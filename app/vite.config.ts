import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// devPlugins serves the repository's plugins/ folder at /__dev-plugins/ while
// developing, so mock mode can load a real plugin bundle without the agent.
function devPlugins(): Plugin {
  const root = path.resolve(import.meta.dirname, "../plugins");
  return {
    name: "berth-dev-plugins",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev-plugins/", (req, res, next) => {
        const file = path.join(root, decodeURIComponent((req.url ?? "").split("?")[0]));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "text/javascript");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// demoPage makes the demo build's page work from any folder (berthd.app/demo/):
// the plugin shims and the icon by relative paths, a title and no indexing,
// and a fresh demo on every load (the app's remembered layout cleared).
function demoPage(): Plugin {
  return {
    name: "berth-demo-page",
    transformIndexHtml(html) {
      return html
        .replace(/"\/shims\//g, '"./shims/')
        .replace('href="/favicon.svg"', 'href="./favicon.svg"')
        .replace("<title>Berth</title>", '<title>Berth demo</title>\n    <meta name="robots" content="noindex" />')
        .replace(
          "<script type=\"importmap\">",
          `<script>
      // Its paths are relative: /demo needs its slash to find them.
      if (!location.pathname.endsWith("/") && !location.pathname.endsWith(".html")) location.replace(location.pathname + "/" + location.search + location.hash);
      // Every visit starts the demo afresh.
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith("berth.")) localStorage.removeItem(k);
      } catch {}
    </script>
    <script type="importmap">`,
        );
    },
  };
}

// noShikiWasm: the diff renderer highlights with Shiki's JavaScript regex
// engine, so its Oniguruma engine (a 600 KB wasm chunk) is never shipped.
function noShikiWasm(): Plugin {
  return {
    name: "berth-no-shiki-wasm",
    enforce: "pre",
    resolveId: (id) => (id === "shiki/wasm" ? "\0no-shiki-wasm" : undefined),
    load: (id) => (id === "\0no-shiki-wasm" ? "export default undefined;" : undefined),
  };
}

// workerScript: the highlighting worker's script is imported for what it
// does when it runs, which its package's sideEffects list leaves out (so a
// build would drop it, leaving an empty worker).
function workerScript(): Plugin {
  return {
    name: "berth-diffs-worker-script",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (id !== "@pierre/diffs/worker/worker.js") return undefined;
      const r = await this.resolve(id, importer, { ...options, skipSelf: true });
      return r ? { ...r, moduleSideEffects: true } : undefined;
    },
  };
}

// commit is the checkout's short hash, which Copy diagnostics names as the
// app's build; empty outside a git checkout.
function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: import.meta.dirname, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// https://vite.dev/config/
//
// `vite build --mode demo` (pnpm build:demo) is the live demo on berthd.app:
// the app on its fixtures (mock mode, always), with a guide and scripted
// activity (src/demo/), nothing that needs a laptop agent or Tauri, built
// with relative paths into site/demo/.
// A second dev server (another --port) keeps its own prebundled deps: one
// cache re-bundled under a running server gives its page two copies of a
// library's internals, and Base UI's contexts stop matching.
const argPort = process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : undefined;

export default defineConfig(({ mode }) => ({
  cacheDir: argPort && argPort !== "1420" ? `node_modules/.vite-${argPort}` : "node_modules/.vite",
  plugins: [react(), tailwindcss(), devPlugins(), noShikiWasm(), ...(mode === "demo" ? [demoPage()] : [])],
  // The diff renderer's highlighting worker loads its languages as chunks,
  // which takes a module worker.
  worker: { format: "es" as const, plugins: () => [noShikiWasm(), workerScript()] },
  define: { __BERTH_DEMO__: JSON.stringify(mode === "demo"), __BERTH_COMMIT__: JSON.stringify(commit()) },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // lucide's dynamic icons are one chunk per icon (some 1,700 files);
      // the demo draws the few that plugins name from one small map.
      ...(mode === "demo" ? { "lucide-react/dynamic": path.resolve(import.meta.dirname, "./src/demo/lucide-dynamic.tsx") } : {}),
    },
  },
  base: mode === "demo" ? "./" : "/",
  // A desktop app loads from disk; one large chunk (xterm, React) is fine.
  build:
    mode === "demo"
      ? { chunkSizeWarningLimit: 2000, outDir: path.resolve(import.meta.dirname, "../site/demo"), emptyOutDir: true }
      : { chunkSizeWarningLimit: 2000 },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
