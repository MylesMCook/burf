---
name: berth-orchestrate
description: Drive other coding agents through berth — prompt a running agent, wait for its turn to end, run a check in its worktree, loop until a check passes, hand work to a fresh agent in a new worktree, or ask a second agent for a review. Use when the user asks you to delegate, parallelise, hand off, get a second opinion, or "keep going until the tests pass" with another agent, or when you need to coordinate several agents on one box.
---

# Orchestrating agents with berth

Four primitives, on a box (`berthd …`) or a laptop (`berth … BOX/…`):

```sh
berthd task new shop/checkout-tests --agent codex --prompt "…" --open tab   # worktree + agent
berthd session send NAME "Also cover refunds." --json                     # → {"turn":"NAME#3",…}
berthd session wait NAME --turn 'NAME#3' --timeout 5m --json              # until that turn ends
berthd exec shop/checkout -- pnpm test                                    # a check in a worktree
```

- Start agents with `--agent ID --prompt TEXT`, never `-- claude "…"`;
  `--open split|tab` puts them in front of the user (see the berth skill).
- `session send` types one prompt and presses Enter. It returns a **turn**:
  that prompt's turn, not whatever the agent is doing now. Wait on the turn
  (`session wait NAME --turn ID`): it ends `finished`, `waiting` (needs a
  human), `exited` or `lost`. No clocks, no polling.
- `--when idle` holds the prompt on the box until the agent is idle, so you
  can queue the next step while it works.
- The box refuses to type into an agent that is `waiting` for someone. Never
  pass `--force`: that answers the person's question for them.
- On a retry, pass the same `--idem KEY` (e.g. `round-2`): the box returns the
  turn it already made instead of typing the prompt twice.
- `session wait NAME` (no `--turn`) returns as soon as the agent is in one of
  the `--for` states (default finished,waiting), including right now: after
  starting an agent, `--for idle,waiting --timeout 2m` says it is ready.
- `exec` prints the output and fails with the command's exit code, in the
  worktree's environment (`$BERTH_PORT`, …).

## Your own time limit

Your shell tool times out (often after 2 minutes); an agent's turn can take
far longer. Never block on `send --wait` or `loop` in the foreground. Either
wait in short steps:

```sh
berthd session wait NAME --turn 'NAME#3' --timeout 90s --json   # repeat while "timed_out": true
```

or run the long command in the background and check on it later.

## Saving tokens (yours and theirs)

- Waits are event-driven: wait on the turn. Do not poll `session screen` or
  re-run `sessions` to see if it is done.
- Use `--json` and read only the fields you need (`turn`, `state`,
  `timed_out`). Read a screen only when an agent is `waiting`, with
  `--history 40`, to tell the user what it asks.
- Keep prompts short and specific. Feed back only what failed: the failing
  lines and the end of the output, never a whole log (`loop` does this).

## Patterns

**Loop until a check passes**

```sh
berthd loop NAME --check "pnpm test" --prompt "Make the tests pass" --max 5   # in the background
```

Prompts, waits for that turn, runs the check, and sends back what failed
until it passes, the rounds run out, or the agent waits for the user.

**Hand off**: a fresh agent in its own worktree picks up where you are:

```sh
berthd task new shop/checkout-tests --agent codex --open tab \
  --prompt "Continue from $BERTH_WORKTREE_NAME in $BERTH_WORKTREE_PATH: write the missing tests for the refund flow."
```

Say what is done, what is left, and where. Commit or push what the other
agent needs first; worktrees do not share uncommitted changes.

**Beside you**: a second agent in your worktree, in a split the user sees,
e.g. a reviewer told not to edit. Each agent's turns are its own, even in
one worktree:

```sh
berthd session new "$BERTH_LOCATION/$BERTH_WORKTREE_NAME" --agent codex --open split \
  --prompt "Review the uncommitted changes against main. List bugs first. Do not edit files."
```

**Fan out**: several tasks, then one wait per turn.

## Rules

- **Never answer for the human.** When a turn ends `waiting`, or the box
  refuses a send because the agent waits, tell the user which agent needs
  them and why. Do not send "yes", approve permissions, or pick options.
- Do not prompt sessions you did not start unless the user asked you to.
- Prefer a new worktree (`task new`) over two agents editing the same files.
- Never put secrets in prompts; they are typed into a terminal the user reads.
- Stop when the goal is met. Report what each agent did and where.
