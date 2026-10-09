import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "tidy.sh");

// A scratch repository with its own origin, and stand-ins for gh and burf so
// the run touches no network and no installed interface.
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "burf-tidy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  for (const name of ["gh", "burf"]) {
    writeFileSync(join(bin, name), "#!/bin/sh\nexit 1\n");
    chmodSync(join(bin, name), 0o755);
  }
  const env = {
    ...process.env, PATH: `${bin}:${process.env.PATH}`, BURF_CLONES: join(dir, "none"),
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
  };
  const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(dir, "origin.git")]);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  mkdirSync(join(repo, "scripts"));
  copyFileSync(script, join(repo, "scripts/tidy.sh"));
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  git("remote", "add", "origin", join(dir, "origin.git"));
  git("push", "-q", "-u", "origin", "main");
  return { dir, repo, env, git };
}

test("a removal git refuses is listed as skipped and the rest still happens", (t) => {
  const { dir, repo, env, git } = scratch(t);
  // In main, in a locked worktree: neither the worktree nor its branch can go.
  git("worktree", "add", "-q", "-b", "locked", join(dir, "wt-locked"));
  git("worktree", "lock", join(dir, "wt-locked"));
  // In main, held by a worktree with uncommitted work: the worktree is left
  // alone, so the branch cannot be deleted.
  git("worktree", "add", "-q", "-b", "held", join(dir, "wt-held"));
  writeFileSync(join(dir, "wt-held", "note.txt"), "not committed");
  // In main and free, here and on origin: both go.
  git("branch", "done-here");
  git("push", "-q", "origin", "main:refs/heads/done-there");
  // Not in main: stays.
  git("branch", "unmerged");
  git("switch", "-q", "unmerged");
  writeFileSync(join(repo, "more.txt"), "more");
  git("add", "-A");
  git("commit", "-q", "-m", "more");
  git("switch", "-q", "main");

  const run = spawnSync("sh", [join(repo, "scripts/tidy.sh")], { cwd: repo, env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const branches = git("branch", "--format=%(refname:short)").split("\n");
  assert.deepEqual(branches.sort(), ["held", "locked", "main", "unmerged"]);
  assert.equal(git("ls-remote", "--heads", "origin", "done-there"), "");
  assert.match(git("worktree", "list"), /wt-locked/);
  assert.match(git("worktree", "list"), /wt-held/);

  const skipped = out.slice(out.indexOf("== skipped"));
  assert.match(skipped, /worktree remove .*wt-locked .*lock/);
  assert.match(skipped, /branch -q -D locked/);
  assert.match(skipped, /branch -q -D held/);
  // The report after the removals was still written.
  assert.match(out, /== branches not in main\nunmerged \(1 ahead/);
  assert.match(out, /== interface on this computer\nnone installed/);
});

test("--dry-run changes nothing", (t) => {
  const { repo, env, git } = scratch(t);
  git("branch", "done-here");
  const run = spawnSync("sh", [join(repo, "scripts/tidy.sh"), "--dry-run"], { cwd: repo, env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /would: git branch -q -D done-here/);
  assert.match(git("branch", "--format=%(refname:short)"), /done-here/);
});
