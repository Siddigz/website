import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { parse } from 'yaml';

// The site address lives in one place: src/content/site.yaml.
const { url } = parse(readFileSync(new URL('./src/content/site.yaml', import.meta.url), 'utf8')).main;

// The two small scripts that are put in the head as they are. The security
// policy allows each by the hash of its exact text, worked out here.
const hashOf = (file) => `sha256-${createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('base64')}`;
const headScripts = ['./src/scripts/theme-early.js', './src/scripts/page-transition.js'].map(hashOf);

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
  // Pages are still built ahead of time. The adapter is only for the few
  // addresses that must answer at request time (email, resume, daily rebuild).
  adapter: vercel(),
  integrations: [
    // The list of pages for search engines: real pages only, each at the same
    // address its page calls its own (no trailing slash, except the home page).
    sitemap({
      filter: (page) => !/\/(dev|og|api)\//.test(page),
      serialize: (item) => ({ ...item, url: item.url.replace(/(?<=[^/])\/$/, '') }),
    }),
  ],
  fonts: [
    font('Bricolage Grotesque', '--font-bricolage', sans, [
      [`${variable}/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`, '200 800'],
    ]),
    font('Figtree', '--font-figtree', sans, [[`${variable}/figtree/files/figtree-latin-wght-normal.woff2`, '300 900']]),
  ],
  site: url,
  // Each page says what it may load and run: only this site's own files, and
  // only the scripts and styles whose hashes are listed. Anything else,
  // such as a script injected into the page, is refused by the browser.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "media-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: { hashes: headScripts },
    },
  },
  // The home page is the list of projects, so the bare folder address leads there.
  // Browsers ask for /favicon.ico without being told to; it leads to the small icon.
  redirects: { '/projects': '/#projects', '/favicon.ico': '/favicon-32.png' },
  image: { layout: 'constrained', responsiveStyles: true },
  // The stylesheets are small, so they travel inside each page: one less
  // round trip before anything can be drawn.
  build: { inlineStylesheets: 'always' },
});
