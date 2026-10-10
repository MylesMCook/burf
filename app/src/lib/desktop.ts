// Keep the native shell behind this boundary. The legacy shell is used only
// while its supported state export is installed before the Wails migration.
declare global {
  interface Window {
    __BURF_WAILS__?: boolean;
  }
}

export type DesktopKind = "wails" | "tauri" | "browser";

export function desktopKind(scope: unknown): DesktopKind {
  if (typeof scope !== "object" || scope === null || !("top" in scope) || scope.top !== scope) return "browser";
  if ("__BURF_WAILS__" in scope && scope.__BURF_WAILS__ === true) return "wails";
  if ("__TAURI_INTERNALS__" in scope) return "tauri";
  return "browser";
}

export const isWails = (): boolean => typeof window !== "undefined" && desktopKind(window) === "wails";
export const isLegacyTauri = (): boolean => typeof window !== "undefined" && desktopKind(window) === "tauri";
export const isDesktop = (): boolean => isWails() || isLegacyTauri();

export async function invoke<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isWails()) {
    const { Invoke } = await import("../../bindings/github.com/MylesMCook/burf/app/native/desktop/service");
    return await Invoke(command, args) as T;
  }
  if (isLegacyTauri()) {
    const native = await import("@tauri-apps/api/core");
    return native.invoke<T>(command, args);
  }
  throw new Error("Desktop commands are only available in the Burf app.");
}

export async function listen<T>(name: string, callback: (event: { payload: T }) => void): Promise<() => void> {
  if (isWails()) {
    const { Events } = await import("@wailsio/runtime");
    return Events.On(name, (event) => callback({ payload: event.data as T }));
  }
  if (isLegacyTauri()) {
    const native = await import("@tauri-apps/api/event");
    return native.listen<T>(name, callback);
  }
  return () => {};
}

export async function getVersion(): Promise<string> {
  if (isWails()) return invoke<string>("get_version");
  if (isLegacyTauri()) return (await import("@tauri-apps/api/app")).getVersion();
  return "dev";
}

export async function closeWindow(): Promise<void> {
  if (isWails()) { await invoke("close_window"); return; }
  if (isLegacyTauri()) await (await import("@tauri-apps/api/window")).getCurrentWindow().close();
}

export async function setWindowTitle(title: string): Promise<void> {
  if (isWails()) { await invoke("set_window_title", { title }); return; }
  if (isLegacyTauri()) await (await import("@tauri-apps/api/window")).getCurrentWindow().setTitle(title);
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isWails()) { await invoke("open_url", { url }); return; }
  if (isLegacyTauri()) { await (await import("@tauri-apps/plugin-shell")).open(url); return; }
  window.open(url, "_blank", "noopener");
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (isWails()) return invoke<boolean>("notification_permission");
  if (isLegacyTauri()) return (await import("@tauri-apps/plugin-notification")).isPermissionGranted();
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isWails()) return invoke<boolean>("request_notification_permission");
  if (isLegacyTauri()) return (await (await import("@tauri-apps/plugin-notification")).requestPermission()) === "granted";
  return false;
}

export async function sendNotification(notification: { title: string; body?: string }): Promise<void> {
  if (isWails()) { await invoke("send_notification", { title: notification.title, body: notification.body ?? "" }); return; }
  if (isLegacyTauri()) (await import("@tauri-apps/plugin-notification")).sendNotification(notification);
}

export type LegacyUpdate = NonNullable<Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater")["check"]>>>;

export async function checkLegacyUpdate(): Promise<LegacyUpdate | null> {
  if (!isLegacyTauri()) return null;
  return (await import("@tauri-apps/plugin-updater")).check({ timeout: 30_000 });
}
