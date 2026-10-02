// Builds the plugins that ship with the app: every plugins/<id>/ whose
// berth-plugin.json says "builtin": true becomes one ES module in
// public/builtin-plugins/<id>/, listed in public/builtin-plugins/index.json.
// React and the Berth SDK stay external: the app provides them at runtime,
// as it does for plugins in ~/.berth/plugins.
//
//   node scripts/build-plugins.mjs           build once
//   node scripts/build-plugins.mjs --watch   rebuild on change
import { context, build } from "esbuild";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "plugins");
const out = resolve(import.meta.dirname, "..", "public", "builtin-plugins");
const watch = process.argv.includes("--watch");

const manifests = [];
for (const dir of await readdir(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  let m;
  try {
    m = JSON.parse(await readFile(join(root, dir.name, "berth-plugin.json"), "utf8"));
  } catch {
    continue;
  }
  if (!m.builtin) continue;
  // A plugin still being written must not keep the app from starting.
  try {
    await readFile(join(root, dir.name, "src", "index.tsx"));
  } catch {
    console.warn(`skipping built-in plugin ${dir.name}: no src/index.tsx yet`);
    continue;
  }
  manifests.push({ ...m, id: m.id ?? dir.name, dir: dir.name });
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const index = [];
for (const m of manifests) {
  const { dir, builtin, ...manifest } = m;
  const target = join(out, m.id);
  await mkdir(target, { recursive: true });
  const options = {
    entryPoints: [join(root, dir, "src", "index.tsx")],
    bundle: true,
    format: "esm",
    jsx: "automatic",
    // A plugin can carry a script it runs on boxes as text.
    loader: { ".py": "text", ".sh": "text" },
    target: "es2022",
    external: ["react", "react/jsx-runtime", "react-dom", "@berth/plugin", "@berth/plugin/ui"],
    outfile: join(target, "index.js"),
    logLevel: "warning",
  };
  try {
    if (watch) await (await context(options)).watch();
    else await build(options);
  } catch (err) {
    console.warn(`skipping built-in plugin ${m.id}: ${err.message.split("\n")[0]}`);
    continue;
  }
  const info = { ...manifest, main: "index.js" };
  await writeFile(join(target, "berth-plugin.json"), JSON.stringify(info, null, 2) + "\n");
  index.push(info);
}
await writeFile(join(out, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`built-in plugins: ${index.map((p) => p.id).join(", ") || "none"}${watch ? " (watching)" : ""}`);
