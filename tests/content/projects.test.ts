import { describe, it, expect } from 'vitest';
import { featuredSlugs, moreSlugs, readProjects } from './helpers';
import { wordCount } from '../../src/lib/text';

const projects = readProjects();
const bySlug = (slug: string) => {
  const project = projects.find((p) => p.slug === slug);
  if (!project) throw new Error(`No project file for ${slug}`);
  return project;
};
const featured = featuredSlugs();
const more = moreSlugs();

describe('projects', () => {
  it('has featured projects and more projects', () => {
    expect(featured.length).toBeGreaterThan(0);
    expect(more.length).toBeGreaterThan(0);
  });

  it('numbers featured projects 1 to n with no gaps or repeats', () => {
    const numbers = featured.map((slug) => bySlug(slug).data.featured);
    expect(numbers).toEqual(featured.map((_, index) => index + 1));
  });

  it.each(featured)('featured project %s has a brief three-part body', (slug) => {
    const { body } = bySlug(slug);
    expect(body.match(/^## .+$/gm)).toEqual(['## Problem', '## What I built', '## Result']);
    expect(wordCount(body)).toBeLessThanOrEqual(120);
    expect(wordCount(body)).toBeGreaterThan(30);
  });

  it.each(more)('%s has no body, because it has no page', (slug) => {
    expect(bySlug(slug).body.trim()).toBe('');
  });

  it('words the two awards exactly', () => {
    expect(bySlug('curiding').data.award).toEqual({ name: "People's Choice", event: 'cuHacking 7' });
    expect(bySlug('ecocart').data.award).toEqual({
      name: 'Best AI for Environmental Impact',
      event: 'AGI Ventures Canada Hackathon 3.0',
    });
  });

  it('links both cuRiding repositories', () => {
    const { links } = bySlug('curiding').data;
    expect(links.repo).toBe('https://github.com/Siddigz/cuRiding-pi');
    expect(links.extraRepos).toEqual(['https://github.com/Siddigz/cuRiding-Server']);
  });
});
