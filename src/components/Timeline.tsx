import type { Choice } from '../domain/types';
import { ChoiceRow } from './ChoiceRow';

interface TimelineProps {
  choices: Choice[];
  readOnly?: boolean;
}

export function Timeline({ choices, readOnly = false }: TimelineProps) {
  const orderedChoices = [...choices].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt),
  );

  return (
    <div>
      {orderedChoices.map((choice) => (
        <ChoiceRow key={choice.id} choice={choice} readOnly={readOnly} />
      ))}
    </div>
  );
}
