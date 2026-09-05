import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { getChoiceStats, getReviewQueue } from '../domain/choices';
import type { Choice, ChoiceStatus } from '../domain/types';
import { useHorizontalDecision } from '../gestures/useHorizontalDecision';
import { useOpt } from '../state/OptContext';
import '../gestures/interaction.css';

interface ReviewPageProps {
  onExit(): void;
}

interface ExitPointer {
  id: number;
  x: number;
  y: number;
}

const COMMITTED_HOLD_MS = 420;
const REVIEW_DRAG_THRESHOLD = 120;
const EXIT_DRAG_DISTANCE = 100;

export function ReviewPage({ onExit }: ReviewPageProps) {
  const opt = useOpt();
  const [committedChoice, setCommittedChoice] = useState<Choice | null>(null);
  const [decision, setDecision] = useState<'neutral' | 'green' | 'red'>(
    'neutral',
  );
  const holdTimer = useRef<number | null>(null);
  const exitPointer = useRef<ExitPointer | null>(null);
  const reviewScreen = useRef<HTMLElement>(null);

  const todayChoices = opt.data.choices.filter(
    (choice) => choice.localDate === opt.editableDate,
  );
  const queue = getReviewQueue(opt.data.choices, opt.editableDate);
  const currentChoice = committedChoice ?? queue[0] ?? null;
  const stats = getChoiceStats(todayChoices);

  const commit = useCallback(
    (status: Exclude<ChoiceStatus, 'unjudged'>) => {
      if (currentChoice === null || decision !== 'neutral') return;
      setCommittedChoice(currentChoice);
      setDecision(status);
      opt.judgeChoice(currentChoice.id, status);

      const holdMs = prefersReducedMotion() ? 0 : COMMITTED_HOLD_MS;
      if (holdMs === 0) {
        setCommittedChoice(null);
        setDecision('neutral');
        return;
      }
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        setCommittedChoice(null);
        setDecision('neutral');
      }, holdMs);
    },
    [currentChoice, decision, opt],
  );

  const horizontal = useHorizontalDecision({
    threshold: REVIEW_DRAG_THRESHOLD,
    onDecision(direction) {
      commit(direction === 'right' ? 'green' : 'red');
    },
  });

  useEffect(() => {
    reviewScreen.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onExit();
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('button, input, textarea, a, [role="button"]')
      ) {
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        commit(event.key === 'ArrowRight' ? 'green' : 'red');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commit, onExit]);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    },
    [],
  );

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    exitPointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    horizontal.bind.onPointerDown(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    horizontal.bind.onPointerUp(event);
    const start = exitPointer.current;
    exitPointer.current = null;
    if (
      start !== null &&
      start.id === event.pointerId &&
      event.clientY - start.y >= EXIT_DRAG_DISTANCE &&
      Math.abs(event.clientX - start.x) < EXIT_DRAG_DISTANCE
    ) {
      onExit();
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    exitPointer.current = null;
    horizontal.bind.onPointerCancel(event);
  };

  const progress = decision === 'neutral' ? horizontal.progress : 0;
  const background = reviewBackground(decision, progress);
  const screenStyle = {
    '--decision-progress': progress,
    '--review-background': background,
    '--review-foreground': readableReviewForeground(background),
  } as CSSProperties;

  return (
    <main
      ref={reviewScreen}
      className="review-screen--immersive"
      data-testid="review-screen"
      data-decision={decision}
      data-drag-direction={horizontal.direction}
      style={screenStyle}
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      onPointerMove={horizontal.bind.onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <button
        className="review-screen__exit"
        type="button"
        onClick={onExit}
      >
        退出回顾
      </button>
      <span
        role="status"
        aria-live="polite"
        className="visually-hidden"
      >
        {decision === 'green'
          ? '已判断：绿色'
          : decision === 'red'
            ? '已判断：红色'
            : ''}
      </span>
      {currentChoice === null ? (
        <section className="review-screen__choice" aria-live="polite">
          <h1>今天已回顾完</h1>
          <p>
            共 {stats.total} 条 · {stats.green} 绿 · {stats.red} 红 ·{' '}
            {stats.unjudged} 未判断
          </p>
        </section>
      ) : (
        <section
          className="review-screen__choice"
          role="region"
          aria-label="当前选择"
          aria-live="polite"
          aria-atomic="true"
        >
          <h1>
            {currentChoice.text}
          </h1>
          <time dateTime={currentChoice.occurredAt}>
            {formatChoiceTime(currentChoice.occurredAt)}
          </time>
        </section>
      )}
    </main>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, input, textarea, a, [role="button"]') !== null
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function reviewBackground(
  decision: 'neutral' | 'green' | 'red',
  progress: number,
): string {
  if (decision === 'green') return '#20C873';
  if (decision === 'red') return '#F04444';
  if (progress > 0) return mixHex('#10110F', '#20C873', progress);
  if (progress < 0) return mixHex('#10110F', '#F04444', -progress);
  return '#10110F';
}

function mixHex(from: string, to: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const start = Number.parseInt(from.slice(offset, offset + 2), 16);
    const end = Number.parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function readableReviewForeground(background: string): string {
  const white = '#FFFFFF';
  const black = '#000000';
  return contrastRatio(background, black) >= contrastRatio(background, white)
    ? black
    : white;
}

function contrastRatio(left: string, right: string): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function formatChoiceTime(timestamp: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}
