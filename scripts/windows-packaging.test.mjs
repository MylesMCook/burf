import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

const source = await readFile(new URL("../app/src-tauri/windows/cli-path.ps1", import.meta.url), "utf8");
const hooks = await readFile(new URL("../app/src-tauri/windows/hooks.nsh", import.meta.url), "utf8");
const psQuote = (s) => "'" + s.replaceAll("'", "''") + "'";
function powershell(command) {
  const executable = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync(executable, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout.trim();
}

test("uninstall and installer recovery use only inspected bundled candidates", () => {
  assert.match(hooks, /BerthInspect "\$INSTDIR\\berth-cli\.exe"/);
  assert.match(hooks, /BerthInspect "\$INSTDIR\\cli\\berth\.exe"/);
  assert.match(hooks, /BerthFlag "owned_running"/);
  assert.match(hooks, /"\$BerthLoginProgram" agent uninstall/);
  assert.match(hooks, /Function \.onInstFailed\n  Call BerthRecover/);
  assert.match(hooks, /BerthRestore "cli\\berth\.exe"/);
  assert.match(hooks, /"\$INSTDIR\\Berth\.exe" --remove-cli-path/);
  assert.ok(!hooks.includes("-File"));
  assert.ok(!source.includes("ExecutionPolicy"));
});

test("native embedded Status works without loading an unsigned script file", { skip: process.platform !== "win32" }, () => {
  const directory = "C:\\Berth's & $Literal; Tools\\cli";
  const command = `& {\n${source}\n} -Action 'Status' -CliDirectory ${psQuote(directory)}`;
  assert.equal(powershell(command), "missing");
});

test("native PATH edits preserve unrelated entries and literal directory names", { skip: process.platform !== "win32" }, () => {
  const directory = "C:\\Berth's & $Literal; Tools\\cli";
  // Parse and load only the pure functions, without executing registry code.
  const command = `$ErrorActionPreference='Stop'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput(${psQuote(source)}, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
$functions=$ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]}, $true)
foreach ($function in $functions) { Invoke-Expression $function.Extent.Text }
$directory=${psQuote(directory)}
$original='C:\\One;;C:\\Two;'
@{
  add=(Add-BerthPathValue $original $directory)
  remove=(Remove-BerthPathValue ($original + ';' + $directory) $directory)
  existing=(Add-BerthPathValue ('C:\\One;' + $directory) $directory)
} | ConvertTo-Json -Compress`;
  // A semicolon separates Windows PATH entries, so it cannot be represented
  // as one directory. The literal quoting test above still covers shell safety.
  const safeDirectory = directory.replace("; Tools", " Tools");
  const safeCommand = command.replaceAll(psQuote(directory), psQuote(safeDirectory));
  const result = JSON.parse(powershell(safeCommand));
  assert.equal(result.add, `C:\\One;;C:\\Two;;${safeDirectory}`);
  assert.equal(result.remove, "C:\\One;;C:\\Two;");
  assert.equal(result.existing, `C:\\One;${safeDirectory}`);
});
