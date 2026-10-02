#!/usr/bin/env python3
"""Cal.com development worktrees for berth: setup, archive and reclaim.

berth runs these with every worktree's environment: BERTH_ROOT_PATH (the main
checkout), BERTH_WORKTREE_PATH/NAME/SLUG, BERTH_LOCATION, BERTH_PORT and
BERTH_PORT_1 (the worktree's own ports), and BERTH_KIT_DIR (this kit).

Each worktree gets its own Postgres database (cloned from a snapshot of the
main checkout's when their migrations match, migrated and seeded otherwise),
its own .env pointing at that database and at the worktree's URL, and its
dependencies installed from a cache shared with every other worktree.

Only databases this kit created can be dropped: their names start with
bcal_ and Postgres records which worktree each belongs to.
"""
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

DB_PREFIX = "bcal_"
MARKER = "berth cal-com kit: "
GRACE_DAYS = 7
MIN_FREE_GIB = 6

STATE = pathlib.Path(os.environ.get("BERTH_CAL_STATE") or pathlib.Path.home() / ".local/share/berth-cal-com")
KIT = pathlib.Path(os.environ.get("BERTH_KIT_DIR") or pathlib.Path(__file__).resolve().parent.parent)


class KitError(Exception):
    pass


# --- .env files ------------------------------------------------------------

_LINE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def parse_env(text):
    """The KEY=value pairs of a .env file, unquoted, as dotenv reads them."""
    out = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = _LINE.match(lines[i])
        i += 1
        if not m:
            continue
        key, raw = m.group(1), m.group(2)
        if raw[:1] in ('"', "'", "`"):
            q = raw[0]
            body = raw[1:]
            # A quoted value may run over several lines.
            while not _closes(body, q) and i < len(lines):
                body += "\n" + lines[i]
                i += 1
            end = _closing_index(body, q)
            value = body[:end] if end >= 0 else body
            if q == '"':
                value = value.replace("\\n", "\n").replace('\\"', '"')
        else:
            value = re.sub(r"\s+#.*$", "", raw).strip()
        out[key] = value
    return out


def _closing_index(body, q):
    for i, c in enumerate(body):
        if c == q and (i == 0 or body[i - 1] != "\\"):
            return i
    return -1


def _closes(body, q):
    return _closing_index(body, q) >= 0


def set_env(text, updates):
    """text with each KEY=… line replaced, or appended when missing. Values
    are written double-quoted, which dotenv and Next.js both read."""
    for key, value in updates.items():
        line = key + "=" + json.dumps(value)
        pattern = re.compile(r"^(?:export\s+)?" + re.escape(key) + r"\s*=.*$", re.M)
        if pattern.search(text):
            text = pattern.sub(lambda _: line, text, count=1)
        else:
            if text and not text.endswith("\n"):
                text += "\n"
            text += line + "\n"
    return text


# --- where we are ----------------------------------------------------------


