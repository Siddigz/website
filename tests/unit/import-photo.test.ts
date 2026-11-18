import { it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPhoto } from '../../scripts/import-photo.mjs';

it('strips metadata and limits width', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'photo-'));
  const src = join(dir, 'in.jpg');
  const out = join(dir, 'nested', 'out.jpg');
  await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#888' } })
    .withExif({ IFD0: { Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N' } })
    .jpeg()
    .toFile(src);
  expect((await sharp(src).metadata()).exif).toBeDefined();

  await importPhoto(src, out);

  const meta = await sharp(out).metadata();
  expect(meta.exif).toBeUndefined();
  expect(meta.width).toBe(2000);
  expect(meta.height).toBe(1000);
});

it('does not enlarge a small image', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'photo-'));
  const src = join(dir, 'in.png');
  const out = join(dir, 'out.png');
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#888' } }).png().toFile(src);
  await importPhoto(src, out);
  const meta = await sharp(out).metadata();
  expect(meta.width).toBe(800);
  expect(meta.format).toBe('png');
});

it('refuses a destination format it does not know', async () => {
  await expect(importPhoto('in.jpg', 'out.gif')).rejects.toThrow(/\.jpg, \.jpeg or \.png/);
});
