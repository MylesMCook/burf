// Checks the app's plugin consent rules against the agent's: the hash the
// app computes over a plugin's files must be the one internal/hooks computes
// (TestPluginHashMatchesTheApp pins the same vector), and a plugin from
// ~/.berth/plugins may load only with the user's permission for exactly
// those bytes.
//
//   node scripts/check-plugin-consent.mjs
import assert from "node:assert/strict";

import { cleanPath, hashPluginFiles, mainOf, mayLoad } from "../src/plugins/consent-core.ts";

const enc = new TextEncoder();
const manifest = enc.encode(`{"id":"évil","main":"dist/index.js"}`);
const main = enc.encode("export default () => {}\n");
const hash = await hashPluginFiles(manifest, main);
assert.equal(hash, "sha256:3e0cdbeb35f4f5a762f6c81c61162292d8498c56bf874bc3df21eaea4b2bac41");

assert.equal(cleanPath("./dist/../dist/index.js"), "dist/index.js");
assert.equal(cleanPath("../../etc/passwd"), "etc/passwd");
assert.equal(mainOf(manifest), "dist/index.js");
assert.equal(mainOf(enc.encode("{}")), "");

// The audit's sample plugin (design/security-audit/poc/app/evil-plugin): an
// agent lists it with no permission, so it never loads.
const evil = { id: "evil-demo", name: "Harmless theme pack", version: "0.0.1", main: "dist/index.js" };
assert.equal(mayLoad(evil, hash), false);
assert.equal(mayLoad({ ...evil, enabled: true }, hash), false, "enabled without a hash");
assert.equal(mayLoad({ ...evil, enabled: true, allowed: "sha256:other" }, hash), false, "allowed different code");
assert.equal(mayLoad({ ...evil, enabled: false, allowed: hash }, hash), false, "turned off");
assert.equal(mayLoad({ ...evil, enabled: true, allowed: hash }, hash), true);
assert.equal(mayLoad({ ...evil, builtin: true }, hash), true, "built-ins ship with the app");
console.log("check-plugin-consent: ok");
