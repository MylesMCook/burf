import { toastManager } from "@/components/ui/toast";
import { isTauri } from "@/lib/api";

type Kind = "info" | "success" | "warning" | "error";

export interface NotifyAction {
  label: string;
  run(): void;
}

// notify shows a toast in the app and, when the window is not focused, a
// system notification, so an agent waiting for you is noticed from anywhere.
// An action ("Open") goes on the toast as a button.
export function notify(title: string, body?: string, kind: Kind = "info", action?: NotifyAction) {
  toastManager.add({ title, description: body, type: kind, actionProps: action ? { children: action.label, onClick: action.run } : undefined });
  if (!document.hasFocus()) void systemNotification(title, body);
}

let permitted: boolean | undefined;

async function systemNotification(title: string, body?: string) {
  try {
    if (isTauri()) {
      const n = await import("@tauri-apps/plugin-notification");
      if (permitted === undefined) {
        permitted = (await n.isPermissionGranted()) || (await n.requestPermission()) === "granted";
      }
      if (permitted) n.sendNotification({ title, body });
      return;
    }
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification(title, { body });
  } catch {
    // The toast already said it.
  }
}
