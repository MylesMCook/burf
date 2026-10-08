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
pnpm exec playwright test remote-chat.spec.ts local-chat.spec.ts chat-first.spec.ts chat.spec.ts chat-feed.spec.ts first-run.spec.ts local-computer.spec.ts windows-client.spec.ts diagnostics.spec.ts trust.spec.ts workspace.spec.ts chat-experience.spec.ts agent-picker.spec.ts --workers=2
```

These acceptance tests use synthetic fixtures and isolated loopback servers.
Leave `BERTH_E2E_LIVE` unset. Never point mutation tests at a real agent.
Playwright starts and stops its own preview server; `E2E_PORT` can select a free
port from 1421-1439. Build before running Playwright so it tests current source.
Native Windows execution and signed-in provider behavior require separate
evidence; a Chromium fixture run or cross-build does not verify either.

## Branding

Approved masters live in `design/branding`; read `PRODUCTION.md` there.
Never use its review previews as production exports or change the master art.
Run `node scripts/export-branding.mjs` to regenerate and synchronize assets,
then `node --test scripts/branding.test.mjs` to verify them. This uses existing
app dependencies and does not update installed applications.

## Structured Chat

Structured chat: `GORACE=atexit_sleep_ms=0 go test -race
./internal/localchat ./internal/agent ./internal/localagent ./internal/box
./cmd/burfd` and `go vet` over the same packages. `internal/localchat` uses
synthetic protocol peers; its native Windows/Mac/Linux pipe/process tests
launch only the test executable. Unix tests include parent-death cleanup.
Box chat tests cover authentication, account environment and upgrade guards.
No model prompt or installed provider is needed for this regression suite.
