import assert from "node:assert/strict";
import test from "node:test";

import type { CliLink } from "./cli-link.ts";
import { cliLinkDecided, shouldLinkCli } from "./cli-link-rule.ts";

const cli = (over: Partial<CliLink>): CliLink => ({ link: "C:\\Burf\\cli", bundled: "C:\\Burf\\cli\\burf.exe", blocked: null, state: "missing", target: null, ...over });

test("a new install puts its command on the PATH once", () => {
  assert.equal(shouldLinkCli(cli({}), false), true);
  assert.equal(cliLinkDecided(cli({})), true);
  // Removed in Settings afterwards: it stays removed.
  assert.equal(shouldLinkCli(cli({}), true), false);
});

test("it never takes the place of a burf that is already there", () => {
  for (const state of ["linked", "symlink", "file"] as const) {
    assert.equal(shouldLinkCli(cli({ state }), false), false, state);
    assert.equal(cliLinkDecided(cli({ state })), true, state);
  }
});

test("a copy that cannot be linked waits for its turn", () => {
  const ownState = cli({ blocked: "This copy of Burf keeps its state in a folder of its own (BERTH_HOME)." });
  assert.equal(shouldLinkCli(ownState, false), false);
  // Not decided: once it runs on the standard folder, it links.
  assert.equal(cliLinkDecided(ownState), false);
});

test("a development build or a browser has no command to link", () => {
  assert.equal(shouldLinkCli(null, false), false);
  assert.equal(cliLinkDecided(null), false);
  assert.equal(shouldLinkCli(cli({ bundled: null }), false), false);
  assert.equal(cliLinkDecided(cli({ bundled: null })), false);
});
