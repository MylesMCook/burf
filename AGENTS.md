# Burf Development

Read `FORK.md` for product direction and compatibility boundaries, `UPSTREAM.md`
for upstream intake, `DESIGN.md` before drawing or changing a screen, and the
local `tasks.md` for cross-session status.
Preserve legacy state/protocol names and the disabled updater when changing
branding or packaging. Local checks do not authorize replacing installed apps
or restarting live agents.

## Speed Is A Requirement

These are budgets, measured on the Mini. A change that breaks one is a
regression, the same as a failing test.

- **Edit to seeing it: under 10 seconds.** Use the dev server (`pnpm dev`, or
  a spec with `E2E_DEV=1`, which reuses a running one). No build in this loop.
- **Check before a push: under 60 seconds.** `scripts/check-local.sh` runs the
  type-check (kept warm), the Node unit tests, and only the browser spec
  files the change reaches (`scripts/e2e-pick.mjs`), against a two-second
  bundle. A path nothing knows runs the smoke set, never everything.
- **No full local run before a merge.** The whole browser suite, the Go race
  suite, both desktop builds and native Windows run on the hosted runner once
  per merge to main, and nothing waits for them.
- **A pull request's hosted run: under 2 minutes**, and only what it reaches.
- **Anything over a minute runs in the background.** Do not hold a merge or
  the owner's attention for a run that is not needed.

Keeping it so:

- A browser case is for what needs a real page. Logic that a function can
  answer is a Node unit test beside it.
- No fixed waits or sleeps in `app/e2e`: wait for a condition, or the case
  goes.
- A case that takes over 5 seconds is fixed or deleted. So is one that
  fails by itself now and then. Fewer tests beat slow ones.
- When a feature is cut, its cases go in the same change.
- Workers handed a task run the type-check and unit tests only. They do not
  run production builds or the browser suite.

## Leave Nothing Behind

The owner does not ask for cleanup. A piece of work is finished when all of
this is true, and you make it true before you report:

- It is merged, or its pull request is open and `tasks.md` says what it
  waits for.
- Its branch is gone here and on origin, and its worktree or worker clone is
  free. `scripts/tidy.sh` does that for whatever is already in main and
  lists what is left; run it when you take over and before you report.
- A merged frontend change is on the owner's machines:
  `scripts/ship-ui.sh` with the hosts `tasks.md` names. A machine that
  refuses is fixed, or named with the one step it needs.
- No process you started is still running, and nothing sits uncommitted in
  a checkout without a line in `tasks.md` saying why.
- `tasks.md` gives the current state in under 60 lines: what is open, who
  owns it, the next action. Finished work is deleted from it; Git and the
  pull requests are the history.

Close what is yours to close. Bring the owner only what only they can do,
once, with the exact step. A report does not end with a list of things you
could have done.

## assistant-ui

Every chat is drawn by assistant-ui (`FORK.md`), so look a part up before
writing one. Its documentation is made for assistants to read:

- Index of every page: <https://www.assistant-ui.com/llms.txt>. Add `.md`
  to a page's URL for Markdown; <https://www.assistant-ui.com/llms-full.txt>
  is everything in one file.
- Docs server: <https://www.assistant-ui.com/mcp> (`search_docs`,
  `read_page`), set up for Claude Code in `.mcp.json`. It only reads
  documentation. Other assistants fetch the pages above.

How Burf uses it, which narrows what applies:

- The runtime is `useExternalStoreRuntime`, fed by a `ChatTransport`
  (`app/src/components/chat`). There is no AI SDK, model route, API key or
  assistant-ui cloud: pages about `useChatRuntime` and transports to a model
  do not apply.
- Stock parts come from the registry
  (<https://r.assistant-ui.com/registry.json>) into
  `app/src/components/assistant-ui`, and are fed through their props and
  slots. Do not write a look-alike of one.
- The lockfile pins the version. Check that an API a page describes exists
  in the installed version before using it; do not bump it in passing.

## Frontend Checks

From `app/`:

```sh
pnpm exec tsc --noEmit -p . && pnpm exec tsc --noEmit -p e2e
pnpm test
E2E_DEV=1 pnpm exec playwright test <spec files>   # look at a change, no build
```

The browser cases use synthetic fixtures and isolated loopback servers.
Leave `BERTH_E2E_LIVE` unset. Never point mutation tests at a real agent.
`E2E_PORT` can select a free port from 1421-1439. Native Windows execution
and signed-in provider behavior require separate evidence; a Chromium
fixture run or cross-build does not verify either.

## Branding

Approved masters live in `design/branding`; read `PRODUCTION.md` there.
Never use its review previews as production exports or change the master art.
Run `node scripts/export-branding.mjs` to regenerate and synchronize assets,
then `node --test scripts/branding.test.mjs` to verify them. This uses existing
app dependencies and does not update installed applications.

## Structured Chat

Structured chat: `GORACE=atexit_sleep_ms=0 go test -race
./internal/localchat ./internal/agent ./internal/localagent ./internal/box
./cmd/burfd` and `go vet` over the same packages plus `./internal/browsermcp`
(the browser bridge process, exercised by the box tests). Browser pairing adds
`./cmd/burf` to both, and a chat's own tools add `./internal/mcpserver` and
`./internal/transcript`. `internal/localchat` uses
synthetic protocol peers; its native Windows/Mac/Linux pipe/process tests
launch only the test executable. Unix tests include parent-death cleanup.
Box chat tests cover authentication, account environment and upgrade guards.
No model prompt or installed provider is needed for this regression suite.

## Additional Checks and Guardrails

The hosted runner runs these once per merge, and nothing waits for them:
`go vet ./...`, `GORACE=atexit_sleep_ms=0 go test -race ./...`, the app
scripts `typecheck:plugins`, `check:titles`, `check:csp`, `check:themes`,
`test:platform` and `test`, and the Windows packaging/installer template
tests (`node --test scripts/windows-installer-template.test.mjs scripts/windows-packaging.test.mjs`).
Run one locally only when the change is about what it checks.

Do not use reserved ports 1420 or 1377-1379, live state in `~/.berth`, or
installed services. A unit test is a `*.test.ts` beside its code; the app test script finds it by pattern. Use `<Tip>`
instead of HTML `title` attributes. Fixtures stay synthetic. Build docs-site
when docs change. Commands are `cmd/burf` and `cmd/burfd`; compatibility aliases
and state/protocol names follow `FORK.md`. Release or publication requires a
direct request. `CLAUDE.md` only points at this canonical policy.
