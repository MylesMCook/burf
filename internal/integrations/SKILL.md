---
name: berth
description: Use berth to work across development boxes — list and create worktrees at registered locations, start and read other agent sessions, find a service's private URL, forward ports, and announce events. Use when asked to spin up a worktree or agent on a box, check what another agent is doing, open a dev server running on a box, or hand work between machines.
---

# berth

berth connects a laptop to development boxes. Each box runs `berthd`; each
laptop runs `berth`. The same commands exist in both, with one difference:

- **On a laptop**, name the box first: `berth worktree new devl/cal/fix-login`.
- **On a box**, the box is implied: `berthd worktree new cal/fix-login`.

Check which you have with `command -v berth berthd`. Add `--json` to any
listing command for machine-readable output; prefer it when you will parse the
result.

## Concepts

- **Box**: a paired machine, e.g. `devl`. `berth boxes` lists them.
- **Location**: a named directory on a box, usually a git repository, e.g.
  `cal` → `~/work/cal`. Its worktrees are addressed as `cal/<worktree>`.
- **Session**: a long-running program (usually a coding agent) started at a
  location. It keeps running when nobody is attached.

## Find your way around

```sh
berth boxes --json                 # which boxes are online
berth locations devl --json        # locations and their worktrees
berth sessions devl --json         # running agent sessions
berth ports devl --json            # what is listening on the box
```

## Hand work to another agent

A task is a new worktree with an agent already running in it:

```sh
berth agents devl                  # agents the box can start: claude, codex, …
berth task new devl/cal/fix-login --agent claude --base main \
  --prompt "Fix the login redirect loop; see issue 123"
```

The person sees the new agent in the Berth app and is told when it waits for
them. For the pieces separately:

```sh
berth worktree new devl/cal/fix-login --base main
berth session new devl/cal/fix-login --name fix-login -- claude
```

A worktree's setup script (the repository's `.berth/config.json`) runs in the
background after it is created.

## Drive another agent

```sh
berth session send devl/fix-login "Also cover the logout path."   # type a prompt
berth session wait devl/fix-login                  # until its turn ends: finished or waiting
berth exec devl/cal/fix-login -- pnpm test         # run a check in its worktree
berth loop devl/fix-login --check "pnpm test" --prompt "Make the tests pass" --max 5
```

`loop` prompts, waits for the turn to end, runs the check, and sends the
failure back until it passes. It stops when the agent is waiting for a human:
tell the user rather than answering for them. Hand work to a fresh agent with
`berth task new … --prompt "Continue from <session> in <path>: …"`.

## See what another agent is doing

```sh
berth session screen devl/fix-login --history 200
```

This prints the session's terminal. Do not attach (`berth attach`) from an
agent: it is interactive and meant for humans.

## Reach a dev server

Every port on a box has a private URL on the laptop:

```sh
berth url devl 3000        # → http://3000.devl.localhost:1377/
```

For a fixed local port instead: `berth forward devl 3000`.

## Share publicly — only when a human asks

`berth share devl 3000` makes a port reachable **by anyone on the
internet** until `berth unshare devl <id>`. Never share on your own
initiative, and never share anything with real data. Confirm with the user
first and tell them the URL and how to stop it.

## Announce what you did

```sh
berth emit agent.finished path="$PWD" --origin=claude     # on a laptop
berthd emit agent.finished path="$PWD" --origin claude    # on a box
```

Hooks configured by the user react to these events (notifications, starting
the next agent). Event types look like `area.action`. Put identifiers and
paths in events, never prompts, secrets, or personal data.

## When something fails

- `no paired box named X`: run `berth boxes`; the name may differ.
- `box no longer trusts this laptop`: the box revoked access; a human must pair again.
- `berthd serve is not running`: on a box, `berthd install` starts it.
- `a "before:…" hook stopped …`: the user's hooks refused the action. The
  message says why; do not try to work around it.
