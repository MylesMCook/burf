# Berth

Connect your laptop to development boxes — any VPS or dev machine, on a tailnet
or not — and work on them as if they were local:

- **Private URLs for every service**: `http://3000.devl.localhost:1377/`, with no
  DNS, `/etc/hosts`, or port juggling. Nothing is public unless you share it.
- **Locations, worktrees, and agent sessions**: register a repo on a box,
  create worktrees (through git, Orca, or Herdr), start Claude Code or Codex in
  any of them, and read or attach to them from anywhere.
- **Integrations both ways**: agent tools drive berth through its CLI and a
  bundled skill; berth drives tools through hooks.
- **A desktop app** (Tauri) with onboarding, or the `berth` CLI.

See [docs/design.md](docs/design.md) for the architecture and security model,
and [docs/integrations.md](docs/integrations.md) for Orca, Herdr, Cursor, Claude
Code, and hooks.

## Install

On a box (Linux, amd64 or arm64), this downloads berthd from the latest
release, verifies it against `SHA256SUMS`, starts it at boot, and prints a
pairing link:

```sh
curl -fsSL https://raw.githubusercontent.com/sean-brydon/berth/main/install.sh | sh
```

On your laptop, paste that link into the app, or install the CLI and pair:

```sh
curl -fsSL https://raw.githubusercontent.com/sean-brydon/berth/main/install.sh | sh -s -- berth
berth pair '<link>'
```

`BERTH_VERSION=v0.1.0` pins a release; `BERTHD_LISTEN=<ip>:7444` sets the
address on a box that is not on a tailnet. If you can SSH to the box,
`berth add ssh <host>` does all of this for you instead.

## Quick start (from source)

```sh
make all                                  # berth, berthd, and Linux daemons in bin/
bin/berth add ssh my-box                # install on a box over SSH once, and pair
bin/berth ports my-box                  # what is running there
bin/berth url my-box 3000               # → http://3000.my-box.localhost:1377/
bin/berth orca connect devl             # this computer's Orca app now reaches devl
bin/berth herdr setup                   # every box in this computer's Herdr window
```

A box on a tailnet this laptop is not joined to (say a personal one, while
the Mac is on work):

```sh
bin/berth network login personal        # one-time browser sign-in
bin/berth add ssh devl --network personal
```

Without SSH access, run the install script on the box and paste the link it
prints into `berth pair '<link>'` or the app.

## Everyday commands

```sh
berth status                                   # boxes, forwards, proxy
berth locations devl                           # repos and their worktrees
berth worktree new devl/cal/fix-login --base main
berth kit install devl/cal                     # Cal.com: every worktree gets its own app and URL
berth kit tools devl/cal --setup               # …for worktrees Orca, Cursor, Codex and Superset make too
berth worktree open devl/cal/fix-login --tool orca --agent claude
berth services devl                            # dev servers by worktree
berth doctor devl                              # what the box sees
berth forward devl 3000                        # fixed local port
berth share devl 3000                          # public link, until unshare
berth upgrade devl                             # new daemon, no SSH, sessions kept
berth events                                   # everything, live
```

Every listing takes `--json`. `berth help` lists everything.

## The desktop app

```sh
make app-dev        # run it
make app-build      # build Berth.app
make release        # every install.sh asset + SHA256SUMS in dist/
```

### Releasing

```sh
make publish VERSION=0.3.0 NOTES="What changed"
```

From a clean `main`, this bumps the version, builds the CLI and daemons, builds
the app and signs its update, writes `latest.json`, tags, and creates the
GitHub release. Installed apps check that feed at launch and every few hours,
verify the signature against the public key in `tauri.conf.json`, and offer
**Restart to update**; afterwards they offer to upgrade any box running an
older berthd. The private key is read from `TAURI_SIGNING_PRIVATE_KEY`, from
1Password with `BERTH_SIGNING_KEY_OP=op://…`, or from `~/.tauri/berth.key`.
Anyone with it can ship updates to every install, so keep it in 1Password.

It is a view over the bundled `berth` binary: every action runs it with
`--json`, so the app and the CLI never disagree. In a plain browser
(`cd app && pnpm dev`) it runs on sample data, for working on the UI; add
`?preview=new` to see first-run onboarding.

## Layout

| Path | What |
| --- | --- |
| `cmd/berth` | Laptop CLI and background agent |
| `cmd/berthd` | Box daemon |
| `internal/wire` | Pinned mutual TLS, pairing, HTTP/2 streams |
| `internal/agent` | Laptop agent: box health, forwards, proxy, events, local API |
| `internal/box` | Locations, worktrees, sessions, shares, ports, self-upgrade |
| `internal/network` | Embedded Tailscale nodes for other tailnets |
| `internal/proxy`, `internal/forward` | `*.localhost` proxy and TCP forwards |
| `internal/hooks`, `internal/integrations` | Hooks, tool adapters, the skill |
| `internal/terminal` | PTYs and raw-mode terminals, no dependencies |
| `app/` | Tauri + React desktop app (coss ui) |

## Development

```sh
make test           # go vet + go test -race
```

The Go module's only third-party dependency is `tailscale.com`, for reaching
boxes on other tailnets.
