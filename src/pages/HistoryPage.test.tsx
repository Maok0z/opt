import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChoiceStatus, OptData } from '../domain/types';
import { OptProvider } from '../state/OptContext';
import type { StorageLike } from '../storage/optStorage';
import { HistoryPage } from './HistoryPage';

const NOW = new Date(2026, 8, 4, 8, 5);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', window.location.href);
});

describe('HistoryPage', () => {
  it('folds past days newest first with exact counts and expands a read-only timeline', async () => {
    const storage = renderHistory();
    const dayButtons = screen.getAllByRole('button', { name: /2026年9月[23]日/ });

    expect(dayButtons[0]).toHaveAccessibleName('2026年9月3日 · 1 绿 · 1 红 · 1 未判断');
    expect(dayButtons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('昨天的选择')).not.toBeInTheDocument();

    await userEvent.click(dayButtons[0]);
    expect(screen.getByText('昨天的选择')).toBeInTheDocument();
    expect(screen.getByText('昨天随手记下的内容')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '编辑' })).not.toBeInTheDocument();
    const status = screen.getByRole('button', { name: '状态：未判断' });
    expect(status).toBeDisabled();

    fireEvent.contextMenu(screen.getByText('昨天的选择'));
    fireEvent.click(status);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(readSavedData(storage).choices.find((choice) => choice.id === 'past-unjudged')?.status).toBe('unjudged');
  });

  it('omits today and empty notes from historical groups', async () => {
    renderHistory();

    expect(screen.queryByRole('button', { name: /2026年9月4日/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /2026年9月2日/ }));
    expect(screen.getByText('更早的选择')).toBeInTheDocument();
    expect(screen.queryByText('昨天随手记下的内容')).not.toBeInTheDocument();
  });

  it('exits through the button without repeating the callback', async () => {
    const onExit = vi.fn();
    renderHistory({ onExit });

    await userEvent.click(screen.getByRole('button', { name: '返回今天' }));
    expect(onExit).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('exits with Escape', () => {
    const onExit = vi.fn();
    renderHistory({ onExit });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onExit).toHaveBeenCalledOnce();
  });

  it('exits after a 100px right swipe', () => {
    const onExit = vi.fn();
    renderHistory({ onExit });
    const page = screen.getByTestId('history-page');

    fireEvent(page, pointerEvent('pointerdown', 1, 10, 50));
    fireEvent(page, pointerEvent('pointerup', 1, 112, 55));

    expect(onExit).toHaveBeenCalledOnce();
  });

  it('adds one browser-history entry and browser Back exits once without an entry loop', async () => {
    const onExit = vi.fn();
    const pushState = vi.spyOn(window.history, 'pushState');
    renderHistory({ onExit });

    expect(pushState).toHaveBeenCalledTimes(1);
    window.history.back();

    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(pushState).toHaveBeenCalledTimes(1);
  });
});

interface RenderOptions {
  onExit?: () => void;
}

function renderHistory(options: RenderOptions = {}): MapStorage {
  const storage = new MapStorage(
    new Map([['opt:data', JSON.stringify(historyData())]]),
  );
  render(
    <OptProvider storage={storage} now={() => NOW}>
      <HistoryPage onExit={options.onExit ?? vi.fn()} />
    </OptProvider>,
  );
  return storage;
}

function historyData(): OptData {
  return {
    version: 1,
    choices: [
      choice('today', '今天的选择', '2026-09-04T01:00:00.000Z', 'green'),
      choice('past-green', '昨天绿色', '2026-09-03T00:00:00.000Z', 'green'),
      choice('past-red', '昨天红色', '2026-09-03T00:30:00.000Z', 'red'),
      choice('past-unjudged', '昨天的选择', '2026-09-03T01:00:00.000Z', 'unjudged'),
      choice('older', '更早的选择', '2026-09-02T01:00:00.000Z', 'unjudged'),
    ],
    days: {
      '2026-09-03': { localDate: '2026-09-03', note: '昨天随手记下的内容' },
      '2026-09-02': { localDate: '2026-09-02', note: '   ' },
      '2026-09-01': { localDate: '2026-09-01', note: '只有随记的历史日' },
    },
    settings: {
      reviewTime: '21:30',
      reminderEnabled: true,
      notificationPreference: 'unsupported',
      historyHintSeen: true,
      latestSeenDate: '2026-09-04',
    },
  };
}

function choice(
  id: string,
  text: string,
  occurredAt: string,
  status: ChoiceStatus,
) {
  return {
    id,
    text,
    occurredAt,
    localDate: occurredAt.slice(0, 10),
    status,
    judgedAt: status === 'unjudged' ? null : occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

class MapStorage implements StorageLike {
  constructor(private readonly values = new Map<string, string>()) {}
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function readSavedData(storage: StorageLike): OptData {
  return JSON.parse(storage.getItem('opt:data') ?? '') as OptData;
}

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}
