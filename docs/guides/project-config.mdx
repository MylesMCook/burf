# Templates

Two kinds of template shape new work.

- **A repository's `.berth/config.json`**, committed with the code, says how
  every worktree of that repository is set up and torn down, and which agents
  to offer. It travels with the repo, so every box does the same.
- **Task templates** in `~/.berth/templates/` are yours: kinds of task you
  start often, with the agent, branch and prompt filled in.

## `.berth/config.json`

```json
{
  "setup": "pnpm install && createdb $BERTH_WORKTREE_SLUG",
  "archive": "dropdb --if-exists $BERTH_WORKTREE_SLUG",
  "ports": 2,
  "env": {
    "DATABASE_URL": "postgres://localhost/$BERTH_WORKTREE_SLUG",
    "NEXT_PUBLIC_WEBAPP_URL": "http://localhost:$BERTH_PORT"
  },
  "services": [
    { "name": "web", "run": "pnpm dev --port $BERTH_PORT", "autostart": true },
    { "name": "worker", "run": "pnpm worker" }
  ],
  "agents": [
    { "id": "claude", "name": "Claude Code (Opus)", "command": "claude --model opus" }
  ],
  "hooks": [
    { "on": "worktree.created", "run": "cp ../cal/.env .env" }
  ],
  "flows": []
}
```

Everything here applies to each worktree of the repository:

- **Ports.** Every worktree has its own block of ports, stable for its life
  and freed when it is removed: `$BERTH_PORT`, then `$BERTH_PORT_1`… up to
  `ports` of them (at most 10). Any port in a worktree's block reaches it at
  `http://<worktree>.<location>.<box>.localhost:1377/`, whatever process
  listens on it, containers included.
- **Environment.** Everything run in a worktree (setup and archive scripts,
  terminals and agents, `exec`, hooks, services) gets `BERTH_BOX`,
  `BERTH_LOCATION`, `BERTH_ROOT_PATH`, `BERTH_WORKTREE_PATH`,
  `BERTH_WORKTREE_NAME`, `BERTH_WORKTREE_SLUG` (like `cal_fix_billing`, safe
  for database names), `BERTH_BRANCH` and the ports, then `env` with those
  expanded. A value can be a [secret reference](#secrets) instead.
- **Services** run in each worktree as managed processes that survive the
  daemon restarting and come back if they crash, with their output in a log.
  `autostart` ones start when the worktree is created, after setup; all of
  them stop before the archive script runs. A service also gets `PORT`
  unless `env` sets it. Start and stop them from the app's Run menu.
- **Hooks** fire only for this repository's events, inside the worktree the
  event is about, with its environment. `before:` gates here can refuse
  actions in this repository.
- **Flows** are this repository's automations; see
  [automations.md](automations.md).
- `setup` runs right after a worktree is created; `archive` before it is
  removed, and the worktree stays if it fails. Both also get Orca's names
  (`ORCA_ROOT_PATH`, `ORCA_WORKTREE_PATH`, `ORCA_WORKSPACE_NAME`), so setup
  scripts written for Orca work unchanged.
- `agents` adds ways to start agents in this repository, or replaces a
  built-in one with the same `id` (`claude`, `codex`, `opencode`, `gemini`,
  `cursor`).

### Secrets

An `env` value can name a secret instead of holding it, so the file, or a
kit, can be shared, even publicly, without one in it:

```json
"env": {
  "DATABASE_PASSWORD": "op://dev/cal-db/password",
  "STRIPE_SECRET_KEY": "op://dev/Stripe test/secret key",
  "OPENAI_API_KEY": "env://OPENAI_API_KEY"
}
```

- `op://vault/item/field` (or `op://vault/item/section/field`, with
  `?attribute=otp` and the like) is 1Password's own reference syntax,
  read with the 1Password CLI on the box: `op read`. Install `op` on the
  box; berthd finds it on its `PATH`, in `~/.local/bin`, `/opt/homebrew/bin`
  or `/usr/local/bin`, or wherever `$BERTH_OP` says. It signs in with a
  [service account](https://developer.1password.com/docs/service-accounts/)
  when `OP_SERVICE_ACCOUNT_TOKEN` is set, in berthd's own environment or in
  the box's `~/.berth/env.json` (which every worktree also gets, so berthd's
  environment is the tighter place), and otherwise with the box user's own
  signed-in `op`.
- `env://NAME` passes on a variable from berthd's own environment, under
  whatever name the project wants.

The box reads a reference when it builds a worktree's environment for a
hook, a flow, a setup script or `exec`, and keeps the value in memory for
five minutes. It never writes a value to disk or
puts one in a log, an event, the API or an error: config, `GET
/v1/locations/{name}/config` and `GET /v1/env` show the reference. A value
is not expanded, so a `$` in a password stays a `$`.

If a reference cannot be read (no `op`, not signed in, no such item, a
read that takes over 15 seconds), what needs it still starts, without that
variable, and the box sends one `secret.failed` event with the variable,
the reference and the reason, which the app shows as a notification. A
failure is remembered for 30 seconds, so a broken reference does not run
`op` for every hook.

Terminals, agents and services don't get values from berthd at all: tmux
takes a session's environment as command-line arguments, which other
processes can read, and a service's unit file is on disk and restarted by
the service manager without berthd. So they get the references, and their
program runs behind `berthd secret exec`, which resolves them in its own
memory and then replaces itself with the shell or agent (the pane's process
and the session's command are the ones asked for). It prints which
variables it could not set, and reports to the box, through its local
socket, which resolved and which failed (never a value), so the box can
announce failures. For a service, `env://` reads the service manager's
environment. Each start reads `op` afresh, so a service that keeps
crashing reads it on every restart.

Check one from the app (Project settings → Environment → **Test**), or:

```sh
berth secret test devl op://dev/cal-db/password   # Resolved op://dev/cal-db/password: 24 characters
```

Either way the box reports only whether it could read it and how long the
value is.

### This box only

Some of it should not be committed: a database password, one box's paths.
Each box keeps its own config for a location, laid over the file: scripts,
ports and env entries replace the file's; services, agents and flows replace by
name; and hooks add up. Edit it in the app's Project settings, or
`PUT /v1/locations/{name}/config` on the box.

## Task templates

One JSON file per template in `~/.berth/templates/`; the file name is its id.

```json
{
  "name": "Fix a bug",
  "description": "A fresh branch and Claude Code, asked for a failing test first.",
  "box": "devl",
  "location": "cal",
  "agent": "claude",
  "branch": "fix/{{name}}",
  "base": "main",
  "prompt": "Fix this bug: {{issue}}\n\nReproduce it with a failing test first.",
  "variables": [{ "id": "issue", "label": "What's broken", "multiline": true }]
}
```

- `box` and `location` are defaults the New Task dialog starts from.
- `{{name}}` is the task's name, which is also the worktree's.
- Every other `{{var}}` in `branch` or `prompt` becomes an input; `variables`
  gives them labels and makes long ones multi-line.
- A branch that already exists, locally or on `origin`, is checked out as it
  is, so a template can review or continue existing work.

[examples/templates](../examples/templates) has two to start from.
