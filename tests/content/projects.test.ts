import { describe, it, expect } from 'vitest';
import { readProjects } from './helpers';
import { wordCount } from '../../src/lib/text';

const FEATURED = [
  'curiding',
  'alternative-signals',
  'brightspace-deadlines',
  'visioncompanion',
  'ecocart',
  'cpu-cache-benchmark',
];
const MORE = [
  'curate',
  'schedule-scoop',
  'north-star',
  'pdf-merger',
  'markit',
  'student-management-system',
  'relational-algebra-query-processor',
];

const projects = readProjects();
const bySlug = (slug: string) => {
  const project = projects.find((p) => p.slug === slug);
  if (!project) throw new Error(`No project file for ${slug}`);
  return project;
};

describe('launch projects', () => {
  it('has exactly the launch projects', () => {
    expect(projects.map((p) => p.slug).sort()).toEqual([...FEATURED, ...MORE].sort());
  });

  it('features the six in the agreed order', () => {
    const order = projects
      .filter((p) => p.data.featured !== undefined)
      .sort((a, b) => a.data.featured - b.data.featured);
    expect(order.map((p) => p.slug)).toEqual(FEATURED);
    expect(order.map((p) => p.data.featured)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it.each(FEATURED)('%s has a brief three-part body', (slug) => {
    const { body } = bySlug(slug);
    expect(body.match(/^## .+$/gm)).toEqual(['## Problem', '## What I built', '## Result']);
    expect(wordCount(body)).toBeLessThanOrEqual(120);
    expect(wordCount(body)).toBeGreaterThan(30);
  });

  it.each(MORE)('%s has no body', (slug) => {
    expect(bySlug(slug).body.trim()).toBe('');
  });

  it('words the two awards exactly', () => {
    expect(bySlug('curiding').data.award).toEqual({ name: "People's Choice", event: 'cuHacking 7' });
    expect(bySlug('ecocart').data.award).toEqual({
      name: 'Best AI for Environmental Impact',
      event: 'AGI Ventures Canada Hackathon 3.0',
    });
    const awarded = projects.filter((p) => p.data.award).map((p) => p.slug).sort();
    expect(awarded).toEqual(['curiding', 'ecocart']);
  });

  it('links both cuRiding repositories', () => {
    const { links } = bySlug('curiding').data;
    expect(links.repo).toBe('https://github.com/Siddigz/cuRiding-pi');
    expect(links.extraRepos).toEqual(['https://github.com/Siddigz/cuRiding-Server']);
  });
});
