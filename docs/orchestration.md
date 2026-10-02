# Orchestration

Agents in berth can drive each other, and so can you, a hook, or a plugin.
Four pieces on every box do it, the same from the app, the CLI and the API:

| Piece | CLI | Box API |
| --- | --- | --- |
| Start work: a worktree with an agent in it | `berth task new BOX/LOC/NAME --agent claude --prompt …` | `POST /v1/tasks` |
| Prompt a running agent | `berth session send BOX/SESSION TEXT` | `POST /v1/sessions/{name}/send` |
| Wait for its turn to end | `berth session wait BOX/SESSION` | `GET /v1/sessions/{name}/wait` |
| Run a check where it works | `berth exec BOX/LOC[/WT] -- COMMAND` | `POST /v1/exec` |

- **send** pastes the text as one block (so a multi-line prompt is one
  prompt), then presses Enter. Prompts never appear in events or logs; only
  `session.sent` with the session's name.
- **wait** returns when the agent is `finished` or `waiting` (or the states
  you ask for), or when its program exits. Over the API it only counts
  states reported after `after`. `berth session wait` counts the state the
  agent is in now; `berth session send … --wait` counts only what comes
  after the prompt, so the previous turn's `finished` does not end it.
- **exec** runs a command to completion through a login shell in the
  location or worktree, and returns its exit code and the last 64 KB of
  output. `before:exec` hooks can refuse it.

Agent state comes from the agents' own hooks (`berthd integrations install
claude`), so these work for Claude Code fully, and for Codex and Cursor as far
as they report (`finished` only).

## Patterns

**Loop until a check passes.**
`berth loop devl/fix-login --check "pnpm test" --prompt "Make the tests pass"`
prompts, waits, runs the check, and sends the failure back ("The check … failed:
<output> Fix it.") until it passes or `--max` rounds run out. It stops if the
agent is waiting for a human.

**Hand off.** A new worktree and agent picking up where another left off:
`berth task new devl/cal/billing-tests --agent codex --prompt "Continue from
cal-billing-claude in ~/work/cal-billing: write the missing tests."` The app's
"Hand off to…" does the same and records `from_session` on the task.

**Review.** A second agent in the same worktree:
`berth session new devl/cal/billing -- codex "Review the uncommitted changes. Do not edit."`

**Chain with hooks.** A hook can start the next step when an agent finishes:

```json
{ "on": "agent.finished", "run": "berth session send devl/reviewer \"Review what changed in $BERTH_PATH\"" }
```

## From an agent

The skill berth installs (`berth integrations install claude`) teaches agents
these commands, so an agent can split work across worktrees, ask another
agent for a review, or loop on a check by itself.
