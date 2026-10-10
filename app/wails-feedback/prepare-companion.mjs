import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function prepareCompanion(frontend, state) {
  const require = createRequire(join(frontend, "package.json"));
  const entry = require.resolve("agentation-mcp");
  const packageRoot = dirname(dirname(entry));
  const metadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (metadata.version !== "1.3.2") throw new Error("The companion adapter requires agentation-mcp 1.3.2.");
  const source = await readFile(join(packageRoot, "dist/cli.js"), "utf8");
  const expected = "5ab7f2ed13dc966d7265a0a6815a0757e673a9615dd6966dfaac7bd8a2345612";
  if (createHash("sha256").update(source).digest("hex") !== expected) throw new Error("Agentation CLI bytes changed; review its local-store adapter first.");
  const original = 'const dataDir = (0, import_path.join)((0, import_os.homedir)(), ".agentation");';
  if (source.split(original).length !== 2) throw new Error("Unknown Agentation data-directory implementation.");
  const replacement = 'const dataDir = process.env.AGENTATION_DATA_DIR; if (!dataDir) throw new Error("Private feedback data directory is required");';
  // Use the original CLI's module resolution, including pnpm's transitive layout.
  const adapted = source.replace(original, replacement).replace('\n"use strict";', `\n"use strict";\nconst {createRequire: feedbackRequire} = require("node:module");\nrequire = feedbackRequire(${JSON.stringify(join(packageRoot, "dist/cli.js"))});`);
  await mkdir(state, { recursive: true, mode: 0o700 });
  const output = join(state, "agentation-local.cjs");
  await writeFile(output, adapted, { mode: 0o600 });
  await writeFile(join(state, "AGENTATION-LICENSE.txt"), await readFile(join(packageRoot, "LICENSE")), { mode: 0o600 });
  return output;
}
