import { type AttachmentAdapter, type PendingAttachment } from "@assistant-ui/react";
import { useEffect, useMemo } from "react";

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

