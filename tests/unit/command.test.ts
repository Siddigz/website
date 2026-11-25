import { describe, it, expect } from 'vitest';
import { filterItems, moveActive, type CommandItem } from '../../src/lib/command';
import { commandItems } from '../../src/lib/command-items';

const items: CommandItem[] = [
  { id: 'section-about', group: 'sections', label: 'About', href: '/#about' },
  { id: 'project-ecocart', group: 'projects', label: 'EcoCart', href: '/projects/ecocart', keywords: 'React Chrome extension' },
  { id: 'project-curiding', group: 'projects', label: 'cuRiding', href: '/projects/curiding', keywords: 'Raspberry Pi Python' },
  { id: 'project-curate', group: 'projects', label: 'curate', href: 'https://github.com/Siddigz/curate', keywords: 'TypeScript' },
  { id: 'link-github', group: 'links', label: 'GitHub', href: 'https://github.com/Siddigz' },
  { id: 'theme', group: 'theme', label: 'Switch to dark theme', action: 'toggle-theme', keywords: 'Switch to light theme' },
];
const ids = (found: CommandItem[]) => found.map((item) => item.id);

describe('filterItems', () => {
  it('keeps the items that hold every word of the query, in order', () => {
    expect(ids(filterItems(items, 'cur rid'))).toEqual(['project-curiding']);
    expect(ids(filterItems(items, 'cur'))).toEqual(['project-curiding', 'project-curate']);
  });

  it('ignores case, accents and stray spaces', () => {
    expect(ids(filterItems(items, 'ECO'))).toEqual(['project-ecocart']);
    expect(ids(filterItems(items, '  écö  '))).toEqual(['project-ecocart']);
  });

  it('looks in the keywords as well as the label', () => {
    expect(ids(filterItems(items, 'python'))).toEqual(['project-curiding']);
    expect(ids(filterItems(items, 'light'))).toEqual(['theme']);
  });

  it('gives everything for an empty query and nothing when no item matches', () => {
    expect(filterItems(items, '')).toEqual(items);
    expect(filterItems(items, '   ')).toEqual(items);
    expect(filterItems(items, 'zzz')).toEqual([]);
  });
});

describe('moveActive', () => {
  it('steps forward and back, wrapping at both ends', () => {
    expect(moveActive(3, 0, 1)).toBe(1);
    expect(moveActive(3, 2, 1)).toBe(0);
    expect(moveActive(3, 0, -1)).toBe(2);
    expect(moveActive(3, 1, -1)).toBe(0);
  });

  it('starts from the right end when nothing is active yet', () => {
    expect(moveActive(3, -1, 1)).toBe(0);
    expect(moveActive(3, -1, -1)).toBe(2);
  });

  it('is -1 when there is nothing to move through', () => {
    expect(moveActive(0, -1, 1)).toBe(-1);
    expect(moveActive(0, 0, -1)).toBe(-1);
  });
});

describe('commandItems', () => {
  const built = commandItems({
    sections: [
      { id: 'experience', label: 'Experience' },
      { id: 'about', label: 'About' },
    ],
    projects: [
      { title: 'EcoCart', href: '/projects/ecocart', keywords: 'React' },
      { title: 'curate', href: 'https://github.com/Siddigz/curate', keywords: 'TypeScript' },
    ],
    explainers: [{ title: 'One packet', href: '/playground/one-packet' }],
    links: [{ label: 'GitHub', href: 'https://github.com/Siddigz' }],
    theme: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  });

  it('lists sections, projects, explainers, links and the theme switch, in that order', () => {
    expect(built.map((item) => item.group)).toEqual(['sections', 'sections', 'projects', 'projects', 'explainers', 'links', 'theme']);
    expect(built.map((item) => item.label)).toEqual([
      'Experience', 'About', 'EcoCart', 'curate', 'One packet', 'GitHub', 'Switch to dark theme',
    ]);
  });

  it('points sections at the home page, so they work from any page', () => {
    expect(built[0]!.href).toBe('/#experience');
    expect(built[1]!.href).toBe('/#about');
  });

  it('gives every item its own id, usable as an element id', () => {
    const all = built.map((item) => item.id);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('makes the theme switch an action that both of its labels find', () => {
    const theme = built.at(-1)!;
    expect(theme.action).toBe('toggle-theme');
    expect(theme.href).toBeUndefined();
    expect(ids(filterItems(built, 'light'))).toEqual([theme.id]);
    expect(ids(filterItems(built, 'dark'))).toEqual([theme.id]);
  });

  it('leaves out a group that has nothing in it', () => {
    const none = commandItems({ sections: [], projects: [], explainers: [], links: [], theme: { toDark: 'a', toLight: 'b' } });
    expect(none.map((item) => item.group)).toEqual(['theme']);
  });
});
