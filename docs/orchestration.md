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

## When a box is away

Boxes drop off: the laptop sleeps, Wi-Fi goes, a box restarts. A prompt for
an agent on a box that cannot be reached can wait in the laptop agent's
queue instead of failing:

```sh
berth session send devl/billing-claude "Rebase on main" --queue
berth queue                # what is waiting, and why anything failed
berth queue rm ID          # discard one
berth queue retry ID       # put a failed one back in line
berth queue send ID        # send one now, without waiting for the agent's turn
```

The app offers the same thing ("Queue for when devl is back") in Send a
prompt, the prompt picker and broadcasts, and lists the queue under
**Queued** in the status bar.

- **Only prompts that never left are queued.** `--queue` (and the app's
  offer) applies when the connection to the box could not be opened at all.
  If the connection dropped after the prompt went out, it may have arrived,
  so the send fails as usual; the app says so and offers "Queue anyway".
- **Where it lives.** `queue.json` in the laptop's state directory, written
  atomically on every change. It survives the agent and the laptop
  restarting; delivery happens with the app closed.
- **When it goes.** As soon as the agent sees the box again (and on every
  health check while prompts wait), oldest first for each session. Each
  session's prompts go in order: a failed one holds the ones behind it until
  it is retried, moved or discarded.
- **Not mid-turn.** Before typing, the agent checks the session still runs.
  If its agent reported `running`, the prompt waits (state `waiting`) for
  `idle`, `waiting` or `finished`, for up to 30 minutes, then goes anyway:
  agents take input mid-turn, they just read it later. An agent that never
  reported a state is not waited for. A prompt queued with `wait: false`
  goes at once.
- **Gone sessions.** If the session is gone or its program exited, the
  prompt fails with that reason and stays, so you can move it to another
  agent or discard it.
- **At most once.** An item is marked `sending` and saved before the
  request goes out. If the box answers, it leaves the queue (delivered) or
  fails with the box's reason. If the request never reached the box, it
  goes back in line. If anything else happens before the answer — the
  connection drops, the agent crashes — nobody can tell whether it arrived,
  so it fails ("may have arrived") rather than being typed twice; Retry
  sends it again once you have looked. Enqueueing takes an optional `id`,
  so a client retrying the enqueue itself never queues twice.

The agent publishes `queue.changed`, `queue.delivered` and `queue.failed`
(with `id`, `box`, `session`, and `reason` for failures; never the prompt),
so laptop hooks can react too.

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
