import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OptData } from '../domain/types';
import { OptProvider } from '../state/OptContext';
import type { StorageLike } from '../storage/optStorage';
import { SettingsPanel } from './SettingsPanel';

class MapStorage implements StorageLike {
  constructor(private readonly values = new Map<string, string>()) {}
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SettingsPanel', () => {
  it('changes review time and disables reminders immediately', async () => {
    const storage = renderSettings();
    expect(screen.getByRole('switch')).toHaveTextContent('回顾提醒：开启');
    fireEvent.change(screen.getByLabelText('每日回顾时间'), {
      target: { value: '20:45' },
    });
    await userEvent.click(screen.getByRole('switch', { name: /回顾提醒/ }));

    expect(readSettings(storage)).toMatchObject({
      reviewTime: '20:45',
      reminderEnabled: false,
    });
    expect(screen.getByRole('switch')).toHaveTextContent('回顾提醒：关闭');
  });

  it('requests notification permission only after an explicit click', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    stubNotification('default', requestPermission);
    const storage = renderSettings(dataWithPreference('default'));

    expect(requestPermission).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: '开启浏览器通知' }),
    );

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(readSettings(storage).notificationPreference).toBe('granted');
    expect(screen.getByText('浏览器通知已开启')).toBeInTheDocument();
  });

  it('disables notification permission control while the request is pending', async () => {
    let resolvePermission!: (permission: NotificationPermission) => void;
    const requestPermission = vi.fn(
      () =>
        new Promise<NotificationPermission>((resolve) => {
          resolvePermission = resolve;
        }),
    );
    stubNotification('default', requestPermission);
    renderSettings(dataWithPreference('default'));

    const control = screen.getByRole('button', { name: '开启浏览器通知' });
    await userEvent.click(control);

    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleName('正在开启浏览器通知');

    act(() => resolvePermission('granted'));
    await waitFor(() =>
      expect(screen.getByText('浏览器通知已开启')).toBeInTheDocument(),
    );
  });

  it('announces a notification permission failure and allows retrying', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('blocked'));
    stubNotification('default', requestPermission);
    renderSettings(dataWithPreference('default'));

    await userEvent.click(
      screen.getByRole('button', { name: '开启浏览器通知' }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      '未能开启浏览器通知，请重试',
    );
    expect(
      screen.getByRole('button', { name: '开启浏览器通知' }),
    ).toBeEnabled();
  });

  it('moves focus into the modal and wraps focus with Shift+Tab', async () => {
    stubNotification('default', vi.fn());
    renderSettings(dataWithPreference('default'));

    const close = screen.getByRole('button', { name: '关闭设置' });
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(
      screen.getByRole('button', { name: '开启浏览器通知' }),
    ).toHaveFocus();
  });

  it('shows unsupported and denied notification states without requesting again', async () => {
    const unsupported = renderSettings(dataWithPreference('unsupported'));
    expect(screen.getByText('此浏览器不支持通知')).toBeInTheDocument();
    unsupported.view.unmount();

    const requestPermission = vi.fn();
    stubNotification('denied', requestPermission);
    renderSettings(dataWithPreference('denied'));
    expect(screen.getByText('通知已被浏览器阻止')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '开启浏览器通知' }),
    ).not.toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('closes from its button, Escape, and only the outside overlay', async () => {
    const onClose = vi.fn();
    const first = renderSettings(undefined, onClose);
    await userEvent.click(screen.getByRole('button', { name: '关闭设置' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    first.view.unmount();

    const secondClose = vi.fn();
    const second = renderSettings(undefined, secondClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(secondClose).toHaveBeenCalledTimes(1);
    second.view.unmount();

    const outsideClose = vi.fn();
    renderSettings(undefined, outsideClose);
    await userEvent.click(screen.getByRole('dialog'));
    expect(outsideClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('settings-overlay'));
    expect(outsideClose).toHaveBeenCalledTimes(1);
  });
});

function renderSettings(data?: OptData, onClose = vi.fn()) {
  const storage = new MapStorage(
    data ? new Map([['opt:data', JSON.stringify(data)]]) : undefined,
  );
  const view = render(
    <OptProvider storage={storage} now={() => new Date(2026, 8, 4, 8)}>
      <SettingsPanel onClose={onClose} />
    </OptProvider>,
  );
  return Object.assign(storage, { view });
}

function dataWithPreference(
  notificationPreference: OptData['settings']['notificationPreference'],
): OptData {
  return {
    version: 1,
    choices: [],
    days: {},
    settings: {
      reviewTime: '21:30',
      reminderEnabled: true,
      notificationPreference,
      historyHintSeen: false,
      latestSeenDate: '2026-09-04',
    },
  };
}

function readSettings(storage: StorageLike): OptData['settings'] {
  return (JSON.parse(storage.getItem('opt:data') ?? '') as OptData).settings;
}

function stubNotification(
  permission: NotificationPermission,
  requestPermission: () => Promise<NotificationPermission>,
) {
  vi.stubGlobal('Notification', {
    permission,
    requestPermission,
  });
}
