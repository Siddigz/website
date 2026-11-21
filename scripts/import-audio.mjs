// Brings a recording of the name into the site.
// Usage: node scripts/import-audio.mjs <recording> first|last
//
// The recording is converted to mono AAC with macOS's afconvert. Converting
// writes a new file from the sound alone, so whatever the phone attached to
// the original (place, device, date) is left behind. site.yaml is then pointed
// at the new file.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const PARTS = ['first', 'last'];
const SITE = 'src/content/site.yaml';
const AUDIO_DIR = 'src/assets/audio';

/** site.yaml's text with `name.audio.<part>` set to `fileName`. Comments and order are kept. */
export function withAudio(yaml, part, fileName) {
  if (!PARTS.includes(part)) throw new Error(`The part must be one of: ${PARTS.join(', ')}`);
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => /^\s+audio:\s*$/.test(line));
  if (start === -1) throw new Error(`${SITE} has no name.audio block`);
  const indent = lines[start].search(/\S/);
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    // The block ends at the first line that is not indented deeper than `audio:`.
    if (line.trim() !== '' && line.search(/\S/) <= indent) break;
    if (new RegExp(`^\\s+${part}:\\s`).test(line)) {
      lines[index] = line.replace(/:\s.*$/, `: ${fileName}`);
      return lines.join('\n');
    }
  }
  throw new Error(`${SITE} has no name.audio.${part}`);
}

export async function importAudio(source, part) {
  const fileName = `name-${part}.m4a`;
  await promisify(execFile)('afconvert', ['-f', 'm4af', '-d', 'aac', '-c', '1', '-b', '64000', source, `${AUDIO_DIR}/${fileName}`]);
  await writeFile(SITE, withAudio(await readFile(SITE, 'utf8'), part, fileName));
  return fileName;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [source, part] = process.argv.slice(2);
  if (!source || !PARTS.includes(part)) {
    console.error('Usage: node scripts/import-audio.mjs <recording> first|last');
    process.exit(1);
  }
  const fileName = await importAudio(source, part);
  console.log(`Wrote ${AUDIO_DIR}/${fileName} and updated ${SITE}. Listen to it, then remove the file it replaced.`);
}
