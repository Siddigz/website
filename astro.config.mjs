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
const variable = '@fontsource-variable';

export default defineConfig({
  fonts: [
    font('Bricolage Grotesque', '--font-bricolage', sans, [
      [`${variable}/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`, '200 800'],
    ]),
    font('Figtree', '--font-figtree', sans, [[`${variable}/figtree/files/figtree-latin-wght-normal.woff2`, '300 900']]),
  ],
  site: url,
  // The home page is the list of projects, so the bare folder address leads there.
  redirects: { '/projects': '/#projects' },
  image: { layout: 'constrained', responsiveStyles: true },
});
