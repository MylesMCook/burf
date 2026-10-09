---
name: e2e-tests
description: Write or fix the existing Playwright acceptance tests in app/e2e using synthetic fixtures. Use when adding a spec, when a browser test flakes in CI, or when running the suite.
---

# Browser tests (app/e2e)

The suite runs in Playwright's Chromium on mock fixtures (`?mock=1`). The helpers are in `fixtures.ts`: `app.open()`, `app.openWorktree()`, `app.chat`, `app.composer`, `app.panes`. The speed budgets in `AGENTS.md` ("Speed Is A Requirement") bind every case here.

## Running

```sh
cd app && E2E_DEV=1 pnpm exec playwright test thing.spec.ts   # one spec, dev server, no build
scripts/check-local.sh                                        # before a push: only the specs the change reaches
```

Never run the whole suite locally: it runs on the hosted runner after a merge and blocks nothing. `E2E_WORKERS` overrides the worker count.

## Assertions and permissions

Use observable assertions for the accepted behavior. No fixed waits, retries
or longer timeouts to get a pass. A case over 5 seconds is fixed or deleted;
logic that needs no real page belongs in a Node unit test; a cut feature's
cases go in the same change. Zero tests or skipped cases do not prove
acceptance.

Keep `BERTH_E2E_LIVE` unset for mutation acceptance tests. Live fleet checks,
installed providers and signed-in browsers require their own explicit scope;
this skill does not authorize connecting to or changing a real agent. Use the
existing suite and lockfile; do not add another browser stack or dependencies.

## Accessibility (`a11y.spec.ts`)

By default, axe runs in Berth Dark over one state per screen (`a11y-scenes.ts`). `A11Y_FULL=1` adds Berth Light and the scenes marked `extra`. `A11Y_THEMES=all` checks key screens' contrast in every theme. A new screen gets a scene; another state of an existing screen gets `extra: true`. Input borders are deliberately subtle: don't raise them for contrast.

## New specs

- Use the mock's synthetic fixtures ("acme"). Add to `src/lib/mock*.ts` if you need more.
- Seeded prefs get `whatsNewSeen` by default, so the What's new note stays away unless the test is about it.
- One behaviour per test, named as a sentence about what the user gets.
