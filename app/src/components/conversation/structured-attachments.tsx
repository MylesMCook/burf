import { useAui, useAuiState, type Attachment, type AttachmentAdapter, type PendingAttachment } from "@assistant-ui/react";
import { useEffect, useImperativeHandle, useMemo, type Ref } from "react";

import type { Client } from "@/lib/api";
import { attachable, isImage, MAX_ATTACHMENT, named, uploadAttachment, type AttachTarget } from "@/lib/attachments";
import { errorMessage } from "@/lib/format";

export function useWorktreeAttachments(client: Client | null | undefined, target: AttachTarget | undefined) {
  const uploads = useMemo(() => new Map<string, AbortController>(), [client, target]);
  useEffect(() => () => { for (const abort of uploads.values()) abort.abort(); }, [uploads]);
  return useMemo<AttachmentAdapter | undefined>(() => client && target ? {
    accept: "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/*,.txt,.md,.log,.csv,.tsv,.json,.yaml,.yml,.toml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.go,.py,.rb,.rs,.java,.kt,.swift,.c,.h,.cpp,.sh,.sql,.diff,.patch",
    async *add({ file }) {
      file = named(file);
      const id = crypto.randomUUID();
      const attachment: PendingAttachment = { id, name: file.name, file, type: isImage(file.type) ? "image" : "file", contentType: file.type, status: { type: "running", reason: "uploading", progress: 0 } };
      yield attachment;
      const abort = new AbortController();
      uploads.set(id, abort);
      try {
        if (!attachable(file)) throw new Error("Attach an image, PDF or text file.");
        if (file.size > MAX_ATTACHMENT) throw new Error("Attachments can be up to 20 MB.");
        const uploaded = await uploadAttachment(client, target, file, { signal: abort.signal });
        yield { ...attachment, content: [{ type: "text", text: uploaded.path }], status: { type: "requires-action", reason: "composer-send" } };
      } catch (error) {
        if (!abort.signal.aborted) yield { ...attachment, status: { type: "incomplete", reason: "error", message: errorMessage(error) } };
      } finally { uploads.delete(id); }
    },
    async remove(attachment) { uploads.get(attachment.id)?.abort(); uploads.delete(attachment.id); },
    async send(attachment) {
      if (!attachment.content?.length || attachment.status.type === "incomplete") throw new Error("The attachment has not uploaded.");
      return { ...attachment, content: attachment.content, status: { type: "complete" } };
    },
  } : undefined, [client, target, uploads]);
}

export interface StructuredAttachmentControl {
  items(): readonly Attachment[];
  add(files: File[]): void;
  remove(id: string): void;
  clear(): void;
}

// The thread's runtime owns the stock attachment UI; Burf sends its uploaded paths.
export function StructuredAttachmentState({ control, onChange }: { control: Ref<StructuredAttachmentControl>; onChange(items: readonly Attachment[]): void }) {
  const aui = useAui();
  const items = useAuiState((s) => s.composer.attachments);
  useEffect(() => onChange(items), [items, onChange]);
  useImperativeHandle(control, () => ({
    items: () => aui.composer().getState().attachments,
    add: (files) => { for (const file of files) void aui.composer().addAttachment(named(file)).catch(() => {}); },
    remove: (id) => { void aui.composer().attachment({ id }).remove(); },
    clear: () => { void aui.composer().clearAttachments(); },
  }), [aui]);
  return null;
}

