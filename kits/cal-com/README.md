# Cal.com development kit

Every worktree of Cal.com gets its own working copy of the app: its own
Postgres database, `.env`, ports, URL and dev server, so several branches and
agents can run Cal.com side by side on one box without sharing state.

```sh
berth kit add ~/personal/berth/kits/cal-com     # or a link to wherever this folder is pushed
berth kit apply cal-com devl/cal                # any number of BOX/PROJECT
```

Then make worktrees as usual (the app's New worktree, or
`berth worktree new devl/cal/fix-billing`). Setup runs in the background;
the Run menu starts and stops the dev server.

## What a worktree gets

| | |
| --- | --- |
| Database | `bcal_<location>_<worktree>` on the same Postgres as the main checkout. When the main database's applied Prisma migrations match the worktree's, it is a copy of a snapshot of the main database, data included; otherwise a fresh database, migrated and seeded with `seed-basic`. |
| `.env` | The main checkout's, with `DATABASE_URL`/`DATABASE_DIRECT_URL` pointing at the worktree's database, and every URL that pointed at the main checkout's app (and Cal.com's default `localhost:3000`) pointing at the worktree. Also `NEXTAUTH_URL`, `NEXTAUTH_URL_INTERNAL` and `PORT`. Other URLs (video, OAuth redirect lists) are left alone. |
| Ports | Two: the app on `$BERTH_PORT`, Prisma Studio on `$BERTH_PORT_1`. |
| URL | `http://<worktree>.<location>.<box>.localhost:1377`, through berth's proxy. |
| Dependencies | `yarn install --immutable` with the main checkout's download cache, and node_modules hardlinked from one shared store, so a new worktree costs little disk. |
| Services | `web` (the dev server, starts when setup finishes) and `studio` (Prisma Studio, start it from the Run menu). |

Removing the worktree through berth stops its services, drops its database,
deletes its `apps/web/.next`, caps the main checkout's `.turbo` at 2 GB
(`CAL_TURBO_CAP_MB`), and drops stale snapshot templates. A worktree removed
some other way (another tool, `rm -rf`) has its database dropped 7 days
later (`CAL_RECLAIM_DAYS`), in case it comes back.

## Per box

berth names a box by its hostname on the box (`devbox`), while your laptop
may call it something else (`devl`). The worktree URL has to use your
laptop's name. Set it once per box: in the app, open the project's
Project settings → Environment and set `CAL_PUBLIC_BOX` to the box's name
on your laptop (`devl`). The box's own settings override the kit's, and
survive kit updates. Setup prints a note when it is not set.

`CAL_URL_PORT` is `1377`, berth's proxy port. Set it to `80` if you give
berth port 80 (`berth setup port80`).

Postgres can run in Docker. Without `pg_dump` on the box, the kit runs
`pg_dump`/`pg_restore` inside the container that publishes the database's
port, as on devl (`database-postgres-1` on 5450).

## Safety

- It only ever creates and drops databases named `bcal_…` and snapshot
  templates named `bcaltpl_…`, which no other tool uses (calport's were
  `calwt_`/`caltpl_`, so the two kits can share a Postgres).
- When it creates a database it records the worktree's path on it in
  Postgres. It drops a database only when that record matches, so it never
  drops another worktree's, another tool's, or the main database.
- It refuses to set up the main checkout, a folder of another repository, or
  a non-local Postgres.
- Setup takes a lock per worktree, and removal stops a setup still running
  between steps.

## How it differs from calport's kit

calport's kit was a Go installer plus a router, a lifecycle reconciler and
systemd units of its own. In berth those are things berth already does, so
the kit is only what is specific to Cal.com:

| calport | berth kit |
| --- | --- |
| Its own port range (3100–4100) and route records | berth's per-worktree ports (`$BERTH_PORT`) |
| `NAME-abc123.HOST.cal.localhost` through a router on the box | berth's worktree URLs through its proxy |
| A systemd unit per worktree, readiness polling | The `web` service, a berth managed unit, with logs in the Run menu |
| `/__worktree/logs` and `/__worktree/studio` pages | Service logs in the app; `studio` as a service |
| Orca/Superset/Herdr hook wiring and an Orca reconciler | berth runs setup and teardown itself |
| Archive kept the database for reopening | Removing the worktree drops it (reclaim waits 7 days for worktrees removed outside berth) |
| `calwt_<hash>` databases | `bcal_<location>_<worktree>`, readable in `psql` |

Kept from calport, unchanged in behaviour: the snapshot templates with the
migration check, the shared yarn cache, the `.env` rewriting, the seed
workspace detection (`packages/infra/adapters/database` or the older
`packages/prisma`), the dev command (`yarn dev --env-mode=loose -- --port …
--hostname 127.0.0.1`, 4 GB heap) and the disk check (6 GB free for a fresh
worktree).

## Files

- `kit.json`: the kit.
- `scripts/cal_kit.py`: setup, archive and reclaim (Python standard library only).
- `scripts/database.cjs`: Postgres work, with the repository's own `pg` and `dotenv`.
- `scripts/setup.sh`, `archive.sh`, `dev.sh`, `studio.sh`: what berth runs.
- `tests/`: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests`
  and `node --test tests/database.test.cjs`.
