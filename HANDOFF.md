# Handoff, 2026-10-09

For the engineer taking this over. It says where the project stands, what
was changed today and why, what is known to be wrong, and how to work in it.
Everything described here is on `main`; nothing is waiting in a branch.

Read in this order: this file, `FORK.md` (what Burf is and what must stay
compatible), `AGENTS.md` (rules, checks, speed budgets), `DESIGN.md`,
`UPSTREAM.md` (taking changes from the project this was forked from).

## What Burf is

A desktop app (Tauri, React, in `app/`) that runs coding agents on your own
machines. A Go client (`cmd/burf`) runs on each computer; a Go daemon
(`cmd/burfd`) runs on each box that hosts agents. Legacy names (`berth`,
`berthd`, state folders, protocol names) are kept on purpose: see `FORK.md`.

## What the owner decided today

These are product decisions, not suggestions. They explain most of the diff.

- **Speed is a requirement.** Budgets are in `AGENTS.md`: see a change in
  under 10 s, check before a push in under 60 s, no full local run before a
  merge, a pull request's hosted run under 2 minutes, a frontend release in
  under 2 minutes. "I would rather have fewer tests than slow ones."
- **The Great Culling.** Cut: Team setup, Kits, the direct agent buttons,
  the chat view of a terminal session. Kept: Phone, the Usage plugin,
  Automations and loops, Attempts and Compare, Visual diff, Charts,
  Dashboard, the guided install plan.
- **All in on assistant-ui.** Every chat goes through one component
  (`app/src/components/chat`: `Chat` and `ChatTransport`) built from stock
  assistant-ui parts. Custom work is for machines, connections and their
  management only.
- **Cleanup is part of the work.** `AGENTS.md`, "Leave Nothing Behind".

## What changed today

Pull requests 6 to 33, all merged. By theme:

- **Speed.** `scripts/check-local.sh` runs the type-check, the unit tests
  and only the browser spec files a change reaches
  (`scripts/e2e-pick.mjs`). Hosted CI on a pull request runs quick checks
  only; the browser suite, the race suite and the native builds run once
  per merge and block nothing. Measured: pre-push check 5 to 49 s (was 8.6
  minutes), hosted pull request run 22 to 99 s (was about 20 minutes).
- **Fewer tests, on purpose.** Browser cases went from 417 in 56 files to
  269 in 38. Cases for cut features, cases over 5 seconds and fixed waits
  were deleted, not rewritten. Expect gaps: see "Known gaps".
- **The interface folder.** A window draws the frontend from a folder on
  disk when its manifest matches the shell contract
  (`internal/uicontract/shell.txt`) and every file's hash. `scripts/ship-ui.sh
  [hosts]` builds and installs it over ssh in under 20 s with no native
  build; `burf ui status|rollback|remove` manage it. `FORK.md`, "The
  interface folder".
- **Chat.** Structured Codex and Claude Code chats, on a box or on this
  computer, and saved conversations (read-only) all draw through `Chat`.
  Claude Code's structured backend is `internal/localchat/claude.go`
  (`claude -p` with stream-json), advertised as capability `chat.claude`.
- **Removed.** About 28,000 lines: Team setup and Kits (app and Go), the
  transcript-drawn chat of a terminal session and everything only it used,
  the one-click agent buttons, 3,300 lines of unreachable components.

## Known defects, most important first

1. **"Continue in Burf" opens the agent's terminal UI, not a chat.** The
   owner reported this today and calls it a failure. On This computer, a
   saved conversation is continued by `internal/localagent/manager.go`
   (`startLocked`): it runs `codex fork <id>` or `claude --resume <id>
   --fork-session` in a terminal session. The structured backend
   (`internal/localchat`) can only start a new thread; it has no resume or
   fork. The button's tooltip says "Continue as a new chat". The fix is a
   resume or fork in `internal/localchat` for both providers and a
   `mode: "chat"` session from `localApi.fork`. Until then every continued
   conversation is a terminal.
2. **Anything without a structured backend is terminal-only.** Since the
   chat view of a terminal session was cut, a custom agent command, an
   agent other than Codex or Claude Code, or a box too old to advertise
   `chat.codex` / `chat.claude` gets a terminal and nothing else. That is
   the intended end state only if every agent the owner uses has a
   structured backend.
3. **The Claude Code chat has never run against a signed-in Claude Code.**
   Tool use, approvals, interrupt and model or permission changes are
   tested against a synthetic peer only (`internal/localchat` tests and the
   browser fixtures).
4. **A reinstall could leave a daemon unloaded on macOS.** `launchctl
   bootstrap` straight after `bootout` failed once today and took a daemon
   down for 14 minutes. `internal/service/service.go` now retries for 5
   seconds; that is tested against a stand-in, not a real launchd. If a
   daemon is missing after an upgrade: `launchctl bootstrap gui/$(id -u)
   ~/Library/LaunchAgents/dev.berth.berthd.plist`.
5. **One Go test is flaky under load.**
   `TestAnSSHRouteThatFailsIsShownDownAndTheBoxStaysUp` (`internal/agent`)
   times out at its 5 second wait in a whole-package run on the owner's
   Mac. It passes alone and on hosted CI.
6. **An open design question.** The chat's empty state has icon suggestion
   groups, as assistant-ui's base demo does. assistant-ui's own design
   guide rejects them. The owner has not said which wins; `DESIGN.md`
   leaves that line out.

## Known gaps

- **Deploying native builds is manual and its scripts are not in this
  repository.** The Mac app is built with `make app-build` (Rust on
  `PATH`); the Windows window is built natively on a Windows machine; the
  daemons are upgraded with `burf upgrade <box>`. The staging and install
  scripts used so far live in the owner's scratch folders and are specific
  to their machines. There are no signed releases and the updater is
  disabled (`FORK.md`).
- **Test coverage was traded for speed.** What was deleted outright:
  cases for the cut features, the long-chat performance cases, the motion
  and idle cases, most of the accessibility sweep (one theme remains).
  Little logic has yet moved from browser cases into Node unit tests,
  which was the plan (`AGENTS.md`).
- **The hosted browser run after a merge takes 3 to 4.5 minutes per
  shard.** It blocks nothing, but a failure there is found late.
- **Native Windows behavior and signed-in providers** need their own
  evidence; a Chromium fixture run proves neither (`AGENTS.md`).
- **`tasks.md` is local and not in Git.** It holds the owner's machine
  names, installed build ids and rollback folders. Ask the owner for it.

## Working in it

```sh
cd app && pnpm install --frozen-lockfile
pnpm dev                                   # look at a change
scripts/check-local.sh                     # before a push, under a minute
scripts/ship-ui.sh [ssh hosts]             # release the frontend
scripts/tidy.sh                            # release merged branches, list what is open
```

Go: `go vet` and `go test` on the packages you changed; the list for the
structured chat is in `AGENTS.md`. Merge by hand once checks are green;
branches delete themselves on merge.
