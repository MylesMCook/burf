// Postgres work for the Cal.com kit, run with the repository's own `pg` and
// `dotenv` so the box needs no Postgres client libraries of its own.
//
//   database.cjs create ROOT NAME WORKTREE NOTE   a worktree's database
//   database.cjs drop ROOT NAME NOTE              drop one this kit made
//   database.cjs list ROOT                        this kit's databases
//   database.cjs prune-templates ROOT apply|dry-run
//
// ROOT is the main checkout, whose .env says where Postgres is. A new
// database is cloned from a snapshot template of the main checkout's database
// when its applied migrations match the worktree's; otherwise it starts empty
// and the kit migrates and seeds it. pg_dump and pg_restore run on the box,
// or inside the Postgres container when the box has no client tools.
//
// Safety: only names starting bcal_ (databases) and bcaltpl_ (templates)
// are ever created or dropped, and a database is dropped only when Postgres
// records the same NOTE the kit wrote when it made it.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawn, execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");

const DB = /^bcal_[a-z0-9_]{1,58}$/;
const TEMPLATE_PREFIX = "bcaltpl_";
const LOCK = 719245832; // pg_advisory_lock key, apart from calport's
const MARKER = "berth cal-com kit: ";
const state = process.env.BERTH_CAL_STATE || path.join(os.homedir(), ".local/share/berth-cal-com");

const isKitDatabase = (n) => DB.test(n || "");
const digest = (v) => crypto.createHash("sha256").update(v).digest("hex");

// templateName is deterministic in the source database and its migrations, so
// every worktree at the same migrations shares one snapshot.
function templateName(host, source, user, migrations, epoch) {
  return TEMPLATE_PREFIX + digest(JSON.stringify([host, source, user, migrations, epoch])).slice(0, 20);
}

// publishedPort finds the container that publishes a host port, from
// `docker ps --format '{{.Names}}\t{{.Ports}}'`, and the port inside it.
function publishedPort(psOutput, hostPort) {
  for (const line of psOutput.split("\n")) {
    const [name, ports = ""] = line.split("\t");
    for (const m of ports.matchAll(/:(\d+)->(\d+)\/tcp/g)) {
      if (m[1] === String(hostPort)) return { name, port: m[2] };
    }
  }
  return null;
}

const quoteIdent = (n) => '"' + n.replace(/"/g, '""') + '"';
const quoteLiteral = (s) => "'" + s.replace(/'/g, "''") + "'";

module.exports = { isKitDatabase, templateName, publishedPort, quoteLiteral, MARKER };
if (require.main !== module) return;

const [action, root, ...args] = process.argv.slice(2);
if (!["create", "drop", "list", "prune-templates"].includes(action) || !root) {
  console.error("usage: database.cjs create|drop|list|prune-templates ROOT …");
  process.exit(2);
}
const req = createRequire(path.join(root, "package.json"));
const env = req("dotenv").parse(fs.readFileSync(path.join(root, ".env")));
const url = new URL(env.DATABASE_DIRECT_URL || env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  console.error("expected a local development Postgres, not " + url.hostname);
  process.exit(1);
}
url.search = "";
const sourceName = decodeURIComponent(url.pathname.slice(1));
const { Client } = req("pg");
function client(database) {
  const u = new URL(url);
  u.pathname = "/" + database;
  return new Client({ connectionString: u.toString() });
}

function onPath(tool) {
  return (process.env.PATH || "").split(":").some((d) => d && fs.existsSync(path.join(d, tool)));
}
let container;
function postgresContainer() {
  if (container !== undefined) return container;
  container = null;
  try {
    const ps = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    container = publishedPort(ps, url.port || "5432");
  } catch {}
  return container;
}
const canSnapshot = () => onPath("pg_dump") || Boolean(postgresContainer());

function pgTool(tool, database, toolArgs, file, output) {
  const c = onPath(tool) ? null : postgresContainer();
  const penv = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  const conn = ["--host", c ? "127.0.0.1" : url.hostname, "--port", c ? c.port : url.port || "5432", "--username", decodeURIComponent(url.username), "--dbname", database];
  const command = c ? "docker" : tool;
  const argv = c ? ["exec", "-i", "-e", "PGPASSWORD", c.name, tool, ...conn, ...toolArgs] : [...conn, ...toolArgs];
  const fd = fs.openSync(file, output ? "w" : "r", 0o600);
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { env: penv, stdio: [output ? "ignore" : fd, output ? fd : "ignore", "pipe"] });
    fs.closeSync(fd);
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(tool + " failed: " + err.trim()))));
  });
}

