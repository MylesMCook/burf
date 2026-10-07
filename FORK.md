# Maintained Windows Fork

This fork adds native Windows desktop workflows to Berth. The upstream project
is now [Shipyard](https://github.com/cosscom/shipyard). Original authorship and
the MIT license are retained. Go module paths remain unchanged to keep the
patches small and upstream contributions straightforward.

## First Milestone

- This computer appears alongside the paired remote computers.
- Existing local Codex and Claude Code conversations are discoverable by
  project and readable without modifying their source files.
- Imported history is read-only. It is not represented as a running agent,
  and opening it never resumes or takes over another application's process.
- **Continue in Berth** explicitly starts an interactive copy using the installed
  CLI's fork command. The original conversation stays unchanged, even if another
  application still has it open. Repeated clicks reuse a running continuation.
  The original project directory must still exist and the CLI must support forks.
- Installed native agent CLIs can run in a Berth-owned Windows terminal,
  receive input, resize, and stop without affecting externally started agents.
- Local sessions belong to the client backend. They survive closing a view,
  but stop when that backend stops. They do not yet provide tmux-like recovery
  after a backend crash or restart.
- Remote Mac and Linux sessions continue to use the existing box protocol.

Local discovery currently indexes top-level active transcripts, not helper
sessions, archived Codex sessions or cloud-only conversations. Agent
authentication and permission prompts remain the installed CLI's responsibility.
The fork does not install CLIs, bypass agent approvals, or change host security.

When an installed Codex CLI advertises `--no-daemon`, local terminals use that
mode so their process stays owned by Berth instead of a shared Codex server.

## Updates

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
cd app && pnpm test && pnpm test:e2e -- local-computer.spec.ts windows-client.spec.ts first-run.spec.ts chat.spec.ts
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
