# Keeping Burf Current

Burf is a personal fork, not a disconnected rewrite. `origin` is
<https://github.com/MylesMCook/burf>; `upstream` remains
<https://github.com/cosscom/shipyard>. Preserve upstream history and authorship.
The local development branch is currently `codex/windows-client`.

## Intake Routine

At the start of substantial development and before a release, run:

```sh
sh scripts/upstream-status.sh --fetch
```

Without `--fetch`, the script only compares already-fetched Git references.
It never merges, changes checkout files, pushes, installs, or deploys anything.
This is a development checkpoint, not an unattended updater or scheduled job.

Review new upstream changes by behavior, not just commit count. Prefer a tested
merge of a pinned upstream revision for routine catch-up, retaining ancestry so
the same changes are not repeatedly offered. Use `git cherry-pick -x` only for
small urgent independent fixes; record the source commit and prerequisites.
Do not cherry-pick large feature branches without their dependencies.

Before integration, checkpoint owned changes without including secrets or
scratch evidence. Use a short-lived integration branch; use an isolated
worktree only when another editor is active. Keep a recoverable pre-integration
commit and retire temporary worktrees after verification. Never overwrite an
active editor or force-reset dirty work. A Git merge does not authorize a live
client/daemon update, dependency addition, push, release or service restart.

For each intake record in `tasks.md`: pinned upstream SHA, accepted/deferred
features, conflicting custom behavior, actual checks, and deployed-versus-local
status. Do not mark a commit integrated just because it was fetched or reviewed.

## Burf Contracts To Preserve

- Native Windows client, local history and owned ConPTY sessions remain usable.
- Opening existing history is read-only; continuation creates an independent
  copy and preserves the source. Never take over an externally owned process.
- Reconnection does not duplicate local prompts or replay uncertain input.
- Imported/external activity does not produce repeated needs-you/done toasts.
- Background discovery opens no Windows console windows or steals focus.
- Existing state, pairings, pinned TLS identities and old daemon connections
  survive branding and upgrades. Preserve documented compatibility names.
- Burf branding and fork-specific updater isolation survive merges. Never
  silently install upstream binaries over the fork.
- Keep upstream security protections, attribution and license notices. Do not
  inherit skipped/soft-failing acceptance checks as proof of correctness.

## Review Snapshot: 2026-10-08

Fetched upstream `b140a0f` (including release `v0.3.11`). Relative to local
`5274d96`, upstream has 152 unique commits (126 excluding merges), and the fork
has 51 unique commits. Common ancestor: `5c74cf4`. Uncommitted Windows,
notification and browser fixes and the in-progress Burf rebrand are additional
local work; these counts are a snapshot, not a permanent claim.

Recommended intake order:

| Priority | Upstream Work | Why It Matters / Required Review |
| --- | --- | --- |
| 1 | `b722850` agentpath race fix; `819a9f1` login-shell CLI discovery | Correctness and finding installed agents; agentpath is a new upstream package, so the race fix is not a standalone fix to our current code. |
| 1 | `150ffc9` account-specific transcripts; `5a0fb30` per-account hooks/skills | Correct histories when using multiple accounts. Verify source isolation and approval before writing installed provider config. |
| 1 | `9d13934` slow-link resilience; `a527d7a` route failover; `25f2883` route diagnostics | Directly relevant to the Mini/Beelink/Windows fleet. Check Windows SSH support, pinned TLS, timeout behavior and terminal input deduplication. Do not apply host routing changes as part of a source merge. |
| 2 | `31658c8`, `c72424a`, `888a228`, `c40f4b6` idle/terminal performance | Reduce background resource use. Verify hidden-terminal output is retained and reconnect still works. |
| 2 | `e4bd0e5`, `fdd66f5` session cleanup/browser controls | Useful lifecycle controls, but Linux systemd scopes need platform guards and must not kill unrelated processes. |
| 2 | `bbc8e6e` nested worktrees; `ce23c80` predictive terminal echo | Useful UX. Check Windows path handling, terminal input fidelity and accessibility. |
| 3 | Artifacts/visual diffs, accessibility, What's New, Linux desktop alpha | Valuable feature groups with broad UI/build changes. Integrate with their tests and review added dependencies first. |

Upstream also renamed its module/app to Shipyard (`406d44f`, `ecb22f8`,
`d102843`). Resolve those changes to Burf intentionally, while retaining the
underlying behavior. Upstream currently makes E2E non-blocking (`24c19c6`);
that policy is not adopted as Burf acceptance. No commits from this snapshot
have been merged yet.

Two concrete integration risks found in the reviewed source:

- `internal/agentpath/agentpath.go` uses Unix-only `SysProcAttr.Setsid` and
  `syscall.Kill` without a Windows build boundary. Port/guard these paths before
  adopting that package; this is source inspection, not an upstream Windows
  build result.
- `internal/agent/attachkeys.go` intentionally retains and resends recently
  unconfirmed terminal keys during route recovery. Review the delivery contract
  and test ambiguous disconnects before adopting it. Keep it distinct from the
  Windows local-session path, which must never replay uncertain input.

## Verification Before Adoption

Run the focused checks in [FORK.md](FORK.md), then broaden according to changed
code. A routine catch-up requires Go tests/race/vet on Mac, Windows cross-build
plus actual native Windows tests, frontend unit/type checks and relevant E2E
scenarios. Networking changes need synthetic failure/recovery and old-daemon
compatibility checks. Preserve input/continuation, quiet-notification and
no-console regressions. Packaging needs native build/upgrade-state checks.

Keep model-backed tests disposable and bounded by the current human approval.
Use only synthetic chat content; stop at login/trust prompts. Cross-compilation,
mock UI tests and an online box are separate evidence, not desktop acceptance.
Publish or deploy only when explicitly requested, with rollback preserved.
