import { toLocalDateKey } from '../domain/date';
import type {
  Choice,
  ChoiceStatus,
  DayRecord,
  OptData,
  Settings,
} from '../domain/types';

const STORAGE_KEY = 'opt:data';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { ok: true; data: OptData }
  | { ok: false; reason: 'unavailable' | 'corrupt'; raw?: string };

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' };

export function createDefaultData(now: Date): OptData {
  return {
    version: 1,
    choices: [],
    days: {},
    settings: {
      reviewTime: '21:30',
      reminderEnabled: true,
      notificationPreference: getNotificationPreference(),
      historyHintSeen: false,
      latestSeenDate: toLocalDateKey(now),
    },
  };
}

export function loadOptData(
  storage: StorageLike,
  now: Date,
): LoadResult {
  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (raw === null) {
    return { ok: true, data: createDefaultData(now) };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isOptData(parsed)) {
      return { ok: false, reason: 'corrupt', raw };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, reason: 'corrupt', raw };
  }
}

export function saveOptData(
  storage: StorageLike,
  data: OptData,
): SaveResult {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function getNotificationPreference(): Settings['notificationPreference'] {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

function isOptData(value: unknown): value is OptData {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!Array.isArray(value.choices) || !value.choices.every(isChoice)) {
    return false;
  }
  if (!isRecord(value.days) || !Object.values(value.days).every(isDayRecord)) {
    return false;
  }
  return isSettings(value.settings);
}

function isChoice(value: unknown): value is Choice {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.occurredAt === 'string' &&
    typeof value.localDate === 'string' &&
    isChoiceStatus(value.status) &&
    (value.judgedAt === null || typeof value.judgedAt === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isChoiceStatus(value: unknown): value is ChoiceStatus {
  return value === 'unjudged' || value === 'green' || value === 'red';
}

function isDayRecord(value: unknown): value is DayRecord {
  return (
    isRecord(value) &&
    typeof value.localDate === 'string' &&
    typeof value.note === 'string'
  );
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  return (
    typeof value.reviewTime === 'string' &&
    typeof value.reminderEnabled === 'boolean' &&
    (value.notificationPreference === 'default' ||
      value.notificationPreference === 'granted' ||
      value.notificationPreference === 'denied' ||
      value.notificationPreference === 'unsupported') &&
    typeof value.historyHintSeen === 'boolean' &&
    typeof value.latestSeenDate === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
