---
name: e2e-tests
description: Write or fix Playwright tests in app/e2e that pass on slow CI runners and against a real fleet (smoke:live). Use when adding a spec, when a browser test flakes in CI, or when running the suite.
---

# Browser tests (app/e2e)

The suite runs the production build in Playwright's Chromium on mock fixtures (`?mock=1`). The helpers are in `fixtures.ts`: `app.open()`, `app.openWorktree()`, `app.chat`, `app.composer`, `app.panes`.

## Running

```sh
cd app && pnpm build
E2E_PORT=1427 npx playwright test e2e/thing.spec.ts           # a free port in 1421-1439
E2E_PORT=1427 npx playwright test e2e/thing.spec.ts --repeat-each=5   # before calling a fix done
```

`E2E_WORKERS` sets the worker count; CI uses 6 on omarchy and 2 on hosted runners.

## Don't flake on a slow runner

Every flake fixed so far was one of these:

- **Never read state once right after an action.** Focus, layout and image loads settle a moment later. Use `await expect.poll(() => …).toBe(…)` or a web-first assertion (`toBeVisible`, `toHaveAttribute`), never `expect(await …)` straight after `keyboard.press` or a click.
- **Wait for what you need, not for time.** No `waitForTimeout`, except to let an animation finish before a screenshot or axe.
- **Expect in-between states.** A resize, a reconnect or a re-render can show a stale frame or value first. Accept the right one within the timeout; don't fail on the first wrong one.
- **Images and blob URLs** can take more than 10 s on a busy runner. Give them the timeout, or assert on the app's own state instead.

## Live runs (`pnpm smoke:live`)

`smoke:live` runs the same specs against the real laptop agent (`VITE_BERTH_TOKEN` in env, never in the URL).

- A test that needs mock data or would write to a box starts with `mockOnly("why")`.
- A test that opens an agent's chat uses `await agentWorktree(app, "devl/checkout-fix")`, never a hard-coded mock worktree name. It unfolds the sidebar's "N more worktrees" and picks one with an agent.
- A real fleet may have no agent running. Chat tests can't pass then; that's the fleet, not a bug.

## Accessibility (`a11y.spec.ts`)

By default, axe runs in Berth Dark over one state per screen (`a11y-scenes.ts`). `A11Y_FULL=1` adds Berth Light and the scenes marked `extra`. `A11Y_THEMES=all` checks key screens' contrast in every theme. A new screen gets a scene; another state of an existing screen gets `extra: true`. Input borders are deliberately subtle: don't raise them for contrast.

## New specs

- Use the mock's synthetic fixtures ("acme"). Add to `src/lib/mock*.ts` if you need more.
- Seeded prefs get `whatsNewSeen` by default, so the What's new note stays away unless the test is about it.
- One behaviour per test, named as a sentence about what the user gets.
