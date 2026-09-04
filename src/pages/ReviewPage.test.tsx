import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChoiceStatus, OptData } from '../domain/types';
import { OptProvider } from '../state/OptContext';
import type { StorageLike } from '../storage/optStorage';
import { ReviewPage } from './ReviewPage';

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ReviewPage', () => {
  it('holds the committed green field for 420ms before advancing', () => {
    vi.useFakeTimers();
    renderReviewWithChoices(['第一条', '第二条']);

    expect(screen.getByRole('heading', { name: '第一条' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('review-screen')).toHaveAttribute(
      'data-decision',
      'green',
    );
    expect(screen.getByRole('status')).toHaveTextContent('已判断：绿色');
    expect(screen.getByRole('heading', { name: '第一条' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(419));
    expect(screen.getByRole('heading', { name: '第一条' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('heading', { name: '第二条' })).toBeInTheDocument();
    expect(screen.getByTestId('review-screen')).toHaveAttribute(
      'data-decision',
      'neutral',
    );
  });

  it('commits red from a left drag and exposes proportional drag state', () => {
    vi.useFakeTimers();
    renderReviewWithChoices(['第一条']);
    const screenElement = screen.getByTestId('review-screen');
    expect(screenElement).toHaveClass('review-screen--immersive');

    fireEvent(screenElement, pointerEvent('pointerdown', 1, 200, 100));
    fireEvent(screenElement, pointerEvent('pointermove', 1, 140, 100));
    expect(screenElement).toHaveAttribute('data-drag-direction', 'left');
    expect(screenElement.style.getPropertyValue('--decision-progress')).toBe(
      '-0.5',
    );
    fireEvent(screenElement, pointerEvent('pointerup', 1, 70, 100));

    expect(screenElement).toHaveAttribute('data-decision', 'red');
    expect(readChoiceStatus('第一条')).toBe('red');
  });

  it('exits with the visible control, Escape, or a 100px downward gesture', () => {
    const onExit = vi.fn();
    const view = renderReviewWithChoices(['第一条'], { onExit });
    fireEvent.click(screen.getByRole('button', { name: '退出回顾' }));
    expect(onExit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(2);

    const screenElement = screen.getByTestId('review-screen');
    fireEvent(screenElement, pointerEvent('pointerdown', 3, 100, 40));
    fireEvent(screenElement, pointerEvent('pointerup', 3, 100, 140));
    expect(onExit).toHaveBeenCalledTimes(3);
    view.unmount();
  });

  it('shows current totals without a score when every choice is judged', () => {
    renderReview({
      data: dataWithDefinitions([
        ['green choice', 'green'],
        ['red choice', 'red'],
      ]),
    });

    expect(screen.getByRole('heading', { name: '今天已回顾完' })).toBeInTheDocument();
    expect(
      screen.getByText('共 2 条 · 1 绿 · 1 红 · 0 未判断'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/分数/)).not.toBeInTheDocument();
  });

  it('advances without a hold when reduced motion is requested', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    renderReviewWithChoices(['第一条', '第二条']);

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByRole('heading', { name: '第二条' })).toBeInTheDocument();
  });
});

interface RenderReviewOptions {
  data?: OptData;
  onExit?: () => void;
}

let latestStorage: MapStorage;

function renderReviewWithChoices(
  texts: string[],
  options: Omit<RenderReviewOptions, 'data'> = {},
) {
  return renderReview({
    ...options,
    data: dataWithDefinitions(texts.map((text) => [text, 'unjudged'])),
  });
}

function renderReview(options: RenderReviewOptions = {}) {
  const data = options.data ?? dataWithDefinitions([]);
  latestStorage = new MapStorage(
    new Map([['opt:data', JSON.stringify(data)]]),
  );
  return render(
    <OptProvider storage={latestStorage} now={() => new Date(2026, 8, 4, 21, 30)}>
      <ReviewPage onExit={options.onExit ?? vi.fn()} />
    </OptProvider>,
  );
}

function readChoiceStatus(text: string): ChoiceStatus | undefined {
  const data = JSON.parse(latestStorage.getItem('opt:data') ?? '') as OptData;
  return data.choices.find((choice) => choice.text === text)?.status;
}

function dataWithDefinitions(
  definitions: [string, ChoiceStatus][],
): OptData {
  return {
    version: 1,
    choices: definitions.map(([text, status], index) => {
      const timestamp = `2026-09-04T0${index}:00:00.000Z`;
      return {
        id: `choice-${index}`,
        text,
        occurredAt: timestamp,
        localDate: '2026-09-04',
        status,
        judgedAt: status === 'unjudged' ? null : timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }),
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
