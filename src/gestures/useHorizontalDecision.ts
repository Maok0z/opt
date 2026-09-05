import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEventHandler,
} from 'react';

type HorizontalDirection = 'left' | 'right';
type GestureDirection = HorizontalDirection | 'neutral';

interface HorizontalDecisionOptions {
  threshold: number;
  onDecision(direction: HorizontalDirection): void;
}

interface HorizontalDecisionBind {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

interface HorizontalDecisionResult {
  bind: HorizontalDecisionBind;
  offsetX: number;
  progress: number;
  direction: GestureDirection;
}

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  axis: 'pending' | 'horizontal';
  offsetX: number;
}

const AXIS_LOCK_DISTANCE = 6;

export function useHorizontalDecision({
  threshold,
  onDecision,
}: HorizontalDecisionOptions): HorizontalDecisionResult {
  const activePointer = useRef<ActivePointer | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const reset = useCallback(() => {
    activePointer.current = null;
    setOffsetX(0);
  }, []);

  useEffect(
    () => () => {
      activePointer.current = null;
    },
    [],
  );

  const onPointerDown: PointerEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (activePointer.current !== null) return;
      activePointer.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        axis: 'pending',
        offsetX: 0,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [],
  );

  const onPointerMove: PointerEventHandler<HTMLElement> = useCallback(
    (event) => {
      const active = activePointer.current;
      if (active === null || event.pointerId !== active.id) return;

      const nextX = event.clientX - active.startX;
      const nextY = event.clientY - active.startY;
      if (active.axis === 'pending') {
        if (
          Math.abs(nextY) > Math.abs(nextX) &&
          Math.abs(nextY) >= AXIS_LOCK_DISTANCE
        ) {
          reset();
          return;
        }
        if (Math.abs(nextX) < AXIS_LOCK_DISTANCE) return;
        active.axis = 'horizontal';
      }

      active.offsetX = nextX;
      setOffsetX(nextX);
    },
    [reset],
  );

  const onPointerUp: PointerEventHandler<HTMLElement> = useCallback(
    (event) => {
      const active = activePointer.current;
      if (active === null || event.pointerId !== active.id) return;
      const finalOffset = event.clientX - active.startX;
      const finalVerticalOffset = event.clientY - active.startY;
      const remainedVertical =
        active.axis === 'pending' &&
        Math.abs(finalVerticalOffset) > Math.abs(finalOffset) &&
        Math.abs(finalVerticalOffset) >= AXIS_LOCK_DISTANCE;
      reset();
      if (remainedVertical || Math.abs(finalOffset) < threshold) return;
      onDecision(finalOffset > 0 ? 'right' : 'left');
    },
    [onDecision, reset, threshold],
  );

  const onPointerCancel: PointerEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (activePointer.current?.id === event.pointerId) reset();
    },
    [reset],
  );

  const progress = Math.max(-1, Math.min(1, offsetX / threshold));

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    offsetX,
    progress,
    direction: progress > 0 ? 'right' : progress < 0 ? 'left' : 'neutral',
  };
}
