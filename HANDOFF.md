# Burf handoff, 2026-10-10

Read FORK.md for product and compatibility boundaries, AGENTS.md for checks and
speed budgets, DESIGN.md before changing a screen, and local tasks.md for fleet
state and remaining work. Git and pull requests hold completed history.

## Current architecture

React/StyleX and stock assistant-ui run in a Go desktop shell, pinned to Wails
v3.0.0-beta.28 in app/native. Desktop builds have no Rust or Tauri dependency.
The Go client is cmd/burf and each agent-hosting box uses cmd/burfd. Legacy berth
aliases, identities, state directories and protocol names remain intentional.
The updater is disabled. There is no Linux desktop bundle; Linux hosts run Go.

General browsing uses raw WKWebView or WebView2 children. Their pages receive
no app bindings, runtime or UI token. Only the trusted main window owns native
commands. Exact old origins remain in mixed-version server compatibility lists.
UI folder manifests use shell contract 2 and validate all bytes. The old contract
1 UI remains usable by legacy installed apps during migration.

Every chat uses the pinned assistant-ui external-store runtime and ChatTransport.
Codex uses the installed official app-server CLI; Claude uses official stream-json.
There is no model API key, assistant-ui cloud or third-party ACP bridge. Structured
continuations fork independently and preserve source history and permissions.

## Behavior and recovery

This computer opens an inline local composer on Mac and Windows. It does not
connect another machine or install a daemon. Mac local chat preserves the user's
account and CLI path; local terminal hosting remains Windows-only.

Local drafts and queues follow authenticated client/session identity. Recovered
queues stay held until an explicit send. Uncertain sends warn instead of replaying.
Authoritative message repositories remove provisional IDs, avoiding false 2/2
branches. Unsupported local attachments have a disabled control and explanation.

Dropdown labels have dedicated columns. Floating surfaces have quiet black
shadows and unblurred backdrops. Dialogs retain finite desktop widths, capped
height and reachable scrolling actions. AddBox form content is container-sized;
its long command scrolls inside itself. Notifications contain their complete
opaque body and have no horizontal overflow. Home uses one calm entry card and
progressive options; long drafts and options scroll within its bounded region.

Automatic daemon checks and reconnects leave existing executables and services
untouched. Install bundled / burf upgrade BOX uses the daemon's atomic chat guard.
First setup still installs; unavailable existing services report explicit recovery.
Development build ordering also preserves stale, dirty or unknown metadata.

## Verification and delivery

Use scripts/check-local.sh for changed paths; scripts/go-check.mjs separates root
and native modules. PRs run quick checks, including portable native browser tests
and Windows compilation. Full suites/native packages run after merge. Browser
shards reuse one commit- and hash-verified frontend artifact. Both Go lockfiles,
actual packaging cache and the pinned Wails CLI are cached. ci/README.md records
Act selection and fleet delivery boundaries.

Observed in this session: app/e2e types and Node units passed; affected browser
checks and separate rendered dark/light QA passed. Geometry regressions reproduce
clipping rather than relying on DOM visibility. Native hidden Mac and both Windows
checks passed isolation, private RPC denial, navigation/history, evaluation,
console/picker, frames/popups, bounds and cleanup. Windows loader Authenticode
was Valid. These are distinct from visible native placement or site sign-in.

Installed Mini Codex replied in 4.2s then 1.1s, and an independent fork preserved
the original. That proof used an isolated manager/workspace, not a live agent API.
Claude on the Mini was signed out; actual Claude turns remain unverified.

All four legacy desktop windows exported owned private UI state before cutover.
Preferences/drafts/fonts/backgrounds restore before settings imports. Imports fill
missing records and commit their marker last, preserving retries and both origins.
A missing export initializes a new profile. A missing export during a pending
import still blocks and keeps recovery retryable. Legacy upgrades must export
before cutover: absence does not detect an old WebView profile, and a completed
new origin does not later import one. Current fleet migration has exports.
Installed builds/rollback paths are in tasks.md. Local checks alone never
establish installed parity.

The bounded Act selector job passed in 5.1s. Native portable checks passed, while
cold Windows dependency downloads hit a 120s external deadline under emulation.
Hosted app checks passed in 93s and native quick checks in 66s. The first cold
Go job failed a route-probe fixture race; its assertions now wait on both route
states, and root/native caches have separate keys. Final timing is in tasks.md.
Hosted browser artifact transfer runs after merge. Publication/signing
and signed-in provider/native site behavior require their own evidence.
