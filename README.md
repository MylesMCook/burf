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

## Getting started

**On each box**, as the user your agents will run as:

```sh
curl -fsSL https://berthd.app/install | sh
```

It installs `berthd` for that user (no root), checks it against the
release's checksums, starts it as a systemd user service (launchd on macOS),
and prints a pairing link. The link works once, for ten minutes. Run it again
to upgrade in place; `sh -s -- --help` lists the options.

**On your laptop**, paste the link into the app (**Add a box**), or:

```sh
berth pair 'berth://100.101.102.103:7444?code=…&fp=…'
```

The app and `berth` are built from source for now (Go 1.27, Node 22 and
pnpm, and Rust for the app). Instead of the install line, `berth add ssh`
can install and pair a box over SSH in one step:

```sh
make all                                   # bin/berth, bin/berthd, Linux daemons
bin/berth add ssh me@my-box                # or: install on the box over SSH, and pair
bin/berth location add my-box/app ~/work/app
bin/berth task new my-box/app/fix-login --agent claude --prompt "Fix the login redirect"
cd app && pnpm install && pnpm tauri dev   # the desktop app
```

`berth help` lists every command; every listing takes `--json`.

## Docs

The documentation is at [docs.berthd.app](https://docs.berthd.app). Its pages
are the [`docs/`](docs) folder here, built by [`docs-site/`](docs-site):

- [Install](docs/getting-started/install.mdx), [add a box](docs/getting-started/add-a-box.mdx), [first project](docs/getting-started/first-project.mdx), [first agent](docs/getting-started/first-agent.mdx)
- [How Berth works](docs/concepts/architecture.mdx) and [the security model](docs/concepts/security.mdx)
- [Orchestration](docs/guides/orchestration.mdx): agents driving agents, and [the offline queue](docs/guides/offline-queue.mdx)
- [Automations](docs/guides/automations.mdx): flows, schedules, GitHub triggers; [hooks and gates](docs/guides/hooks.mdx)
- [Project config](docs/guides/project-config.mdx) (`.berth/config.json`), [kits](docs/guides/kits.mdx), [secrets](docs/guides/secrets.mdx)
- [The phone companion](docs/guides/phone.mdx), [agent integrations](docs/guides/agent-integrations.mdx), [plugins](docs/guides/plugins.mdx)
- Reference: [CLI](docs/reference/cli.mdx), [berthd](docs/reference/berthd.mdx), [config](docs/reference/config.mdx), [events](docs/reference/events.mdx), [the app's API](docs/reference/app-api.mdx), [plugin SDK](docs/reference/plugin-sdk.mdx)

## Development

```sh
make test               # go vet + go test -race
pnpm -C app build       # typecheck and build the app
pnpm -C docs-site dev   # the docs site, on http://localhost:3333
```
