# Angela Lau — portfolio

Static portfolio for [Angela Lau](https://www.linkedin.com/in/angela-lau-636969212/), rebuilt from the live Framer site at [angelalau.framer.website](https://angelalau.framer.website/). It is an [Astro](https://astro.build) site: plain HTML, CSS, and a small script, with one JSON file per project.

Published URL: [https://laua997.github.io/angela-portfolio/](https://laua997.github.io/angela-portfolio/)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Astro prints (usually `http://localhost:4321/angela-portfolio/`). The `/angela-portfolio` prefix matches GitHub Pages.

To check the production build:

```bash
npm run build
npm run preview
```

## Add or edit a project

Each project is a JSON file in `src/data/projects/`. Copy an existing file, give it a new `slug`, and fill in the fields:

| Field | What it is |
| --- | --- |
| `slug` | URL piece. `miya-deco-atelier` becomes `/projects/miya-deco-atelier/`. The filename should match. |
| `title` | Name shown on cards. The project page heading is this name in lowercase with a period. |
| `year`, `medium`, `size`, `category` | Overview facts. `category` must be `Graphic Design`, `2D`, or `3D` so the projects filter can find it. |
| `cover` | Image used on the home page and the projects index. Path is relative to `public/`, for example `images/my-cover.jpg`. |
| `images` | Gallery on the project page, top to bottom. Each item is `{ "src": "images/file.jpg", "alt": "short description" }`. |
| `paragraphs` | Overview copy. One string per paragraph. |
| `related` | Slugs of related projects, in order. |
| `order` | Position on the projects index. Lower numbers come first. The index flows top-to-bottom in three columns, matching the original. |

Put new images in `public/images/` and refer to them as `images/your-file.jpg`. Do not hotlink `framerusercontent.com` URLs.

Home page layout (which six projects are featured, and which two sit under “wins”) lives in `src/data/site.json` under `featured` and `wins`. Awards, the about text, fun facts, and outbound links are in that same file.

## How deploy works

Pushes to `main` run `.github/workflows/pages.yml`. The workflow installs dependencies, runs `npm run build`, and uploads the `dist/` folder to GitHub Pages. Astro is configured with `site: https://laua997.github.io` and `base: /angela-portfolio` so asset and page URLs include that path.

## Enable GitHub Pages

If the site is not live yet:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The next push to `main` (or a manual run of the “Deploy to GitHub Pages” workflow) publishes the site.

## Add a custom domain later

1. Add a `CNAME` file in `public/` containing only the domain, for example `angela.example.com`. Astro copies `public/` into the site root.
2. In **Settings → Pages**, set **Custom domain** to that domain and turn on **Enforce HTTPS** after the certificate is ready.
3. At the DNS host, add the records GitHub shows (an `A`/`AAAA` set for an apex domain, or a `CNAME` to `laua997.github.io` for a subdomain).
4. Change `site` in `astro.config.mjs` to `https://your-domain`. Keep `base: '/angela-portfolio'` only if the site stays in a subpath. For a domain that serves the site at `/`, set `base` to `'/'` and update the font and internal links by rebuilding.

## What was carried over

Pages: home, projects (all 18 works), about, and contact. Images and the Uncut Sans file used on the Framer site are stored in the repo. The floating menu, logo cursor, “explore project” hover cursor, scroll-in fades, menu open/close, about-page fun-fact folder, and a short crossfade between pages follow the original timing. `prefers-reduced-motion` turns the follower and motion off.
