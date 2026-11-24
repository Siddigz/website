import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import sharp from 'sharp';
import { DRAWINGS, DRAWING_SIZE, drawingSvg, packetDrawing } from '../../src/lib/explainers/drawings';

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

  it('follow a packet: a row of stops with one current and a stretch of fiber, over the packet as four nested layers', () => {
    const shapes = packetDrawing();
    const of = (role: string) => shapes.filter((shape) => shape.role === role);
    const stops = shapes.filter((shape) => shape.role.startsWith('stop'));
    expect(stops.length).toBeGreaterThanOrEqual(5);
    expect(of('stop-now')).toHaveLength(1);
    expect(of('fiber')).toHaveLength(1);
    // The current stop is drawn larger, so colour is not the only sign.
    expect(Number(of('stop-now')[0]!.attrs.r)).toBeGreaterThan(Number(of('stop')[0]!.attrs.r));
    // Each layer sits wholly inside the one before it, below the row of stops.
    const boxes = ['layer-eth', 'layer-ip', 'layer-tcp', 'layer-data'].map((role) => {
      expect(of(role)).toHaveLength(1);
      const { x, y, width, height } = of(role)[0]!.attrs as Record<string, number>;
      return { left: x!, top: y!, right: x! + width!, bottom: y! + height! };
    });
    const lowestStop = Math.max(...stops.map((stop) => Number(stop.attrs.cy) + Number(stop.attrs.r)));
    expect(boxes[0]!.top).toBeGreaterThan(lowestStop);
    for (let index = 1; index < boxes.length; index += 1) {
      const [outer, inner] = [boxes[index - 1]!, boxes[index]!];
      expect(inner.left).toBeGreaterThan(outer.left);
      expect(inner.top).toBeGreaterThan(outer.top);
      expect(inner.right).toBeLessThan(outer.right);
      expect(inner.bottom).toBeLessThan(outer.bottom);
    }
    // Values a router has just changed are marked in the two layers it touches, and nowhere else.
    const inside = (shape: (typeof shapes)[number], box: (typeof boxes)[number]) => Number(shape.attrs.y) > box.top && Number(shape.attrs.y) < box.bottom;
    const changed = of('changed');
    expect(changed.length).toBeGreaterThanOrEqual(2);
    for (const chip of changed) expect(inside(chip, boxes[2]!)).toBe(false);
  });

  it('refuses to draw a part it has no colour for, rather than leave it out silently', () => {
    expect(() => drawingSvg(DRAWINGS[slugs[0]!]!(), {})).toThrow(/colour/);
  });
});
