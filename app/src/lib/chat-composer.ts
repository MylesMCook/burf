import type { Attachment } from "@assistant-ui/react";

export interface QueuedChatMessage<Options = unknown> {
  id: string;
  text: string;
  options: Options;
}

// Claim before sending. A failed or uncertain request is never put back.
export class ChatQueue<Options = unknown> {
  items: QueuedChatMessage<Options>[] = [];
  paused = false;
  private sending = false;
  private next = 0;

  add(text: string, options: Options) {
    const message = { id: `queued-${++this.next}`, text, options };
    this.items = [...this.items, message];
    return message;
  }

  cancel(id: string) { this.items = this.items.filter((message) => message.id !== id); }

  take() {
    if (this.sending || this.paused || !this.items.length) return;
    this.sending = true;
    const [message, ...rest] = this.items;
    this.items = rest;
    return message;
  }

  finish(sent: boolean) { this.sending = false; this.paused = !sent; }
  resume() { this.paused = false; }
}

export function fileMention(text: string, caret: number) {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[1].length - 1, end: caret + (text.slice(caret).match(/^\S*/)?.[0].length ?? 0), query: match[1] } : undefined;
}

export function insertFileMention(text: string, caret: number, path: string) {
  const mention = fileMention(text, caret);
  return mention ? `${text.slice(0, mention.start)}${path} ${text.slice(mention.end).replace(/^ /, "")}` : text;
}

export function attachmentPaths(items: readonly Attachment[]) {
  return items.flatMap((item) => item.status.type === "requires-action" || item.status.type === "complete" ? item.content?.flatMap((part) => part.type === "text" ? [part.text] : []) ?? [] : []);
}
