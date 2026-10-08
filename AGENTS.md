# Burf Development

Read `FORK.md` for product direction and compatibility boundaries, `UPSTREAM.md`
for upstream intake, and the local `tasks.md` for cross-session status.
Preserve legacy state/protocol names and the disabled updater when changing
branding or packaging. Local checks do not authorize replacing installed apps
or restarting live agents.

## Frontend Checks

Use existing lockfiles and the existing Playwright Test suite; do not add a
second browser-test stack. From `app/`:

```sh
pnpm test
pnpm exec tsc --noEmit -p e2e
pnpm run build --logLevel error
pnpm exec playwright test chat-first.spec.ts chat.spec.ts chat-feed.spec.ts first-run.spec.ts local-computer.spec.ts windows-client.spec.ts diagnostics.spec.ts trust.spec.ts workspace.spec.ts --workers=2
```

These acceptance tests use synthetic fixtures and isolated loopback servers.
Leave `BERTH_E2E_LIVE` unset. Never point mutation tests at a real agent.
Playwright starts and stops its own preview server; `E2E_PORT` can select a free
port from 1421-1439. Build before running Playwright so it tests current source.
Native Windows execution and signed-in provider behavior require separate
evidence; a Chromium fixture run or cross-build does not verify either.
