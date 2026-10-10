import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderInstaller } from "./windows-installer-template.mjs";

const template = await readFile(new URL("./windows/installer.nsi", import.meta.url), "utf8");
const options = { stage: "C:\\Burf's & $Literal Tools\\stage", output: "C:\\out\\setup.exe", version: "1.2.3", architecture: "amd64", icon: "C:\\icon.ico", hooks: "C:\\hooks.nsh" };

test("compression is selected before includes can write installer data", () => {
  const rendered = renderInstaller(template, options);
  assert.match(rendered, /^Unicode true\r?\nSetCompressor \/SOLID lzma\r?\n/);
});

test("an upgrade replaces files without invoking the previous uninstaller", () => {
  const rendered = renderInstaller(template, options);
  assert.ok(rendered.indexOf("!insertmacro NSIS_HOOK_PREINSTALL") < rendered.indexOf('!insertmacro InstallFile "Burf.exe"'));
  assert.ok(rendered.indexOf("!insertmacro NSIS_HOOK_POSTINSTALL") < rendered.indexOf('"DisplayVersion" "${VERSION}"'));
  assert.ok(!rendered.includes("PageReinstall"));
  assert.ok(!rendered.includes("ExecWait"));
  assert.ok(!/@[A-Z]+@/.test(rendered));
});

test("installer paths are literals and incomplete templates or invalid versions fail", () => {
  assert.ok(renderInstaller(template, options).includes("C:\\Burf's & $$Literal Tools\\stage"));
  assert.ok(renderInstaller(template, { ...options, stage: 'C:\\quote"' }).includes('C:\\quote$\\"'));
  assert.throws(() => renderInstaller("upstream changed", options));
  assert.throws(() => renderInstaller(template, { ...options, version: "1.2.3\n!system bad" }));
  assert.throws(() => renderInstaller(template, { ...options, stage: "C:\\bad\n!system bad" }));
  assert.throws(() => renderInstaller(template, { ...options, architecture: "x86" }));
});
