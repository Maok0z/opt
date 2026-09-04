import { fireEvent, render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHorizontalDecision } from './useHorizontalDecision';

afterEach(cleanup);

describe('useHorizontalDecision', () => {
  it('commits right only after crossing the configured threshold', () => {
    const onDecision = vi.fn();
    render(<GestureProbe threshold={120} onDecision={onDecision} />);
    const target = screen.getByTestId('gesture');

    fireEvent(target, pointerEvent('pointerdown', 1, 100, 100));
    fireEvent(target, pointerEvent('pointermove', 1, 210, 100));
    fireEvent(target, pointerEvent('pointerup', 1, 210, 100));
    expect(onDecision).not.toHaveBeenCalled();

    fireEvent(target, pointerEvent('pointerdown', 2, 100, 100));
    fireEvent(target, pointerEvent('pointermove', 2, 230, 100));
    fireEvent(target, pointerEvent('pointerup', 2, 230, 100));
    expect(onDecision).toHaveBeenCalledWith('right');
  });

  it('ignores other pointers and cancels a gesture that becomes vertical', () => {
    const onDecision = vi.fn();
    render(<GestureProbe threshold={72} onDecision={onDecision} />);
    const target = screen.getByTestId('gesture');

    fireEvent(target, pointerEvent('pointerdown', 4, 100, 100));
    fireEvent(target, pointerEvent('pointermove', 9, 200, 100));
    fireEvent(target, pointerEvent('pointerup', 9, 200, 100));
    expect(screen.getByTestId('offset')).toHaveTextContent('0');

    fireEvent(target, pointerEvent('pointermove', 4, 105, 130));
    fireEvent(target, pointerEvent('pointermove', 4, 200, 130));
    fireEvent(target, pointerEvent('pointerup', 4, 200, 130));
    expect(onDecision).not.toHaveBeenCalled();
    expect(screen.getByTestId('offset')).toHaveTextContent('0');
  });

  it('reports clamped progress and resets after pointer cancellation', () => {
    render(<GestureProbe threshold={50} onDecision={vi.fn()} />);
    const target = screen.getByTestId('gesture');

    fireEvent(target, pointerEvent('pointerdown', 1, 100, 100));
    fireEvent(target, pointerEvent('pointermove', 1, 0, 100));
    expect(screen.getByTestId('progress')).toHaveTextContent('-1');
    expect(screen.getByTestId('direction')).toHaveTextContent('left');

    fireEvent(target, pointerEvent('pointercancel', 1, 0, 100));
    expect(screen.getByTestId('progress')).toHaveTextContent('0');
    expect(screen.getByTestId('direction')).toHaveTextContent('neutral');
  });

  it('uses the release coordinates when a quick drag has no move event', () => {
    const onDecision = vi.fn();
    render(<GestureProbe threshold={72} onDecision={onDecision} />);
    const target = screen.getByTestId('gesture');

    fireEvent(target, pointerEvent('pointerdown', 1, 100, 100));
    fireEvent(target, pointerEvent('pointerup', 1, 180, 102));

    expect(onDecision).toHaveBeenCalledWith('right');
  });
});

interface GestureProbeProps {
  threshold: number;
  onDecision(direction: 'left' | 'right'): void;
}

function GestureProbe({ threshold, onDecision }: GestureProbeProps) {
  const gesture = useHorizontalDecision({ threshold, onDecision });
  return (
    <div data-testid="gesture" {...gesture.bind}>
      <span data-testid="offset">{gesture.offsetX}</span>
      <span data-testid="progress">{gesture.progress}</span>
      <span data-testid="direction">{gesture.direction}</span>
    </div>
  );
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
