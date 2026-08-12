# how to FL

Everything we wish someone had told us before we landed in Beijing on the **Future Leaders
International Undergraduate Double Degree Programme** at Peking University (Guanghua School
of Management).

Written by us, for whoever comes next. → **[how-to-fl.github.io](https://how-to-fl.github.io)**

## Want to add something?

Read **[CONTRIBUTING.md](CONTRIBUTING.md)**. You don't need to code, and you don't need
GitHub to load — there's a way round that, because for most of us in Beijing it often won't.

If you'd rather not touch Markdown, run the editor:

```bash
npm install && npm run admin
```

That gives you forms for every place on the map and every page on the site, at
`http://localhost:4400`. It edits the real files on your laptop; commit when you're happy.

## What's where

| Path | What it is |
|---|---|
| `src/content/docs/` | Every page, as Markdown. Edit these to change what we say. |
| `data/places.yaml` | Every pin on the map. One file, one block per place. |
| `src/components/BeijingMap.astro` | The map. |
| `scripts/admin-server.mjs` | The local editing panel (`npm run admin`). |
| `scripts/validate.mjs` | Pre-build checks — coordinate sanity, external assets. |
| `scripts/sync-vendor.mjs` | Copies MapLibre into `public/`. See the note below. |
| `public/basemap/` | The Beijing basemap, glyphs and sprites we serve ourselves. |

## How it's built

[Astro](https://astro.build) + [Starlight](https://starlight.astro.build), deployed to
GitHub Pages. Search is [Pagefind](https://pagefind.app), built into the site itself. The
map is [MapLibre](https://maplibre.org) over a [Protomaps](https://protomaps.com) basemap.

Two constraints shape basically every technical decision, both because our readers are
behind the Great Firewall:

1. **Everything is same-origin.** No CDNs, no Google Fonts, no `raw.githubusercontent.com`.
   Anything on someone else's domain can be blocked independently of us, and blocked assets
   don't degrade — they hang. Our build fails if it finds one.
2. **Coordinates are WGS-84 only.** Amap and Baidu use deliberately offset systems. See
   [CONTRIBUTING.md](CONTRIBUTING.md#1-put-a-place-on-the-map). The build enforces this too.

### Two things that will bite you

**MapLibre must not be bundled.** It works out where its Web Worker lives from its own
`import.meta.url`, so bundling it breaks the worker handshake — and the map then hangs on a
blank canvas without emitting a single error. `scripts/sync-vendor.mjs` copies it into
`public/vendor/` instead, and we import it from there at runtime. That script runs
automatically before `dev` and `build`; its output is gitignored.

**Sprite and glyph URLs must be absolute.** MapLibre 6 rejects a root-relative sprite URL
and that aborts the whole style load. Build them from `location.origin` by string
concatenation, not `new URL()` — the latter percent-encodes the `{fontstack}` braces and
breaks the template substitution.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Local preview at `localhost:4321` |
| `npm run admin` | The editing panel at `localhost:4400` |
| `npm run validate` | The checks our build runs |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Keeping it alive

This outlives any one of us. The **Guide Steward** hands over from one cohort to the next
each May, along with a sweep where everyone re-checks the pages they look after. Domain and
deploy credentials live in the shared vault, never on one person's laptop.

Current steward: _to be filled in_
