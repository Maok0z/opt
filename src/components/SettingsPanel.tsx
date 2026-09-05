import {
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

const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { data, updateSettings } = useOpt();
  const [notificationState, setNotificationState] =
    useState<Settings['notificationPreference']>(readNotificationState);
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      for (const element of background) element.removeAttribute('inert');
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const closeOutside = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
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
        <header>
          <h2 id="settings-title">设置</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            关闭设置
          </button>
        </header>

        <label>
          每日回顾时间
          <input
            aria-label="每日回顾时间"
            type="time"
            value={data.settings.reviewTime}
            onChange={(event) => {
              if (VALID_TIME.test(event.currentTarget.value)) {
                updateSettings({ reviewTime: event.currentTarget.value });
              }
            }}
          />
        </label>

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
          回顾提醒：{data.settings.reminderEnabled ? '开启' : '关闭'}
        </button>

        <div aria-live="polite">
          <NotificationControl
            state={notificationState}
            pending={notificationPending}
            error={notificationError}
            onRequest={requestNotifications}
          />
        </div>
      </section>
    </div>
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
