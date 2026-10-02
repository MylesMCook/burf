# Usage & accounts

A built-in plugin, **off by default**. Turn it on in Settings → Plugins. It adds a **Usage** screen to the sidebar and two commands, "Show agent usage" and "Switch agent account".

## Usage

The screen shows how many tokens Claude Code and Codex used on a box. Pick today, 7 days or 30 days, and see the tokens:

- by agent;
- by model;
- by project or worktree;
- by session.

Each session has **Open** if it is still running in Berth, or **Resume** (`claude --resume <id>`, `codex resume <id>`) in its worktree.

The numbers come from the files each agent writes on the box. Nothing is estimated or made up.

| Agent | Read from | What's in it |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/*.jsonl` and each account's `<dir>/projects` | `message.usage` on each assistant message, deduplicated by message and request id. It also holds Claude Code's own per-session `totalCostUSD`. |
| Codex | `~/.codex/sessions/**/*.jsonl` and each account's `<dir>/sessions` | `token_count` events (cumulative totals per session) and the `rate_limits` Codex last saw. |

- **Input** excludes cached input. Cache reads and writes are shown separately; Codex's `input_tokens` includes its cached tokens, so the plugin subtracts them.
- **Cost** is shown only for Claude Code, and only as Claude Code's own estimate at API list prices. On a subscription (Claude Max or Pro) the screen says the plan covers the use. Codex gets no dollar figure: it records none, and the plugin keeps no price table.
- **Plan limits** are shown only for Codex, which writes its 5-hour and weekly windows into its transcripts. They show as "as of" the last turn Codex took. A window that has reset since says so instead of showing an old percentage. Claude Code doesn't write its limits anywhere the plugin can read, so it shows none.

### How it runs on the box

[`box/usage.py`](box/usage.py) runs through `exec` with `python3`; the box needs nothing installed.

- It reads files newest first.
- It stops after 45 seconds (`BERTH_USAGE_BUDGET`) and reports what is still pending. The screen asks again until it's done.
- It caches each file's summary by size and mtime in `~/.cache/berth-usage/files.json`.
- Its answer stays under exec's 64 KB output cap.

## Accounts

A box can have several logins per agent. Each login lives in its own folder:

| Agent | Default | More accounts | Picked with |
| --- | --- | --- | --- |
| Claude Code | `~/.claude` (profile in `~/.claude.json`) | `~/.berth/accounts/claude/<name>` | `CLAUDE_CONFIG_DIR` |
| Codex | `~/.codex` | `~/.berth/accounts/codex/<name>` | `CODEX_HOME` |

**Add account…** creates the folder (mode 0700) and opens a terminal in the current worktree. It runs the agent's own sign-in with that folder:

- `CLAUDE_CONFIG_DIR=<dir> claude`;
- `CODEX_HOME=<dir> codex login --device-auth`.

You finish signing in yourself; the plugin never reads or stores credentials. It shows only the email, plan and sign-in method the agent recorded.

**Use for new sessions** sets the variable in one of two places:

- **Everywhere on a box:** in the box's `~/.berth/env.json` (`GET`/`PUT /v1/env`). Every worktree gets it, under the project's own env.
- **One project:** in that project's box-local config (`PUT /v1/locations/{name}/config`, `local.env`). It wins over the box.

Choosing the default account removes the variable. Running sessions keep the account they started with. The screen shows which account each running session uses, read from its tmux environment.

`CODEX_HOME` is Codex's documented home folder. `CLAUDE_CONFIG_DIR` is the variable Claude Code reads for its config folder. On a Linux box each folder keeps its own login. On a Mac box, Claude Code keeps its credentials in the keychain; check that a second account really signs in on its own before relying on it.

## Developing

`pnpm -C app build:plugins` bundles it into `app/public/builtin-plugins/usage/`, with `usage.py` inlined as text. In `?mock=1`, `app/src/lib/mock-usage.ts` answers the script and `/v1/env` with made-up numbers. There are screenshots in `design/plugins/usage-*.png`.
