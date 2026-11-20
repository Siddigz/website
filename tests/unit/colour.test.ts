import { describe, it, expect } from 'vitest';
import { contrast, declaredValue, toHex } from '../../src/lib/colour';

describe('toHex', () => {
  it('converts black, white and a mid grey', () => {
    expect(toHex('oklch(0% 0 0)')).toBe('#000000');
    expect(toHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(toHex('oklch(56.93% 0 0)')).toBe('#777777');
  });
  it('converts a saturated colour', () => {
    // Pure sRGB red is oklch(62.8% 0.2577 29.23).
    expect(toHex('oklch(62.8% 0.2577 29.23)')).toMatch(/^#f[ef]0[0-3]0[0-3]$/);
  });
  it('rejects anything that is not oklch(L% C H)', () => {
    expect(() => toHex('#fff')).toThrow();
    expect(() => toHex('oklch(50% 0.1 20 / 0.5)')).toThrow();
  });
});

describe('contrast', () => {
  it('matches known ratios', () => {
    expect(contrast('oklch(100% 0 0)', 'oklch(0% 0 0)')).toBeCloseTo(21, 0);
    expect(contrast('oklch(100% 0 0)', 'oklch(100% 0 0)')).toBeCloseTo(1, 5);
    expect(contrast('oklch(56.93% 0 0)', 'oklch(100% 0 0)')).toBeCloseTo(4.48, 1);
  });
  it('does not depend on the order', () => {
    expect(contrast('oklch(20% 0 0)', 'oklch(90% 0 0)')).toBe(contrast('oklch(90% 0 0)', 'oklch(20% 0 0)'));
  });
});

describe('declaredValue', () => {
  it('reads the first declaration and skips comments', () => {
    const css = '/* --x: wrong; */ :root { --x: oklch(1% 0 0); --y: 2px; } .a { --x: other; }';
    expect(declaredValue(css, '--x')).toBe('oklch(1% 0 0)');
    expect(declaredValue(css, '--y')).toBe('2px');
  });
  it('throws for a name that is not there', () => {
    expect(() => declaredValue(':root {}', '--missing')).toThrow();
  });
});
