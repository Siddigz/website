import { it, expect } from 'vitest';
import { wordCount } from '../../src/lib/text';

it('counts words and ignores headings and markup', () => {
  expect(wordCount('## Problem\n\nRiders **crash** and `nobody` knows.\n')).toBe(5);
});

it('counts nothing in empty or heading-only text', () => {
  expect(wordCount('')).toBe(0);
  expect(wordCount('## Result\n\n')).toBe(0);
});

it('counts link text but not link targets', () => {
  expect(wordCount('See [the live app](https://example.com/a/b) today.')).toBe(5);
});
