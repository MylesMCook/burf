import { CircleAlertIcon, FileTextIcon, ImageIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { type AttachTarget, attachable, fileName, isImage, localPaths, MAX_ATTACHMENT, onThisComputer, pastedFiles, uploadAttachment, uploadLocalFile } from "@/lib/attachments";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// A file on its way to the box, or there: the composer shows it as a chip
// until the prompt goes.
export interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  // An object URL, for an image's thumbnail.
  preview?: string;
  state: "uploading" | "ready" | "error";
  path?: string;
  error?: string;
}

let seq = 0;

// useAttachments keeps a composer's attachments: a paste or a drop of files
// uploads them to the target's worktree at once, and paths lists where the
// ready ones are for the prompt. A paste without files (text, HTML, a URL)
// is left to the field.
export function useAttachments(target: AttachTarget | undefined) {
  const client = useStore((s) => s.client);
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const address = useStore((s) => (target ? s.status?.boxes.find((b) => b.name === target.box)?.address : undefined));
  const live = useRef(items);
  live.current = items;
  useEffect(() => () => live.current.forEach((it) => it.preview && URL.revokeObjectURL(it.preview)), []);

  const add = useCallback(
    (files: File[]) => {
      if (!client || !target) return;
      const ok = files.filter((f) => attachable(f) && f.size <= MAX_ATTACHMENT);
      const refused = files.filter((f) => !ok.includes(f));
      if (refused.length) {
        const big = refused.some((f) => attachable(f));
        toastManager.add({
          type: "warning",
          title: refused.length === 1 ? `Couldn't attach ${refused[0].name || "the file"}` : `Couldn't attach ${refused.length} files`,
          description: big ? "Attachments can be up to 20 MB." : "Images (PNG, JPEG, GIF, WebP), PDFs and text files can be attached.",
        });
      }
      for (const f of ok) {
        const id = `att${++seq}`;
        const item: PendingAttachment = { id, name: fileName(f), type: f.type, size: f.size, preview: isImage(f.type) ? URL.createObjectURL(f) : undefined, state: "uploading" };
        setItems((l) => [...l, item]);
        uploadAttachment(client, target, f).then(
          (a) => setItems((l) => l.map((x) => (x.id === id ? { ...x, state: "ready", path: a.path } : x))),
          (err: unknown) => setItems((l) => l.map((x) => (x.id === id ? { ...x, state: "error", error: errorMessage(err) } : x))),
        );
      }
    },
    [client, target],
  );

  // Paths to files on this computer, pasted as text, go up through the
  // laptop agent. A path that isn't a file here (one copied from the box's
  // own output, say) is pasted as the text it was.
  const addLocal = (paths: string[], asText: () => void) => {
    if (!client || !target) return;
    let missed = 0;
    for (const path of paths) {
      const id = `att${++seq}`;
      const name = path.split("/").pop() ?? path;
      const type = /\.pdf$/i.test(name) ? "application/pdf" : `image/${(name.split(".").pop() ?? "png").toLowerCase().replace("jpg", "jpeg")}`;
      setItems((l) => [...l, { id, name, type, size: 0, state: "uploading" }]);
      uploadLocalFile(client, target, path).then(
        (a) => setItems((l) => l.map((x) => (x.id === id ? { ...x, name: a.name.replace(/^\d{8}-\d{6}-/, ""), size: a.size, state: "ready", path: a.path } : x))),
        (err: unknown) => {
          const notHere = err instanceof ApiError && err.code === "attach_local" && /^no file at/.test(err.message);
          // An agent from before attach-local: the path goes as text, and
          // the person hears why the box may not see it.
          const oldAgent = err instanceof ApiError && err.status === 404 && !err.code;
          if (oldAgent && !missed) toastManager.add({ type: "warning", title: "Pasted the path as text", description: "Restart the Berth agent to upload files from this computer; the box can't read a path here." });
          if (notHere || oldAgent) {
            setItems((l) => l.filter((x) => x.id !== id));
            if (++missed === paths.length) asText();
          } else setItems((l) => l.map((x) => (x.id === id ? { ...x, state: "error", error: errorMessage(err) } : x)));
        },
      );
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (!target) return;
    const files = pastedFiles(e.clipboardData);
    if (files.length) {
      e.preventDefault();
      add(files);
      return;
    }
    if (onThisComputer(address)) return;
    const text = e.clipboardData.getData("text/plain");
    const paths = localPaths(text);
    if (!paths.length) return;
    e.preventDefault();
    const field = e.currentTarget as HTMLElement;
    addLocal(paths, () => {
      field.focus();
      document.execCommand("insertText", false, text);
    });
  };
  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e) || !target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      setDragging(false);
      const files = pastedFiles(e.dataTransfer);
      if (!files.length || !target) return;
      e.preventDefault();
      add(files);
    },
  };
  const remove = (id: string) =>
    setItems((l) => {
      const gone = l.find((x) => x.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return l.filter((x) => x.id !== id);
    });
  const clear = () =>
    setItems((l) => {
      for (const x of l) if (x.preview) URL.revokeObjectURL(x.preview);
      return [];
    });
  const paths = items.flatMap((x) => (x.state === "ready" && x.path ? [x.path] : []));
  const uploading = items.some((x) => x.state === "uploading");
  return { items, paths, uploading, dragging, onPaste, dropProps, remove, clear, add };
}

