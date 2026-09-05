import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePullHold } from './usePullHold';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePullHold', () => {
  it('opens only after a 64px pull is held for 500ms', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PullProbe onComplete={onComplete} />);
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    act(() => vi.advanceTimersByTime(499));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('cancels when released before the hold completes', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PullProbe onComplete={onComplete} />);
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    fireEvent(target, pointerEvent('pointerup', 1, 70));
    act(() => vi.advanceTimersByTime(500));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancels when the pointer is released outside the bound element', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PullProbe onComplete={onComplete} />);
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    fireEvent(window, pointerEvent('pointerup', 1, 70));
    act(() => vi.advanceTimersByTime(500));

    expect(onComplete).not.toHaveBeenCalled();
    expect(target).toHaveAttribute('data-holding', 'false');
  });

  it('cancels after retreating under the threshold or losing the page top', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PullProbe onComplete={onComplete} />);
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    fireEvent(target, pointerEvent('pointermove', 1, 50));
    act(() => vi.advanceTimersByTime(500));
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent(target, pointerEvent('pointerdown', 2, 0));
    fireEvent(target, pointerEvent('pointermove', 2, 70));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 10 });
    fireEvent(target, pointerEvent('pointermove', 2, 72));
    act(() => vi.advanceTimersByTime(500));

    expect(onComplete).not.toHaveBeenCalled();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('does not begin when disabled or when the page is not at the top', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { rerender } = render(
      <PullProbe enabled={false} onComplete={onComplete} />,
    );
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    act(() => vi.advanceTimersByTime(500));
    expect(onComplete).not.toHaveBeenCalled();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 4 });
    rerender(<PullProbe onComplete={onComplete} />);
    fireEvent(target, pointerEvent('pointerdown', 2, 0));
    fireEvent(target, pointerEvent('pointermove', 2, 70));
    act(() => vi.advanceTimersByTime(500));

    expect(onComplete).not.toHaveBeenCalled();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('cancels an active hold immediately when scrolling away from the top', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PullProbe onComplete={onComplete} />);
    const target = screen.getByTestId('pull-zone');

    fireEvent(target, pointerEvent('pointerdown', 1, 0));
    fireEvent(target, pointerEvent('pointermove', 1, 70));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 8 });
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(500));

    expect(onComplete).not.toHaveBeenCalled();
    expect(target).toHaveAttribute('data-holding', 'false');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });
});

function PullProbe({
  enabled = true,
  onComplete,
}: {
  enabled?: boolean;
  onComplete(): void;
}) {
  const pull = usePullHold({ distance: 64, holdMs: 500, enabled, onComplete });
  return (
    <div
      data-testid="pull-zone"
      data-distance={pull.pullDistance}
      data-holding={pull.holding}
      data-progress={pull.progress}
      {...pull.bind}
    />
  );
}

function pointerEvent(type: string, pointerId: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}
