// Native commands belong only to the trusted top-level Wails application page.
declare global {
  interface Window {
    __BURF_WAILS__?: boolean;
  }
}

export type DesktopKind = "wails" | "browser";

export function desktopKind(scope: unknown): DesktopKind {
  if (typeof scope !== "object" || scope === null || !("top" in scope) || scope.top !== scope) return "browser";
  if ("__BURF_WAILS__" in scope && scope.__BURF_WAILS__ === true) return "wails";
  return "browser";
}

export const isWails = (): boolean => typeof window !== "undefined" && desktopKind(window) === "wails";
export const isDesktop = isWails;

export async function invoke<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isWails()) throw new Error("Desktop commands are only available in the Burf app.");
  const { Invoke } = await import("../../bindings/github.com/MylesMCook/burf/app/native/desktop/service");
  return await Invoke(command, args) as T;
}

export async function listen<T>(name: string, callback: (event: { payload: T }) => void): Promise<() => void> {
  if (!isWails()) return () => {};
  const { Events } = await import("@wailsio/runtime");
  return Events.On(name, (event) => callback({ payload: event.data as T }));
}

export async function getVersion(): Promise<string> {
  return isWails() ? invoke<string>("get_version") : "dev";
}

export async function closeWindow(): Promise<void> {
  if (isWails()) await invoke("close_window");
}

export async function setWindowTitle(title: string): Promise<void> {
  if (isWails()) await invoke("set_window_title", { title });
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isWails()) { await invoke("open_url", { url }); return; }
  window.open(url, "_blank", "noopener");
}

export async function isNotificationPermissionGranted(): Promise<boolean> {
  return isWails() ? invoke<boolean>("notification_permission") : false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return isWails() ? invoke<boolean>("request_notification_permission") : false;
}

export async function sendNotification(notification: { title: string; body?: string }): Promise<void> {
  if (isWails()) await invoke("send_notification", { title: notification.title, body: notification.body ?? "" });
}
