# Maintained Windows Fork

This fork is Burf, maintained at https://github.com/MylesMCook/burf. It adds
native Windows desktop workflows to the original Berth project. The upstream project
is now [Shipyard](https://github.com/cosscom/shipyard). Original authorship and
the MIT license are retained. The Go module is `github.com/MylesMCook/burf`.

The desktop app and CLI ship as Burf and `burf`; the daemon command is `burfd`.
Existing `.berth` and OS `berth` state directories, `BERTH_*` environment
variables, protocol keys and links, plugin SDK names, service identities,
Windows fork application identifier and PATH ownership registry key remain
compatible. Build outputs retain `berth` and `berthd` aliases for existing
integrations. Bundled daemon resources retain their legacy names because
existing clients and hooks discover them by name. Pairings and user settings
are not reset. No new update feed is enabled until Burf has signed releases.
Windows also retains its internal `berth-cli.exe` sidecar and a `cli/berth.exe`
alias so existing owned login tasks keep the executable paths they trust.

## Product Direction: Chat First

The intended primary experience is a conventional LLM chat UI, not an embedded
terminal or TUI. Users should read conversations and send replies in Burf's own
chat view on local and remote computers. Terminal hosting is the current
compatibility foundation, not the long-term default chat experience.

Plan toward a message composer, streamed replies, visible tool activity and
explicit approval controls. Prefer supported structured agent interfaces over
screen scraping or simulated terminal keystrokes when implementing this.
Keep terminals as a fallback for shell work and unsupported agent interactions.
Preserve source-history isolation, agent permissions and no-replay guarantees.

This is an accepted product direction, not implemented functionality or a
selected provider protocol. Evaluate future upstream features against it.

## First Milestone

- This computer appears alongside the paired remote computers.
- Existing local Codex and Claude Code conversations are discoverable by
  project and readable without modifying their source files.
- Imported history is read-only. It is not represented as a running agent,
  and opening it never resumes or takes over another application's process.
- **Continue in Burf** explicitly starts an interactive copy using the installed
  CLI's fork command. The original conversation stays unchanged, even if another
  application still has it open. Repeated clicks reuse a running continuation.
  The original project directory must still exist and the CLI must support forks.
  Replaced, truncated, deleted or mismatched source files fail until refreshed.
  Source checks run after waiting for the launch lock; canceled pending requests
  do not start agents when that lock becomes available.
- Installed native agent CLIs can run in a Burf-owned Windows terminal,
  receive input, resize, and stop without affecting externally started agents.
- Local sessions belong to the client backend. They survive closing a view,
  but stop when that backend stops. They do not yet provide tmux-like recovery
  after a backend crash or restart.
- Remote Mac and Linux sessions continue to use the existing box protocol.

Local discovery currently indexes top-level active transcripts, not helper
sessions, archived Codex sessions or cloud-only conversations. Agent
authentication and permission prompts remain the installed CLI's responsibility.
The fork does not install CLIs, bypass agent approvals, or change host security.

If terminal input loses its response, Burf reports that it may have arrived.
Reconnecting reads output from the same owned session and never resends input.
If a launch response is lost, Burf reports that an agent may have started and
asks the user to refresh This computer before intentionally trying again.
Canceling a request after the process already started cannot undo that launch;
refresh This computer to find the owned session before intentionally trying again.

When an installed Codex CLI advertises `--no-daemon`, local terminals use that
mode so their process stays owned by Burf instead of a shared Codex server.

## Updates

See [UPSTREAM.md](UPSTREAM.md) for the maintained upstream intake workflow.

Keep `upstream` pointing to the original project and `origin` pointing to this
fork. Fetch upstream changes into a review branch, merge, then run the existing
Unix regression checks and native Windows acceptance tests before adopting them.
Keep local-machine support and packaging changes in separate commits where
practical; propose generally useful fixes upstream independently.

Development Windows builds use `VITE_BERTH_FORK=true` and must not consume the
official Berth update feed. Signed fork releases and an independent update feed
are separate release work. Do not ship a fork build with the upstream updater
enabled.

## Verification

Synthetic transcript fixtures must cover discovery, read-only pagination,
malformed files and path containment. Native terminal tests must verify output,
input, resizing and owned-process cleanup on Windows, not just cross-compilation.
App acceptance tests must cover unavailable CLIs, read-only history, explicit
continuation and its failure cases, and terminal
reconnection. A successful cross-build is not evidence of native execution or
desktop usability.

Focused checks:

```sh
GORACE=atexit_sleep_ms=0 go test -race ./internal/agent ./internal/localagent ./internal/localhistory ./internal/localpty ./internal/transcript
go vet ./internal/agent ./internal/localagent ./internal/localhistory ./internal/localpty ./internal/transcript
cd app && pnpm test && pnpm run test:e2e local-computer.spec.ts windows-client.spec.ts first-run.spec.ts chat.spec.ts --workers=2
```

The race setting removes the race runtime's exit delay from synthetic CLI
subprocesses; it does not disable race detection. Execute Windows test binaries
for `internal/localpty` and `internal/localhistory` on Windows. The optional
`BERTH_TEST_INSTALLED_LOCAL_AGENTS=1` test in `internal/agent` checks the installed
CLIs through ConPTY using `--version`, without starting a model turn.

On Windows, `scripts/test-windows-local.ps1 -Binary <berth.exe>` checks a disposable
local client and starts available CLIs with synthetic agent homes, without
submitting prompts. `-ExistingHistory` instead discovers the current user's local
conversations and parses one page per source, printing counts only. It does not
start a coding agent, edit transcripts, register a login task or change pairings.

`scripts/test-windows-continuation.ps1 -Artifacts <directory>` runs cross-compiled
synthetic localagent, localhistory, localpty and agent test binaries natively.
Installed-provider smoke is disabled. See the
[native acceptance checklist](scripts/WINDOWS-LOCAL-ACCEPTANCE.md) for the
remaining desktop and actual CLI fork checks.
The [installed-provider smoke proposal](scripts/WINDOWS-PROVIDER-SMOKE-PROPOSAL.md)
defines synthetic context and separates no-turn checks from model turns that
need specific approval.
