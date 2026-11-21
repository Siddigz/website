/*
 * Text contrast, worked out from the design tokens. The automated browser
 * check skips text that sits over a background image, and the top of every
 * page has one, so the arithmetic is done here from the declared values.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, declaredValue } from '../../src/lib/colour';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');

// [text, what it sits on, minimum ratio]. 4.5 is WCAG AA for body text; 3 for large text and graphics.
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['accent-2', 'bg', 3],
  ['live', 'surface', 3],
  // Lines and marks in the explainers' drawings.
  ['violet', 'surface', 3],
  ['violet', 'bg', 3],
  ['amber', 'surface', 3],
  ['amber', 'bg', 3],
  ['wrong', 'surface', 3],
  ['wrong', 'bg', 3],
];

describe.each(['light', 'dark'])('%s theme', (scheme) => {
  const colour = (name: string) => declaredValue(tokens, `--color-${name}-${scheme}`);

  it('text contrast meets WCAG AA', () => {
    const failures = PAIRS.map(([text, behind, minimum]) => ({
      pair: `${text} on ${behind}`,
      ratio: Number(contrast(colour(text), colour(behind)).toFixed(2)),
      minimum,
    })).filter(({ ratio, minimum }) => ratio < minimum);
    expect(failures).toEqual([]);
  });
});

it('the two fonts are the self-hosted ones', () => {
  expect(declaredValue(tokens, '--font-heading')).toBe('var(--font-bricolage)');
  expect(declaredValue(tokens, '--font-sans')).toBe('var(--font-figtree)');
});
