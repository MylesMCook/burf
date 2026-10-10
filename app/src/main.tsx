import React from "react";
import ReactDOM from "react-dom/client";

import { invoke, isDesktop, isWails, openExternalUrl } from "@/lib/desktop";
import { restoreDesktopState } from "@/lib/desktop-state";
import "@/index.css";
import { NativeFeedback } from "./native-feedback/NativeFeedback";

async function migrateDesktopState() {
  if (isWails()) {
    // Nothing that reads preferences, workspaces or font records can load
    // until the explicit snapshot is restored or a new profile is initialized.
    await restoreDesktopState(await invoke<unknown>("ui_state"));
  }
}

async function start() {
  await migrateDesktopState();
  // Plugins resolve React and the SDK through globals. Install them after
  // storage is restored and before the app can load a plugin.
  const { installGlobals } = await import("@/plugins/host");
  installGlobals();
  const { initCustomFonts } = await import("@/lib/custom-fonts");
  initCustomFonts();
  await import("@/components/error-note");
  await import("@/lib/terminal-health");
  const [{ default: App }, { ErrorBoundary }] = await Promise.all([
    import("@/App"),
    import("@/components/error-boundary"),
  ]);

  // Terminal links belong in the system browser, away from the trusted
  // page that owns the desktop command bridge.
  if (isDesktop()) {
    window.open = (url?: string | URL) => {
      if (url) void openExternalUrl(String(url));
      return null;
    };
  }

  const root = document.getElementById("root");
  if (!root) throw new Error("Burf's root element is missing.");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
        <NativeFeedback />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

void start().catch((error: unknown) => {
  // This view deliberately has no imports that could initialize storage.
  const root = document.getElementById("root");
  if (!root) return;
  const panel = document.createElement("main");
  panel.className = "desktop-startup-error";
  panel.setAttribute("role", "alert");
  const heading = document.createElement("h1");
  heading.textContent = "Burf could not restore your desktop settings";
  const message = document.createElement("p");
  message.textContent = isWails()
    ? "Close this window and reopen the previous Burf app to save its settings. Your previous app data is still available."
    : "Your settings have not changed. Try opening Burf again after its agent is available.";
  const detail = document.createElement("p");
  detail.textContent = error instanceof Error ? error.message : "Desktop startup failed.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => location.reload());
  panel.append(heading, message, detail, retry);
  root.replaceChildren(panel);
});
