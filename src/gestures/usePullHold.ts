import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEventHandler,
} from 'react';

interface PullHoldOptions {
  distance: number;
  holdMs: number;
  enabled: boolean;
  onComplete(): void;
}

interface PullHoldBinding {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

interface PullHoldResult {
  bind: PullHoldBinding;
  pullDistance: number;
  holding: boolean;
  progress: number;
}

interface ActivePull {
  pointerId: number;
  startY: number;
}

export function usePullHold({
  distance,
  holdMs,
  enabled,
  onComplete,
}: PullHoldOptions): PullHoldResult {
  const activeRef = useRef<ActivePull | null>(null);
  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [pullDistance, setPullDistance] = useState(0);
  const [holding, setHolding] = useState(false);
  onCompleteRef.current = onComplete;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    activeRef.current = null;
    completedRef.current = false;
    setPullDistance(0);
  }, [clearTimer]);

  useEffect(() => reset, [reset]);

  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  useEffect(() => {
    const cancelAwayFromTop = () => {
      if (activeRef.current !== null && window.scrollY !== 0) reset();
    };
    window.addEventListener('scroll', cancelAwayFromTop, { passive: true });
    return () => window.removeEventListener('scroll', cancelAwayFromTop);
  }, [reset]);

  useEffect(() => {
    const endPullOutsideElement = (event: globalThis.PointerEvent) => {
      if (activeRef.current?.pointerId === event.pointerId) reset();
    };
    window.addEventListener('pointerup', endPullOutsideElement);
    window.addEventListener('pointercancel', endPullOutsideElement);
    return () => {
      window.removeEventListener('pointerup', endPullOutsideElement);
      window.removeEventListener('pointercancel', endPullOutsideElement);
    };
  }, [reset]);

  const beginHold = useCallback(() => {
    if (timerRef.current !== null || completedRef.current) return;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      completedRef.current = true;
      setHolding(false);
      onCompleteRef.current();
    }, holdMs);
  }, [holdMs]);

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled || window.scrollY !== 0) return;
    reset();
    activeRef.current = { pointerId: event.pointerId, startY: event.clientY };
  };

  const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!enabled || window.scrollY !== 0) {
      reset();
      return;
    }

    const nextDistance = Math.max(0, event.clientY - active.startY);
    setPullDistance(nextDistance);
    if (nextDistance >= distance) {
      beginHold();
    } else {
      clearTimer();
    }
  };

  const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
    if (activeRef.current?.pointerId === event.pointerId) reset();
  };

  const onPointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    if (activeRef.current?.pointerId === event.pointerId) reset();
  };

  return {
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    pullDistance,
    holding,
    progress: Math.min(pullDistance / distance, 1),
  };
}
