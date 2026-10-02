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
  expanded.
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

### This box only

Some of it should not be committed: a database password, one box's paths.
Each box keeps its own config for a location, laid over the file: scripts,
ports and env entries replace the file's, services and agents replace by
name, and hooks and flows add up. Edit it in the app's Project settings, or
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
