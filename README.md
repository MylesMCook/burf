# Berth

Run coding agents on your dev boxes, and work with them as if they were on
your laptop.

Berth connects a laptop to any number of development machines (a VPS, a
cloud VM, a desktop under your desk) and gives each repository on them
worktrees, terminals, agents, dev servers and automations. The agents run on
the boxes, so closing the app, sleeping the laptop or losing Wi-Fi never
stops them; the app is a view you can close and reopen at any time.

- **Workspaces per worktree**: terminals (ghostty-web), splits, and browser
  tabs onto each worktree's dev server, at private URLs like
  `http://billing.cal.devl.localhost:1377/`.
- **Agents you can see and steer**: Claude Code, Codex and others, with a
  kanban of who needs you, a review inbox for finished work, and
  orchestration (prompt, wait, check, loop, hand off) from the app, the CLI,
  or other agents.
- **Projects set up the same everywhere**: each worktree gets its own ports,
  environment, services, hooks and flows, from the repository's
  `.berth/config.json`, a shareable kit, or the box's own config.
- **Automations**: Zapier-style flows on events, schedules or GitHub
  activity, running on the box; plus plain shell hooks and `before:` gates.
- **Plugins**: React plugins for the app, with built-ins for git changes,
  pull requests, dev servers, box monitoring, activity and notes.
- **Boxes without the fuss**: pinned mutual TLS, pairing by link, boxes on
  other tailnets, self-upgrade over Berth's own connection, and a phone
  companion served by each box.

## Pieces

| | |
| --- | --- |
| `berthd` | The daemon on each box: worktrees, sessions (tmux), services, hooks, flows, kits. |
| `berth` | The laptop CLI and background agent: connections, private URLs, the app's API. |
| `app/` | The desktop app (Tauri, React, coss ui). |
| `plugins/` | Built-in plugins, written against `packages/plugin-sdk`. |
| `kits/` | Kits, such as `cal-com`. |

## Getting started (from source)

There are no releases yet. Build everything with Go 1.27, Node 22 and pnpm,
and Rust for the app:

```sh
make all                                   # bin/berth, bin/berthd, Linux daemons
bin/berth add ssh me@my-box                # install berthd on a box over SSH, and pair
bin/berth location add my-box/app ~/work/app
bin/berth task new my-box/app/fix-login --agent claude --prompt "Fix the login redirect"
cd app && pnpm install && pnpm tauri dev   # the desktop app
```

`berth help` lists every command; every listing takes `--json`.

## Docs

- [design.md](docs/design.md): architecture and security model
- [app-api.md](docs/app-api.md): the API the app and plugins use
- [templates.md](docs/templates.md): `.berth/config.json` (ports, env, services) and task templates
- [kits.md](docs/kits.md): set projects up on every box, shared as a link
- [automations.md](docs/automations.md): flows, schedules, GitHub triggers, the resource guard
- [hooks.md](docs/hooks.md): events, hooks and gates
- [orchestration.md](docs/orchestration.md): agents driving agents
- [phone.md](docs/phone.md): the phone companion
- [integrations.md](docs/integrations.md): agent tools, skills

## Development

```sh
make test          # go vet + go test -race
pnpm -C app build  # typecheck and build the app
```
