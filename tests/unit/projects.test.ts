import { it, expect } from 'vitest';
import { featuredProjects, moreProjects, nextFeatured } from '../../src/lib/projects';

const p = (id: string, date?: string, featured?: number) => ({ id, data: { date, featured } });
const all = [p('c', '2025-03'), p('a', '2026-01', 2), p('b', '2025-03'), p('d', '2024-05', 1), p('e', '2026-06')];

it('featuredProjects sorts by featured number', () => {
  expect(featuredProjects(all).map((x) => x.id)).toEqual(['d', 'a']);
});

it('moreProjects sorts newest first, then by id', () => {
  expect(moreProjects(all).map((x) => x.id)).toEqual(['e', 'b', 'c']);
});

it('moreProjects puts projects with no date last, by id', () => {
  const mixed = [p('z'), ...all, p('y')];
  expect(moreProjects(mixed).map((x) => x.id)).toEqual(['e', 'b', 'c', 'y', 'z']);
});

it('nextFeatured wraps around', () => {
  expect(nextFeatured(all, 'd').id).toBe('a');
  expect(nextFeatured(all, 'a').id).toBe('d');
});

it('nextFeatured rejects a project that is not featured', () => {
  expect(() => nextFeatured(all, 'c')).toThrow(/not a featured project/);
});

it('the helpers do not reorder the list they are given', () => {
  const before = all.map((x) => x.id);
  featuredProjects(all);
  moreProjects(all);
  expect(all.map((x) => x.id)).toEqual(before);
});
