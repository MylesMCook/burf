# Self-hosted CI runner (omarchy)

CI (`go`, `app`, `shell`, `docs-site`) and the Linux `release` job can run on
**omarchy**, the owner's Arch box, instead of GitHub's queue. The `macos`
release job always stays on GitHub's macOS runners.

## How it works

- One Docker container, `berth-runner`, built from this directory's
  `Dockerfile`: Ubuntu 24.04 with the GitHub Actions runner (pinned version,
  checksum verified), git, curl, jq, build-essential, tmux, shellcheck, gh,
  Google Chrome and Playwright's Chromium libraries. Jobs run as the
  non-root `runner` user, with passwordless sudo inside the container only.
- It runs four runners, `omarchy-1`..`omarchy-4` (labels `self-hosted`,
  `Linux`, `X64`, `omarchy`), so a push's jobs run side by side. They share
  the container's limits: 12 CPUs, 12 GB of memory, 16k processes.
- Its only mount is the named volume `berth-runner` at `/runner`: each
  runner's registration, work dir, tool cache (`_work/_tool`) and its jobs'
  `$HOME` (`home`), so two jobs at once never share a cache directory. The
  caches there (Go modules and build cache, the pnpm store, Playwright's
  browsers) stay warm between jobs and across updates, so the workflows skip
  GitHub's cache actions on omarchy.
- `--restart unless-stopped`: it comes back when Docker restarts. Docker must
  start at boot for it to survive a reboot: `sudo systemctl enable docker`.
- Each workflow job picks its runner with:

  ```yaml
  runs-on: ${{ (vars.SELF_HOSTED == 'true' && github.event_name == 'push' && github.actor == github.repository_owner) && fromJSON('["self-hosted","omarchy"]') || 'ubuntu-latest' }}
  ```

  `ci` runs on pushes to `main` and `release` on `v*` tags, so only those
  reach omarchy; pull requests and everything else use `ubuntu-latest`.

## Switch

```sh
gh variable set SELF_HOSTED --body true    # omarchy
gh variable set SELF_HOSTED --body false   # back to GitHub's runners
```

No code change either way. With `false`, the container can keep running idle.

## Install, update, remove

Run these from a checkout on the laptop; Docker talks to omarchy over SSH
(`berth ssh-config` sets up the `berth-omarchy` host). Your user on omarchy
must be in the `docker` group.

```sh
DOCKER_HOST=ssh://berth-omarchy ci/runner/install.sh    # build, register, start
DOCKER_HOST=ssh://berth-omarchy ci/runner/update.sh     # rebuild, recreate
DOCKER_HOST=ssh://berth-omarchy ci/runner/uninstall.sh  # unregister, remove all
```

- **install.sh** asks GitHub for a registration token with
  `gh api -X POST repos/sean-brydon/berthd/actions/runners/registration-token`
  (it needs repository admin; without gh it reads the token from stdin). The
  token goes to a one-off container on stdin and from there to `config.sh`
  through its environment: it is never on a command line, in the running
  container's environment, in the repository or in a log. It expires in an
  hour; the runners keep their own credentials in the volume.
  `RUNNERS`, `CPUS`, `MEMORY` and the other settings in `common.sh` can be
  overridden from the environment.
- **update.sh** rebuilds the image and recreates the container on the same
  volume; no token needed. To update the runner, set `RUNNER_VERSION` and
  `RUNNER_SHA256` (the release notes list the linux-x64 sha256) in the
  `Dockerfile` first. Runners don't update themselves (`--disableupdate`), and
  GitHub stops sending jobs to a runner that falls too far behind, so update
  when a new runner release comes out. A running job is cancelled: update
  when CI is idle.
- **uninstall.sh** deletes the `omarchy-*` runners from GitHub, then the
  container, volume and image. Set `SELF_HOSTED` to `false` first, or jobs
  wait for a runner that is gone.

Logs: `docker logs berth-runner`; a runner's own logs are in
`/runner/omarchy-N/_diag`.

## Security model

The repository is public, so the runner must never run code from anyone but
the owner. There are four locks, any one of which keeps a stranger's code
off omarchy:

1. **runs-on** chooses omarchy only for a `push` by the repository owner.
   Pull requests (forks or not), `workflow_dispatch`, schedules and every
   other event get `ubuntu-latest`.
2. **The job-started hook** (`job-started.sh`, baked into the image, run by
   the runner before every job) fails any job that is not a `push` to
   `refs/heads/main` or `refs/tags/v*` of sean-brydon/berthd whose actor and
   triggering actor are both the owner. A pull request can rewrite the
   workflow's `runs-on`, but not this script.
3. **Only the owner can push**: they are the only collaborator, and the
   "Release tags: owner only" ruleset limits creating, moving and deleting
   `v*` tags to admins. Fork pull requests from any outside contributor wait
   for the owner's approval before any workflow runs.
4. **The container**: no host mounts but its own volume, no Docker socket,
   not privileged, its own network namespace (not the host's), the default
   seccomp profile, `NET_RAW` dropped, memory, CPU and process limits. A job
   cannot see `/home/sean` or run `docker`. Sudo inside it is root in the
   container only.

What remains: the container's network can reach the internet and omarchy's
LAN and Tailscale addresses like any process on the box; jobs share the
container (one job can see what an earlier one left behind); and a
container escape would need a kernel or Docker bug. As belt and braces,
every job's first step also fails on a self-hosted runner unless the actor
is the owner and the event a push.
