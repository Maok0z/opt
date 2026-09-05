import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../domain/types';
import { useReviewReminder } from './useReviewReminder';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useReviewReminder', () => {
  it('becomes due at the configured local time when unjudged choices exist', () => {
    const { result } = renderHook(() =>
      useReviewReminder({
        settings: enabledAt('21:30'),
        unjudgedCount: 2,
        now: () => new Date(2026, 8, 4, 21, 30),
        notify: vi.fn(),
      }),
    );

    expect(result.current.due).toBe(true);
  });

  it('stays quiet while disabled or when no choices remain', () => {
    const disabled = renderHook(() =>
      useReviewReminder({
        settings: { ...enabledAt('21:30'), reminderEnabled: false },
        unjudgedCount: 2,
        now: () => new Date(2026, 8, 4, 22),
        notify: vi.fn(),
      }),
    );
    const empty = renderHook(() =>
      useReviewReminder({
        settings: enabledAt('21:30'),
        unjudgedCount: 0,
        now: () => new Date(2026, 8, 4, 22),
        notify: vi.fn(),
      }),
    );

    expect(disabled.result.current.due).toBe(false);
    expect(empty.result.current.due).toBe(false);
  });

  it('dismisses only the current local date and becomes due again tomorrow', () => {
    vi.useFakeTimers();
    let current = new Date(2026, 8, 4, 22);
    const { result } = renderHook(() =>
      useReviewReminder({
        settings: enabledAt('21:30'),
        unjudgedCount: 1,
        now: () => current,
        notify: vi.fn(),
      }),
    );

    act(() => result.current.dismissForToday());
    expect(result.current.due).toBe(false);

    current = new Date(2026, 8, 5, 21, 30);
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.due).toBe(true);
  });

  it('sends one granted browser notification per local date', () => {
    vi.useFakeTimers();
    let current = new Date(2026, 8, 4, 21, 30);
    const notify = vi.fn();
    renderHook(() =>
      useReviewReminder({
        settings: {
          ...enabledAt('21:30'),
          notificationPreference: 'granted',
        },
        unjudgedCount: 1,
        now: () => current,
        notify,
      }),
    );

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('该回顾今天的选择了');
    act(() => vi.advanceTimersByTime(90_000));
    expect(notify).toHaveBeenCalledTimes(1);

    current = new Date(2026, 8, 5, 21, 30);
    act(() => vi.advanceTimersByTime(30_000));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it.each(['default', 'denied', 'unsupported'] as const)(
    'does not notify when permission is %s',
    (notificationPreference) => {
      const notify = vi.fn();
      renderHook(() =>
        useReviewReminder({
          settings: { ...enabledAt('21:30'), notificationPreference },
          unjudgedCount: 1,
          now: () => new Date(2026, 8, 4, 22),
          notify,
        }),
      );

      expect(notify).not.toHaveBeenCalled();
    },
  );

  it('rechecks when the page becomes visible', () => {
    let current = new Date(2026, 8, 4, 21, 29);
    const { result } = renderHook(() =>
      useReviewReminder({
        settings: enabledAt('21:30'),
        unjudgedCount: 1,
        now: () => current,
        notify: vi.fn(),
      }),
    );
    expect(result.current.due).toBe(false);

    current = new Date(2026, 8, 4, 21, 30);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.due).toBe(true);
  });
});

function enabledAt(reviewTime: string): Settings {
  return {
    reviewTime,
    reminderEnabled: true,
    notificationPreference: 'default',
    historyHintSeen: false,
    latestSeenDate: '2026-09-04',
  };
}
