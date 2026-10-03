# Kits

A kit sets a project up the same way on every box, and travels as a link.
It packages what a project needs around its code: setup and teardown
scripts, environment, ports, services such as dev servers, hooks, flows,
agent presets, and the tools it requires.

Use a kit for setup you cannot or should not commit to the repository: a
public repository with your team's internal setup, a personal workflow, or
one setup shared by several repositories. A team that owns the repository
can commit `.berth/config.json` instead; a kit adds to that.

## Using one

```sh
berth kit add https://github.com/acme/kits/tree/main/cal-com   # shows what it does, then asks
berth kit apply cal-com devl/cal cal/cal omarchy/cal           # install on projects on any box
berth kit list                                                  # where each is installed, and if it is out of date
berth kit update cal-com && berth kit apply cal-com devl/cal    # take a newer version
berth kit remove devl/cal                                       # uninstall from a project
```

In the app, open a `berth://kit?src=<link>` link, or use **Kits → Add from
link**. Either way you see everything the kit will do, every file it
carries, and where it came from, before anything is kept or run. Projects
whose repository matches the kit are selected for you.

A link can be:

- a git repository: `https://github.com/acme/cal-kit`
- a folder in one: `https://github.com/acme/kits/tree/main/cal-com`, or
  `URL#cal-com`, with `@ref` for a branch or tag
- a gist, for a kit that fits in one `kit.json`
- a URL to a `kit.json`
- a folder on this laptop

Berth remembers the link and the commit, so `update` fetches the newest
version and the app flags projects running an older one.

## Writing one

```
cal-com/
  kit.json
  scripts/
    setup.sh
    archive.sh
```

```json
{
  "id": "cal-com",
  "name": "Cal.com development",
  "description": "Each worktree gets its own database, ports and dev server.",
  "version": "3",
  "match": { "slug": "calcom/cal.com" },
  "requires": [
    { "tool": "psql", "hint": "sudo apt install postgresql-client" },
    { "tool": "yarn" }
  ],
  "config": {
    "setup": "$BERTH_KIT_DIR/scripts/setup.sh",
    "archive": "$BERTH_KIT_DIR/scripts/archive.sh",
    "ports": 3,
    "env": { "DATABASE_URL": "postgres://localhost/cal_$BERTH_WORKTREE_SLUG" },
    "services": [{ "name": "web", "run": "yarn dev --port $BERTH_PORT", "autostart": true }]
  }
}
```

`config` is the same as a repository's `.berth/config.json`; see
[templates.md](templates.md). A kit's files are copied to each box it is
applied to, and `$BERTH_KIT_DIR` is where they are, so its scripts can run
from there. Scripts starting with `#!` are made executable. A small kit can
carry its files inside `kit.json` under `"files": {"scripts/setup.sh": "…"}`.

Keep secrets out of a kit: give `env` a reference such as
`op://dev/cal-db/password` and each box reads it from 1Password when a
worktree needs it, so the kit can be shared, even publicly. See
[Secrets](templates.md#secrets); a kit that uses `op://` should list
`{ "tool": "op" }` in `requires`.

`requires` lists tools a box needs. A missing one is reported when the kit
is applied, not refused, since a setup script may install it.

`berth kit save devl/cal my-kit` turns how a project is set up on a box
into a kit in `~/.berth/kits/my-kit/`; push that folder to a git
repository to share it.

## How it applies

On each project a kit is its own layer: the repository's
`.berth/config.json`, then the kit, then the box's own config for the
project. The box's own settings always win, so a teammate can adjust one
value without forking the kit, and updating or removing the kit never
touches either of the other layers. A project has at most one kit.

A plugin can ship kits by listing their folders under `"kits"` in its
`berth-plugin.json`.

## Safety

A kit runs its scripts on the boxes you apply it to, with your account's
access. Berth never applies one silently: adding shows everything it does
and every file, and applying is a separate step you choose projects for.
On a box, kit files can only be written inside the kit's own folder, and
`before:kit.install` / `before:kit.remove` hooks can refuse them.
