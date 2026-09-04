import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChoiceStatus, OptData } from '../domain/types';
import { OptProvider } from '../state/OptContext';
import type { StorageLike } from '../storage/optStorage';
import { Timeline } from '../components/Timeline';
import { TodayPage } from './TodayPage';

class MapStorage implements StorageLike {
  constructor(private readonly values = new Map<string, string>()) {}

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

const NOW = new Date(2026, 8, 4, 8, 5);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TodayPage', () => {
  it('focuses the one-line composer and adds trimmed text with Enter', async () => {
    renderToday();
    const input = screen.getByRole('textbox', { name: '记录此刻的选择' });

    expect(input).toHaveFocus();
    await userEvent.type(input, '  躺在床上玩手机  {enter}');

    expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('keeps blank input and does not create a row', async () => {
    renderToday();
    const input = screen.getByRole('textbox', { name: '记录此刻的选择' });

    await userEvent.type(input, '   {enter}');

    expect(input).toHaveValue('   ');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('shows only today in chronological minimal rows and clears a judged marker', async () => {
    renderToday({
      data: dataWithChoices([
        ['later', '稍后的选择', '2026-09-04T02:00:00.000Z', 'green'],
        ['past', '昨天的选择', '2026-09-03T02:00:00.000Z', 'red'],
        ['earlier', '较早的选择', '2026-09-04T01:00:00.000Z', 'unjudged'],
      ]),
    });

    const rows = screen.getAllByRole('article');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('较早的选择');
    expect(rows[1]).toHaveTextContent('稍后的选择');
    expect(screen.queryByText('昨天的选择')).not.toBeInTheDocument();
    expect(within(rows[0]).getByText('较早的选择')).toBeInTheDocument();
    expect(rows[0].querySelectorAll('time')).toHaveLength(1);
    expect(
      within(rows[0]).getByRole('button', { name: '状态：未判断' }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(rows[1]).getByRole('button', { name: '状态：绿色' }),
    );
    expect(
      within(rows[1]).getByRole('button', { name: '状态：未判断' }),
    ).toBeInTheDocument();
  });

  it('edits from the context menu and undoes deletion', async () => {
    renderToday({ data: dataWithStatuses(['unjudged'], ['喝生椰拿铁']) });
    fireEvent.contextMenu(screen.getByText('喝生椰拿铁'));
    await userEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    const editor = screen.getByRole('textbox', { name: '编辑选择' });
    await userEvent.clear(editor);
    await userEvent.type(editor, '喝黑咖啡{enter}');
    expect(screen.getByText('喝黑咖啡')).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('喝黑咖啡'));
    await userEvent.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(screen.queryByText('喝黑咖啡')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '撤销删除' }));
    expect(screen.getByText('喝黑咖啡')).toBeInTheDocument();
  });

  it('opens the edit menu after a stationary 600ms pointer hold', () => {
    vi.useFakeTimers();
    renderToday({ data: dataWithStatuses(['unjudged']) });
    const row = screen.getByRole('article');
    expect(row).toHaveClass('choice-row--horizontal-decision');

    fireEvent(row, pointerEvent('pointerdown', 20, 20));
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByRole('menuitem', { name: '编辑' })).toBeInTheDocument();
  });

  it('cancels the long-press menu after moving more than eight pixels', () => {
    vi.useFakeTimers();
    renderToday({ data: dataWithStatuses(['unjudged']) });
    const row = screen.getByRole('article');

    fireEvent(row, pointerEvent('pointerdown', 20, 20));
    fireEvent(row, pointerEvent('pointermove', 29, 20));
    act(() => vi.advanceTimersByTime(600));

    expect(screen.queryByRole('menuitem', { name: '编辑' })).not.toBeInTheDocument();
  });

  it('cancels the long-press menu when the pointer leaves the row', () => {
    vi.useFakeTimers();
    renderToday({ data: dataWithStatuses(['unjudged']) });
    const row = screen.getByRole('article');

    fireEvent(row, pointerEvent('pointerdown', 20, 20));
    fireEvent.pointerLeave(row);
    act(() => vi.advanceTimersByTime(600));

    expect(screen.queryByRole('menuitem', { name: '编辑' })).not.toBeInTheDocument();
  });

  it('moves focus into the keyboard context menu and closes it with Escape', () => {
    renderToday({ data: dataWithStatuses(['unjudged']) });
    const row = screen.getByRole('article');
    row.focus();

    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menuitem', { name: '编辑' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: '删除' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it('does not start a row long-press from the status button', async () => {
    vi.useFakeTimers();
    renderToday({ data: dataWithStatuses(['green']) });
    const status = screen.getByRole('button', { name: '状态：绿色' });

    fireEvent(status, pointerEvent('pointerdown', 20, 20));
    act(() => vi.advanceTimersByTime(600));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.click(status);
    expect(screen.getByRole('button', { name: '状态：未判断' })).toBeInTheDocument();
  });

  it('judges a row from horizontal drag and focused keyboard arrows only', () => {
    renderToday({ data: dataWithStatuses(['unjudged']) });
    const row = screen.getByRole('article');

    fireEvent(row, pointerEvent('pointerdown', 100, 100));
    fireEvent(row, pointerEvent('pointermove', 180, 100));
    fireEvent(row, pointerEvent('pointerup', 180, 100));
    expect(
      screen.getByRole('button', { name: '状态：绿色' }),
    ).toBeInTheDocument();

    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(
      screen.getByRole('button', { name: '状态：红色' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole('button', { name: '状态：红色' }),
      { key: 'ArrowRight' },
    );
    expect(
      screen.getByRole('button', { name: '状态：红色' }),
    ).toBeInTheDocument();
  });

  it('restores row focus after keyboard editing and closes an empty edit on blur', async () => {
    renderToday({ data: dataWithStatuses(['unjudged'], ['原始文字']) });
    const row = screen.getByRole('article');
    fireEvent.contextMenu(row);
    await userEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    const editor = screen.getByRole('textbox', { name: '编辑选择' });
    await userEvent.clear(editor);
    await userEvent.type(editor, '新文字{enter}');
    expect(row).toHaveFocus();
    expect(screen.getByText('新文字')).toBeInTheDocument();

    fireEvent.contextMenu(row);
    await userEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    await userEvent.clear(screen.getByRole('textbox', { name: '编辑选择' }));
    fireEvent.blur(screen.getByRole('textbox', { name: '编辑选择' }));
    expect(screen.queryByRole('textbox', { name: '编辑选择' })).not.toBeInTheDocument();
    expect(screen.getByText('新文字')).toBeInTheDocument();
  });

  it('keeps Timeline rows inert in read-only mode', () => {
    const data = dataWithStatuses(['green'], ['历史选择']);
    const storage = new MapStorage(
      new Map([['opt:data', JSON.stringify(data)] as [string, string]]),
    );
    render(
      <OptProvider storage={storage} now={() => NOW}>
        <Timeline choices={data.choices} readOnly />
      </OptProvider>,
    );
    const row = screen.getByRole('article');
    const status = screen.getByRole('button', { name: '状态：绿色' });

    expect(row).not.toHaveAttribute('tabindex');
    expect(status).toBeDisabled();
    fireEvent.contextMenu(row);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(status);
    expect(screen.getByRole('button', { name: '状态：绿色' })).toBeDisabled();
  });

  it('shows visual proportions and exact textual totals', () => {
    renderToday({ data: dataWithStatuses(['green', 'red', 'unjudged']) });

    expect(screen.getByText('1 绿 · 1 红 · 1 未判断')).toBeInTheDocument();
    expect(screen.getByTestId('ratio-green')).toHaveStyle({ width: `${100 / 3}%` });
    expect(screen.getByTestId('ratio-red')).toHaveStyle({ width: `${100 / 3}%` });
    expect(screen.getByTestId('ratio-unjudged')).toHaveStyle({ width: `${100 / 3}%` });
  });

  it('starts with the daily note collapsed and autosaves it on blur', async () => {
    const storage = renderToday();
    expect(
      screen.queryByRole('textbox', { name: '今日随记内容' }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '今日随记' }));
    const note = screen.getByRole('textbox', { name: '今日随记内容' });
    await userEvent.type(note, '今天更留意起床后的选择');
    fireEvent.blur(note);

    expect(readSavedData(storage).days['2026-09-04']?.note).toBe(
      '今天更留意起床后的选择',
    );
  });

  it('does not carry an unblurred note draft across midnight', () => {
    vi.useFakeTimers();
    let current = new Date(2026, 8, 4, 23, 59);
    const storage = new MapStorage();
    render(
      <OptProvider storage={storage} now={() => current}>
        <TodayPage
          onOpenReview={vi.fn()}
          onOpenHistory={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </OptProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '今日随记' }));
    fireEvent.change(screen.getByRole('textbox', { name: '今日随记内容' }), {
      target: { value: '昨天尚未保存的草稿' },
    });

    current = new Date(2026, 8, 5, 0, 1);
    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.getByRole('textbox', { name: '今日随记内容' })).toHaveValue('');
    expect(readSavedData(storage).days['2026-09-04']).toBeUndefined();
  });

