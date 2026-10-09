import assert from "node:assert/strict";
import test from "node:test";
import { patchInstaller } from "./windows-installer-template.mjs";

test("a higher-version NSIS install enters overinstall before maintenance can uninstall", () => {
  const marker = '  nsis_tauri_utils::SemverCompare "${VERSION}" $R0\n  Pop $R0\n';
  const fixture = "Function PageReinstall\n" + marker + "  ; Reinstalling the same version\nFunctionEnd\n";
  const patched = patchInstaller(fixture);
  assert.ok(patched.indexOf("StrCpy $UpdateMode 1") < patched.indexOf("; Reinstalling the same version"));
  assert.match(patched, /\$WixMode <> 1\n  \$\{AndIf\} \$R0 = 1\n    StrCpy \$UpdateMode 1\n    Abort/);
  assert.throws(() => patchInstaller("upstream changed"));
  assert.throws(() => patchInstaller(fixture + marker));
});
