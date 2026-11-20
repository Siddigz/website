/*
 * Stage 2: the chosen look and its three accent colour versions. Colour
 * contrast is worked out here from the declared values, because the automated
 * browser check skips text that sits over a background image, and the look
 * has one behind the top of the page.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LOOKS } from '../../src/lib/look';

type Scheme = 'light' | 'dark';

/** The custom properties declared in the first rule of a file with this selector. */
function block(path: string, selector: string): [string, string][] {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${path} has no rule for ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]);
}

/** A colour version's values: the shared look, with that version's accents on top. */
function declared(look: string): Map<string, string> {
  return new Map([
    ...block('src/styles/look.css', ':root[data-look]'),
    ...block(`src/styles/looks/${look}.css`, `:root[data-look='${look}']`),
  ]);
}

/** Follows `var(--x)` to the value it names. */
function resolve(values: Map<string, string>, name: string): string {
  let value = values.get(name);
  for (let hops = 0; value && hops < 5; hops += 1) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    if (!reference) return value;
    value = values.get(reference[1]!);
  }
  throw new Error(`${name} is not declared as a plain colour`);
}

/** Relative luminance (WCAG) of an `oklch(L% C H)` colour. */
function luminance(colour: string): number {
  const match = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(colour);
  if (!match) throw new Error(`expected oklch(L% C H), got ${colour}`);
  const [l, c, h] = [Number(match[1]) / 100, Number(match[2]), (Number(match[3]) * Math.PI) / 180];
  const [a, b] = [c * Math.cos(h), c * Math.sin(h)];
  const [l3, m3, s3] = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map(
    (value) => value ** 3,
  ) as [number, number, number];
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const red = clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3);
  const green = clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3);
  const blue = clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

// [text, what it sits on, minimum ratio]. 4.5 is WCAG AA for body text; 3 for large text and graphics.
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['bg', 'text', 4.5],
  ['accent-2', 'bg', 3],
];

const REQUIRED = ['bg', 'surface', 'text', 'text-muted', 'accent', 'accent-2', 'border', 'on-accent'];

describe('the contrast arithmetic', () => {
  it('matches known values', () => {
    expect(contrast('oklch(100% 0 0)', 'oklch(0% 0 0)')).toBeCloseTo(21, 0);
    expect(contrast('oklch(100% 0 0)', 'oklch(100% 0 0)')).toBeCloseTo(1, 5);
    // Mid grey #777777 is oklch(56.9% 0 0): 4.48 to 1 against white.
    expect(contrast('oklch(56.93% 0 0)', 'oklch(100% 0 0)')).toBeCloseTo(4.48, 1);
  });
});

describe.each(LOOKS)('colour version: %s', (look) => {
  const values = declared(look);

  it.each(['light', 'dark'] as Scheme[])('declares every colour for %s', (scheme) => {
    for (const name of REQUIRED) {
      expect(() => resolve(values, `--color-${name}-${scheme}`), `--color-${name}-${scheme}`).not.toThrow();
    }
  });

  it.each(['light', 'dark'] as Scheme[])('text contrast meets WCAG AA in %s', (scheme) => {
    const colour = (name: string) => resolve(values, `--color-${name}-${scheme}`);
    const failures = PAIRS.map(([text, behind, minimum]) => ({
      pair: `${text} on ${behind}`,
      ratio: Number(contrast(colour(text), colour(behind)).toFixed(2)),
      minimum,
    })).filter(({ ratio, minimum }) => ratio < minimum);
    expect(failures).toEqual([]);
  });

  it('sets only its accents: every other value is shared', () => {
    const own = block(`src/styles/looks/${look}.css`, `:root[data-look='${look}']`).map(([name]) => name);
    expect(own.sort()).toEqual(
      ['--color-accent-light', '--color-accent-dark', '--color-accent-2-light', '--color-accent-2-dark', '--warm-shade', '--warm-glow-a', '--warm-glow-b'].sort(),
    );
  });
});

it('the look uses its two self-hosted fonts', () => {
  const values = new Map(block('src/styles/look.css', ':root[data-look]'));
  expect(values.get('--font-heading')).toBe('var(--font-bricolage)');
  expect(values.get('--font-sans')).toBe('var(--font-figtree)');
});
