// Prepare source without executing it or reading the application's UI state.
export const readinessPath = "/__wails-feedback-ready";
export function nativeStartup(entries) {
  return {
    name: "wails-native-feedback-startup",
    configureServer(server) {
      let started = false, ready = false, failed = false;
      const environment = server.environments?.client ?? server;
      if (typeof environment.transformRequest !== "function" || typeof environment.waitForRequestsIdle !== "function" || !server.httpServer) {
        throw new Error("Native feedback needs a standalone Vite server with module readiness support.");
      }
      const prepare = () => {
        if (started) return;
        started = true;
        void (async () => {
          await Promise.all(entries.map(async entry => {
            if (!await environment.transformRequest(entry)) throw new Error("Missing startup module " + entry);
          }));
          await environment.waitForRequestsIdle();
          ready = true;
        })().catch(error => {
          failed = true;
          server.config.logger.error("Native feedback frontend preparation failed: " + error.message);
        });
      };
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (req.method === "GET" && path === readinessPath) {
          res.setHeader("Cache-Control", "no-store");
          res.writeHead(ready ? 204 : failed ? 500 : 503);
          res.end();
          return;
        }
        // Let Vite process HTML normally: its initial optimizer scan needs it.
        if (req.method === "GET" && ["/", "/index.html"].includes(path)) prepare();
        next();
      });
    },
  };
}
