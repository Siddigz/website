import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parse } from 'yaml';

/** Where a build leaves the files the host serves. */
export const BUILT = '.vercel/output/static';

export type ProjectFile = { slug: string; data: Record<string, any>; body: string };

/** Splits a Markdown file into its YAML frontmatter and body. */
export function readMarkdown(path: string): { data: Record<string, any>; body: string } {
  const source = readFileSync(path, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${path} has no frontmatter`);
  return { data: parse(match[1] ?? '') ?? {}, body: match[2] ?? '' };
}

export function readProjects(): ProjectFile[] {
  const dir = 'src/content/projects';
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ slug: name.replace(/\.md$/, ''), ...readMarkdown(join(dir, name)) }));
}

export function readYaml(path: string): any {
  return parse(readFileSync(path, 'utf8'));
}

const TEXT_EXTENSIONS = new Set([
  '.astro', '.ts', '.js', '.mjs', '.css', '.md', '.yaml', '.yml', '.json', '.html', '.svg', '.txt', '.xml',
]);

/** Every text file under `root`, as [path, contents] pairs. */
export function textFiles(root: string): [string, string][] {
  const found: [string, string][] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (TEXT_EXTENSIONS.has(extname(name))) found.push([path, readFileSync(path, 'utf8')]);
    }
  };
  try {
    walk(root);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return found;
}

export const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// Lists derived from the content files, so tests keep working when a project
// is added, removed or reordered.
import { featuredProjects, moreProjects } from '../../src/lib/projects';

const asEntries = () =>
  readProjects().map((project) => ({
    id: project.slug,
    data: project.data as { featured?: number; date?: string; order?: number },
  }));

export const featuredSlugs = (): string[] => featuredProjects(asEntries()).map((entry) => entry.id);
export const moreSlugs = (): string[] => moreProjects(asEntries()).map((entry) => entry.id);

/** Every page a visitor can reach from the home page. */
export const explainerSlugs = (): string[] =>
  readdirSync('src/content/explainers')
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''));

export const pagePaths = (): string[] => [
  '/',
  ...featuredSlugs().map((slug) => `/projects/${slug}`),
  ...explainerSlugs().map((slug) => `/explainers/${slug}`),
];
