import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const CLI_VERSION = "2.12.1";
const TEMPLATE_SHA256 = "dabed59013b1d78b879a1a85bc7f2eed2993b33a9a90cdabe5946de3d3950597";
const SOURCE = `https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v${CLI_VERSION}/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi`;
const MARKER = '  nsis_tauri_utils::SemverCompare "${VERSION}" $R0\n  Pop $R0\n';
const OVERINSTALL = `  ; Berth upgrades preserve the installed task, PATH consent and rollback files.
  ; Skip the maintenance page so its uninstall-before-install choice cannot run.
  \${If} $WixMode <> 1
  \${AndIf} $R0 = 1
    StrCpy $UpdateMode 1
    Abort
  \${EndIf}
`;

export function patchInstaller(source) {
  if (source.split(MARKER).length !== 2) throw new Error("The locked NSIS template's version comparison changed.");
  return source.replace(MARKER, MARKER + OVERINSTALL);
}

export async function prepareInstaller() {
  const require = createRequire(new URL("../app/package.json", import.meta.url));
  const installed = require("@tauri-apps/cli/package.json").version;
  if (installed !== CLI_VERSION) throw new Error(`Windows packaging supports the locked Tauri CLI ${CLI_VERSION}, found ${installed}. Review its template before updating the pinned source.`);
  const directory = new URL("../app/src-tauri/binaries/", import.meta.url);
  const cache = new URL(`nsis-${CLI_VERSION}.upstream.nsi`, directory);
  let source;
  try { source = await readFile(cache, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not obtain the locked NSIS template: HTTP ${response.status}`);
    source = await response.text();
  }
  if (createHash("sha256").update(source).digest("hex") !== TEMPLATE_SHA256) throw new Error("The locked NSIS template does not match its pinned SHA256.");
  await mkdir(directory, { recursive: true });
  await writeFile(cache, source);
  const output = new URL("windows-installer.nsi", directory);
  await writeFile(output, patchInstaller(source));
  return fileURLToPath(output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await prepareInstaller());
