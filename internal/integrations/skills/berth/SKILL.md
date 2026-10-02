---
name: berth
description: Use berth to work across development boxes — list repos (locations) and their worktrees, make a worktree or a task (a worktree with an agent in it), start or read terminal sessions, find which port and URL a worktree's dev server has, and read a repo's .berth/config.json (ports, env, services, hooks). Use when asked to spin up a worktree or agent on a box, check what runs where, find a dev server, or when you see BERTH_* variables in your environment. For driving other agents see berth-orchestrate; for showing a page to the user see berth-preview; for automating with hooks see berth-hooks.
---

# berth

berth connects a laptop to development boxes. Each box runs `berthd`; each
laptop runs `berth`. The commands are the same, with one difference:

- **On a laptop**, name the box first: `berth worktree new devl/cal/fix-login`.
- **On a box**, the box is implied: `berthd worktree new cal/fix-login`.

`command -v berth berthd` tells you which you have. Add `--json` to any
listing and prefer it when you will parse the result. The examples below use
the box form (`berthd …`); on a laptop write `berth … BOX/…` instead.

## Where am I?

When berth started your terminal, the environment says where you are:

| Variable | Meaning |
| --- | --- |
| `BERTH_BOX` | the box's name |
| `BERTH_LOCATION` | the repository (location) name, e.g. `cal` |
| `BERTH_ROOT_PATH` | the repository's main checkout |
| `BERTH_WORKTREE_PATH`, `BERTH_WORKTREE_NAME` | this worktree |
| `BERTH_WORKTREE_SLUG` | `cal_fix_login`: safe for database and container names |
| `BERTH_BRANCH` | the worktree's branch |
| `BERTH_PORT`, `BERTH_PORT_1`, … | ports reserved for this worktree alone |

Use `$BERTH_PORT` for this worktree's dev server instead of a fixed port like
3000: every worktree has its own block, so two worktrees never collide, and
berth's URL for the worktree reaches whatever listens there.

## Find your way around

```sh
berthd locations --json          # repos and their worktrees (each with its first port)
berthd sessions --json           # terminals and agents, with agent and agent_state
berthd services --json           # which worktree each listening port belongs to
berthd ports --json              # everything listening on the box
berthd agents                    # agent CLIs this box can start
```

`agent_state` is `idle` (at its prompt), `running`, `waiting` (needs a human)
or `finished` (done with its turn).

## Make work

```sh
berthd worktree new cal/fix-login --base main          # a worktree on a new branch
berthd task new cal/fix-login --agent claude --prompt "Fix the login redirect loop"
berthd session new cal/fix-login -- pnpm dev           # any command, in a terminal the user can open
berthd session screen cal-fix-login-claude-1a2b --history 200   # read a terminal
```

A branch that already exists, locally or on origin, is checked out as it is.
Session names are printed when they start and listed by `sessions`. Do not run
`berthd session attach` or `berth attach` yourself: they are interactive and
meant for humans.

The user sees every worktree, task and session in the Berth app as soon as it
exists, and is told when an agent waits for them.

## A repository's config

`.berth/config.json` in a repository (and the box's own config for that
location, which wins) says what every worktree gets:

```json
{
  "setup": "pnpm install",
  "archive": "dropdb --if-exists $BERTH_WORKTREE_SLUG",
  "ports": 2,
  "env": { "DATABASE_URL": "postgres://localhost/$BERTH_WORKTREE_SLUG" },
  "services": [{ "name": "web", "run": "pnpm dev --port $BERTH_PORT", "autostart": true }],
  "hooks": [{ "on": "worktree.created", "run": "createdb $BERTH_WORKTREE_SLUG" }],
  "agents": [{ "id": "claude", "name": "Claude Code", "command": "claude --model opus" }]
}
```

```sh
berthd location config cal --json        # the repo's, the box's, and the effective config
berthd service list cal/fix-login        # this worktree's services and their state
berthd service start cal/fix-login web   # also stop, restart
berthd service log cal/fix-login web     # its output, when it will not stay up
```

`setup` runs after a worktree is created and `archive` before it is removed;
services start after setup and stop before archive. Edit the repository's
file only when the user asks you to change how every worktree is set up.

## Share publicly — only when a human asks

`berthd share 3000` makes a port reachable **by anyone on the internet**
until `berthd unshare <id>`. Never share on your own initiative, and never
share anything with real data. Confirm with the user first and tell them the
URL and how to stop it.

## When something fails

- `no paired box named X` (laptop): run `berth boxes`; the name may differ.
- `berthd serve is not running` (box): `berthd install` starts it.
- `a "before:…" hook stopped …`: the user's hooks refused the action. The
  message says why; do not try to work around it.
