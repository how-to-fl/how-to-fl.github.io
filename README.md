# how to FL

A survival guide for students arriving in Beijing on the **Future Leaders International
Undergraduate Double Degree Program** at Peking University (Guanghua School of Management).

Written by the cohorts, for the cohorts. → **[how-to-fl.github.io](https://how-to-fl.github.io)**

## Want to add something?

Read **[CONTRIBUTING.md](CONTRIBUTING.md)**. You don't need to code, and you don't need
GitHub to load — there's a fallback for that, because for most contributors in Beijing
it often won't.

## What's here

| Path | What it is |
|---|---|
| `src/content/docs/` | Every page, as Markdown. Edit these to change what the guide says. |
| `data/places.yaml` | Every pin on the map. One file, one entry per place. |
| `src/components/` | The freshness banner and other custom bits. |
| `scripts/validate.mjs` | Pre-build checks — coordinate sanity, external assets. |
| `.github/workflows/` | Build, validate, deploy to GitHub Pages. |

## Stack

[Astro](https://astro.build) + [Starlight](https://starlight.astro.build), deployed to
GitHub Pages. Search is [Pagefind](https://pagefind.app), built into the site itself.

Two constraints shape every technical decision, both because our readers are behind the
Great Firewall:

1. **Everything is same-origin.** No CDNs, no Google Fonts, no `raw.githubusercontent.com`.
   A third-party origin is something that can be blocked independently of this site, and
   blocked assets don't degrade — they hang. CI enforces this.
2. **Coordinates are WGS-84 only.** Amap and Baidu use deliberately offset systems.
   See [CONTRIBUTING.md](CONTRIBUTING.md#1-add-a-place-to-the-map). CI enforces this too.

## Local development

```bash
npm install
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Local preview at `localhost:4321` |
| `npm run validate` | The checks CI runs — places data and external assets |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Maintainers

This project outlives any one cohort. The **Guide Steward** role passes from Cohort N to
Cohort N+1 each May, along with a verification sweep of every page. Domain and deploy
credentials live in the shared vault, never on one person's laptop.

Current steward: _to be filled in_
