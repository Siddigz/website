import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';
import { parse } from 'yaml';

// The site address lives in one place: src/content/site.yaml.
const { url } = parse(readFileSync(new URL('./src/content/site.yaml', import.meta.url), 'utf8')).main;

// Fonts are files from installed packages, copied into the build. No page asks
// another site for a font, and no build depends on a font CDN.
const fonts = fontProviders.local();
const font = (name, cssVariable, fallbacks, variants) => ({
  provider: fonts,
  name,
  cssVariable,
  fallbacks,
  options: {
    variants: variants.map(([file, weight, style = 'normal']) => ({ src: [file], weight, style })),
  },
});
const sans = ['system-ui', 'sans-serif'];
const mono = ['ui-monospace', 'monospace'];
const variable = '@fontsource-variable';

export default defineConfig({
  // One family per role per look (stage 2). The unused ones go when a look is chosen.
  fonts: [
    font('Geist', '--font-geist', sans, [[`${variable}/geist/files/geist-latin-wght-normal.woff2`, '100 900']]),
    font('Geist Mono', '--font-geist-mono', mono, [
      [`${variable}/geist-mono/files/geist-mono-latin-wght-normal.woff2`, '100 900'],
    ]),
    font('Bricolage Grotesque', '--font-bricolage', sans, [
      [`${variable}/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`, '200 800'],
    ]),
    font('Figtree', '--font-figtree', sans, [[`${variable}/figtree/files/figtree-latin-wght-normal.woff2`, '300 900']]),
    font('Fraunces', '--font-fraunces', ['Georgia', 'serif'], [
      [`${variable}/fraunces/files/fraunces-latin-wght-normal.woff2`, '100 900'],
      [`${variable}/fraunces/files/fraunces-latin-wght-italic.woff2`, '100 900', 'italic'],
    ]),
    font('IBM Plex Sans', '--font-plex-sans', sans, [
      [`${variable}/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2`, '100 700'],
    ]),
    font('IBM Plex Mono', '--font-plex-mono', mono, [
      ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', '400'],
      ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', '500'],
    ]),
  ],
  site: url,
  // The home page is the list of projects, so the bare folder address leads there.
  redirects: { '/projects': '/#projects' },
  image: { layout: 'constrained', responsiveStyles: true },
});
