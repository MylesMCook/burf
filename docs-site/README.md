# Berth docs site

The documentation at [docs.berthd.app](https://docs.berthd.app), built with
[Fumadocs](https://fumadocs.dev) on Next.js.

## Where the content lives

Not here. The pages are the repository's own [`docs/`](../docs) folder, next
to the code they describe, so a change to Berth and its docs land in one
commit:

```text
docs/
  index.mdx              the home page (/)
  meta.json              sidebar order and section labels
  getting-started/       install, add a box, first project, first agent
  concepts/              how Berth works, boxes, projects, sessions, security
  guides/                orchestration, automations, hooks, kits, plugins, …
  reference/             CLI, berthd, config, events, app API, plugin SDK
```

- Each page is MDX with `title` and `description` frontmatter. The file's
  path is its URL: `docs/guides/kits.mdx` is `/guides/kits`.
- Each folder's `meta.json` orders its pages; the root one lists the sections.
- Link between pages by URL (`/guides/hooks#gates`).
- Components available in pages without importing: `Callout`
  (`type="warn"` for the amber one), `Cards`/`Card`, `Steps`/`Step`,
  `Tabs`/`Tab`, and `Scene` (a harbour drawing; use sparingly).
- Braces and angle brackets in prose are MDX: put `{{variables}}` and
  `<placeholders>` in backticks.

## Run it

```sh
pnpm install
pnpm dev       # http://localhost:3333, reloads as you edit docs/
pnpm build     # what CI and Vercel run
pnpm start     # serve the build on :3333
```

Node 22 and pnpm 11. `pnpm build` fails on a page with broken MDX or
frontmatter, so CI (the `docs-site` job in `.github/workflows/ci.yml`)
catches those.

## How it's put together

| File | What it does |
| --- | --- |
| `lib/source.ts` | Reads `../docs` with `fumadocs-mdx`, at the site's root URL |
| `next.config.mjs` | Sets the build's root to the repository, so `../docs` and the fonts in `../site/assets/fonts` are inside it |
| `app/(docs)/` | The docs layout and the page route |
| `app/not-found.tsx` | The 404 page |
| `app/api/search/route.ts` | Built-in search (Orama) |
| `app/global.css` | The brand: colours, type, callouts, code, tables |
| `lib/code-themes.ts` | The quiet code themes, light and dark |
| `components/art/` | The harbour scenes, copied from `app/src/components/art/` |
| `components/search.tsx` | The search dialog, with suggestions and an empty state |
| `components/callout.tsx` | Callouts without coloured side stripes |

The look follows the landing page (`site/`) and the brand board
(`design/brand/`): Inter and JetBrains Mono (ligatures off), cool neutrals,
amber only for the logo's dot, the one lamp in a drawing, or a warning;
sentence-case labels; no coloured stripes down the side of anything. The
theme follows the system, light or dark.

When the app's scenes change, copy `app/src/components/art/scenes.tsx` and
`scenes.css` here again, keeping this copy's imports.

## Deploying

Vercel, with the project's root directory set to `docs-site` (and files
outside it included in the build, which is Vercel's default). The site's URL
is set in `lib/shared.ts`.
