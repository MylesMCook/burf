import { nativeStylexHMR } from "./stylex-hmr.mjs";
import { nativeStartup } from "./startup.mjs";
// Wrap, rather than replace, the application's Vite configuration.
export function feedbackEnabled(environment, requested = process.env.WAILS_FEEDBACK) {
  return requested === "1" && environment.command === "serve" && environment.mode === "feedback";
}

export function withNativeFeedback(configuration, startupEntries = ["/src/main.tsx"]) {
  return async (environment) => {
    const existing = await (typeof configuration === "function" ? configuration(environment) : configuration);
    const enabled = feedbackEnabled(environment);
    if (existing.define && Object.hasOwn(existing.define, "__WAILS_FEEDBACK__")) {
      throw new Error("__WAILS_FEEDBACK__ is reserved for native feedback setup.");
    }
    return {
      ...existing,
      define: { ...existing.define, __WAILS_FEEDBACK__: JSON.stringify(enabled) },
      // Native Windows uses wails.localhost for assets; connect HMR directly
      // to the owned loopback server instead of waiting on that synthetic host.
      ...(enabled && existing.server?.hmr === undefined ? { server: { ...existing.server, hmr: { protocol: "ws", host: "127.0.0.1" } } } : {}),
      plugins: [
        ...(existing.plugins ?? []),
        ...(enabled ? [nativeStylexHMR(), nativeStartup(startupEntries), {
          name: "wails-native-feedback-development-marker",
          transformIndexHtml() {
            return [{ tag: "meta", attrs: { name: "wails-native-feedback", content: "development" }, injectTo: "head" }];
          },
        }] : []),
      ],
    };
  };
}
