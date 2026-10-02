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

### On a schedule

```json
{
  "id": "nightly",
  "name": "Nightly: rebase every worktree and run tests",
  "enabled": true,
  "trigger": { "schedule": "0 2 * * *", "each_worktree": true, "where": { "branch": "sean/*" } },
  "steps": [
    { "id": "rebase", "kind": "run", "command": "git fetch origin && git rebase origin/main" },
    { "kind": "run", "when": "failure", "command": "git rebase --abort" },
    { "kind": "run", "command": "pnpm test", "timeout": "20m" },
    { "kind": "notify", "when": "failure", "title": "{{worktree.name}}: tests fail after rebasing" }
  ]
}
```

`schedule` is a cron expression (minute hour day month weekday, with `*`,
`*/15`, `1-5` and lists) or a shortcut (`@hourly`, `@daily`, `@weekly`,
`@monthly`), in the box's local time. When both day fields are restricted,
either one matching runs it, as in cron. A scheduled flow runs once, in the
repository's main checkout, unless `each_worktree` is set: then it runs once
for every worktree (not the main checkout) matching `where.branch`. A box
flow without `where.location` runs once in the box user's home. Runs carry
`schedule.fired` with `schedule` and `time`.

### On GitHub

```json
{ "trigger": { "github": { "on": "review_comment", "poll": "2m" } } }
```

The box checks each covered worktree's pull request with `gh` (installed
and signed in on the box) every `poll` (at least 1m, default 2m), and starts
the flow for what is new: `review_comment` (a comment on the PR or on a
line), `pr_review` (a submitted review), `check_failed` (a check that fails),
`pr_merged`. The first look only records what is already there, so turning
a flow on does not replay a PR's history. Each new item is its own run, one
after another, with `pr`, `url`, `title`, `author`, `body`, `file`, `line`,
`check` and `state` as event data. A box without `gh` simply never starts
these flows. One poll makes at most 20 `gh` calls, shared between flows.

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

Text fields take `{{now}}`, `{{event.FIELD}}` (any field of the event, like
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

## Resource guard

Each box can keep itself usable when memory runs short (`~/.berth/guard.json`
on the box, or Settings → Boxes → ⋯ → Resource guard). It is off until you
turn it on.

```json
{ "enabled": true, "memory_percent": 90, "sustain": "1m", "stop_services": true, "pause_agents": true }
```

Once memory has stayed above `memory_percent` for `sustain`, the guard takes
one step, waits 30 seconds, and looks again:

1. It stops the services of a worktree where no agent is working, the one
   idle longest first. This frees memory at once.
2. When none are left, it pauses a worktree whose live sessions are all
   idle or finished agents. Paused agents use no CPU and the kernel can swap
   them out; their memory is only freed if it does. Resume them from the
   Worktrees view.

It never touches an agent that is working or waiting for you, or a plain
shell. Each step sends `guard.acted` (with what it stopped or paused and
why) and a `notify`. The guard reads memory from `/proc`, so it works on
Linux boxes; on a box without it, it stays idle.

## Runs

The box keeps the last 200 runs with each step's status, duration and
output: `GET /v1/flows/runs`. `POST /v1/flows/{id}/test` with
`{"data": {"path": "<a worktree>"}}` runs a flow now, as if its trigger had
happened there.

## Shell hooks

For a single command on an event, a hook is still the simplest thing; see
[hooks.md](hooks.md). Flows are for anything with more than one step.
