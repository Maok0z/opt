import { useEffect, useRef, useState } from 'react';
import type { Choice } from '../domain/types';
import { ChoiceRow } from './ChoiceRow';

interface TimelineProps {
  choices: Choice[];
  readOnly?: boolean;
}

export function Timeline({ choices, readOnly = false }: TimelineProps) {
  const knownChoiceIds = useRef(new Set(choices.map((choice) => choice.id)));
  const timers = useRef(new Map<string, number>());
  const [enteringChoiceIds, setEnteringChoiceIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const addedChoices = choices.filter(
      (choice) => !knownChoiceIds.current.has(choice.id),
    );
    if (addedChoices.length === 0) return;

    addedChoices.forEach((choice) => knownChoiceIds.current.add(choice.id));
    setEnteringChoiceIds((current) => {
      const next = new Set(current);
      addedChoices.forEach((choice) => next.add(choice.id));
      return next;
    });

    addedChoices.forEach((choice) => {
      const existingTimer = timers.current.get(choice.id);
      if (existingTimer) window.clearTimeout(existingTimer);
      const timer = window.setTimeout(() => {
        timers.current.delete(choice.id);
        setEnteringChoiceIds((current) => {
          if (!current.has(choice.id)) return current;
          const next = new Set(current);
          next.delete(choice.id);
          return next;
        });
      }, 260);
      timers.current.set(choice.id, timer);
    });
  }, [choices]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const orderedChoices = [...choices].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt),
  );

  return (
    <div className="choice-timeline">
      {orderedChoices.map((choice) => (
        <ChoiceRow
          key={choice.id}
          choice={choice}
          readOnly={readOnly}
          isEntering={enteringChoiceIds.has(choice.id)}
        />
      ))}
    </div>
  );
}
