# Siddig Ahmed — Portfolio

A high-performance, native portfolio site built with pure HTML, CSS, and vanilla JavaScript. No frameworks, no build step — just static files that load fast and work everywhere.

## Features

- **Native light/dark mode** — CSS variable theming with a toggle that persists your preference in `localStorage` (no flash on reload)
- **Responsive CSS grid layouts** — hero, projects, and skills sections reflow cleanly from desktop to mobile
- **Minimal engineering aesthetic** — system sans-serif body text, JetBrains Mono for technical labels, tags, and metadata
- **Accessible navigation** — semantic HTML, smooth scrolling with sticky-header offsets, and mobile-friendly meta tags

## Project structure

```
index.html   # Page structure and content
style.css    # Theming, layout, and component styles
app.js       # Theme toggle and browser UI sync
```

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then visit `http://localhost:8000`.

## Deployment

This site is static — deploy the root directory to any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.). No install or build command required.

## License

All rights reserved © Siddig Ahmed.
