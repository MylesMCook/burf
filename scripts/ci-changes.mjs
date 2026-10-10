// Which of CI's suites a change can break, from the paths it touched.
//
//   git diff --name-only BASE HEAD | node scripts/ci-changes.mjs
//
// prints one `suite=true|false` line for each suite, the form a workflow
// step appends to $GITHUB_OUTPUT. `--all` says every suite, for a run with
// nothing to compare against (a release's checks, a run started by hand).
//
// The rule errs towards running: a path no pattern knows runs everything,
// so a new part of the repository is checked until someone says which
// suites it belongs to.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SUITES = ["go", "native", "app", "e2e", "desktop", "windows", "docs", "shell"];

// Each pattern is a path prefix, or a suffix when it starts with "*".
// go: the race suite. app: the frontend's own checks and build. e2e: the
// browser suite. desktop: the macOS Go/Wails shell. windows: the
// native Windows tests and installer. docs: the docs site. shell: shellcheck.
const RULES = [
  // CI itself, and what decides or builds everything.
  { suites: SUITES, paths: [".github/workflows/", "scripts/ci-changes", "scripts/check-local", "Makefile"] },
  { suites: ["go", "windows"], paths: ["go.mod", "go.sum", "internal/", "cmd/", "examples/"] },
  // The page: what the browser suite loads.
  { suites: ["app", "e2e"], paths: ["app/src/", "app/e2e/", "app/public/", "app/index.html", "app/scripts/", "app/playwright.config.ts", "app/vite.config.ts", "app/tsconfig", "plugins/", "packages/"] },
  // Its dependencies reach every build of it.
  { suites: ["app", "e2e", "desktop", "windows"], paths: ["app/package.json", "app/pnpm-lock.yaml", "app/pnpm-workspace.yaml", "app/components.json", "app/perf/"] },
  // Portable native logic and Windows compilation run on PRs too.
  { suites: ["native"], paths: ["app/native/", "app/bindings/", "scripts/go-check", "scripts/native-prepare", "scripts/wails-cli"] },
  { suites: ["app"], paths: ["app/bindings/"] },
  // The native shell and how it is packaged.
  { suites: ["desktop", "windows"], paths: ["app/native/", "app/bindings/", "scripts/native-", "scripts/wails-cli", "scripts/webview2", "scripts/macos/", "scripts/mac-release.sh", "scripts/windows", "scripts/test-windows", "design/branding/", "scripts/export-branding.mjs", "scripts/branding.test.mjs"] },
  { suites: ["windows"], paths: ["scripts/build-tmux.sh"] },
  { suites: ["docs"], paths: ["docs/", "docs-site/", "scripts/docs-shots/"] },
  { suites: ["shell"], paths: ["*.sh", "site/install.sh"] },
  // Read by people or by other tools, never by a suite.
  { suites: [], paths: ["*.md", "*.mdx", "LICENSE", ".gitignore", ".gitattributes", "site/", "video/", "kits/", "ci/", ".claude/", ".berth/", "Casks/", "design/", ".vercelignore", "scripts/release-test/"] },
];

const matches = (path, pattern) => (pattern.startsWith("*") ? path.endsWith(pattern.slice(1)) : path === pattern || path.startsWith(pattern));

// suitesFor is the set of suites the paths reach. Every rule a path matches
// counts, so docs/x.md is the docs site's and scripts/x.sh is shellcheck's
// as well as whatever else names it.
export function suitesFor(paths) {
  const out = new Set();
  for (const path of paths) {
    const hit = RULES.filter((r) => r.paths.some((p) => matches(path, p)));
    if (!hit.length) return new Set(SUITES);
    for (const r of hit) for (const s of r.suites) out.add(s);
  }
  return out;
}

// only keeps the named suites of what was picked: a run that has just one
// left to prove (--only=e2e, a merge whose other suites passed already).
export const only = (picked, names) => new Set([...picked].filter((s) => names.includes(s)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = process.argv.includes("--all");
  const names = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const paths = all ? [] : readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const reached = all ? new Set(SUITES) : suitesFor(paths);
  const picked = names ? only(reached, names) : reached;
  for (const s of SUITES) console.log(`${s}=${picked.has(s)}`);
}
