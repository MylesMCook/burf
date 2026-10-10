import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

const source = await readFile(new URL("./windows/cli-path.ps1", import.meta.url), "utf8");
const hooks = await readFile(new URL("./windows/hooks.nsh", import.meta.url), "utf8");
const acceptance = await readFile(new URL("./test-windows-install.ps1", import.meta.url), "utf8");
const installer = await readFile(new URL("./windows/installer.nsi", import.meta.url), "utf8");
const psQuote = (s) => "'" + s.replaceAll("'", "''") + "'";
function powershell(command) {
  const executable = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync(executable, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout.trim();
}

test("uninstall and installer recovery use only inspected bundled candidates", () => {
  assert.match(hooks, /BerthInspect "\$INSTDIR\\burf-cli\.exe"/);
  assert.match(hooks, /BerthInspect "\$INSTDIR\\cli\\burf\.exe"/);
  assert.match(hooks, /BerthFlag "owned_running"/);
  assert.match(hooks, /"\$BerthLoginProgram" agent uninstall/);
  assert.match(hooks, /BerthInspect "\$INSTDIR\\berth-cli\.exe"/);
  assert.match(hooks, /BerthBackup "Berth\.exe"/);
  assert.match(hooks, /"\$BerthLoginProgram" agent install/);
  assert.match(installer, /InstallFile "berth-cli\.exe"/);
  assert.match(installer, /InstallFile "cli\\berth\.exe"/);
  assert.match(hooks, /Function \.onInstFailed\n  Call BerthRecover/);
  assert.match(hooks, /!define MUI_CUSTOMFUNCTION_ABORT BerthRecover/);
  assert.ok(!hooks.includes("Function .onUserAbort"));
  assert.match(hooks, /\$\{UnStrLoc\}\n/);
  assert.match(hooks, /NSIS_HOOK_PREINSTALL\n  !insertmacro BerthInspectInstallation "install"/);
  assert.match(hooks, /NSIS_HOOK_PREUNINSTALL\n  !insertmacro BerthInspectInstallation "uninstall"/);
  assert.match(hooks, /!if "\$\{CONTEXT\}" == "uninstall"\n  \$\{UnStrLoc\}/);
  assert.match(hooks, /BerthRestore "cli\\burf\.exe"/);
  assert.match(hooks, /"\$INSTDIR\\Burf\.exe" --remove-cli-path/);
  assert.ok(!hooks.includes("-File"));
  assert.ok(!source.includes("ExecutionPolicy"));
});

test("the Go shell embeds the generated reviewed PATH command", async () => {
  const native = await readFile(new URL("../app/native/desktop/cli_link_windows.go", import.meta.url), "utf8");
  assert.match(native, /\/\/go:embed cli-path\.ps1/);
});

test("installer retains normal-user consent and the exact legacy identities", () => {
  assert.match(installer, /RequestExecutionLevel user/);
  assert.match(installer, /shell32::IsUserAnAdmin/);
  assert.match(installer, /InstallDirRegKey HKCU "Software\\berth\\Burf"/);
  assert.match(installer, /WriteRegStr HKCU "Software\\Classes\\berth\\shell\\open\\command"/);
  assert.ok(!installer.includes("WriteRegStr HKLM"));
  assert.ok(!installer.includes("RMDir /r"));
  assert.ok(!installer.includes("ExecShell"));
  assert.ok(!installer.includes("bootstrapper"));
  for (const name of ["WebView2Loader.dll", "berthd-linux-amd64", "berthd-linux-arm64", "uninstall.exe"]) {
    assert.ok(hooks.includes(`BerthBackup "${name}"`), name);
    assert.ok(hooks.includes(`BerthRestore "${name}"`), name);
  }
});

test("native embedded Status works without loading an unsigned script file", { skip: process.platform !== "win32" }, () => {
  const directory = "C:\\Burf's & $Literal; Tools\\cli";
  const command = `& {\n${source}\n} -Action 'Status' -CliDirectory ${psQuote(directory)}`;
  assert.equal(powershell(command), "missing");
});

test("manual acceptance keeps protected actions behind installer preflight", () => {
  assert.match(acceptance, /Run as the ordinary login user, without elevation/);
  assert.match(acceptance, /Pre-existing Burf registration would be replaced/);
  assert.match(acceptance, /Fresh installation registered a task/);
  assert.match(acceptance, /Cleanup did not restore the exact user PATH/);
  assert.match(acceptance, /client\/boxes\.json/);
  assert.match(acceptance, /Uninstall-TestCopy/);
  assert.ok(!acceptance.includes("ExecutionPolicy"));
  assert.ok(!acceptance.includes("DeleteTask("));
  assert.ok(!acceptance.includes("Stop-Process"));
});

test("manual acceptance runner parses without executing host actions", { skip: process.platform !== "win32" }, () => {
  const command = `$tokens=$null; $errors=$null
$null=[Management.Automation.Language.Parser]::ParseInput(${psQuote(acceptance)}, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
[Console]::Out.Write('valid')`;
  assert.equal(powershell(command), "valid");
});

test("manual acceptance final error names the failed step", { skip: process.platform !== "win32" }, () => {
  const command = `$ErrorActionPreference='Stop'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput(${psQuote(acceptance)}, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
$statement=$ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.IfStatementAst] -and $_.Clauses[0].Item1.Extent.Text -eq '$failure' } | Select-Object -Last 1
if (!$statement) { throw 'Final failure check was not found.' }
$failure='The synthetic client command failed: agent install.'
$evidence='C:\\synthetic evidence'
$caught=$null
try { Invoke-Expression $statement.Extent.Text } catch { $caught=$_.Exception.Message }
if (!$caught -or !$caught.Contains($failure) -or !$caught.Contains($evidence)) { throw 'Final error discarded the failed step or evidence path.' }
[Console]::Out.Write('retained')`;
  assert.equal(powershell(command), "retained");
});

test("manual acceptance captures all native stderr before rejecting a failed CLI", { skip: process.platform !== "win32" }, () => {
  const command = `$ErrorActionPreference='Stop'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput(${psQuote(acceptance)}, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw $errors[0] }
$function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-Burf'}, $true)
Invoke-Expression $function.Extent.Text
$evidence=Join-Path $env:TEMP ('berth-stderr-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $evidence | Out-Null
try {
  $child=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $caught=$false
  try { Invoke-Burf $child @('-NoProfile','-NonInteractive','-Command', "[Console]::Error.WriteLine('berth: task error: #< CLIXML'); [Console]::Error.WriteLine('SCHEDULER DETAIL 0x80070005'); exit 17") | Out-Null }
  catch { $caught=$true }
  if (!$caught) { throw 'The failed CLI was accepted.' }
  if ($ErrorActionPreference -ne 'Stop') { throw 'The caller error policy changed.' }
  $diagnostic=Get-Content -Raw -LiteralPath (Join-Path $evidence 'cli-failure.log')
  if (!$diagnostic.Contains('#< CLIXML') -or !$diagnostic.Contains('SCHEDULER DETAIL 0x80070005')) { throw ('Native stderr was truncated: ' + $diagnostic) }
  [Console]::Out.Write('captured')
} finally { Remove-Item -LiteralPath $evidence -Recurse -Force }`;
  assert.equal(powershell(command), "captured");
});

test("native PATH edits preserve unrelated entries and literal directory names", { skip: process.platform !== "win32" }, () => {
  const directory = "C:\\Burf's & $Literal; Tools\\cli";
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
