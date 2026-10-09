---
name: e2e-tests
description: Write or fix the existing Playwright acceptance tests in app/e2e using synthetic fixtures. Use when adding a spec, when a browser test flakes in CI, or when running the suite.
---

# Browser tests (app/e2e)

The suite runs the production build in Playwright's Chromium on mock fixtures (`?mock=1`). The helpers are in `fixtures.ts`: `app.open()`, `app.openWorktree()`, `app.chat`, `app.composer`, `app.panes`.

## Running

```sh
cd app && pnpm build
E2E_PORT=1435 pnpm exec playwright test e2e/thing.spec.ts --workers=2
```

`E2E_WORKERS` sets the worker count; CI uses 6 on omarchy and 2 on hosted runners.

## Assertions and permissions

Use observable assertions for the accepted behavior. Do not weaken existing
assertions, skip a failing case, add retries/sleeps or extend timeouts to get a
pass. Tests that cannot run because of the environment remain unverified;
record the error and actual counts. Zero tests or skipped cases do not prove
acceptance. Main-push and pull-request E2E remain blocking in CI.

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
