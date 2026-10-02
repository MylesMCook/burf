import { isTauri } from "@/lib/api";

// openUrl opens a link in the default browser: through the shell plugin in
// the app, where window.open would navigate the webview itself.
export async function openUrl(url: string) {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