def origin_of(url):
    u = urllib.parse.urlsplit(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        return None
    port = u.port or (443 if u.scheme == "https" else 80)
    return (u.scheme, u.hostname.lower(), port)


def worktree_origin(env):
    """The URL a browser on the laptop uses for this worktree, through
    berth's proxy: http://WORKTREE.LOCATION.BOX.localhost[:PORT]."""
    box = env.get("CAL_PUBLIC_BOX") or env.get("BERTH_BOX") or ""
    name, loc = env.get("BERTH_WORKTREE_NAME", ""), env.get("BERTH_LOCATION", "")
    for label in (name, loc, box):
        if not re.fullmatch(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?", label or ""):
            raise KitError(f"{label!r} cannot be part of a URL; set CAL_PUBLIC_BOX in the project's settings to the box's name on your laptop")
    port = (env.get("CAL_URL_PORT") or "1377").strip()
    suffix = "" if port == "80" else ":" + port
    return f"http://{name}.{loc}.{box}.localhost{suffix}"


def database_name(slug, path):
    """bcal_<slug>, kept under Postgres's 63-byte limit; a long slug is cut
    and made unique with a hash of the worktree's path."""
    base = re.sub(r"[^a-z0-9_]+", "_", (slug or "").lower()).strip("_") or "worktree"
    name = DB_PREFIX + base
    if len(name) > 63:
        name = DB_PREFIX + base[:48].rstrip("_") + "_" + hashlib.sha256(path.encode()).hexdigest()[:8]
    return name


def is_kit_database(name):
    return bool(re.fullmatch(DB_PREFIX + r"[a-z0-9_]{1,58}", name or ""))


def env_updates(main, current, env):
    """What a worktree's .env needs changed: its own database, and every URL
    that pointed at the main checkout's app pointing at the worktree."""
    origin = worktree_origin(env)
    port = env["BERTH_PORT"]
    db = database_name(env.get("BERTH_WORKTREE_SLUG", ""), env.get("BERTH_WORKTREE_PATH", ""))
    updates = {}

    app = origin_of(main.get("NEXT_PUBLIC_WEBAPP_URL", ""))
    for key, value in current.items():
        o = origin_of(value) if "://" in value else None
        if not o:
            continue
        # The main checkout's app, and Cal.com's default localhost:3000.
        if o == app or (o[1] in ("localhost", "127.0.0.1") and o[2] == 3000):
            u = urllib.parse.urlsplit(value)
            updates[key] = origin + u.path + ("?" + u.query if u.query else "") + ("#" + u.fragment if u.fragment else "")

    source = main.get("DATABASE_DIRECT_URL") or main.get("DATABASE_URL")
    if not source:
        raise KitError("the main checkout's .env has no DATABASE_URL")
    for key in ("DATABASE_URL", "DATABASE_DIRECT_URL"):
        u = urllib.parse.urlsplit(main.get(key) or source)
        if u.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise KitError(f"{key} in the main checkout points at {u.hostname}; this kit only makes databases on a local Postgres")
        query = urllib.parse.urlencode([(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True) if k != "schema"])
        updates[key] = urllib.parse.urlunsplit((u.scheme, u.netloc, "/" + db, query, ""))

    updates["NEXT_PUBLIC_WEBAPP_URL"] = origin
    updates["NEXTAUTH_URL"] = origin + "/api/auth"
    updates["NEXTAUTH_URL_INTERNAL"] = f"http://127.0.0.1:{port}/api/auth"
    updates["PORT"] = str(port)
    return db, updates


def context(env=None):
    """root and worktree, checked: a worktree of the root, never the root."""
    env = env if env is not None else os.environ
    root = env.get("BERTH_ROOT_PATH")
    work = env.get("BERTH_WORKTREE_PATH")
    if not root or not work:
        raise KitError("run this from berth: BERTH_ROOT_PATH and BERTH_WORKTREE_PATH are not set")
    root, work = pathlib.Path(root).resolve(), pathlib.Path(work).resolve()
    if root == work:
        raise KitError("this is the main checkout; the kit sets up worktrees, and leaves the main checkout as it is")
    return root, work


def same_repository(root, work):
    def common(p):
        return pathlib.Path(subprocess.check_output(["git", "-C", str(p), "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True).strip()).resolve()
    if common(work) != common(root):
        raise KitError(f"{work} is not a worktree of {root}")


# --- state on the box -------------------------------------------------------


def state_file(work):
    return STATE / "worktrees" / (hashlib.sha256(str(work).encode()).hexdigest()[:16] + ".json")


def load_state(work):
    try:
        return json.loads(state_file(work).read_text())
    except (OSError, ValueError):
        return {}


def save_state(work, value):
    p = state_file(work)
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n")
    tmp.replace(p)


class Lock:
    def __init__(self, work):
        STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = STATE / (hashlib.sha256(str(work).encode()).hexdigest()[:16] + ".lock")

    def __enter__(self):
        self.f = self.path.open("w")
        fcntl.flock(self.f, fcntl.LOCK_EX)
        return self

    def __exit__(self, *a):
        self.f.close()


def cancelled_marker(work):
    return STATE / (hashlib.sha256(str(work).encode()).hexdigest()[:16] + ".cancelled")


# --- running things ---------------------------------------------------------


def step(label, fn):
    started = time.monotonic()
    print(label + "…", flush=True)
    result = fn()
    print(f"{label}: {time.monotonic() - started:.1f}s", flush=True)
    return result


def yarn_env(root):
    """Installs share one download cache (the main checkout's) and hardlink
    node_modules from one store, so a new worktree costs little disk."""
    env = dict(os.environ)
    env.update(
        YARN_CACHE_FOLDER=str(root / ".yarn" / "cache"),
        YARN_NM_MODE="hardlinks-global",
        YARN_GLOBAL_FOLDER=str(STATE / "yarn-global"),
        YARN_ENABLE_GLOBAL_CACHE="false",
    )
    return env


def database(action, root, *args):
    env = dict(os.environ, BERTH_CAL_STATE=str(STATE))
    out = subprocess.run(["node", str(KIT / "scripts" / "database.cjs"), action, str(root), *args], env=env, capture_output=True, text=True)
    if out.returncode != 0:
        raise KitError(f"database {action}: {out.stderr.strip() or out.stdout.strip()}")
    return json.loads(out.stdout or "{}")


def seed_workspace(work):
    # Cal.com moved its Prisma package; older checkouts use @calcom/prisma.
    for rel in ("packages/infra/adapters/database", "packages/prisma"):
        pkg = work / rel / "package.json"
        if pkg.exists():
            data = json.loads(pkg.read_text())
            if "seed-basic" in data.get("scripts", {}):
                return data["name"]
    raise KitError("no workspace has a seed-basic script; seed the database by hand")


# --- commands ---------------------------------------------------------------


def setup():
    root, work = context()
    same_repository(root, work)
    marker = cancelled_marker(work)
    with Lock(work):
        marker.unlink(missing_ok=True)

        def check():
            if marker.exists():
                raise KitError("setup stopped: the worktree is being removed")

        # .env: the main checkout's, with this worktree's database and URL.
        envpath = work / ".env"
        if envpath.is_symlink():
            text = envpath.read_text()
            envpath.unlink()
            envpath.write_text(text)
        if not envpath.exists():
            if not (root / ".env").exists():
                raise KitError(f"{root}/.env is missing; set up the main checkout first")
            shutil.copy2(root / ".env", envpath)
        for extra in (".env.appStore",):
            if (root / extra).exists() and not (work / extra).exists():
                shutil.copy2(root / extra, work / extra)
        main = parse_env((root / ".env").read_text())
        db, updates = env_updates(main, parse_env(envpath.read_text()), os.environ)
        envpath.write_text(set_env(envpath.read_text(), updates))
        envpath.chmod(0o600)
        origin = updates["NEXT_PUBLIC_WEBAPP_URL"]
        print(f"Preparing {origin} (port {os.environ['BERTH_PORT']}, database {db})", flush=True)
        if not os.environ.get("CAL_PUBLIC_BOX"):
            print(f"Note: the URL uses this box's own name, {os.environ.get('BERTH_BOX')}. If your laptop calls it something else, set CAL_PUBLIC_BOX in the project's settings on this box and run setup again.", flush=True)

        if not (work / "node_modules").exists() and shutil.disk_usage(work).free < MIN_FREE_GIB * 1024**3:
            raise KitError(f"a fresh worktree needs at least {MIN_FREE_GIB} GiB free")

        state = load_state(work)
        state.update(path=str(work), database=db)
        made = step("Prepare database", lambda: database("create", root, db, str(work), MARKER + str(work)))
        if made.get("cloned"):
            state["seeded"] = True
            print("Database copied from the main checkout's; it already has development data.", flush=True)
        elif not made.get("existing"):
            state["seeded"] = False
            if made.get("reason"):
                print(made["reason"], flush=True)
        save_state(work, state)
        check()

        step("Install dependencies", lambda: subprocess.run(["yarn", "install", "--immutable"], cwd=work, env=yarn_env(root), check=True))
        check()
        step("Apply migrations", lambda: subprocess.run(["yarn", "prisma", "migrate", "deploy"], cwd=work, check=True))
        check()
        if not state.get("seeded"):
            ws = seed_workspace(work)
            step("Seed development data", lambda: subprocess.run(["yarn", "workspace", ws, "seed-basic"], cwd=work, check=True))
            state["seeded"] = True
            save_state(work, state)
        print(f"READY: {origin} once the web service starts", flush=True)


def archive():
    root, work = context()
    marker = cancelled_marker(work)
    marker.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    marker.touch()
    with Lock(work):
        db = load_state(work).get("database") or database_name(os.environ.get("BERTH_WORKTREE_SLUG", ""), str(work))
        try:
            gone = database("drop", root, db, MARKER + str(work))
            print(f"Dropped database {db}" if gone.get("dropped") else f"No database {db} to drop", flush=True)
        except KitError as e:
            # Keep removing: reclaim drops it later, once Postgres answers.
            print(f"Warning: {e}; the database stays until reclaim drops it", flush=True)
        state_file(work).unlink(missing_ok=True)
        marker.unlink(missing_ok=True)

    nxt = work / "apps" / "web" / ".next"
    if nxt.is_dir():
        shutil.rmtree(nxt, ignore_errors=True)
        print("Removed apps/web/.next", flush=True)
    # Turborepo's cache lives in the main checkout and nothing evicts it.
    turbo, cap = root / ".turbo", int(os.environ.get("CAL_TURBO_CAP_MB", "2048"))
    if turbo.is_dir():
        mb = int(subprocess.check_output(["du", "-sm", str(turbo)], text=True).split()[0])
        if mb > cap:
            shutil.rmtree(turbo, ignore_errors=True)
            print(f"Cleared the main checkout's .turbo ({mb} MB, over {cap} MB)", flush=True)
    try:
        database("prune-templates", root, "apply")
    except KitError as e:
        print(f"Warning: {e}", flush=True)


def reclaim(args):
    """Drop the databases of worktrees whose folder is gone. One removed
    through berth was dropped by archive already; one removed another way
    (another tool, rm -rf) is dropped after GRACE_DAYS, in case it comes
    back."""
    root = pathlib.Path(os.environ.get("BERTH_ROOT_PATH") or ".").resolve()
    dry = "--dry-run" in args
    days = float(os.environ.get("CAL_RECLAIM_DAYS", GRACE_DAYS))
    gone_file = STATE / "gone.json"
    try:
        gone = json.loads(gone_file.read_text())
    except (OSError, ValueError):
        gone = {}
    now, report = time.time(), {"dropped": [], "waiting": []}
    for row in database("list", root).get("databases", []):
        name, note = row["name"], row.get("note") or ""
        if not is_kit_database(name) or not note.startswith(MARKER):
            continue
        path = note[len(MARKER):]
        if pathlib.Path(path).exists():
            gone.pop(name, None)
            continue
        since = gone.setdefault(name, now)
        if now - since < days * 86400:
            report["waiting"].append({"name": name, "path": path, "after": since + days * 86400})
            continue
        if not dry:
            database("drop", root, name, note)
            gone.pop(name, None)
        report["dropped"].append({"name": name, "path": path})
    if not dry:
        STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
        gone_file.write_text(json.dumps(gone))
    print(json.dumps(report) if "--json" in args else
          f"{'Would drop' if dry else 'Dropped'} {len(report['dropped'])} database(s); {len(report['waiting'])} waiting out their {days:g}-day grace", flush=True)


def main(argv):
    try:
        action = argv[1] if len(argv) > 1 else ""
        if action == "setup":
            setup()
        elif action == "archive":
            archive()
        elif action == "reclaim":
            reclaim(argv[2:])
        else:
            raise KitError("usage: cal_kit.py setup|archive|reclaim [--dry-run] [--json]")
    except (KitError, subprocess.CalledProcessError) as e:
        print("cal-com kit: " + str(e), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
