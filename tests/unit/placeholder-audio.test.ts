import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toneWav } from '../../scripts/make-placeholder-audio.mjs';
import { withAudio } from '../../scripts/import-audio.mjs';

const options = { notes: [440, 660], seconds: 0.35, rate: 22050 };
const samplesOf = (wav: Buffer) =>
  Array.from({ length: (wav.length - 44) / 2 }, (_, index) => wav.readInt16LE(44 + index * 2));

describe('toneWav', () => {
  it('writes a mono, 16-bit WAV of the length asked for', () => {
    const wav = toneWav(options);
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('latin1')).toBe('WAVE');
    expect(wav.length).toBe(44 + Math.round(22050 * 0.35) * 2);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt16LE(22), 'channels').toBe(1);
    expect(wav.readUInt32LE(24), 'sample rate').toBe(22050);
    expect(wav.readUInt16LE(34), 'bits per sample').toBe(16);
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
  });

  it('is audible but soft, and starts and ends in silence so it never clicks', () => {
    const samples = samplesOf(toneWav(options));
    const peak = Math.max(...samples.map(Math.abs));
    expect(peak).toBeGreaterThan(32767 * 0.05);
    expect(peak).toBeLessThan(32767 * 0.4);
    expect(Math.abs(samples[0]!)).toBeLessThan(200);
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(200);
  });

  it('gives the same bytes every time, and different ones for different notes', () => {
    expect(toneWav(options).equals(toneWav(options))).toBe(true);
    expect(toneWav(options).equals(toneWav({ ...options, notes: [330, 440] }))).toBe(false);
  });
});

describe('the placeholder recordings', () => {
  it('are both there, and each is under 20 KB', () => {
    const dir = 'src/assets/audio';
    const files = readdirSync(dir);
    expect(files.sort()).toEqual(['name-first.wav', 'name-last.wav']);
    for (const name of files) expect(statSync(join(dir, name)).size, name).toBeLessThan(20 * 1024);
  });
});

describe('withAudio', () => {
  const yaml = `main:
  name:
    first: A
    last: B
    audio:
      # The two recordings.
      first: name-first.wav
      last: name-last.wav
      hint: Plays it.
  pitch: first: not this one
`;

  it('swaps one recording and leaves everything else as it was', () => {
    expect(withAudio(yaml, 'last', 'name-last.m4a')).toBe(yaml.replace('last: name-last.wav', 'last: name-last.m4a'));
    expect(withAudio(yaml, 'first', 'name-first.m4a')).toBe(yaml.replace('first: name-first.wav', 'first: name-first.m4a'));
  });

  it('refuses a part that is not first or last, and a file with no audio block', () => {
    expect(() => withAudio(yaml, 'middle', 'x.m4a')).toThrow();
    expect(() => withAudio('main:\n  name:\n    first: A\n', 'first', 'x.m4a')).toThrow();
  });
});
