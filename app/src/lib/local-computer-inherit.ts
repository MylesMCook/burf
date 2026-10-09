import { load } from "./storage.ts";

const CHAT_PERMISSION = "berth.chat.permission";
const INHERITABLE = new Set(["strict", "read-only", "workspace"]);

export type InheritableChatPermission = "strict" | "read-only" | "workspace";

export function inheritableSavedPermission(saved: string): InheritableChatPermission | undefined {
  if (!INHERITABLE.has(saved)) return undefined;
  return saved as InheritableChatPermission;
}

// Permission offered on the next chat. Full access is never inherited.
export function inheritedChatPermission(): InheritableChatPermission | undefined {
  return inheritableSavedPermission(load<string>(CHAT_PERMISSION, ""));
}
