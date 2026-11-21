/*
 * "NRZ vs PAM4": a transmitter sends one of M levels spread over a fixed
 * range, the receiver sees the level plus Gaussian noise and picks the
 * nearest level. More levels means smaller gaps, so the same noise causes
 * more mistakes. Pure maths and wording, shared by the page as built, the
 * page script and the tests.
 */
export type Levels = 2 | 4 | 8;

/** How many symbols the histogram and the measured error rate are made from. */
export const SYMBOLS = 20_000;
/** The amplitude range the drawings cover: a quarter of the signal range beyond each end. */
export const Y_MIN = -0.25;
export const Y_MAX = 1.25;
const BINS = 120;
const WAVE_SYMBOLS = 40;

/** A small, fast random number generator: the same seed always gives the same numbers. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One sample of Gaussian noise with a spread of one (Box-Muller). */
export function gauss(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * The complementary error function. This fit keeps a relative error under
 * 1.2e-7, so the tiny tail values behind a low error rate stay accurate.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** The chance that noise of spread 1 exceeds x. */
const tail = (x: number) => 0.5 * erfc(x / Math.SQRT2);

/** The symbol error rate theory predicts for evenly spaced levels and Gaussian noise. */
export function theorySER(levels: Levels, sigma: number): number {
  if (sigma <= 0) return 0;
  const gap = 1 / (levels - 1);
  return 2 * (1 - 1 / levels) * tail(gap / (2 * sigma));
}

export function levelsOf(levels: Levels): number[] {
  return Array.from({ length: levels }, (_, index) => index / (levels - 1));
}

const LABELS: Record<Levels, { gray: string[]; plain: string[] }> = {
  2: { gray: ['0', '1'], plain: ['0', '1'] },
  4: { gray: ['00', '01', '11', '10'], plain: ['00', '01', '10', '11'] },
  8: {
    gray: ['000', '001', '011', '010', '110', '111', '101', '100'],
    plain: ['000', '001', '010', '011', '100', '101', '110', '111'],
  },
};

/** The bits each level stands for, lowest level first. */
export function labelsOf(levels: Levels, gray: boolean): string[] {
  return LABELS[levels][gray ? 'gray' : 'plain'];
}

/** The index of the level nearest to what was received. */
export function decide(received: number, levels: Levels): number {
  return Math.min(levels - 1, Math.max(0, Math.round(received * (levels - 1))));
}

/** Many symbols sent and received: how many were misread, and where each landed, as a histogram. */
export function simulate(levels: Levels, sigma: number, seed: number, symbols = SYMBOLS): { errors: number; ok: number[]; bad: number[]; bins: number } {
  const values = levelsOf(levels);
  const rng = mulberry32(seed);
  const ok = new Array<number>(BINS).fill(0);
  const bad = new Array<number>(BINS).fill(0);
  let errors = 0;
  for (let index = 0; index < symbols; index += 1) {
    const sent = Math.floor(rng() * levels);
    const received = values[sent]! + sigma * gauss(rng);
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor(((received - Y_MIN) / (Y_MAX - Y_MIN)) * BINS)));
    if (decide(received, levels) === sent) {
      ok[bin]! += 1;
    } else {
      bad[bin]! += 1;
      errors += 1;
    }
  }
  return { errors, ok, bad, bins: BINS };
}

/** The forty symbols of the waveform drawing. */
export function waveform(levels: Levels, sigma: number, seed: number): { cells: { sent: number; received: number; bad: boolean }[]; wrong: number } {
  const values = levelsOf(levels);
  const rng = mulberry32(seed);
  const cells = Array.from({ length: WAVE_SYMBOLS }, () => {
    const sent = Math.floor(rng() * levels);
    const received = values[sent]! + sigma * gauss(rng);
    return { sent, received, bad: decide(received, levels) !== sent };
  });
  return { cells, wrong: cells.filter((cell) => cell.bad).length };
}

/** A small number the short way: 0.00065 becomes "6.5e-4". */
export const sci = (value: number) => (value === 0 ? '0' : value.toExponential(1));

const count = (value: number) => value.toLocaleString('en-US');

/** The four readouts (a large value and a line under it) and the sentence below them. */
export function readouts(levels: Levels, sigma: number, errors: number) {
  const gap = 1 / (levels - 1);
  const theory = theorySER(levels, sigma);
  return {
    gap: [levels === 2 ? '1' : `1/${levels - 1}`, `= ${gap.toFixed(3)} of full range`],
    bits: [String(Math.log2(levels)), `log2(${levels})`],
    measured:
      errors === 0
        ? [`< 1 in ${count(SYMBOLS)}`, `0 wrong out of ${count(SYMBOLS)} symbols`]
        : [`1 in ${count(Math.round(SYMBOLS / errors))}`, `${errors} wrong out of ${count(SYMBOLS)} = ${sci(errors / SYMBOLS)}`],
    theory: [
      sci(theory),
      theory === 0 ? 'no noise, no errors' : theory > 1e-12 ? `about 1 in ${count(Math.round(1 / theory))}` : 'far below 1 in a trillion',
    ],
    caption:
      levels === 2
        ? `NRZ is the baseline: one full-range gap between the two levels. At σ = ${sigma.toFixed(3)}, errors are about ${sci(theory)}.`
        : `Same noise, levels ${levels - 1}× closer → errors go from ${sci(theorySER(2, sigma))} (NRZ) to ${sci(theory)} (PAM${levels}).`,
  } satisfies Record<string, string | string[]>;
}

/** "3 of 40 symbols in this view were decided as the wrong level. Press Resample for a new set." */
export const waveNote = (wrong: number) => `${wrong} of ${WAVE_SYMBOLS} symbols in this view were decided as the wrong level. Press Resample for a new set.`;

/** Where the page starts: PAM4, a little noise, and a fixed seed so the page as built matches the first draw. */
export const START = { levels: 4 as Levels, sigma: 0.05, seed: 20260101, gray: true };
/** The three drawings use different stretches of random numbers from one seed. */
export const SEED_OFFSET = { eye: 7919, histogram: 104729 };
