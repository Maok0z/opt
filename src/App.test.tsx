import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Choice, OptData } from './domain/types';
import { OptProvider } from './state/OptContext';
import type { StorageLike } from './storage/optStorage';
import { App } from './App';

class MapStorage implements StorageLike {
  constructor(private readonly values = new Map<string, string>()) {}
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('starts on Today and navigates to Review and back with Escape', async () => {
    renderApp(dataWithChoices([choice('today', '今天的选择', '2026-09-04')]));
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '开始回顾' }));
    expect(screen.getByTestId('review-screen')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();
  });

  it('opens History and returns through its Escape behavior', async () => {
    renderApp(dataWithChoices([choice('past', '昨天的选择', '2026-09-03')]));
    await userEvent.click(screen.getByRole('button', { name: '过往' }));
    expect(screen.getByRole('heading', { name: '过往' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();
  });

  it('uses browser popstate to leave Review', async () => {
    renderApp(dataWithChoices([choice('today', '今天的选择', '2026-09-04')]));
    await userEvent.click(screen.getByRole('button', { name: '开始回顾' }));
    expect(screen.getByTestId('review-screen')).toBeInTheDocument();

    fireEvent.popState(window);
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();
  });

  it('shows Settings as an overlay without losing the Today draft', async () => {
    renderApp();
    const composer = screen.getByRole('textbox', { name: '记录此刻的选择' });
    await userEvent.type(composer, '还没有按回车的选择');
    await userEvent.click(screen.getByRole('button', { name: '设置' }));

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '关闭设置' }));
    expect(composer).toHaveValue('还没有按回车的选择');
  });

  it('shows a due reminder that can start Review or be dismissed for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 21, 30));
    const data = dataWithChoices([
      choice('today', '等待回顾的选择', '2026-09-04'),
    ]);
    data.settings.reminderEnabled = true;
    renderApp(data);

    expect(screen.getByRole('status')).toHaveTextContent('该回顾今天的选择了');
    fireEvent.click(screen.getByRole('button', { name: '今天稍后再说' }));
    expect(screen.queryByText('该回顾今天的选择了')).not.toBeInTheDocument();
  });

  it('starts Review from the due reminder action', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 21, 30));
    const data = dataWithChoices([
      choice('today', '等待回顾的选择', '2026-09-04'),
    ]);
    data.settings.reminderEnabled = true;
    renderApp(data);

    fireEvent.click(screen.getAllByRole('button', { name: '开始回顾' })[0]);
    expect(screen.getByTestId('review-screen')).toBeInTheDocument();
  });

  it('reconciles stored notification state with the browser permission', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 21, 30));
    const delivered: string[] = [];
    class NotificationStub {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn();
      constructor(message: string) {
        delivered.push(message);
      }
    }
    vi.stubGlobal('Notification', NotificationStub);
    const data = dataWithChoices([
      choice('today', '等待回顾的选择', '2026-09-04'),
    ]);
    data.settings.reminderEnabled = true;
    data.settings.notificationPreference = 'default';

    const { storage } = renderApp(data);

    expect(delivered).toEqual(['该回顾今天的选择了']);
    expect(
      (JSON.parse(storage.getItem('opt:data') ?? '') as OptData).settings
        .notificationPreference,
    ).toBe('granted');
  });
});

function renderApp(data = dataWithChoices([])) {
  const storage = new MapStorage(
    new Map([['opt:data', JSON.stringify(data)]]),
  );
  const view = render(
    <OptProvider storage={storage} now={() => new Date(2026, 8, 4, 12)}>
      <App />
    </OptProvider>,
  );
  return { ...view, storage };
}

function dataWithChoices(choices: Choice[]): OptData {
  return {
    version: 1,
    choices,
    days: {},
    settings: {
      reviewTime: '21:30',
      reminderEnabled: false,
      notificationPreference: 'unsupported',
      historyHintSeen: false,
      latestSeenDate: '2026-09-04',
    },
  };
}

function choice(id: string, text: string, localDate: string): Choice {
  const occurredAt = `${localDate}T08:00:00.000Z`;
  return {
    id,
    text,
    occurredAt,
    localDate,
    status: 'unjudged',
    judgedAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}
