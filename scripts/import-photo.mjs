// Copies an image into the repo safely: applies its stored rotation, limits
// its width, and writes no metadata (location, camera, timestamps).
//
//   node scripts/import-photo.mjs <source> <dest.jpg|dest.png>
import { mkdir } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_WIDTH = 2000;

/**
 * @param {string} source
 * @param {string} dest Its extension picks the output format.
 * @returns {Promise<void>}
 */
export async function importPhoto(source, dest) {
  const extension = extname(dest).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
    throw new Error(`Destination must end in .jpg, .jpeg or .png, got "${dest}"`);
  }

  await mkdir(dirname(dest), { recursive: true });

  // sharp drops all metadata unless told to keep it. rotate() bakes in the
  // orientation that the dropped metadata would otherwise have carried.
  const image = sharp(source).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (extension === '.png') await image.png().toFile(dest);
  else await image.jpeg({ quality: 85, mozjpeg: true }).toFile(dest);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [source, dest] = process.argv.slice(2);
  if (!source || !dest) {
    console.error('Usage: node scripts/import-photo.mjs <source> <dest.jpg|dest.png>');
    process.exit(1);
  }
  await importPhoto(source, dest);
  console.log(`Imported ${dest}`);
}
