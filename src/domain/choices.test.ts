import { describe, expect, it } from 'vitest';
import {
  createChoice,
  getChoiceStats,
  getReviewQueue,
  setChoiceStatus,
} from './choices';

describe('choice domain', () => {
  const morning = new Date('2026-09-04T08:05:00+08:00');

  it('trims and creates an unjudged choice at the supplied time', () => {
    const choice = createChoice('  躺在床上玩手机  ', morning, 'choice-1');

    expect(choice).toMatchObject({
      id: 'choice-1',
      text: '躺在床上玩手机',
      status: 'unjudged',
      localDate: '2026-09-04',
    });
    expect(choice.occurredAt).toBe(morning.toISOString());
  });

  it('rejects a choice containing only whitespace', () => {
    expect(() => createChoice('   ', morning, 'choice-1')).toThrow(
      'Choice text is required',
    );
  });

  it('records and clears a user judgment without changing occurrence time', () => {
    const choice = createChoice('喝黑咖啡', morning, 'choice-1');
    const green = setChoiceStatus(
      choice,
      'green',
      new Date('2026-09-04T21:30:00+08:00'),
    );

    expect(green.status).toBe('green');
    expect(green.judgedAt).toBeTruthy();
    expect(green.occurredAt).toBe(choice.occurredAt);
    expect(setChoiceStatus(green, 'unjudged', morning).judgedAt).toBeNull();
  });

  it('returns only unjudged choices for the requested day in occurrence order', () => {
    const first = createChoice('第一条', morning, '1');
    const second = setChoiceStatus(
      createChoice('第二条', new Date('2026-09-04T09:00:00+08:00'), '2'),
      'red',
      morning,
    );
    const otherDay = createChoice(
      '昨天',
      new Date('2026-09-03T09:00:00+08:00'),
      '3',
    );

    expect(
      getReviewQueue([second, otherDay, first], '2026-09-04').map(
        ({ id }) => id,
      ),
    ).toEqual(['1']);
  });

  it('uses creation time to order choices with the same occurrence time', () => {
    const laterCreated = {
      ...createChoice('稍后创建', morning, '2'),
      createdAt: '2026-09-04T01:00:01.000Z',
    };
    const earlierCreated = {
      ...createChoice('较早创建', morning, '1'),
      createdAt: '2026-09-04T01:00:00.000Z',
    };

    expect(
      getReviewQueue([laterCreated, earlierCreated], '2026-09-04').map(
        ({ id }) => id,
      ),
    ).toEqual(['1', '2']);
  });

  it('derives green, red, unjudged, total, and percentages', () => {
    const base = createChoice('一条', morning, '1');
    const choices = [
      base,
      setChoiceStatus({ ...base, id: '2' }, 'green', morning),
      setChoiceStatus({ ...base, id: '3' }, 'red', morning),
    ];

    expect(getChoiceStats(choices)).toEqual({
      green: 1,
      red: 1,
      unjudged: 1,
      total: 3,
      greenPercent: 100 / 3,
      redPercent: 100 / 3,
      unjudgedPercent: 100 / 3,
    });
  });

  it('returns zero percentages when no choices exist', () => {
    expect(getChoiceStats([])).toEqual({
      green: 0,
      red: 0,
      unjudged: 0,
      total: 0,
      greenPercent: 0,
      redPercent: 0,
      unjudgedPercent: 0,
    });
  });
});
