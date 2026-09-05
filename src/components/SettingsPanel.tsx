import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import type { Settings } from '../domain/types';
import { useOpt } from '../state/OptContext';

interface SettingsPanelProps {
  onClose(): void;
}

const CLOSE_TRANSITION_MS = 180;
const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0'),
);
const MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, '0'),
);

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { data, updateSettings } = useOpt();
  const [notificationState, setNotificationState] =
    useState<Settings['notificationPreference']>(readNotificationState);
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [isClosing, setIsClosing] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'time'>('main');
  const [selectedHour, setSelectedHour] = useState(() =>
    data.settings.reviewTime.slice(0, 2),
  );
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, CLOSE_TRANSITION_MS);
  }, [onClose]);

  const selectHour = (hour: string) => {
    setSelectedHour(hour);
    updateSettings({
      reviewTime: `${hour}:${data.settings.reviewTime.slice(3)}`,
    });
  };

  const selectMinute = (minute: string) => {
    updateSettings({ reviewTime: `${selectedHour}:${minute}` });
    setSettingsView('main');
  };

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.opt-app > main, .opt-app > .review-reminder',
      ),
    );
    for (const element of background) element.setAttribute('inert', '');
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (settingsView === 'time') {
        setSettingsView('main');
        return;
      }
      requestClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      for (const element of background) element.removeAttribute('inert');
      previouslyFocused?.focus();
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [requestClose, settingsView]);

  const closeOutside = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  const requestNotifications = async () => {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'default'
    ) {
      return;
    }
    setNotificationError(null);
    setNotificationPending(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      updateSettings({ notificationPreference: permission });
    } catch {
      setNotificationError('未能开启浏览器通知，请重试');
    } finally {
      setNotificationPending(false);
    }
  };

  const keepFocusInDialog = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      data-testid="settings-overlay"
      data-closing={isClosing}
      onClick={closeOutside}
      style={{ position: 'fixed', inset: 0 }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={keepFocusInDialog}
      >
        {settingsView === 'time' ? (
          <TimeSettingsPage
            reviewTime={data.settings.reviewTime}
            selectedHour={selectedHour}
            onBack={() => setSettingsView('main')}
            onSelectHour={selectHour}
            onSelectMinute={selectMinute}
          />
        ) : (
          <>
            <header>
              <h2 id="settings-title">设置</h2>
              <button ref={closeButtonRef} type="button" onClick={requestClose}>
                关闭设置
              </button>
            </header>

            <div className="settings-time">
              <span>每日回顾时间</span>
              <button
                className="settings-time__trigger"
                type="button"
                aria-label={`每日回顾时间：${data.settings.reviewTime}`}
                onClick={() => {
                  setSelectedHour(data.settings.reviewTime.slice(0, 2));
                  setSettingsView('time');
                }}
              >
                <span>{data.settings.reviewTime}</span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.25" />
                  <path d="M8 4.75V8l2.2 1.45" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={data.settings.reminderEnabled}
              onClick={() =>
                updateSettings({
                  reminderEnabled: !data.settings.reminderEnabled,
                })
              }
            >
              <span>回顾提醒：{data.settings.reminderEnabled ? '开启' : '关闭'}</span>
              <span className="settings-switch__track" aria-hidden="true">
                <span className="settings-switch__thumb" />
              </span>
            </button>

            <div aria-live="polite">
              <NotificationControl
                state={notificationState}
                pending={notificationPending}
                error={notificationError}
                onRequest={requestNotifications}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TimeSettingsPage({
  reviewTime,
  selectedHour,
  onBack,
  onSelectHour,
  onSelectMinute,
}: {
  reviewTime: string;
  selectedHour: string;
  onBack(): void;
  onSelectHour(hour: string): void;
  onSelectMinute(minute: string): void;
}) {
  const selectedMinute = reviewTime.slice(3);

  return (
    <section className="settings-time-page" aria-labelledby="settings-title">
      <header>
        <button className="settings-time-page__back" type="button" onClick={onBack}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M9.75 3.25 5 8l4.75 4.75M5.5 8H13" />
          </svg>
          返回
        </button>
        <h2 id="settings-title">每日回顾时间</h2>
        <span aria-hidden="true" />
      </header>
      <p className="settings-time-page__value">{reviewTime}</p>
      <div className="settings-time-page__wheels" aria-label="时间选择">
        <div className="settings-time-page__column" aria-label="小时">
          {HOURS.map((hour) => (
            <button
              key={hour}
              type="button"
              aria-label={`${hour} 时`}
              aria-pressed={selectedHour === hour}
              onClick={() => onSelectHour(hour)}
            >
              {hour}
            </button>
          ))}
        </div>
        <span className="settings-time-page__divider" aria-hidden="true">:</span>
        <div className="settings-time-page__column" aria-label="分钟">
          {MINUTES.map((minute) => (
            <button
              key={minute}
              type="button"
              aria-label={`${minute} 分`}
              aria-pressed={selectedMinute === minute}
              onClick={() => onSelectMinute(minute)}
            >
              {minute}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotificationControl({
  state,
  pending,
  error,
  onRequest,
}: {
  state: Settings['notificationPreference'];
  pending: boolean;
  error: string | null;
  onRequest(): void;
}) {
  if (state === 'unsupported') return <p>此浏览器不支持通知</p>;
  if (state === 'denied') return <p>通知已被浏览器阻止</p>;
  if (state === 'granted') return <p>浏览器通知已开启</p>;
  return (
    <>
      {error ? <p role="status">{error}</p> : null}
      <button type="button" disabled={pending} onClick={onRequest}>
        {pending ? '正在开启浏览器通知' : '开启浏览器通知'}
      </button>
    </>
  );
}

function readNotificationState(): Settings['notificationPreference'] {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
