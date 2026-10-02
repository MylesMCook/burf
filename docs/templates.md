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
  "setup": "pnpm install && cp ../cal/.env .env",
  "archive": "docker compose down -v",
  "agents": [
    { "id": "claude", "name": "Claude Code (Opus)", "command": "claude --model opus" },
    { "id": "review", "name": "Codex review", "command": "codex --sandbox read-only" }
  ]
}
```

- `setup` runs in a new worktree right after berth creates it, through a login
  shell, logging to berthd's log directory. `worktree.setup.started`,
  `.finished` and `.failed` report how it went.
- `archive` runs before a worktree is removed; if it fails, the worktree stays.
- Both get `BERTH_ROOT_PATH` (the repository), `BERTH_WORKTREE_PATH` and
  `BERTH_WORKTREE_NAME`, and the same values under Orca's names
  (`ORCA_ROOT_PATH`, `ORCA_WORKTREE_PATH`, `ORCA_WORKSPACE_NAME`), so setup
  scripts written for Orca work unchanged.
- `agents` adds ways to start agents in this repository, or replaces a
  built-in one with the same `id` (`claude`, `codex`, `opencode`, `gemini`,
  `cursor`). `prompt_flag` names the flag that passes a first prompt, when it
  is not simply the last argument.

Scripts set on the location win over the file:
`berth location scripts devl/cal --setup '…'`, and `--clear` goes back to it.

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
