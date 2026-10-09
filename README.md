# Burf
https://github.com/MylesMCook/burf
Run coding agents on your dev boxes, and work with them as if they were on
your laptop.

Burf connects a laptop to any number of development machines (a VPS, a
cloud VM, a desktop under your desk) and gives each repository on them
worktrees, terminals, agents, dev servers and automations. The agents run on
the boxes, so closing the app, sleeping the laptop or losing Wi-Fi never
stops them; the app is a view you can close and reopen at any time.

- **Workspaces per worktree**: terminals (ghostty-web), splits, and browser
  tabs onto each worktree's dev server, at private URLs like
  `http://checkout.shop.devl.localhost:1377/`.
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
  other tailnets, self-upgrade over Burf's own connection, and a phone
  companion served by each box.

## Pieces

| | |
| --- | --- |
| `burfd` | The daemon on each box: worktrees, sessions (tmux), services, hooks, flows, kits. |
| `burf` | The laptop CLI and background agent: connections, private URLs, the app's API. |
| `app/` | The desktop app (Tauri, React, coss ui). |
| `plugins/` | Built-in plugins, written against `packages/plugin-sdk`. |

## Getting started

Burf is a fork preview. Signed Burf releases, a Homebrew cask and an
application update feed are not available. Build the fork using the commands
below. The app carries the `burf` CLI and Linux daemons for `burf add ssh`
and `burf upgrade`; automatic application updates stay disabled.

On a Linux or macOS box, the fork installer downloads only fork-owned
releases. If none is published, it stops and prints build instructions:

```sh
curl -fsSL https://raw.githubusercontent.com/MylesMCook/burf/main/site/install.sh | sh
```

For `burf` in a terminal, **Settings → General → Command line → Install**
links `~/.local/bin/burf` to the app's copy (it asks first). For the CLI
alone, build with `make all`.

Paste the box's link into the app (**Add a box**), or:

```sh
burf pair 'berth://100.101.102.103:7444?code=…&fp=…'
```

With a local build, `burf add ssh` can install and pair a box over
SSH in one step. Then add a project and start an agent, in the app or here:

```sh
burf add ssh me@my-box                    # or: install on the box over SSH, and pair
burf location add my-box/app ~/work/app
burf task new my-box/app/fix-login --agent claude --prompt "Fix the login redirect"
```

`burf help` lists every command; every listing takes `--json`.

### Build from source

With Go 1.27, Node 22, pnpm and Rust. `make all` builds `burf` and
`burfd` into `bin/`; the app runs the clone's `bin/burf` for the laptop
agent:

```sh
git clone https://github.com/MylesMCook/burf
cd burf && make all
cd app && pnpm install && pnpm tauri dev
```

`make app-build` builds `Burf.app` and its disk image, with the CLI and the
Linux daemons inside.

## Docs

The fork's documentation lives in [`docs/`](docs), built locally by
[`docs-site/`](docs-site). [Shipyard](https://github.com/cosscom/shipyard)
is the upstream project; its hosted docs describe its own releases.

- [Install](docs/getting-started/install.mdx), [add a box](docs/getting-started/add-a-box.mdx), [first project](docs/getting-started/first-project.mdx), [first agent](docs/getting-started/first-agent.mdx)
- [How Burf works](docs/concepts/architecture.mdx) and [the security model](docs/concepts/security.mdx)
- [Orchestration](docs/guides/orchestration.mdx): agents driving agents, and [the offline queue](docs/guides/offline-queue.mdx)
- [Automations](docs/guides/automations.mdx): flows, schedules, GitHub triggers; [hooks and gates](docs/guides/hooks.mdx)
- [Project config](docs/guides/project-config.mdx) (`.berth/config.json`), [kits](docs/guides/kits.mdx), [secrets](docs/guides/secrets.mdx)
- [The phone companion](docs/guides/phone.mdx), [agent integrations](docs/guides/agent-integrations.mdx), [plugins](docs/guides/plugins.mdx)
- Reference: [CLI](docs/reference/cli.mdx), [berthd](docs/reference/berthd.mdx), [config](docs/reference/config.mdx), [events](docs/reference/events.mdx), [the app's API](docs/reference/app-api.mdx), [plugin SDK](docs/reference/plugin-sdk.mdx)
- [Changelog](docs/changelog.mdx), and [releasing](docs/contributing/releasing.mdx) for maintainers

## Development

```sh
make test               # go vet + go test -race
pnpm -C app build       # typecheck and build the app
pnpm -C docs-site dev   # the docs site, on http://localhost:3333
```

## Licence

[MIT](LICENSE).
