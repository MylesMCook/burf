---
name: berth-orchestrate
description: Drive other coding agents through berth — prompt a running agent, wait for its turn to end, run a check in its worktree, loop until a check passes, hand work to a fresh agent in a new worktree, or ask a second agent for a review. Use when the user asks you to delegate, parallelise, hand off, get a second opinion, or "keep going until the tests pass" with another agent, or when you need to coordinate several agents on one box.
---

# Orchestrating agents with berth

Four primitives, on a box (`berthd …`) or a laptop (`berth … BOX/…`):

```sh
berthd task new cal/billing-tests --agent codex --prompt "…"   # start work: worktree + agent
berthd session send cal-billing-claude-1a2b "Also cover refunds."  # prompt a running agent
berthd session wait cal-billing-claude-1a2b                     # until finished or waiting
berthd exec cal/billing -- pnpm test                            # run a check in a worktree
```

- `session send` pastes the text as one prompt and presses Enter
  (`--no-enter` to only type it). Get session names from `berthd sessions`.
- `session wait` returns `finished`, `waiting` (the agent needs a human),
  `exited`, or reports a timeout (`--timeout 30m`, `--for finished,waiting,idle`).
  It only counts what the agent reports after you start waiting.
- `exec` prints the command's output and fails with its exit code. It runs in
  the worktree with the worktree's environment (`$BERTH_PORT`, …).

## Patterns

**Loop until a check passes**

```sh
berthd loop cal-billing-claude-1a2b --check "pnpm test" --prompt "Make the tests pass" --max 5
```

Prompts, waits, runs the check, and sends the failure back ("The check …
failed … Fix it.") until it passes or the rounds run out.

**Hand off** — a fresh agent in its own worktree picks up where you are:

```sh
berthd task new cal/billing-tests --agent codex \
  --prompt "Continue from $BERTH_WORKTREE_NAME in $BERTH_WORKTREE_PATH: write the missing tests for the refund flow."
```

Say exactly what is done, what is left, and where the work is. Commit or push
what the other agent needs first; worktrees do not share uncommitted changes.

**Review** — a second agent in the same worktree, told not to edit:

```sh
berthd session new cal/billing -- codex "Review the uncommitted changes against main. List bugs first. Do not edit files."
```

**Fan out** — several tasks at once, then wait on each:

```sh
for part in api ui docs; do berthd task new cal/refunds-$part --agent claude --prompt "…$part…"; done
berthd sessions --json        # names and agent_state of everything running
```

## Rules

- **Never answer for the human.** When `wait` returns `waiting`, or `loop`
  stops because an agent is waiting, tell the user which agent needs them and
  why (read it with `berthd session screen NAME --history 80`). Do not send it
  "yes", approve permissions, or pick options on their behalf.
- Do not prompt sessions you did not start unless the user asked you to.
- Prefer a new worktree (`task new`) over a second agent editing the same
  files at the same time.
- Never put secrets in prompts or events; prompts are not logged, but they are
  typed into a terminal the user can read.
- Stop when the user's goal is met. Report what each agent did and where.
