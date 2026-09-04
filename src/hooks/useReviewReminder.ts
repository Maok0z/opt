import { useCallback, useEffect, useRef, useState } from 'react';
import { toLocalDateKey } from '../domain/date';
import type { Settings } from '../domain/types';

interface ReviewReminderOptions {
  settings: Settings;
  unjudgedCount: number;
  now?: () => Date;
  notify?: (message: string) => void;
}

interface ReviewReminderResult {
  due: boolean;
  dismissForToday(): void;
}

export function useReviewReminder({
  settings,
  unjudgedCount,
  now = systemNow,
  notify = browserNotify,
}: ReviewReminderOptions): ReviewReminderResult {
  const [current, setCurrent] = useState(() => now());
  const [dismissedDate, setDismissedDate] = useState<string | null>(null);
  const notifiedDatesRef = useRef(new Set<string>());

  useEffect(() => {
    const refresh = () => setCurrent(now());
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [now]);

  const localDate = toLocalDateKey(current);
  const due =
    settings.reminderEnabled &&
    unjudgedCount > 0 &&
    localTime(current) >= settings.reviewTime &&
    dismissedDate !== localDate;

  useEffect(() => {
    if (
      !due ||
      settings.notificationPreference !== 'granted' ||
      notifiedDatesRef.current.has(localDate)
    ) {
      return;
    }
    notifiedDatesRef.current.add(localDate);
    notify('该回顾今天的选择了');
  }, [due, localDate, notify, settings.notificationPreference]);

  const dismissForToday = useCallback(() => {
    setDismissedDate(toLocalDateKey(now()));
  }, [now]);

  return { due, dismissForToday };
}

function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function systemNow(): Date {
  return new Date();
}

function browserNotify(message: string): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(message);
  }
}
