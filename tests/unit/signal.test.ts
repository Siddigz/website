import { describe, it, expect } from 'vitest';
import {
  SYMBOLS,
  decide,
  erfc,
  gauss,
  labelsOf,
  levelsOf,
  mulberry32,
  readouts,
  sci,
  simulate,
  theorySER,
  waveform,
} from '../../src/lib/explainers/signal';

describe('levels and labels', () => {
  it('spreads the levels evenly from 0 to 1', () => {
    expect(levelsOf(2)).toEqual([0, 1]);
    expect(levelsOf(4)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(levelsOf(8).length).toBe(8);
    expect(levelsOf(8)[7]).toBe(1);
  });

  it('labels each level with its bits, in Gray code or in plain counting order', () => {
    expect(labelsOf(2, true)).toEqual(['0', '1']);
    expect(labelsOf(4, true)).toEqual(['00', '01', '11', '10']);
    expect(labelsOf(4, false)).toEqual(['00', '01', '10', '11']);
    expect(labelsOf(8, false)[7]).toBe('111');
    expect(labelsOf(8, true)).toEqual(['000', '001', '011', '010', '110', '111', '101', '100']);
  });

  it('in Gray code, neighbouring levels differ by exactly one bit', () => {
    for (const levels of [4, 8] as const) {
      const labels = labelsOf(levels, true);
      for (let index = 1; index < labels.length; index += 1) {
        const differing = [...labels[index]!].filter((bit, place) => bit !== labels[index - 1]![place]).length;
        expect(differing).toBe(1);
      }
    }
  });
});

describe('decide', () => {
  it('picks the nearest level, and the end levels for anything beyond them', () => {
    expect(decide(0.4, 4)).toBe(1);
    expect(decide(0.6, 4)).toBe(2);
    expect(decide(-3, 4)).toBe(0);
    expect(decide(9, 4)).toBe(3);
    expect(decide(0.49, 2)).toBe(0);
    expect(decide(0.51, 2)).toBe(1);
  });
});

describe('erfc', () => {
  it('matches known values', () => {
    expect(Math.abs(erfc(0) - 1)).toBeLessThan(1e-6);
    expect(Math.abs(erfc(1) - 0.157299)).toBeLessThan(1e-6);
    expect(Math.abs(erfc(-1) - 1.842701)).toBeLessThan(1e-6);
  });
});

describe('theorySER', () => {
  it('is zero with no noise', () => {
    expect(theorySER(2, 0)).toBe(0);
    expect(theorySER(8, 0)).toBe(0);
  });

  it('matches the worked value for PAM4 at σ = 0.05', () => {
    expect(Math.abs(theorySER(4, 0.05) - 6.4e-4) / 6.4e-4).toBeLessThan(0.05);
  });

  it.each([0.05, 0.1, 0.2, 0.3])('is worse with more levels at σ = %f', (sigma) => {
    expect(theorySER(4, sigma)).toBeGreaterThan(theorySER(2, sigma));
    expect(theorySER(8, sigma)).toBeGreaterThan(theorySER(4, sigma));
  });
});

describe('random numbers', () => {
  it('repeat exactly for one seed and differ between seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gauss is centred on zero with a spread of one', () => {
    const rng = mulberry32(7);
    const samples = Array.from({ length: 20_000 }, () => gauss(rng));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const spread = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(spread - 1)).toBeLessThan(0.03);
  });
});

describe('simulate', () => {
  it('gives the same result for the same seed', () => {
    expect(simulate(4, 0.05, 123)).toEqual(simulate(4, 0.05, 123));
    expect(simulate(4, 0.05, 123)).not.toEqual(simulate(4, 0.05, 124));
  });

  it('makes no mistakes without noise', () => {
    expect(simulate(2, 0, 1).errors).toBe(0);
    expect(simulate(8, 0, 1).errors).toBe(0);
  });

  it('counts every symbol once, as right or as wrong', () => {
    const result = simulate(4, 0.1, 5);
    const total = [...result.ok, ...result.bad].reduce((sum, count) => sum + count, 0);
    expect(total).toBe(SYMBOLS);
    expect(result.bad.reduce((sum, count) => sum + count, 0)).toBe(result.errors);
    expect(result.ok.length).toBe(result.bins);
    expect(simulate(4, 0.1, 5, 500).ok.reduce((sum, count) => sum + count, 0) + simulate(4, 0.1, 5, 500).errors).toBe(500);
  });

  it('lands near the theory', () => {
    expect(Math.abs(simulate(4, 0.05, 20260101).errors / 20000 - theorySER(4, 0.05)) / theorySER(4, 0.05)).toBeLessThan(0.3);
    // With plenty of errors to count, the match is close.
    expect(Math.abs(simulate(4, 0.1, 20260101).errors / 20000 - theorySER(4, 0.1)) / theorySER(4, 0.1)).toBeLessThan(0.08);
  });
});

describe('waveform', () => {
  it('is forty symbols, each with what was sent, what arrived and whether it was misread', () => {
    const wave = waveform(4, 0.05, 20260101);
    expect(wave.cells.length).toBe(40);
    expect(wave.wrong).toBe(wave.cells.filter((cell) => cell.bad).length);
    for (const cell of wave.cells) expect(cell.bad).toBe(decide(cell.received, 4) !== cell.sent);
    expect(waveform(4, 0, 1).wrong).toBe(0);
    expect(waveform(4, 0.05, 20260101)).toEqual(wave);
  });
});

describe('readouts', () => {
  it('describes PAM4 at the starting noise', () => {
    const text = readouts(4, 0.05, 13);
    expect(text.gap).toEqual(['1/3', '= 0.333 of full range']);
    expect(text.bits).toEqual(['2', 'log2(4)']);
    expect(text.measured).toEqual(['1 in 1,538', '13 wrong out of 20,000 = 6.5e-4']);
    expect(text.theory[0]).toBe('6.4e-4');
    expect(text.theory[1]).toMatch(/^about 1 in 1,5\d\d$/);
    expect(text.caption).toMatch(/^Same noise, levels 3× closer → errors go from .+ \(NRZ\) to 6\.4e-4 \(PAM4\)\.$/);
  });

  it('describes NRZ as the baseline', () => {
    const text = readouts(2, 0.08, 0);
    expect(text.gap).toEqual(['1', '= 1.000 of full range']);
    expect(text.bits).toEqual(['1', 'log2(2)']);
    expect(text.measured).toEqual(['< 1 in 20,000', '0 wrong out of 20,000 symbols']);
    expect(text.caption).toMatch(/^NRZ is the baseline: one full-range gap between the two levels\. At σ = 0\.080, errors are about .+\.$/);
  });

  it('says so when there is no noise, or next to none', () => {
    expect(readouts(4, 0, 0).theory).toEqual(['0', 'no noise, no errors']);
    expect(readouts(2, 0.02, 0).theory[1]).toBe('far below 1 in a trillion');
  });

  it('writes small numbers the short way', () => {
    expect(sci(0)).toBe('0');
    expect(sci(0.00065)).toBe('6.5e-4');
  });
});
