import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { faviconPng, faviconSvg } from '../../src/lib/favicon';
import { declaredValue, toHex } from '../../src/lib/colour';

const accent = toHex(declaredValue(readFileSync('src/styles/tokens.css', 'utf8'), '--color-accent-light'));

describe('favicon', () => {
  it('is drawn from shapes alone: no text and no font, so it looks the same everywhere', async () => {
    const svg = await faviconSvg('AB');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<text|font-family|<style|<image|href/);
    expect(svg).toMatch(/<path/);
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  it('sits on the accent colour from the design tokens', async () => {
    expect((await faviconSvg('AB')).toLowerCase()).toContain(accent);
  });

  it('changes with the initials', async () => {
    expect(await faviconSvg('AB')).not.toBe(await faviconSvg('CD'));
    expect(await faviconSvg('AB')).toBe(await faviconSvg('AB'));
  });

  it.each([32, 180])('makes a square PNG %i pixels across, filled to the corners where asked', async (size) => {
    const png = await faviconPng('AB', size, { square: size === 180 });
    const { width, height, format } = await sharp(png).metadata();
    expect([width, height, format]).toEqual([size, size, 'png']);
    const corner = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
    // A phone's home screen rounds the corners itself, so that one has none; the tab icon is rounded.
    expect(corner[3]).toBe(size === 180 ? 255 : 0);
  });
});
