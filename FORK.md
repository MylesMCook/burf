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

### Core Providers

Codex, Claude Code, Cursor and Grok are the four first-class provider targets.
Each should have native Burf chat, streaming/tool activity, supported human
approvals/questions, Stop, account isolation and reconnect without replay.
ACP connections are part of the product, not a requirement to force every
provider through ACP: Codex uses its official app-server; Cursor and Grok have
official ACP interfaces. Claude needs a supported structured adapter selected
against its current official CLI/SDK contract, not terminal-screen emulation.
Claude is core scope alongside the other three, not an optional extra.

This is scope, not a claim of completed parity: Codex structured chat is
implemented; structured Claude, Cursor and Grok remain planned. Preserve
existing other-provider compatibility, but defer new integrations and broader
provider expansion until these four workflows are reliable. Generic ACP support
must not displace first-class behavior and verification for the core four.

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

### Launcher Agent Selection

The composer selects one provider. Choosing another replaces it and becomes the
default for that project; model and reasoning are separate single choices kept
per provider. Compare agents is an explicit switch that restores the attempts,
judge and pull-request options with its own saved selection. Earlier saved
multi-agent picks are kept for comparison and never launched as an ordinary chat.

### Structured Remote Codex

The built-in New Codex action and single-agent composer on an existing registered
project/worktree use an owned `codex app-server --listen stdio://` process.
The desktop reaches it through Burf's existing authenticated, pinned box
connection, not a raw provider listener or a shared Codex daemon. The local and
remote views share the structured message/approval interface below.

The box resolves the registered location, effective project/box environment and
`CODEX_HOME` before launch. Invalid configuration, unresolved secrets and custom
Codex commands fail closed. Credentials are not copied. A box that advertises
`chat.options` takes the composer's model, effort and permission with the first
message, or holds model and effort as the opened chat's next-message choices
when no message was written. There the composer lists the account's own Codex
models.
Older boxes use the provider's configured model/effort; explicit choices are
rejected before launch, not silently discarded. Create/open a worktree before
starting structured chat.
Multi-agent orchestration, handoffs and custom commands retain their existing
terminal behavior. Structured state is shown in each chat pane and its project
chat list; the older global working counter still counts terminal-backed agents.

`GET /v1/chats` lists the box's bounded in-memory registry; `POST /v1/chats`
accepts only `{ "location": "project[/worktree]" }`, plus `browser` on a box
with `chat.browser` (Browser Bridge, below). Individual chats support
GET, DELETE, and POST to `/messages` (`text`), `/interrupt`, and `/approvals`
(`id`, `decision`: `accept` or `decline`). With `chat.options`, `/messages` also
takes `options` (`model`, `effort`, `permission`), `GET /models` lists the owned
provider's models, `GET /v1/chats/models?location=` lists them before a chat
exists (a short-lived owned provider process with no thread, behind the same
start gate, cached ten minutes per account), and approvals take the scoped
decisions described under
Structured Local Codex. Older daemons reject unknown request fields, so clients
omit `options` entirely unless the session reports `composer`. Session responses
include stable provider thread/turn IDs, location and the last options the
provider accepted. Reopening the desktop reads that same
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

### Browser Bridge

A box that advertises `chat.browser` lets a structured chat act in the browser
of the client that started it. This is Burf's side of the sitegeist extension
work. The extension and the chat view inside it are not implemented yet, so
nothing starts a browser chat today.

- `POST /v1/chats` also takes `browser.tools`: 1 to 16 tools (`name`,
  `description`, optional object `input_schema`), validated before any provider
  starts. Older daemons reject the field, so clients send it only to boxes with
  the capability. A chat without it starts exactly as before.
- The provider reaches the tools through one stdio MCP server, `burfd
  browser-mcp --socket PATH --chat ID`, named `burf_browser` in that thread's
  start configuration only. The signed-in account's Codex configuration is not
  edited and the box adds no listener.
- A tool call waits on the chat. `GET /v1/chats/{id}` and `GET
  /v1/chats/{id}/browser/calls?wait=N` (at most 25 seconds) show waiting calls.
  `POST /v1/chats/{id}/browser/results` (`id`, `content`, `is_error`) answers
  one, once, through the `session.send` gate. An answer carries at most 16 text
  or image items and 2 MiB.
- Only the box's own socket may ask the browser to act (`browser/tools`,
  `browser/calls`). A paired client can watch and answer, never issue calls.
