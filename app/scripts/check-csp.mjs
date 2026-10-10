// Exercise the policy actually applied to Wails' final, injected HTML.
// The Go checks preserve plugin/worker/WASM sources and reject unrestricted
// privileged script or connection origins. ATS remains limited to localhost.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const required = new Set(["TestSnapshotHTMLHashesFinalScriptsAndImportMaps", "TestDesktopCSPAllowsPluginsImagesWorkersAndTerminalWasm"]);
const output = execFileSync("go", ["test", "-json", "./internal/uibundle", "-run", `^(${[...required].join("|")})$`], {
  cwd: fileURLToPath(new URL("../../", import.meta.url)),
  stdio: ["ignore", "pipe", "inherit"],
  encoding: "utf8",
});
for (const line of output.trim().split("\n")) {
  const event = JSON.parse(line);
  if (event.Action === "pass") required.delete(event.Test);
}
assert.equal(required.size, 0, `CSP checks did not execute: ${[...required].join(", ")}`);
const plist = await readFile(new URL("../../scripts/macos/Info.plist", import.meta.url), "utf8");
const localhost = /<key>NSExceptionDomains<\/key>\s*<dict>\s*<key>localhost<\/key>\s*<dict>([\s\S]*?)<\/dict>/.exec(plist)?.[1] ?? "";
for (const key of ["NSIncludesSubdomains", "NSExceptionAllowsInsecureHTTPLoads"]) {
  assert.match(localhost, new RegExp(`<key>${key}</key>\\s*<true/>`), `Info.plist: ATS needs ${key} for localhost previews`);
}
assert.doesNotMatch(plist, /<key>NSAllowsArbitraryLoads(?:InWebContent)?<\/key>\s*<true\/>/, "ATS must remain limited to localhost");
console.log("check-csp: ok");
