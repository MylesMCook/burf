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
| `kits/` | Pointers to kits kept in their own repositories, such as [the Cal.com kit](https://github.com/sean-brydon/berth-kit-calcom). |

## Getting started

**On each box**, as the user your agents will run as:

```sh
curl -fsSL https://raw.githubusercontent.com/MylesMCook/burf/main/site/install.sh | sh
```

It downloads `burfd` from the [latest release](https://github.com/MylesMCook/burf/releases/latest),
checks it against the release's checksums, installs it for that user (no
root), starts it as a systemd user service (launchd on macOS), installs the
hooks that let Claude Code, Codex and Cursor report their state
(`--no-integrations` skips them), and prints a pairing link. The link works
once, for ten minutes. Run it again to upgrade in place; `sh -s -- --help`
lists the options.

**On your Mac**, build the fork using the development commands below.
Burf is currently a fork preview; signed Burf releases are not available.
The app carries the `burf` CLI and Linux daemons `burf add ssh` uploads.
Automatic application updates stay disabled until the fork has its own
signed releases and update feed.

For `burf` in a terminal, **Settings → General → Command line → Install**
links `~/.local/bin/burf` to the app's copy (it asks first). On a Linux
laptop, or for the CLI alone, build with `make all`. When Burf releases are
available, download a matching archive from the fork release (use
`linux-arm64`, `darwin-arm64` or `darwin-amd64` to match):

```sh
mkdir -p ~/.local/bin
curl -fsSL https://github.com/MylesMCook/burf/releases/latest/download/burf-linux-amd64.tar.gz | tar -xz -C ~/.local/bin
```

Paste the box's link into the app (**Add a box**), or:

```sh
burf pair 'berth://100.101.102.103:7444?code=…&fp=…'
```

Instead of the install line, `burf add ssh` can install and pair a box over
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

The documentation is at [docs.berthd.app](https://docs.berthd.app). Its pages
are the [`docs/`](docs) folder here, built by [`docs-site/`](docs-site):

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
