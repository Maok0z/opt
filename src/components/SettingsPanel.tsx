import { useEffect, useState, type MouseEvent } from 'react';
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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
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
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    updateSettings({ notificationPreference: permission });
  };

  return (
    <div
      data-testid="settings-overlay"
      onClick={closeOutside}
      style={{ position: 'fixed', inset: 0 }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <h2 id="settings-title">设置</h2>
          <button type="button" onClick={onClose}>
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
          回顾提醒
        </button>

        <NotificationControl
          state={notificationState}
          onRequest={requestNotifications}
        />
      </section>
    </div>
  );
}

function NotificationControl({
  state,
  onRequest,
}: {
  state: Settings['notificationPreference'];
  onRequest(): void;
}) {
  if (state === 'unsupported') return <p>此浏览器不支持通知</p>;
  if (state === 'denied') return <p>通知已被浏览器阻止</p>;
  if (state === 'granted') return <p>浏览器通知已开启</p>;
  return (
    <button type="button" onClick={onRequest}>
      开启浏览器通知
    </button>
  );
}

function readNotificationState(): Settings['notificationPreference'] {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
