import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { renderOg } from '../../src/lib/og';

describe('renderOg', () => {
  const card = { title: 'A project', line: 'One sentence about what it does and who it is for.', address: 'example.test' };

  it('draws a 1200 by 630 PNG', async () => {
    const png = await renderOg(card);
    const { width, height, format } = await sharp(png).metadata();
    expect([width, height, format]).toEqual([1200, 630, 'png']);
  });

  it('draws the picture and the badge when there are any', async () => {
    const picture = await sharp({ create: { width: 800, height: 500, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
    const plain = await renderOg(card);
    const withPicture = await renderOg({ ...card, picture });
    const withBadge = await renderOg({ ...card, badge: 'An award · An event' });
    expect(withPicture.equals(plain)).toBe(false);
    expect(withBadge.equals(plain)).toBe(false);
    // The red of the picture shows up on the right-hand side of the card, and stops short of the edge.
    const pixel = async (left: number, top: number) =>
      (await sharp(withPicture).extract({ left, top, width: 1, height: 1 }).removeAlpha().raw().toBuffer()) as Buffer;
    const inside = await pixel(900, 315);
    expect(inside[0]).toBeGreaterThan(150);
    expect(inside[1]).toBeLessThan(90);
    const margin = await pixel(1180, 315);
    expect(margin[1]).toBeGreaterThan(200);
  });

  it('shows the address in the bottom corner', async () => {
    const png = await renderOg(card);
    // Somewhere in the strip where the address sits, a pixel is not the background colour.
    const strip = await sharp(png).extract({ left: 64, top: 530, width: 300, height: 40 }).removeAlpha().raw().toBuffer();
    const background = [strip[0], strip[1], strip[2]];
    let differs = false;
    for (let index = 0; index < strip.length; index += 3) {
      if (Math.abs(strip[index]! - background[0]!) + Math.abs(strip[index + 2]! - background[2]!) > 60) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('keeps a long single word clear of the picture', async () => {
    const picture = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
    const png = await renderOg({ ...card, title: 'VisionCompanionPlus', picture });
    // The gap between the text column and the picture stays the background colour all the way down.
    const gap = await sharp(png).extract({ left: 640, top: 64, width: 30, height: 500 }).removeAlpha().raw().toBuffer();
    let darkest = 255;
    for (let index = 0; index < gap.length; index += 3) darkest = Math.min(darkest, gap[index + 1]!);
    expect(darkest).toBeGreaterThan(200);
  });

  it('copes with a very long title and line without failing', async () => {
    const png = await renderOg({ ...card, title: 'A very long project name '.repeat(6), line: 'Words and more words. '.repeat(30) });
    expect((await sharp(png).metadata()).width).toBe(1200);
  });

  it('gives the same picture for the same card', async () => {
    expect((await renderOg(card)).equals(await renderOg(card))).toBe(true);
  });
});
