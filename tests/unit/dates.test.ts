import { it, expect } from 'vitest';
import { formatMonth, formatRange } from '../../src/lib/dates';

it('formats a year-month', () => {
  expect(formatMonth('2026-09')).toBe('Sep 2026');
  expect(formatMonth('2025-12')).toBe('Dec 2025');
});

it('formats every month the same way in any time zone', () => {
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => formatMonth(`2026-${m}`));
  expect(months).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026']);
});

it('formats a finished range', () => {
  expect(formatRange('2026-01', '2026-08')).toBe('Jan 2026 – Aug 2026');
});

it('shows Present when there is no end', () => {
  expect(formatRange('2026-09')).toBe('Sep 2026 – Present');
});
