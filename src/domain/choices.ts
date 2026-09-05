import { toLocalDateKey } from './date';
import type { Choice, ChoiceStats, ChoiceStatus } from './types';

export function createChoice(text: string, now: Date, id: string): Choice {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error('Choice text is required');
  }

  const timestamp = now.toISOString();

  return {
    id,
    text: normalizedText,
    occurredAt: timestamp,
    localDate: toLocalDateKey(now),
    status: 'unjudged',
    judgedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function setChoiceStatus(
  choice: Choice,
  status: ChoiceStatus,
  now: Date,
): Choice {
  const timestamp = now.toISOString();

  return {
    ...choice,
    status,
    judgedAt: status === 'unjudged' ? null : timestamp,
    updatedAt: timestamp,
  };
}

export function getReviewQueue(
  choices: Choice[],
  dateKey: string,
): Choice[] {
  return choices
    .filter(
      (choice) =>
        choice.localDate === dateKey && choice.status === 'unjudged',
    )
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.createdAt.localeCompare(right.createdAt),
    );
}

export function getChoiceStats(choices: Choice[]): ChoiceStats {
  const counts = choices.reduce(
    (stats, choice) => {
      stats[choice.status] += 1;
      return stats;
    },
    { green: 0, red: 0, unjudged: 0 },
  );
  const total = choices.length;

  return {
    ...counts,
    total,
    greenPercent: total === 0 ? 0 : (counts.green * 100) / total,
    redPercent: total === 0 ? 0 : (counts.red * 100) / total,
    unjudgedPercent: total === 0 ? 0 : (counts.unjudged * 100) / total,
  };
}
