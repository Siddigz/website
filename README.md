# Siddig Ahmed — Portfolio

Personal portfolio site for Siddig Ahmed, a software engineering student focused on systems programming, Linux internals, and C/C++.

**Live site:** [siddigz.com](https://siddigz.com)

Built with plain HTML, CSS, and vanilla JavaScript — no frameworks, no build step, no dependencies. Static files only, so it loads fast and deploys anywhere.

## What's on the site

- **About** — intro and profile
- **Experience** — industry and academic roles
- **Involvement** — teams, hackathons, and leadership
- **Projects** — featured engineering work with links and tags
- **Skills** — languages, tools, and areas of focus
- **Contact** — email reveal, social links, and copy-to-clipboard

## Highlights

- **Light and dark mode** — CSS custom properties, toggle in the header, preference saved in `localStorage` with no flash on reload
- **Responsive layout** — CSS Grid sections that reflow from desktop to mobile
- **Scroll reveal** — subtle entrance animations via `IntersectionObserver`; disabled when `prefers-reduced-motion` is set
- **Accessible by default** — semantic HTML, ARIA labels, smooth scrolling with sticky-header offsets, and an inline SVG icon sprite
- **Minimal aesthetic** — Inter for body text, JetBrains Mono for technical labels and metadata

## Project structure

```
index.html              # Page structure and content
style.css               # Theming, layout, and component styles
app.js                  # Theme toggle, email reveal, scroll animations
assets/
  images/profile.jpg    # Profile photo
  logos/                # Employer and org logos (light/dark variants)
```

## Local development

Open `index.html` in a browser, or serve the folder with any static file server:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000).

## Deployment

The site is fully static. Deploy the repository root to any static host — no install or build command required. Production is hosted at [siddigz.com](https://siddigz.com).

## License

All rights reserved © Siddig Ahmed.
