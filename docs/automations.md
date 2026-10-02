# Automations

Automations in berth are flows: when something happens, do these steps.
They run on the box, so they keep going while your laptop sleeps.

```json
{
  "id": "check-after-turn",
  "name": "Run tests after every agent turn",
  "enabled": true,
  "trigger": { "event": "agent.finished", "where": { "location": "cal" } },
  "steps": [
    { "id": "test", "kind": "run", "command": "pnpm test --changed", "timeout": "15m" },
    { "kind": "prompt", "when": "failure",
      "text": "The tests failed (exit {{prev.exit_code}}):\n\n{{steps.test.output}}\n\nFix them." },
    { "kind": "notify", "when": "success", "title": "{{worktree.name}} passes its tests" }
  ]
}
```

A box's own flows live in `~/.berth/flows.json` on it; a repository's in
its `.berth/config.json` under `flows`, or in the box's own config for it.
The app edits both.

## Triggers

`event` is any event type from [hooks.md](hooks.md#events), or a prefix
like `worktree.*`. `where` narrows it: `location`, `agent` (`claude`,
`codex`), and `branch` (a trailing `*` matches a prefix). A repository's
flows only ever see that repository's events.

## Steps

| Kind | Does | Fields |
| --- | --- | --- |
| `run` | Runs a command in the event's worktree, with its environment | `command`, `timeout` (10m) |
| `prompt` | Types a prompt into the agent that triggered the flow, or `session` | `text`, `session` |
| `wait` | Waits for that agent's turn to end | `for` (finished, waiting), `timeout` (30m) |
| `start_agent` | Starts an agent in the worktree, or in a new one | `agent`, `text` (its prompt), `new_worktree`, `name` |
| `notify` | Shows a notification in the app | `title`, `text` |
| `webhook` | POSTs JSON somewhere, e.g. Slack | `url`, `text` (the body; default every variable) |

Each step runs when the previous one succeeded (`when: "success"`, the
default), failed (`"failure"`), or `"always"`. A `run` step fails when its
command exits non-zero. A flow fails when a step fails and no later step
handles failure.

Text fields take `{{event.FIELD}}` (any field of the event, like
`{{event.agent}}`), `{{worktree.name}}`, `{{worktree.path}}`,
`{{worktree.branch}}`, `{{location}}`, `{{prev.output}}`,
`{{prev.exit_code}}`, `{{steps.ID.output}}` and, after a wait,
`{{agent.state}}`. Output is the last 4000 characters.

## Safety

- A flow that is already running for a worktree is not started again for
  it.
- Each flow runs at most `max_runs_per_hour` times (default 20). A flow that
  prompts the agent whose finishing started it would otherwise run forever.
- Events a flow causes carry `origin: "flow:<id>"`, and `flow.started` and
  `flow.finished` never start flows.
- `before:` hooks still gate what a flow does, like anything else.

## Runs

The box keeps the last 200 runs with each step's status, duration and
output: `GET /v1/flows/runs`. `POST /v1/flows/{id}/test` with
`{"data": {"path": "<a worktree>"}}` runs a flow now, as if its trigger had
happened there.

## Shell hooks

For a single command on an event, a hook is still the simplest thing; see
[hooks.md](hooks.md). Flows are for anything with more than one step.
