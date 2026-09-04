import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timeline } from '../components/Timeline';
import { getChoiceStats } from '../domain/choices';
import type { Choice } from '../domain/types';
import { useOpt } from '../state/OptContext';

interface HistoryPageProps {
  onExit(): void;
}

interface HistoryDay {
  dateKey: string;
  choices: Choice[];
  note: string;
}

interface SwipeStart {
  pointerId: number;
  x: number;
  y: number;
}

const HISTORY_STATE_KEY = 'optHistoryEntry';
let nextHistoryEntryId = 0;

export function HistoryPage({ onExit }: HistoryPageProps) {
  const { data, editableDate } = useOpt();
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const exitedRef = useRef(false);
  const ownsHistoryEntryRef = useRef(false);
  const entryIdRef = useRef(`history-${++nextHistoryEntryId}`);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const days = useMemo(
    () => getHistoryDays(data.choices, data.days, editableDate),
    [data.choices, data.days, editableDate],
  );

  const exit = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    onExitRef.current();
    if (
      ownsHistoryEntryRef.current &&
      window.history.state?.[HISTORY_STATE_KEY] === entryIdRef.current
    ) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const currentState = window.history.state as Record<string, unknown> | null;
    if (currentState?.[HISTORY_STATE_KEY] !== entryIdRef.current) {
      window.history.pushState(
        { ...currentState, [HISTORY_STATE_KEY]: entryIdRef.current },
        '',
      );
      ownsHistoryEntryRef.current = true;
    }

    const handlePopState = () => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      onExitRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exit();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exit]);

  return (
    <main
      data-testid="history-page"
      onPointerDown={(event) => {
        swipeStartRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      }}
      onPointerUp={(event) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (deltaX >= 100 && Math.abs(deltaX) > Math.abs(deltaY)) exit();
      }}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
    >
      <header>
        <button type="button" onClick={exit}>
          返回今天
        </button>
        <h1>过往</h1>
      </header>
      {days.length === 0 ? <p>还没有过往记录</p> : null}
      {days.map((day) => {
        const expanded = expandedDates.has(day.dateKey);
        const stats = getChoiceStats(day.choices);
        const heading = `${formatHistoryDate(day.dateKey)} · ${stats.green} 绿 · ${stats.red} 红 · ${stats.unjudged} 未判断`;
        return (
          <section key={day.dateKey}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setExpandedDates((current) => {
                  const next = new Set(current);
                  if (next.has(day.dateKey)) next.delete(day.dateKey);
                  else next.add(day.dateKey);
                  return next;
                });
              }}
            >
              {heading}
            </button>
            {expanded ? (
              <div>
                <Timeline choices={day.choices} readOnly />
                {day.note.trim() ? (
                  <section aria-label={`${formatHistoryDate(day.dateKey)}随记`}>
                    <p>{day.note}</p>
                  </section>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}

function getHistoryDays(
  choices: Choice[],
  dayRecords: Record<string, { note: string }>,
  editableDate: string,
): HistoryDay[] {
  const dateKeys = new Set<string>();
  for (const choice of choices) {
    if (choice.localDate < editableDate) dateKeys.add(choice.localDate);
  }
  for (const dateKey of Object.keys(dayRecords)) {
    if (dateKey < editableDate) dateKeys.add(dateKey);
  }

  return [...dateKeys]
    .sort((left, right) => right.localeCompare(left))
    .map((dateKey) => ({
      dateKey,
      choices: choices.filter((choice) => choice.localDate === dateKey),
      note: dayRecords[dateKey]?.note ?? '',
    }));
}

function formatHistoryDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
