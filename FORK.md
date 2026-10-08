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

For every provider, use its existing official CLI sign-in without making Burf
a billing manager. No billing dashboard, required API-key setup or automatic
paid fallback belongs in this workflow. Surface provider login/limit errors
clearly. Provider account settings still govern charges; do not claim that
subscription authentication guarantees zero overages or change those settings.

The first UI step promotes the existing remote Claude Code and Codex chat view
out of Labs. Fresh profiles default to Chat; saved preferences and explicit pane
choices are preserved. General settings controls the default, while switching a
pane to Terminal affects only that pane. Shells, unsupported agents and older
boxes without transcripts default to Terminal. New remote chats use a bottom
composer, like ongoing conversations.

New Windows-local Codex chats use the installed CLI's structured app-server
protocol. New remote Codex chats do too when the Mac/Linux box advertises
`chat.codex`. Existing remote terminal sessions, older boxes, Claude and
imported-history continuations retain their terminal paths; imported histories
remain read-only. Never infer provider conversation identity from the latest
transcript in a folder. Evaluate future upstream features against this direction.

### Structured Remote Codex

The built-in New Codex action and single-agent composer on an existing registered
project/worktree use an owned `codex app-server --listen stdio://` process.
The desktop reaches it through Burf's existing authenticated, pinned box
connection, not a raw provider listener or a shared Codex daemon. The local and
remote views share the structured message/approval interface below.

The box resolves the registered location, effective project/box environment and
`CODEX_HOME` before launch. Invalid configuration, unresolved secrets and custom
Codex commands fail closed. Credentials are not copied. This first slice uses
the provider's configured model/effort; explicit composer overrides are rejected,
not silently discarded. Create/open a worktree before starting structured chat.
Multi-agent orchestration, handoffs and custom commands retain their existing
terminal behavior. Structured state is shown in each chat pane and its project
chat list; the older global working counter still counts terminal-backed agents.

`GET /v1/chats` lists the box's bounded in-memory registry; `POST /v1/chats`
accepts only `{ "location": "project[/worktree]" }`. Individual chats support
GET, DELETE, and POST to `/messages` (`text`), `/interrupt`, and `/approvals`
(`id`, `decision`: `accept` or `decline`). Session responses include stable
provider thread/turn IDs and location. Reopening the desktop reads that same
registry and never starts or replays a turn. A lost launch response tells the
user to recover the existing chat before intentionally starting another.

Active and starting chats block the box upgrade API before it replaces the
daemon executable. Failed installation leaves chat creation usable. Closing a
view does not stop its chat; Stop chat and daemon shutdown do. Registry state is
not restart-persistent, so normal daemon restarts require stopping owned chats.
Unix processes use a private lifeline helper and process group: parent death,
provider exit and explicit stop clean up inheriting descendants. This is not
containment against a process deliberately escaping its group with `setsid`.
No new service supervisor is installed.

Implementation is distinct from deployment. Synthetic protocol/API/browser
tests and native process tests do not establish a signed-in provider turn or an
installed box upgrade. `tasks.md` records those separate delivery gates.

### Structured Local Codex

- New Codex chats launch an owned `codex app-server --listen stdio://` process,
  not a shared daemon proxy. The installed CLI retains its existing sign-in and
  configuration; Burf does not copy credentials or install a provider.
- The provider returns thread and turn IDs. Only matching events populate that
  chat. User messages, streamed replies and tool activity render in the GUI;
  message submission and interruption use JSON requests, not terminal keys.
- The thread requests read-only sandboxing and untrusted-command approvals with
  the user as reviewer. Provider-requested command and file-change approvals
  offer Allow once and Deny. No persistent policy changes are offered. Unknown
  interactions, missing/truncated file details and broader root grants stop the
  owned process without granting permission. A login or unsupported interaction
  must be resolved outside this initial chat integration. The first slice does
  not claim native edit capability or loosen a restrictive provider profile.
