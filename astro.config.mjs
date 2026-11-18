import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { parse } from 'yaml';

// The site address lives in one place: src/content/site.yaml.
const { url } = parse(readFileSync(new URL('./src/content/site.yaml', import.meta.url), 'utf8')).main;

export default defineConfig({
  site: url,
  // The home page is the list of projects, so the bare folder address leads there.
  redirects: { '/projects': '/#projects' },
  image: { layout: 'constrained', responsiveStyles: true },
});
