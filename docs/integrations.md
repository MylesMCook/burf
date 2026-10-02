# Integrations

berth works with the tools around it in both directions: tools drive
berth through its CLI, and berth drives tools through hooks. Every event
records the tool it came from, so a change never bounces back and forth
between two tools.

## Agent tools → berth

### Claude Code, Cursor, Codex

```sh
berth integrations install claude     # on a laptop
berthd integrations install claude    # on a box, where agents usually run
berth integrations install all
```

- **Claude Code**: installs the berth skill at `~/.claude/skills/berth/` and
  `Stop` / `Notification` hooks in `~/.claude/settings.json`.
- **Cursor**: appends a `stop` hook to `~/.cursor/hooks.json`, after any hooks
  already there (Orca's are kept).
- **Codex**: installs the skill at `~/.codex/skills/berth/` and prints the
  `notify` line to add to `~/.codex/config.toml`, which berth does not edit
  because it holds a single value you may already use.

Installs are idempotent, keep every existing setting, back up the previous
file to `*.berth-backup`, and refuse to touch a file that is not valid JSON.

The hooks run `berth hook TOOL EVENT`, which turns the tool's payload into an
event (`agent.finished`, `agent.waiting`, `agent.started`). Only identifiers and
the working directory are kept: prompts, messages, and transcripts never
leave the tool. A hook never fails or blocks the tool that called it.

### The skill

The skill teaches agents to list boxes and locations, create worktrees, start
sessions, read another session's screen, find a service's URL, and announce
events, with `--json` output. It tells agents never to share a port publicly
unless a person asked.

### Anything else

Any script can announce an event:

```sh
berth emit agent.finished path="$PWD" --origin=mytool     # on a laptop
berthd emit deploy.done url=https://… --origin mytool      # on a box
```

## Worktrees from any tool

berthd watches its locations. A worktree created by another app, an agent,
or plain `git worktree add` shows up in berth and produces a
`worktree.created` event with origin `detected`. Nothing needs configuring in
those tools.

## berth → tools

berth drives other tools through hooks and plugins rather than adapters
built into it: a hook on `worktree.created` can register the worktree with
any tool that has a CLI, and a plugin can ship those hooks along with its UI.
See [hooks.md](hooks.md) and [plugins.md](plugins.md).

`berth events` streams every event from the laptop and all its boxes; the
full list is in [hooks.md](hooks.md#events).
