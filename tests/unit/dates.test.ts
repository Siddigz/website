import { it, expect } from 'vitest';
import { formatMonth, formatRange } from '../../src/lib/dates';

it('formats a year-month', () => {
  expect(formatMonth('2026-09')).toBe('Sep 2026');
  expect(formatMonth('2025-12')).toBe('Dec 2025');
});

it('formats a finished range', () => {
  expect(formatRange('2026-01', '2026-08')).toBe('Jan 2026 – Aug 2026');
});

it('shows Present when there is no end', () => {
  expect(formatRange('2026-09')).toBe('Sep 2026 – Present');
});
