// Makes the two stand-in sounds for the name buttons: a few soft notes each.
// They hold the place of the owner's recordings until those arrive
// (see scripts/import-audio.mjs).
// Usage: node scripts/make-placeholder-audio.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LOUDNESS = 0.25;
const HEADER_BYTES = 44;

/**
 * A mono, 16-bit WAV that plays `notes` (in hertz) one after another over
 * `seconds`. Each note fades in and out, so the sound never clicks.
 */
export function toneWav({ notes, seconds, rate }) {
  const count = Math.round(rate * seconds);
  const perNote = count / notes.length;
  const wav = Buffer.alloc(HEADER_BYTES + count * 2);
  wav.write('RIFF', 0, 'latin1');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8, 'latin1');
  wav.writeUInt32LE(16, 16); // size of the format block
  wav.writeUInt16LE(1, 20); // plain samples, not compressed
  wav.writeUInt16LE(1, 22); // one channel
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28); // bytes per second
  wav.writeUInt16LE(2, 32); // bytes per sample
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36, 'latin1');
  wav.writeUInt32LE(count * 2, 40);
  for (let index = 0; index < count; index += 1) {
    const note = Math.min(notes.length - 1, Math.floor(index / perNote));
    const within = (index - note * perNote) / perNote;
    // Zero at both ends of the note, full in the middle.
    const fade = Math.sin(Math.PI * within) ** 2;
    const sample = Math.sin((2 * Math.PI * notes[note] * index) / rate) * fade * LOUDNESS;
    wav.writeInt16LE(Math.round(sample * 32767), HEADER_BYTES + index * 2);
  }
  return wav;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = 'src/assets/audio';
  await mkdir(dir, { recursive: true });
  // Two rising notes for the first name, a higher pair for the last.
  await writeFile(`${dir}/name-first.wav`, toneWav({ notes: [523.25, 659.25], seconds: 0.35, rate: 22050 }));
  await writeFile(`${dir}/name-last.wav`, toneWav({ notes: [659.25, 783.99], seconds: 0.35, rate: 22050 }));
  console.log(`Wrote two placeholder sounds to ${dir}`);
}
