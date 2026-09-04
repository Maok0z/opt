import { describe, expect, it } from 'vitest';
import type { OptData } from '../domain/types';
import {
  createDefaultData,
  loadOptData,
  saveOptData,
  type StorageLike,
} from './optStorage';

class MapStorage implements StorageLike {
  private readonly values: Map<string, string>;

  constructor(entries: [string, string][] = []) {
    this.values = new Map(entries);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('opt storage', () => {
  it('returns defaults when no data exists', () => {
    const storage = new MapStorage();
    const result = loadOptData(storage, new Date(2026, 8, 4));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.reviewTime).toBe('21:30');
      expect(result.data.settings.latestSeenDate).toBe('2026-09-04');
    }
  });

  it('round-trips version one data', () => {
    const storage = new MapStorage();
    const data = createDefaultData(new Date(2026, 8, 4));

    expect(saveOptData(storage, data)).toEqual({ ok: true });
    expect(loadOptData(storage, new Date(2026, 8, 4))).toEqual({
      ok: true,
      data,
    });
  });

  it('preserves malformed source text and reports corruption', () => {
    const storage = new MapStorage([['opt:data', '{bad-json']]);
    const result = loadOptData(storage, new Date(2026, 8, 4));

    expect(result).toEqual({
      ok: false,
      reason: 'corrupt',
      raw: '{bad-json',
    });
    expect(storage.getItem('opt:data')).toBe('{bad-json');
  });

  it.each([
    ['unsupported version', { ...validData(), version: 2 }],
    ['invalid choices collection', { ...validData(), choices: {} }],
    [
      'invalid choice status',
      {
        ...validData(),
        choices: [
          {
            id: 'choice-1',
            text: '一条选择',
            occurredAt: '2026-09-04T00:05:00.000Z',
            localDate: '2026-09-04',
            status: 'maybe',
            judgedAt: null,
            createdAt: '2026-09-04T00:05:00.000Z',
            updatedAt: '2026-09-04T00:05:00.000Z',
          },
        ],
      },
    ],
    ['invalid day records', { ...validData(), days: [] }],
    [
      'invalid settings record',
      { ...validData(), settings: { reviewTime: '21:30' } },
    ],
  ])('rejects %s without replacing it', (_name, value) => {
    const raw = JSON.stringify(value);
    const storage = new MapStorage([['opt:data', raw]]);

    expect(loadOptData(storage, new Date(2026, 8, 4))).toEqual({
      ok: false,
      reason: 'corrupt',
      raw,
    });
    expect(storage.getItem('opt:data')).toBe(raw);
  });

  it('reports unavailable when reading storage throws', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadOptData(storage, new Date(2026, 8, 4))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('reports unavailable when writing storage throws', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };

    expect(saveOptData(storage, validData())).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

function validData(): OptData {
  return {
    version: 1,
    choices: [],
    days: {},
    settings: {
      reviewTime: '21:30',
      reminderEnabled: true,
      notificationPreference: 'unsupported',
      historyHintSeen: false,
      latestSeenDate: '2026-09-04',
    },
  };
}
