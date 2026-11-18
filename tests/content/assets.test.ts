import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { readProjects, readMarkdown } from './helpers';

const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const images = files('src/assets').filter((path) => RASTER.has(extname(path).toLowerCase()));

describe('images', () => {
  // Rule 8a: phone photos record where they were taken.
  it.each(images)('%s carries no camera or location metadata', async (path) => {
    const meta = await sharp(path).metadata();
    expect(meta.exif, 'EXIF').toBeUndefined();
    expect(meta.xmp, 'XMP').toBeUndefined();
    expect(meta.iptc, 'IPTC').toBeUndefined();
  });

  it.each(images)('%s is under 1 MB', (path) => {
    expect(statSync(path).size).toBeLessThan(1024 * 1024);
  });

  it('every image in src/assets is used by some content file or component', () => {
    const referenced = [
      ...readProjects().flatMap((p) => [p.data.cover, ...(p.data.gallery ?? []).map((g: { src: string }) => g.src)]),
      ...readMarkdown('src/content/about.md').data.photos.map((photo: { src: string }) => photo.src),
    ]
      .filter(Boolean)
      .map((path: string) => path.replace(/^(\.\.\/)+/, 'src/'));
    const unused = images.filter((path) => !path.includes('/logos/') && !referenced.includes(path));
    expect(unused).toEqual([]);
  });
});
