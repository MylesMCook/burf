import { createMessageQueue, type AppendMessage } from "@assistant-ui/react";

export interface SavedQueueMessage {
  text: string;
  options: { model?: string; effort?: string; permission?: "strict" | "read-only" | "workspace" | "full-access" };
}

function saveMessage(message: AppendMessage): SavedQueueMessage {
  const text = message.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n");
  const paths = (message.attachments ?? []).flatMap((item) => item.content?.flatMap((part) => part.type === "text" ? [part.text] : []) ?? []);
  return { text: paths.length ? [text.trim(), paths.join("\n")].filter(Boolean).join("\n\n") : text, options: { ...(message.runConfig?.custom?.choices as SavedQueueMessage["options"] ?? {}) } };
}

function restoreMessage(message: SavedQueueMessage): AppendMessage {
  return { role: "user", content: [{ type: "text", text: message.text }], attachments: [], createdAt: new Date(), metadata: { custom: {} }, parentId: null, sourceId: null, runConfig: { custom: { choices: message.options } } };
}

// The stock queue owns ordering and retirement. Keep only its unsent entries
// for recovery; a claimed request is removed before the driver is called.
export function createSavedChatQueue(run: (message: AppendMessage) => void, initial: readonly SavedQueueMessage[] = []) {
  const queue = createMessageQueue({ run });
  const messages = new Map<string, SavedQueueMessage>();
  const listeners = new Set<() => void>();
  let changing = false;
  let held = true;
  queue.hold();
  const items = () => [...queue.adapter.steerItems, ...queue.adapter.items];
  const snapshot = () => items().flatMap((item) => messages.has(item.id) ? [messages.get(item.id)!] : []);
  const notify = () => {
    const ids = new Set(items().map((item) => item.id));
    for (const id of messages.keys()) if (!ids.has(id)) messages.delete(id);
    for (const callback of listeners) callback();
  };
  queue.subscribe(() => { if (!changing) notify(); });
  const enqueue = (message: AppendMessage) => {
    // Publish the complete entry before any subscriber or dispatch sees it.
    queue.hold();
    changing = true;
    try {
      queue.adapter.enqueue(message);
      const item = queue.adapter.items.at(-1)!;
      messages.set(item.id, saveMessage(message));
    } finally { changing = false; }
    notify();
    if (!held) queue.release();
  };
  for (const message of initial) enqueue(restoreMessage(message));
  return {
    ...queue,
    hold() { held = true; queue.hold(); },
    release() { held = false; queue.release(); },
    subscribe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; },
    snapshot,
    adapter: {
      ...queue.adapter,
      get items() { return queue.adapter.items; },
      get steerItems() { return queue.adapter.steerItems; },
      enqueue,
      steer: enqueue,
      edit(id: string, message: AppendMessage) { messages.set(id, saveMessage(message)); queue.adapter.edit(id, message); },
    },
  };
}
