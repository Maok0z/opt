import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OptData } from '../domain/types';
import type { StorageLike } from '../storage/optStorage';
import { OptProvider, useOpt } from './OptContext';

class MapStorage implements StorageLike {
  protected readonly values: Map<string, string>;

  constructor(entries: [string, string][] = []) {
    this.values = new Map(entries);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class WriteFailingStorage extends MapStorage {
  override setItem(): void {
    throw new Error('quota exceeded');
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('OptProvider', () => {
  it('adds a choice, persists it, and restores it after remount', async () => {
    const storage = new MapStorage();
    const now = () => new Date(2026, 8, 4, 8, 5);
    const first = render(
      <OptProvider storage={storage} now={now}>
        <Probe />
      </OptProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'add-test-choice' }),
    );
    expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();

    first.unmount();
    render(
      <OptProvider storage={storage} now={now}>
        <Probe />
      </OptProvider>,
    );
    expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
  });

  it('refuses mutations for dates earlier than the monotonic editable date', async () => {
    const storage = seededStorageWithYesterdayChoice();
    render(
      <OptProvider
        storage={storage}
        now={() => new Date(2026, 8, 4, 8)}
      >
        <Probe />
      </OptProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'judge-yesterday' }),
    );
    expect(screen.getByTestId('yesterday-status')).toHaveTextContent(
      'unjudged',
    );
  });

  it('does not overwrite corrupt source data until the user explicitly resets it', async () => {
    const storage = new MapStorage([['opt:data', '{bad-json']]);
    render(
      <OptProvider
        storage={storage}
        now={() => new Date(2026, 8, 4, 8)}
      >
        <Probe />
      </OptProvider>,
    );

    expect(screen.getByTestId('corrupt-data')).toHaveTextContent('{bad-json');
    expect(storage.getItem('opt:data')).toBe('{bad-json');
    await userEvent.click(
      screen.getByRole('button', { name: 'add-test-choice' }),
    );
    expect(storage.getItem('opt:data')).toBe('{bad-json');

    await userEvent.click(
      screen.getByRole('button', { name: 'reset-corrupt-data' }),
    );
    expect(JSON.parse(storage.getItem('opt:data') ?? '')).toMatchObject({
      version: 1,
      choices: [],
    });
    expect(screen.getByTestId('corrupt-data')).toBeEmptyDOMElement();
  });

  it('updates current data and restores the most recently deleted choice', async () => {
    const storage = seededStorageWithTodayChoice();
    render(
      <OptProvider
        storage={storage}
        now={() => new Date(2026, 8, 4, 21, 30)}
      >
        <Probe />
      </OptProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'update-today' }));
    await userEvent.click(screen.getByRole('button', { name: 'judge-today' }));
    expect(screen.getByTestId('today-choice')).toHaveTextContent('喝黑咖啡');
    expect(screen.getByTestId('today-status')).toHaveTextContent('green');

    await userEvent.click(screen.getByRole('button', { name: 'save-note' }));
    await userEvent.click(screen.getByRole('button', { name: 'update-settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'mark-hint' }));
    expect(screen.getByTestId('today-note')).toHaveTextContent('今天的随记');
    expect(screen.getByTestId('review-time')).toHaveTextContent('20:45');
    expect(screen.getByTestId('history-hint')).toHaveTextContent('true');

    await userEvent.click(screen.getByRole('button', { name: 'delete-today' }));
    expect(screen.queryByTestId('today-choice')).not.toBeInTheDocument();
    expect(screen.getByTestId('last-deleted')).toHaveTextContent('喝黑咖啡');
    await userEvent.click(screen.getByRole('button', { name: 'undo-delete' }));
    expect(screen.getByTestId('today-choice')).toHaveTextContent('喝黑咖啡');
    expect(screen.getByTestId('last-deleted')).toBeEmptyDOMElement();
  });

  it('keeps a successful in-memory mutation visible when persistence fails', async () => {
    const storage = new WriteFailingStorage();
    render(
      <OptProvider
        storage={storage}
        now={() => new Date(2026, 8, 4, 8)}
      >
        <Probe />
      </OptProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'add-test-choice' }),
    );
    expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
    expect(screen.getByTestId('save-error')).toHaveTextContent('true');
  });

