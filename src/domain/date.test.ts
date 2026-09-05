import { describe, expect, it } from 'vitest';
import { isDateEditable, resolveEditableDate, toLocalDateKey } from './date';

describe('local date boundary', () => {
  it('formats a local calendar date without converting through UTC', () => {
    expect(toLocalDateKey(new Date(2026, 8, 4, 23, 59))).toBe('2026-09-04');
  });

  it('never makes an earlier date editable after the clock moves back', () => {
    expect(resolveEditableDate('2026-09-03', '2026-09-04')).toBe('2026-09-04');
    expect(isDateEditable('2026-09-03', '2026-09-04')).toBe(false);
  });

  it('moves the editable date forward and recognizes the current day', () => {
    expect(resolveEditableDate('2026-09-05', '2026-09-04')).toBe('2026-09-05');
    expect(isDateEditable('2026-09-05', '2026-09-05')).toBe(true);
  });
});
