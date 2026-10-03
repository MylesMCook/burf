# Hooks

Hooks run your commands when something happens in berth. They run on the
machine whose `~/.berth/hooks.json` names them: hooks on a box run there,
next to its repositories; hooks on the laptop run on the laptop, where they
can notify you, open things, or call other tools.

```json
{
  "hooks": [
    { "on": "agent.waiting", "run": "osascript -e 'display notification \"$BERTH_PATH\" with title \"An agent needs you\"'" },
    { "on": "worktree.created", "run": "cd \"$BERTH_PATH\" && pnpm install", "timeout": "10m" },
    { "on": "before:worktree.create", "run": "case \"$BERTH_NAME\" in wip-*) echo 'no wip- worktrees'; exit 1;; esac" }
  ]
}
```

The file is read again for every event, so edits apply immediately.

## Two kinds

- **After the fact**: `on` is an event type (`agent.finished`), a prefix
  (`worktree.*`), or `*`. These run one at a time, off the critical path. They
  cannot change what happened, and their failures are only logged.
- **Gates**: `on` is `before:` and an action (`before:worktree.create`,
  `before:*`). They run first, in order, with a 30 second default timeout. A
  gate that exits non-zero stops the action, and whatever it printed is the
  error the app, the CLI or the agent sees. Gates run on the box.

## What a hook gets

- The event as JSON on stdin:
  `{"type":"worktree.created","time":"…","box":"devl","origin":"app","data":{…}}`
- The same as environment variables: `BERTH_EVENT`, `BERTH_EVENT_BOX`,
  `BERTH_EVENT_ORIGIN`, and every data field upper-cased, as
  `BERTH_PATH`, `BERTH_NAME`, `BERTH_LOCATION`, `BERTH_BRANCH`, …
- `BERTH_ORIGIN`, which berth commands the hook runs pass on, so their own
  events are attributed to the hook rather than to you.

Fields: `timeout` (a Go duration, default `1m`; `30s` for gates) and `tool`.
A hook with `"tool": "slack"` never runs for events whose origin is `slack`,
which stops two integrations from bouncing events back and forth.

## Events

| Event | Where | Data |
| --- | --- | --- |
| `laptop.started` | laptop | |
| `box.connected`, `box.disconnected`, `box.untrusted` | laptop | |
| `forward.started`, `forward.failed`, `forward.removed` | laptop | `id`, `local`, `remote` |
| `location.added`, `location.removed` | box | `location`, `path` |
| `worktree.created`, `worktree.removed` | box | `location`, `name`, `path`, `branch` |
| `worktree.setup.started`, `.finished`, `.failed` | box | `location`, `name`, `path`, `script`, `log` |
| `worktree.archive.started`, `.finished`, `.failed` | box | same |
| `task.created` | box | `location`, `name`, `path`, `branch`, `session`, `agent` |
| `session.started` | box | `name`, `location`, `path`, `command` |
| `session.stopped` | box | `name` |
| `agent.ready` | box | `path`, `agent`, `session_id`: a new agent at its prompt |
| `agent.started` | box | the same: working on a prompt |
| `agent.waiting` | box | the same: needs you (a permission, a question, or `reason: "startup question"`) |
| `agent.finished` | box | the same: done with its turn |
| `share.started`, `share.stopped` | box | `id`, `port`, `url` |
| `unit.started`, `unit.stopped`, `unit.restarted` | box | `name` |
| `box.upgraded` | box | `build` |
| `preview.open` | box | `location`, `name`, `path`, `port`, `url_path`: an agent asks the app to show a page (`berthd preview`) |
| `skills.installed`, `skills.removed` | box | `skills`, `agents`, `target`, `location`, `paths` |
| `secret.failed` | box | `location`, `name`, `path`, `variable`, `ref`, `reason`: a [secret reference](templates.md#secrets) could not be read, so the variable was left unset; never the value |
| `secret.resolved` | box | `location`, `name`, `path`, `variable`, `ref`: one that failed reads again |

Box events reach the laptop too: the laptop agent relays every online box's
events, with `box` set, so a laptop hook on `agent.waiting` hears about every
agent on every box.

Agent events come from the agents' own hooks. `berthd integrations install
claude` (or `codex`, `cursor`, `all`) on a box sets them up; the same command
with `berth` does it on a laptop.

Anything can announce its own events: `berth emit deploy.finished url=…`.

## Gates

| Gate | Data |
| --- | --- |
| `before:location.add` | `location`, `path` |
| `before:worktree.create` | `location`, `name`, `branch`, `base` |
| `before:worktree.remove` | `location`, `name`, `path` |
| `before:task.create` | `location`, `name`, `branch`, `base`, `agent`, `command` |
| `before:session.start` | `name`, `location`, `path`, `command` |
| `before:session.stop` | `name` |
| `before:skills.install`, `before:skills.uninstall` | `skills`, `agents`, `target`, `location` |

A task runs `before:task.create`, then the worktree's and the session's own
gates.

## Plugins

A plugin's `berth-plugin.json` can list hooks the same way. They run in the
plugin's folder, with `BERTH_PLUGIN_DIR` set, and stop when the plugin is
disabled. See [plugins.md](plugins.md).