  it('always exposes review, history, and settings entry callbacks', async () => {
    const onOpenReview = vi.fn();
    const onOpenHistory = vi.fn();
    const onOpenSettings = vi.fn();
    renderToday({ onOpenReview, onOpenHistory, onOpenSettings });

    await userEvent.click(screen.getByRole('button', { name: '开始回顾' }));
    await userEvent.click(screen.getByRole('button', { name: '过往' }));
    await userEvent.click(screen.getByRole('button', { name: '设置' }));

    expect(onOpenReview).toHaveBeenCalledOnce();
    expect(onOpenHistory).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('shows the history gesture hint once and opens history after pull-and-hold', () => {
    vi.useFakeTimers();
    const onOpenHistory = vi.fn();
    const storage = renderToday({ onOpenHistory });
    const page = screen.getByTestId('history-pull-zone');

    expect(screen.getByText('下拉并停留，查看过往')).toBeInTheDocument();
    fireEvent(page, pointerEventWithId('pointerdown', 1, 0, 0));
    fireEvent(page, pointerEventWithId('pointermove', 1, 0, 70));
    act(() => vi.advanceTimersByTime(500));

    expect(onOpenHistory).toHaveBeenCalledOnce();
    expect(readSavedData(storage).settings.historyHintSeen).toBe(true);
  });

  it('keeps an always-available history text fallback after the hint is dismissed', async () => {
    const data = dataWithStatuses([]);
    data.settings.historyHintSeen = true;
    const onOpenHistory = vi.fn();
    renderToday({ data, onOpenHistory });

    expect(screen.queryByText('下拉并停留，查看过往')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '过往' }));

    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it('keeps an in-memory choice visible and reports save failure', async () => {
    renderToday({ storage: new WriteFailingStorage() });

    await userEvent.type(
      screen.getByRole('textbox', { name: '记录此刻的选择' }),
      '无法保存但仍可见{enter}',
    );

    expect(screen.getByText('无法保存但仍可见')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('未能保存到此浏览器');
  });

  it('preserves corrupt data until an explicit reset starts a new record', async () => {
    const storage = new MapStorage(new Map([['opt:data', '{bad-json']]));
    renderToday({ storage });

    expect(screen.getByText('本地记录无法读取，原始数据尚未更改')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: '记录此刻的选择' }),
    ).not.toBeInTheDocument();
    expect(storage.getItem('opt:data')).toBe('{bad-json');

    await userEvent.click(
      screen.getByRole('button', { name: '开始新的本地记录' }),
    );

    expect(
      screen.getByRole('textbox', { name: '记录此刻的选择' }),
    ).toBeInTheDocument();
    expect(JSON.parse(storage.getItem('opt:data') ?? '')).toMatchObject({
      version: 1,
      choices: [],
    });
  });
});

