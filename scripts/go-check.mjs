// Keep changed-package checks inside their owning Go module. Native builds
// have their own module; root `./...` deliberately cannot reach it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareNative } from "./native-prepare.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = [
  { directory: ".", prefix: "", smoke: ["./cmd/burf", "./internal/uibundle", "./internal/uicontract"] },
  { directory: "app/native", prefix: "app/native/", smoke: ["./desktop", "./nativebrowser"] },
];

export function checksFor(paths, has = (path) => existsSync(join(root, path))) {
  const picked = new Map();
  for (const path of paths) {
    if (!/\.(go|mod|sum)$/.test(path)) continue;
    const module = path.startsWith("app/native/") ? modules[1] : modules[0];
    const relative = path.slice(module.prefix.length);
    const packages = picked.get(module.directory) || new Set();
    if (relative === "go.mod" || relative === "go.sum") {
      for (const pkg of module.smoke) packages.add(pkg);
    } else if (path.endsWith(".go") && has(dirname(path))) {
      packages.add(`./${dirname(relative)}`.replace("./.", "."));
    }
    if (packages.size) picked.set(module.directory, packages);
  }
  return modules.filter(({ directory }) => picked.has(directory)).map(({ directory }) => ({
    directory, packages: [...picked.get(directory)].sort(),
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = readFileSync(0, "utf8").split("\n").filter(Boolean);
  const checks = checksFor(paths).filter(({ directory }) => !process.argv.includes("--root-only") || directory === ".");
  if (process.argv.includes("--plan")) console.log(JSON.stringify(checks));
  else for (const { directory, packages } of checks) {
    if (directory === "app/native") await prepareNative(root, "bindings");
    const cwd = join(root, directory);
    console.log(`go (${directory}): vet and tests of ${packages.join(" ")}`);
    execFileSync("go", ["vet", ...packages], { cwd, stdio: "inherit" });
    execFileSync("go", ["test", ...packages], { cwd, stdio: "inherit" });
  }
}