export type Attachments = ReturnType<typeof useAttachments>;

const size = (n: number) => (n < 1024 ? `${n} B` : n < 2 ** 20 ? `${Math.round(n / 1024)} KB` : `${(n / 2 ** 20).toFixed(1)} MB`);

// AttachmentChips shows a composer's attachments: a thumbnail for an image,
// a name for anything else, each with a way to take it out.
export function AttachmentChips({ items, onRemove, className }: { items: PendingAttachment[]; onRemove(id: string): void; className?: string }) {
  if (!items.length) return null;
  return (
    <ul aria-label="Attachments" className={cn("flex flex-wrap gap-2", className)}>
      {items.map((it) => (
        <li key={it.id} className="group relative">
          <Tip
            label={
              <span className="flex flex-col gap-0.5">
                <span className="break-all">{it.name}</span>
                <span className={cn("text-muted-foreground", it.state === "error" && "text-destructive-foreground")}>
                  {it.state === "uploading" ? "Uploading to the box…" : it.state === "error" ? it.error : `${size(it.size)} · goes with the prompt as its path`}
                </span>
              </span>
            }
          >
            <div
              className={cn(
                "relative flex h-14 items-center overflow-hidden rounded-lg border bg-muted/40 shadow-xs/5",
                it.preview ? "w-14" : "max-w-52 gap-2.5 py-2 ps-2.5 pe-3",
                it.state === "error" && "border-destructive/50",
              )}
            >
              {it.preview ? (
                <img src={it.preview} alt={it.name} className={cn("size-full object-cover", it.state !== "ready" && "opacity-60")} />
              ) : (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    {it.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileTextIcon className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-xs">{it.name}</span>
                    <span className="text-[11px] text-muted-foreground">{it.state === "uploading" ? "Uploading…" : it.state === "error" ? "Failed" : size(it.size)}</span>
                  </span>
                </>
              )}
              {it.state !== "ready" && it.preview && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/40">
                  {it.state === "uploading" ? <Spinner className="size-4" /> : <CircleAlertIcon className="size-4 text-destructive" />}
                </span>
              )}
              {it.state === "error" && !it.preview && <CircleAlertIcon className="size-4 shrink-0 text-destructive" />}
            </div>
          </Tip>
          <button
            type="button"
            aria-label={`Remove ${it.name}`}
            onClick={() => onRemove(it.id)}
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-xs outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
