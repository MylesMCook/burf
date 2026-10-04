---
name: berth-orchestrate
description: Drive other coding agents through berth — prompt a running agent, wait for its turn to end, run a check in its worktree, loop until a check passes, hand work to a fresh agent in a new worktree, ask a second agent for a review, or try a task several ways and pick the best. Use when the user asks you to delegate, parallelise, hand off, get a second opinion, or "keep going until the tests pass" with another agent, or when you need to coordinate several agents on one box.
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

## Runs: let the box do the waiting

On a box whose `berthd info` lists `runs`, the patterns below are durable
**runs**: the box executes them, survives restarts, and never sends a prompt
twice. Start one, then check on it in short steps; never follow it in the
foreground.

```sh
berthd run start --template loop --param session=NAME --param check='pnpm test' \
  --param prompt='Make the tests pass' --idem my-loop-1 --json      # → {"id":"r_…",…}
berthd run get r_… --json        # status, gate, attempts; read only what you need
berthd runs --status active
```

`berthd run templates` lists them with their parameters: `loop`, `review`,
`handoff`, `broadcast`, `attempts`, `fix-ci`, `address-review`, `exec`. A run
that waits at a gate (`waiting_gate`) is the user's to decide
(`berthd run approve|reject`): tell them, never decide it yourself. If berth
is an MCP server for you (`berth_*` tools), use those: they never block and
return small JSON (`berth_wait_turn` takes at most 90 s and returns a cursor).

## Patterns

**Loop until a check passes**

```sh
berthd loop NAME --check "pnpm test" --prompt "Make the tests pass" --max 5 --detach
```

Prompts, waits for that turn, runs the check, and sends back what failed
until it passes, the rounds run out, or the agent waits for the user.
`--detach` starts the run and returns; check it with `run get`.

**Long checks**: `berthd exec shop/checkout --detach -- pnpm test` returns a
run at once; `run get` has its exit code and output.

**Hand off**: a fresh agent in its own worktree picks up where you are:

```sh
berthd run start --template handoff --param session=NAME --param name=checkout-tests \
  --param agent=codex --param prompt='Write the missing tests for the refund flow.'
```

You are asked to write `.berth/handoff/<run>.md` (Done, Left, Decisions,
Gotchas; at most 30 lines, paths not code); berth adds the diffstat, commits
and turn log and points the new agent at it. On an older box, `task new
… --prompt "Continue from … : …"` and commit what the other agent needs
first: worktrees do not share uncommitted changes.

**Try several ways**: `--template attempts` with `location`, `name`,
`prompt` and `attempts` (`'["claude","codex"]'`): each in its own worktree,
verified, judged, then the user picks.

**Review**: `--template review --param session=NAME` has a read-only
headless reviewer answer in at most 15 lines (`send_back=true` sends it to
the author). Or a second agent in your worktree, in a split the user sees.
Each agent's turns are its own, even in one worktree:

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