- Launch/send failures never automatically retry. An uncertain send stops the
  owned chat rather than risking replay. Refresh reads the same in-memory session.
  Closing its view does not stop the process; Stop chat and backend shutdown do.
  Windows kill-on-close jobs contain the process and its descendants.
- Live views retain at most 200 items / 4 MiB, with 64 KiB per item. Codex's saved
  source history remains provider-owned. Burf's running-chat registry is not yet
  restart-persistent. After backend restart, saved history can be read or explicitly
  continued through the existing independent terminal-fork flow.
- This first slice supports new text conversations only. It does not resume
  externally owned threads, provide structured Claude chat, support attachments,
  render every tool result, or claim every provider interaction is supported.

Protocol fields were checked against schemas generated by installed official
`codex-cli 0.160.0` and `0.161.0`, and the official
[app-server reference](https://learn.chatgpt.com/docs/app-server).
Synthetic protocol and browser tests are not evidence that
an installed Windows provider completed a real model turn. Native provider,
authentication and sandbox compatibility remain separate acceptance gates.

### Planned Cursor and Grok Chat

Research intake: Codex thread `01a11c98-4c22-7b43-a088-520e5fbaba4f`,
"Research Grok and Cursor integration", October 8, 2026. This is a planned
integration, not implemented or verified provider behavior in Burf.

Prefer the official [Cursor ACP](https://cursor.com/docs/cli/acp) interface
(`agent acp`) first, then [Grok Build ACP](https://docs.x.ai/build/cli/headless-scripting)
(`grok agent stdio`). Keep ACP parsing separate from Codex app-server while
reusing chat presentation and owned-process lifecycle where their contracts fit.
Direct official interfaces avoid a third-party bridge's auth and replay behavior.

- Use existing official CLI subscription login. No API-billed fallback,
  credential extraction/copying, private endpoint imitation or browser automation.
  Do not add a billing-configuration step. Subscription login alone does not
  establish a spending cap; provider overage settings remain provider-owned.
- Start with new text chats in one explicit account/workspace: streamed replies,
  tool activity, one-use Allow/Deny, blocking questions, plan decisions and Stop.
  Never offer persistent permission grants. Unknown blocking requests fail closed;
  advertise only filesystem/terminal capabilities Burf actually implements safely.
- Keep the owned provider alive across desktop reconnects. Load history into the
  UI without resending it to the model. Never retry an uncertain prompt or
  permission response. Bind process, workspace and provider session identities;
  verify account isolation through login/refresh changes, not just config paths.
- Gate resume and independent fork on installed, negotiated and tested support.
  The research found Cursor load but no native fork; Grok's source-level
  `x.ai/session/fork` extension still needs released-binary verification.
  Imported source histories stay read-only when safe independent continuation
  cannot be established. Hide unsupported controls rather than emulate a fork.
- ACP is not a sandbox. Verify actual enforcement and descendant cleanup on
  each supported OS, especially native Windows. Do not inherit unrestricted
  execution defaults or weaken host protections to make a provider work.

Acceptance must cover denied execution, questions and plan rejection, Stop,
lost-response reconnect without duplicate sends, account mismatch, unsupported
requests and parent-death cleanup with synthetic peers first. Then separately
verify installed versions and bounded signed-in behavior on Windows, macOS and
Linux with approval. Provider eligibility, correct auth route, account isolation,
Grok extension/platform support and Cursor fork parity remain open gates.
No provider installation, model turn or deployment is authorized by research.

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
- Remote Mac and Linux sessions use the existing authenticated box transport;
  new supported Codex chats are structured, while terminal sessions stay separate.

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
GORACE=atexit_sleep_ms=0 go test -race ./internal/localchat
go vet ./internal/agent ./internal/localagent ./internal/localhistory ./internal/localpty ./internal/transcript
cd app && pnpm test && pnpm run test:e2e local-chat.spec.ts local-computer.spec.ts windows-client.spec.ts first-run.spec.ts chat.spec.ts --workers=2
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
