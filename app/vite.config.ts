import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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

// https://vite.dev/config/
//
// `vite build --mode demo` (pnpm build:demo) is the live demo on berthd.app:
// the app on its fixtures (mock mode, always), with a guide and scripted
// activity (src/demo/), nothing that needs a laptop agent or Tauri, built
// with relative paths into site/demo/.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devPlugins(), ...(mode === "demo" ? [demoPage()] : [])],
  define: { __BERTH_DEMO__: JSON.stringify(mode === "demo") },
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
