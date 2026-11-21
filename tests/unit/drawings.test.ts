import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import sharp from 'sharp';
import { DRAWINGS, DRAWING_SIZE, drawingSvg } from '../../src/lib/explainers/drawings';

const slugs = readdirSync('src/content/explainers').filter((name) => name.endsWith('.md')).map((name) => name.replace(/\.md$/, ''));

describe('explainer drawings', () => {
  it('there is one for every explainer', () => {
    expect(Object.keys(DRAWINGS).sort()).toEqual([...slugs].sort());
  });

  it.each(slugs)('%s: every shape sits inside the picture and has a part to play', (slug) => {
    const shapes = DRAWINGS[slug]!();
    expect(shapes.length).toBeGreaterThan(5);
    for (const shape of shapes) {
      expect(shape.role).toMatch(/^[a-z][a-z-]*$/);
      for (const [name, value] of Object.entries(shape.attrs)) {
        if (typeof value !== 'number') continue;
        expect(value, `${shape.role} ${name}`).toBeGreaterThanOrEqual(0);
        expect(value, `${shape.role} ${name}`).toBeLessThanOrEqual(Math.max(DRAWING_SIZE.width, DRAWING_SIZE.height));
      }
    }
    expect(DRAWINGS[slug]!()).toEqual(shapes);
  });

  it.each(slugs)('%s: becomes a picture that stands on its own, in the colours it is given', async (slug) => {
    const roles = [...new Set(DRAWINGS[slug]!().map((shape) => shape.role))];
    const paint = Object.fromEntries(roles.map((role) => [role, { fill: '#cc2222', stroke: '#2222cc' }]));
    const svg = drawingSvg(DRAWINGS[slug]!(), paint);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/class=|var\(/);
    const { width, height } = await sharp(Buffer.from(svg)).png().metadata();
    expect([width, height]).toEqual([DRAWING_SIZE.width, DRAWING_SIZE.height]);
  });

  it('refuses to draw a part it has no colour for, rather than leave it out silently', () => {
    expect(() => drawingSvg(DRAWINGS[slugs[0]!]!(), {})).toThrow(/colour/);
  });
});