- Calls run only during a turn, at most four at a time. An unanswered call
  fails after 290 seconds without stopping the chat. A turn that ends or a chat
  that stops cancels its waiting calls. Nothing is retried and a late answer is
  refused.
- The tools are approved at the provider (`default_tools_approval_mode =
  "approve"`) because the browser is the reviewer: it must ask the user per site
  before acting. If the provider still asks, that request is a one-use approval
  of kind `browser`. Every other elicitation stops the chat as before.

Acceptance is in `internal/localchat/browser_test.go` and
`internal/box/chatbrowser_test.go`, with synthetic peers. The built bridge was
also started by installed `codex-cli 0.162.0` using an empty account directory
and no turn. Not verified: a model choosing a tool in a real turn, the
provider's approval prompt in a real turn, an installed daemon, and Windows-local
chats, which have no box socket and so no bridge. The chat view still words a
`browser` approval as a command.

#### Browser Credential and Pairing

A browser extension never holds the app's token, which opens terminals, files,
pairings and settings. It pairs with this computer's Burf client and gets its
own credential:

- `burf browser pair` (or the app, `POST /v1/browser/pairing`) prints a code.
  It lasts ten minutes, works once, is replaced by the next one and closes
  after five wrong guesses.
- The extension trades it at `POST /v1/browser/pair` (`code`, `name`), the one
  app API request made without a credential. Only an extension page origin may
  trade a code, so a web page cannot pair or spend the user's guesses.
- The credential opens `GET /v1/browser/boxes` (names and state only) and, on
  each box, `info`, `locations`, structured chats, and the bridge's waiting
  calls and answers. Everything else answers 403, including terminals, files,
  sessions, events, pairing itself and the bridge's box-only routes.
- At most eight browsers are paired. Credentials are stored hashed in
  `browser-pairings.json` in the state directory. `burf browser list` shows
  them and `burf browser revoke ID` ends one at once.

A paired browser is a chat client: it can start chats in registered projects,
send messages and answer approvals there. The credential limits what a
compromised extension reaches beyond that; it is not a sandbox for chat itself.

Acceptance is in `internal/agent/browserpair_test.go` and
`cmd/burf/browser_test.go`. A headless Chromium 153 extension page also paired
with the real handler and used its credential, after an ordinary web page
failed with the same code. Not verified: an installed client, the `burf
browser` command against a real agent, and Firefox. The app has no pairing
screen yet.

### Structured Local Codex

- New Codex chats launch an owned `codex app-server --listen stdio://` process,
  not a shared daemon proxy. The installed CLI retains its existing sign-in and
  configuration; Burf does not copy credentials or install a provider.
- The provider returns thread and turn IDs. Only matching events populate that
  chat. User messages, streamed replies and tool activity render in the GUI;
  message submission and interruption use JSON requests, not terminal keys.
- The thread requests read-only sandboxing and untrusted-command approvals with
  the user as reviewer. Provider-requested command and file-change approvals
  offer Deny, Allow once and Always in this chat (the provider's session
  approval cache, gone when the chat stops). Allow always appears only when the
  provider proposes a command rule; Burf returns that exact proposal, which the
  provider saves to the signed-in account's rules for every chat and project,
  and the prompt says so. Burf never composes or widens a rule. Unknown
  interactions, missing/truncated file details and broader root grants stop the
  owned process without granting permission. A login or unsupported interaction
  must be resolved outside this initial chat integration. The first slice does
  not claim native edit capability or loosen a restrictive provider profile.
- The composer always shows permission, model and reasoning selectors. They
  apply from the next message. Permission is one of Ask every time (the
  starting mode: read-only sandbox, untrusted commands ask), Read only
  (sandboxed reads run unasked) or Edit workspace (edits inside the project run
  unasked). Network stays off and unrestricted access is not offered. The last
  permission chosen is remembered and offered to the next empty chat, where it
  takes effect only with that chat's first message; chats with history keep
  their own. The header shows only what the provider accepted. A submitted
  message is visible at once and is replaced by the provider's echo, never
  duplicated.
- Launch/send failures never automatically retry. A turn the provider answers
  with an error (for example an unsupported model or effort) did not start: the
  chat stays open, the draft and previous settings are kept, and the provider's
  reason is shown. A send whose reply is lost is uncertain and still stops the
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

For the ACP-specific workstream, prefer the official [Cursor ACP](https://cursor.com/docs/cli/acp) interface
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
