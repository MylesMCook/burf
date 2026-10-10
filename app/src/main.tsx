import React from "react";
import ReactDOM from "react-dom/client";

import { invoke, isDesktop, isLegacyTauri, isWails, openExternalUrl } from "@/lib/desktop";
import { captureDesktopState, restoreDesktopState } from "@/lib/desktop-state";
import "@/index.css";

interface Endpoint {
  url: string;
  token: string;
}

async function migrateDesktopState() {
  if (isWails()) {
    // Nothing that reads preferences, workspaces or font records can load
    // until the old origin's explicit snapshot has been restored.
    await restoreDesktopState(await invoke<unknown>("ui_state"));
  } else if (isLegacyTauri()) {
    const snapshot = await captureDesktopState();
    const endpoint = await invoke<Endpoint>("ui_endpoint");
    const response = await fetch(`${endpoint.url}/v1/client/ui-state`, {
      method: "POST",
      headers: { Authorization: `Bearer ${endpoint.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Burf could not save its desktop settings for the shell migration.");
  }
}

async function start() {
  let exportFailed = false;
  try {
    await migrateDesktopState();
  } catch (error) {
    if (!isLegacyTauri()) throw error;
    // The old origin is still authoritative. A stopped or older agent must
    // not prevent the existing desktop app from using its own settings.
    exportFailed = true;
  }
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
      </ErrorBoundary>
    </React.StrictMode>,
  );
  if (exportFailed) {
    const { toastManager } = await import("@/components/ui/toast");
    toastManager.add({
      type: "error",
      title: "Desktop settings could not be saved for migration",
      description: "Your current app still works. Open Burf again after its agent is updated before replacing the desktop app.",
      timeout: 0,
      actionProps: { children: "Try again", onClick: () => location.reload() },
    });
  }
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
