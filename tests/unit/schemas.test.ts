import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { projectSchema, experienceSchema, siteSchema } from '../../src/content/schemas';

const schema = projectSchema(() => z.string());
const base = {
  title: 'X',
  oneLiner: 'Does X.',
  category: 'web-apps',
  stack: ['TypeScript'],
  date: '2026-01',
  links: { repo: 'https://github.com/Siddigz/x' },
};

describe('projectSchema', () => {
  it('accepts a project with only required fields', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it('rejects an unknown category', () => {
    expect(schema.safeParse({ ...base, category: 'games' }).success).toBe(false);
  });
  it('rejects a repo outside the owner account', () => {
    expect(schema.safeParse({ ...base, links: { repo: 'https://github.com/other/x' } }).success).toBe(false);
  });
  it('rejects an extra repo outside the owner account', () => {
    const links = { repo: base.links.repo, extraRepos: ['https://github.com/other/y'] };
    expect(schema.safeParse({ ...base, links }).success).toBe(false);
  });
  it('rejects a featured project without result, cover and coverAlt', () => {
    expect(schema.safeParse({ ...base, featured: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, featured: 1, result: 'Won.', cover: './c.png', coverAlt: 'c' }).success).toBe(true);
  });
  it('rejects a cover with no alt text', () => {
    expect(schema.safeParse({ ...base, cover: './c.png' }).success).toBe(false);
  });
  it('rejects a malformed date', () => {
    expect(schema.safeParse({ ...base, date: 'Jan 2026' }).success).toBe(false);
  });
  it('lets a project have no date', () => {
    const { date, ...undated } = base;
    expect(schema.safeParse(undated).success).toBe(true);
  });
  it('takes a whole positive number as the order among compact projects', () => {
    expect(schema.safeParse({ ...base, order: 3 }).success).toBe(true);
    expect(schema.safeParse({ ...base, order: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...base, order: 1.5 }).success).toBe(false);
  });
  it('takes a web address for a post about the project, and nothing else', () => {
    const links = { repo: base.links.repo, post: 'https://www.linkedin.com/feed/update/urn:li:activity:1/' };
    expect(schema.safeParse({ ...base, links }).success).toBe(true);
    expect(schema.safeParse({ ...base, links: { ...links, post: 'see my profile' } }).success).toBe(false);
  });
  it('accepts only known cover fits', () => {
    const withCover = { ...base, cover: './c.png', coverAlt: 'c' };
    expect(schema.safeParse({ ...withCover, coverFit: 'contain' }).success).toBe(true);
    expect(schema.safeParse({ ...withCover, coverFit: 'stretch' }).success).toBe(false);
    expect(schema.parse(withCover).coverFit).toBe('cover');
  });
  it('accepts only known cover positions', () => {
    const withCover = { ...base, cover: './c.png', coverAlt: 'c' };
    expect(schema.safeParse({ ...withCover, coverPosition: 'center' }).success).toBe(true);
    expect(schema.safeParse({ ...withCover, coverPosition: 'sideways' }).success).toBe(false);
    expect(schema.parse(withCover).coverPosition).toBe('left top');
  });
  it('lets a compact project have no repository, but not a featured one', () => {
    const { links, ...noLinks } = base;
    expect(schema.safeParse(noLinks).success).toBe(true);
    const featured = { ...noLinks, featured: 1, result: 'Won.', cover: './c.png', coverAlt: 'c' };
    expect(schema.safeParse(featured).success).toBe(false);
  });
  it('rejects an empty stack', () => {
    expect(schema.safeParse({ ...base, stack: [] }).success).toBe(false);
  });
});

describe('experienceSchema', () => {
  const role = { organisation: 'Org', title: 'Intern', team: 'Team', start: '2026-01', order: 1 };
  it('accepts a role with no end date', () => {
    expect(experienceSchema.safeParse(role).success).toBe(true);
  });
  it('rejects a description', () => {
    expect(experienceSchema.safeParse({ ...role, description: 'Did things' }).success).toBe(false);
  });
});

describe('siteSchema', () => {
  it('requires the looking-for switch to be a boolean', () => {
    const site = {
      url: 'https://siddigz.com',
      name: { first: 'A', last: 'B', audio: { first: 'a.wav', last: 'b.wav', hint: 'Plays it.' } },
      pitch: 'p',
      lookingFor: { enabled: 'yes', text: 't' },
      program: 'p',
      school: 's',
      gpa: 'g',
      expectedGraduation: 'e',
      links: { github: 'https://github.com/Siddigz', linkedin: 'https://linkedin.com/in/x' },
      repository: 'https://github.com/Siddigz/website',
      contactNote: 'Say hello.',
      home: { city: 'Ottawa', timeZone: 'America/Toronto' },
      greeting: {
        neutral: 'n', morning: 'm', afternoon: 'a', evening: 'e', night: 'n', returning: 'r',
        times: '{yours} {mine} {city}', sameTime: '{time}',
      },
      seenLabel: 'Seen',
      explainers: { title: 'Explainers', back: 'Back', noScript: 'Needs scripts.' },
      resumeLabel: 'Resume',
      email: { button: 'Email', copy: 'Copy', copied: 'Copied', failed: 'f', noScript: 'n' },
      menu: { open: 'o', title: 't', search: 's', empty: 'e', groups: { sections: 'a', projects: 'b', explainers: 'c', links: 'd', theme: 'e' } },
      filter: { all: 'All', label: 'Filter', status: '{n} of {total}' },
    };
    expect(siteSchema.safeParse(site).success).toBe(false);
    expect(siteSchema.safeParse({ ...site, lookingFor: { enabled: false, text: 't' } }).success).toBe(true);
    // The name needs its two recordings and the hint read out on them.
    expect(siteSchema.safeParse({ ...site, lookingFor: { enabled: false, text: 't' }, name: { first: 'A', last: 'B' } }).success).toBe(false);
    // A time line that has lost a place for a value is refused.
    expect(siteSchema.safeParse({ ...site, lookingFor: { enabled: false, text: 't' }, greeting: { ...site.greeting, times: '{yours} {city}' } }).success).toBe(false);
    // The photo is optional, but one with no alt text is refused.
    const complete = { ...site, lookingFor: { enabled: false, text: 't' } };
    expect(siteSchema.safeParse({ ...complete, photo: { src: './me.jpg', alt: 'Me' } }).success).toBe(true);
    expect(siteSchema.safeParse({ ...complete, photo: { src: './me.jpg' } }).success).toBe(false);
  });
});
