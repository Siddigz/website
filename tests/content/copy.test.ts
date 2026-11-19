import { describe, it, expect } from 'vitest';
import { readMarkdown, readProjects, readYaml, textFiles } from './helpers';
import { wordCount } from '../../src/lib/text';

const site = readYaml('src/content/site.yaml')?.main;
const about = readMarkdown('src/content/about.md');

describe('copy', () => {
  it('avoids the old framing', () => {
    const banned = ['close to the metal', 'no framework', 'no build step', 'linux internals'];
    const hits = textFiles('src/content').flatMap(([path, text]) =>
      banned.filter((phrase) => text.toLowerCase().includes(phrase)).map((phrase) => `${path}: ${phrase}`),
    );
    expect(hits).toEqual([]);
  });

  it('about bio is at most 80 words', () => {
    expect(wordCount(about.body)).toBeGreaterThan(20);
    expect(wordCount(about.body)).toBeLessThanOrEqual(80);
  });

  it('words the Hack the North caption exactly', () => {
    const captions = about.data.photos.map((photo: { caption: string }) => photo.caption);
    expect(captions).toContain('Hack the North 2026, Waterloo');
  });

  it('pitch is one sentence of at most 22 words', () => {
    expect(site.pitch.trim().split(/\s+/).length).toBeLessThanOrEqual(22);
    expect(site.pitch.trim().match(/[.!?]/g)).toEqual(['.']);
    expect(site.pitch.trim().endsWith('.')).toBe(true);
  });

  it('shows the agreed facts', () => {
    expect(site.url).toBe('https://siddigz.com');
    expect(site.gpa).toBe('3.96/4.00');
    expect(site.expectedGraduation).toBe('April 2028');
    expect(site.lookingFor).toEqual({ enabled: true, text: 'Open to software engineering internships' });
    expect(site.contactNote.length).toBeGreaterThan(10);
    expect(site.school).toBe('Carleton University');
    expect(site.program).toBe('Computer Science (Honours), Minor in Mathematics');
  });

  it('writes project names as words, without the hyphens their repositories use', () => {
    const titles = readProjects().map((project) => project.data.title);
    for (const title of ['Alternative Signals', 'CPU Cache Benchmark', 'North Star', 'PDF Merger']) {
      expect(titles).toContain(title);
    }
    expect(titles.filter((title: string) => title.includes('-'))).toEqual([]);
  });

  it('gives every activity a year, in the same short form', () => {
    const { activities } = readMarkdown('src/content/about.md').data;
    for (const activity of activities) {
      expect(activity.role, activity.name).toMatch(/ · \d{4}(–\d{2})?( · |$)/);
      expect(activity.role.length, activity.name).toBeLessThanOrEqual(64);
    }
  });

  it('names no stream, since a stream can change', () => {
    expect(site.program).not.toMatch(/stream/i);
    expect(readMarkdown('src/content/about.md').body).not.toMatch(/stream/i);
  });

  it('words the scholarships with the amount and both names', () => {
    const { scholarship } = readYaml('src/content/proof.yaml');
    expect(scholarship.label).toBe('$16,000 in scholarships');
    expect(scholarship.detail).toEqual(['Faculty Scholarship, 2024', 'Jacob Freedman Scholarship, 2025 & 2026']);
  });

  it("lists only the confirmed Deans' Honour List years", () => {
    const proof = readYaml('src/content/proof.yaml');
    expect(proof['honour-list'].detail).toEqual(['2024–25', '2025–26']);
  });

  it('gives the same GPA in the proof strip as at the top', () => {
    const labels = Object.values(readYaml('src/content/proof.yaml')).map((item: any) => item.label);
    expect(labels).toContain(`GPA ${site.gpa}`);
  });

  it('does not call a current internship finished', () => {
    expect(site.pitch).not.toMatch(/behind me/i);
  });

  it('lists three roles and the skills in the agreed order', () => {
    const roles = Object.values(readYaml('src/content/experience.yaml')) as { title: string; order: number }[];
    expect(roles.sort((a, b) => a.order - b.order).map((role) => role.title)).toEqual([
      'Embedded Software Engineering Intern',
      'Software Engineering Intern',
      'Undergraduate Teaching Assistant',
    ]);
    expect(readYaml('src/content/skills.yaml').main.items.slice(0, 4)).toEqual([
      'Python', 'TypeScript', 'JavaScript', 'Java',
    ]);
  });
});