async function dropDatabase(c, name) {
  try {
    await c.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
  } catch {
    await c.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`); // Postgres before 13
  }
}

const noteOf = async (c, name) => (await c.query("SELECT shobj_description(oid, 'pg_database') AS note FROM pg_database WHERE datname = $1", [name])).rows[0];

async function create(c, name, work, note) {
  if (!isKitDatabase(name)) throw new Error("refusing database name " + name);
  if (!note || !note.startsWith(MARKER)) throw new Error("a database needs the kit's note");
  const existing = await noteOf(c, name);
  if (existing) {
    if (existing.note !== note) throw new Error(`${name} exists but was not made for this worktree; leaving it alone`);
    return { existing: true };
  }
  const migrationsDir = ["packages/infra/adapters/database/prisma/migrations", "packages/prisma/migrations"].map((d) => path.join(work, d)).find((d) => fs.existsSync(d));
  const source = client(sourceName);
  await source.connect();
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const history = (await source.query("SELECT to_regclass('public._prisma_migrations') AS t")).rows[0].t;
    const rows = history ? (await source.query("SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name")).rows : [];
    const applied = rows.filter((r) => !r.rolled_back_at);
    const compatible =
      migrationsDir &&
      applied.length > 0 &&
      applied.every((r) => {
        const f = path.join(migrationsDir, r.migration_name, "migration.sql");
        return r.finished_at && fs.existsSync(f) && digest(fs.readFileSync(f)) === r.checksum;
      });
    if (!compatible || !canSnapshot()) {
      await c.query(`CREATE DATABASE ${quoteIdent(name)}`);
      await c.query(`COMMENT ON DATABASE ${quoteIdent(name)} IS ${quoteLiteral(note)}`);
      const reason = !canSnapshot() ? "No pg_dump here or in a Postgres container" : "The main database's migrations differ from this worktree's";
      return { cloned: false, reason: reason + "; migrating and seeding a fresh database" };
    }
    const epochFile = path.join(state, "snapshot-generation");
    const epoch = fs.existsSync(epochFile) ? fs.readFileSync(epochFile, "utf8") : "";
    const template = templateName(url.host, sourceName, url.username, applied.map((r) => [r.migration_name, r.checksum]), epoch);
    const t = (await c.query("SELECT datallowconn FROM pg_database WHERE datname = $1", [template])).rows[0];
    // A template that still allows connections was never finished.
    if (t && t.datallowconn) await dropDatabase(c, template);
    if (!t || t.datallowconn) {
      console.error("Building a snapshot of the main database to copy from");
      const snapshot = (await source.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
      fs.mkdirSync(state, { recursive: true, mode: 0o700 });
      const dump = path.join(state, template + ".dump");
      try {
        await pgTool("pg_dump", sourceName, ["--format=custom", "--no-owner", "--no-acl", "--snapshot", snapshot], dump, true);
        await c.query(`CREATE DATABASE ${quoteIdent(template)}`);
        await pgTool("pg_restore", template, ["--no-owner", "--no-acl", "--exit-on-error"], dump, false);
        await c.query(`ALTER DATABASE ${quoteIdent(template)} ALLOW_CONNECTIONS false`);
      } catch (e) {
        await dropDatabase(c, template);
        throw e;
      } finally {
        fs.rmSync(dump, { force: true });
      }
    }
    await source.query("COMMIT");
    await c.query(`CREATE DATABASE ${quoteIdent(name)} TEMPLATE ${quoteIdent(template)}`);
    await c.query(`COMMENT ON DATABASE ${quoteIdent(name)} IS ${quoteLiteral(note)}`);
    fs.mkdirSync(state, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(state, "current-template"), template);
    return { cloned: true, template };
  } finally {
    await source.end();
  }
}

(async () => {
  const c = client("postgres");
  await c.connect();
  try {
    await c.query("SELECT pg_advisory_lock($1)", [LOCK]);
    let out;
    if (action === "create") {
      out = await create(c, args[0], args[1], args[2]);
    } else if (action === "drop") {
      const [name, note] = args;
      if (!isKitDatabase(name)) throw new Error("refusing to drop " + name + ": not a kit database");
      const row = await noteOf(c, name);
      if (!row) out = { dropped: false };
      else if (row.note !== note) throw new Error(`refusing to drop ${name}: it was not made for ${note.slice(MARKER.length) || "this worktree"}`);
      else {
        await dropDatabase(c, name);
        out = { dropped: true };
      }
    } else if (action === "list") {
      const rows = (await c.query("SELECT datname AS name, shobj_description(oid, 'pg_database') AS note FROM pg_database WHERE datname LIKE 'bcal\\_%'")).rows;
      out = { databases: rows.filter((r) => isKitDatabase(r.name)) };
    } else {
      // Keep the template the last clone used (or the newest); drop the rest.
      const rows = (await c.query("SELECT datname, pg_database_size(datname)::bigint AS bytes FROM pg_database WHERE datname LIKE 'bcaltpl\\_%' ORDER BY oid::bigint")).rows;
      const file = path.join(state, "current-template");
      const recorded = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
      const keep = rows.some((r) => r.datname === recorded) ? recorded : rows.length ? rows[rows.length - 1].datname : "";
      const stale = rows.filter((r) => r.datname !== keep && r.datname.startsWith(TEMPLATE_PREFIX));
      if (args[0] === "apply") {
        for (const r of stale) {
          await c.query(`ALTER DATABASE ${quoteIdent(r.datname)} IS_TEMPLATE false`).catch(() => {});
          await dropDatabase(c, r.datname);
        }
      }
      out = { templates: stale.map((r) => ({ name: r.datname, bytes: Number(r.bytes) })) };
    }
    console.log(JSON.stringify(out));
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