  it('advances the editable date every 30 seconds and never unlocks it after clock rollback', () => {
    vi.useFakeTimers();
    let current = new Date(2026, 8, 4, 23, 59);
    const storage = new MapStorage();
    render(
      <OptProvider storage={storage} now={() => current}>
        <Probe />
      </OptProvider>,
    );
    expect(screen.getByTestId('editable-date')).toHaveTextContent(
      '2026-09-04',
    );

    current = new Date(2026, 8, 5, 0, 1);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId('editable-date')).toHaveTextContent(
      '2026-09-05',
    );

    current = new Date(2026, 8, 4, 12);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId('editable-date')).toHaveTextContent(
      '2026-09-05',
    );
    expect(
      JSON.parse(storage.getItem('opt:data') ?? '').settings.latestSeenDate,
    ).toBe('2026-09-05');
  });

  it('persists the advanced editable date when a mutation happens before the midnight timer', async () => {
    let current = new Date(2026, 8, 4, 23, 59);
    const storage = new MapStorage();
    const first = render(
      <OptProvider storage={storage} now={() => current}>
        <Probe />
      </OptProvider>,
    );

    current = new Date(2026, 8, 5, 0, 1);
    await userEvent.click(
      screen.getByRole('button', { name: 'add-test-choice' }),
    );
    expect(
      JSON.parse(storage.getItem('opt:data') ?? '').settings.latestSeenDate,
    ).toBe('2026-09-05');

    first.unmount();
    current = new Date(2026, 8, 4, 12);
    render(
      <OptProvider storage={storage} now={() => current}>
        <Probe />
      </OptProvider>,
    );
    expect(screen.getByTestId('editable-date')).toHaveTextContent(
      '2026-09-05',
    );
  });

  it('starts with defaults and a save error when the localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage access denied');
    });

    expect(() =>
      render(
        <OptProvider now={() => new Date(2026, 8, 4, 8)}>
          <Probe />
        </OptProvider>,
      ),
    ).not.toThrow();
    expect(screen.getByTestId('editable-date')).toHaveTextContent(
      '2026-09-04',
    );
    expect(screen.getByTestId('save-error')).toHaveTextContent('true');
  });

  it('updates, judges, and deletes only one matching record defensively', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000000',
    );
    render(
      <OptProvider
        storage={new MapStorage()}
        now={() => new Date(2026, 8, 4, 8)}
      >
        <CollisionProbe />
      </OptProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'add-first' }));
    await userEvent.click(screen.getByRole('button', { name: 'add-second' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'update-collision' }),
    );
    expect(screen.getByTestId('collision-0')).toHaveTextContent(
      'updated:unjudged',
    );
    expect(screen.getByTestId('collision-1')).toHaveTextContent(
      'second:unjudged',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'judge-collision' }),
    );
    expect(screen.getByTestId('collision-0')).toHaveTextContent(
      'updated:green',
    );
    expect(screen.getByTestId('collision-1')).toHaveTextContent(
      'second:unjudged',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'delete-collision' }),
    );
    expect(screen.queryByTestId('collision-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('collision-0')).toHaveTextContent(
      'second:unjudged',
    );
  });
});

function Probe() {
  const opt = useOpt();
  const today = opt.data.choices.find(
    (choice) => choice.localDate === '2026-09-04',
  );
  const yesterday = opt.data.choices.find(
    (choice) => choice.localDate === '2026-09-03',
  );

  return (
    <>
      <div data-testid="editable-date">{opt.editableDate}</div>
      <div data-testid="save-error">{String(opt.saveError)}</div>
      <div data-testid="corrupt-data">{opt.corruptData ?? ''}</div>
      <div data-testid="last-deleted">{opt.lastDeleted?.text ?? ''}</div>
      <div data-testid="today-note">
        {opt.data.days['2026-09-04']?.note ?? ''}
      </div>
      <div data-testid="review-time">{opt.data.settings.reviewTime}</div>
      <div data-testid="history-hint">
        {String(opt.data.settings.historyHintSeen)}
      </div>
      {today && (
        <>
          <div data-testid="today-choice">{today.text}</div>
          <div data-testid="today-status">{today.status}</div>
        </>
      )}
      {yesterday && (
        <div data-testid="yesterday-status">{yesterday.status}</div>
      )}
      <button onClick={() => opt.addChoice('躺在床上玩手机')}>
        add-test-choice
      </button>
      <button onClick={() => opt.updateChoiceText('today', '喝黑咖啡')}>
        update-today
      </button>
      <button onClick={() => opt.judgeChoice('today', 'green')}>
        judge-today
      </button>
      <button onClick={() => opt.judgeChoice('yesterday', 'green')}>
        judge-yesterday
      </button>
      <button onClick={() => opt.deleteChoice('today')}>delete-today</button>
      <button onClick={opt.undoDelete}>undo-delete</button>
      <button onClick={() => opt.setDailyNote('今天的随记')}>save-note</button>
      <button onClick={() => opt.updateSettings({ reviewTime: '20:45' })}>
        update-settings
      </button>
      <button onClick={opt.markHistoryHintSeen}>mark-hint</button>
      <button onClick={opt.resetCorruptData}>reset-corrupt-data</button>
    </>
  );
}

function CollisionProbe() {
  const opt = useOpt();
  const firstId = opt.data.choices[0]?.id;

  return (
    <>
      {opt.data.choices.map((choice, index) => (
        <div data-testid={`collision-${index}`} key={`${index}-${choice.id}`}>
          {choice.text}:{choice.status}
        </div>
      ))}
      <button onClick={() => opt.addChoice('first')}>add-first</button>
      <button onClick={() => opt.addChoice('second')}>add-second</button>
      <button
        onClick={() =>
          firstId && opt.updateChoiceText(firstId, 'updated')
        }
      >
        update-collision
      </button>
      <button
        onClick={() => firstId && opt.judgeChoice(firstId, 'green')}
      >
        judge-collision
      </button>
      <button onClick={() => firstId && opt.deleteChoice(firstId)}>
        delete-collision
      </button>
    </>
  );
}

function seededStorageWithYesterdayChoice(): MapStorage {
  return new MapStorage([
    ['opt:data', JSON.stringify(dataWithChoice('yesterday', '2026-09-03'))],
  ]);
}

function seededStorageWithTodayChoice(): MapStorage {
  return new MapStorage([
    ['opt:data', JSON.stringify(dataWithChoice('today', '2026-09-04'))],
  ]);
}

function dataWithChoice(id: string, localDate: string): OptData {
  const timestamp = `${localDate}T00:05:00.000Z`;
  return {
    version: 1,
    choices: [
      {
        id,
        text: '喝生椰拿铁',
        occurredAt: timestamp,
        localDate,
        status: 'unjudged',
        judgedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    days: {},
    settings: {
      reviewTime: '21:30',
      reminderEnabled: true,
      notificationPreference: 'unsupported',
      historyHintSeen: false,
      latestSeenDate: '2026-09-04',
    },
  };
}