interface RenderOptions {
  data?: OptData;
  storage?: StorageLike;
  onOpenReview?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

function renderToday(options: RenderOptions = {}): MapStorage | StorageLike {
  const storage =
    options.storage ??
    new MapStorage(
      options.data
        ? new Map([['opt:data', JSON.stringify(options.data)]])
        : undefined,
    );
  render(
    <OptProvider storage={storage} now={() => NOW}>
      <TodayPage
        onOpenReview={options.onOpenReview ?? vi.fn()}
        onOpenHistory={options.onOpenHistory ?? vi.fn()}
        onOpenSettings={options.onOpenSettings ?? vi.fn()}
      />
    </OptProvider>,
  );
  return storage;
}

function readSavedData(storage: StorageLike): OptData {
  return JSON.parse(storage.getItem('opt:data') ?? '') as OptData;
}

function dataWithStatuses(
  statuses: ChoiceStatus[],
  texts = statuses.map((_, index) => `选择 ${index + 1}`),
): OptData {
  return dataWithChoices(
    statuses.map((status, index) => [
      `choice-${index}`,
      texts[index],
      `2026-09-04T0${index}:00:00.000Z`,
      status,
    ]),
  );
}

function dataWithChoices(
  definitions: [string, string, string, ChoiceStatus][],
): OptData {
  return {
    version: 1,
    choices: definitions.map(([id, text, occurredAt, status]) => ({
      id,
      text,
      occurredAt,
      localDate: occurredAt.slice(0, 10),
      status,
      judgedAt: status === 'unjudged' ? null : occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    })),
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

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

function pointerEventWithId(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}
