import { describe, it, expect } from 'vitest';
import { readYaml, textFiles } from './helpers';

const site = readYaml('src/content/site.yaml').main;
// Rule 25: what a visitor reads comes from src/content/, never from a component.
const code = [...textFiles('src/components'), ...textFiles('src/pages'), ...textFiles('src/layouts'), ...textFiles('src/lib')].filter(
  // The explainers' own captions and labels are the owner's words for those two drawings and live beside their logic.
  ([path]) => !path.includes('explainers'),
);
const labels: string[] = [...Object.values(site.sections), ...Object.values(site.nav), site.activity.less, site.activity.more, site.activity.commits] as string[];

describe('section titles and labels', () => {
  it('site.yaml holds a title for every section of the home page and every nav link', () => {
    expect(Object.keys(site.sections).sort()).toEqual(['activity', 'contact', 'experience', 'moreProjects', 'projects', 'proof', 'skills']);
    expect(Object.keys(site.nav).sort()).toEqual(['about', 'experience', 'projects']);
    expect(site.activity.total).toContain('{n}');
  });

  it.each([...new Set(labels)])('"%s" is not typed into any component, page or library file', (label) => {
    // As the text of an element, or as a quoted string.
    const typed = new RegExp(`>\\s*${label}\\s*<|['"\`]${label}['"\`]`);
    const hits = code.filter(([, text]) => typed.test(text)).map(([path]) => path);
    expect(hits).toEqual([]);
  });
});
