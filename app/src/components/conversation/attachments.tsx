import * as stylex from "@stylexjs/stylex";
import { CircleAlertIcon, FileTextIcon, ImageIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { type AttachTarget, attachable, isImage, localPaths, MAX_ATTACHMENT, named, onThisComputer, pastedFiles, shrinkImage, uploadAttachment, uploadLocalFile } from "@/lib/attachments";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "transitionDuration": "200ms",
  },
  s1: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "8px",
  },
  s2: {
    "position": "relative",
    "minWidth": "0px",
    "cursor": "default",
  },
  s3: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s4: {
    "wordBreak": "break-all",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
  s6: {
    "color": "var(--destructive-foreground)",
  },
  s7: {
    "display": "flex",
    "height": "44px",
    "maxWidth": "224px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--muted) 48%, transparent), color-mix(in oklab, var(--muted) 40%, transparent))",
    },
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingInlineStart": "4px",
    "paddingInlineEnd": "10px",
  },
  s8: {
    "borderColor": "color-mix(in oklab, var(--destructive) 40%, transparent)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--destructive) 6%, transparent), color-mix(in oklab, var(--destructive) 10%, transparent))",
    },
  },
  s9: {
    "position": "relative",
    "display": "flex",
    "width": "36px",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "overflow": "hidden",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "width": "100%",
    "height": "100%",
    "objectFit": "cover",
  },
  s11: {
    "width": "16px",
    "height": "16px",
  },
  s12: {
    "width": "16px",
    "height": "16px",
  },
  s13: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s14: {
    "backgroundColor": "color-mix(in oklab, #000 48%, transparent)",
    "color": "#fff",
  },
  s15: {
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
  },
  s16: {
    "width": "20px",
    "height": "20px",
  },
  s17: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "backgroundColor": "color-mix(in oklab, var(--background) 72%, transparent)",
  },
  s18: {
    "width": "16px",
    "height": "16px",
    "color": "var(--destructive)",
  },
  s19: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "lineHeight": "1.25",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "color": "var(--foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "0.6875rem",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s22: {
    "color": "var(--destructive-foreground)",
  },
  s23: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "var(--radius-sm)",
    "fontWeight": 500,
    "color": "var(--foreground)",
    "textDecoration": "underline",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s24: {
    "width": "12px",
    "height": "12px",
  },
  s25: {
    "position": "absolute",
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    "outline": "none",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group\\/chip:hover &)": {
      "opacity": 1,
    },
  },
  s26: {
    "opacity": 1,
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  q28: {
    "transitionProperty": "stroke-dashoffset",
    "transitionDuration": "150ms",
  },
  q29: {
    "transform": "rotate(-90deg)",
  },
  q30: {
    "textDecorationColor": {
      "default": "color-mix(in oklab, var(--foreground) 24%, transparent)",
      ":hover": "var(--foreground)",
    },
    "textUnderlineOffset": "2px",
  },
  q31: {
    "top": "calc(6px * -1)",
    "right": "calc(6px * -1)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A file on its way to the box, or there: the composer shows it as a chip
// until the prompt goes.
export interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  // Bytes, as it goes up (after shrinking).
  size: number;
  // An object URL, for an image's thumbnail.
  preview?: string;
  // shrinking: a pasted screenshot being made smaller first.
  state: "shrinking" | "uploading" | "ready" | "error";
  // How much has gone, 0 to 1, for a file from the app (a path on this
  // computer goes up through the laptop agent, which doesn't say).
  progress?: number;
  // The size before shrinking, when it was shrunk.
  original?: number;
  path?: string;
  error?: string;
}

let seq = 0;

// A pasted screenshot is made smaller before it goes (lib/attachments); a
// dropped file may be the real asset, so it goes as it is.
const shrinks = (f: File, pasted: boolean) => pasted && isImage(f.type) && f.type !== "image/gif";

// useAttachments keeps a composer's attachments: a paste or a drop of files
// uploads them to the target's worktree at once, and paths lists where the
// ready ones are for the prompt. A paste without files (text, HTML, a URL)
// is left to the field. Each upload shows how far it has got; one that
// fails can be retried, and taking a chip out stops its upload.
//
// A composer whose target can change before it sends (the project or box of
// a new task, the agents picked for a prompt) sends its files again to the
// new one, so their paths are where the agent will look. Until there is a
// target, a file waits for it when one is on its way (waiting: the
// project's checkout is still loading, say); otherwise without says why a
// file can't go, when one is dropped or pasted.
export function useAttachments(target: AttachTarget | undefined, { without, waiting }: { without?: string; waiting?: boolean } = {}) {
  const client = useStore((s) => s.client);
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const address = useStore((s) => (target ? s.status?.boxes.find((b) => b.name === target.box)?.address : undefined));
  const live = useRef(items);
  live.current = items;
  // What each unfinished chip is doing: how to try it again, and how to
  // stop it.
  const jobs = useRef(new Map<string, { retry(): void; abort?: AbortController }>());
  // What each chip was made from, to send it again to another target.
  const sources = useRef(new Map<string, File | string>());
  useEffect(
    () => () => {
      for (const j of jobs.current.values()) j.abort?.abort();
      for (const it of live.current) if (it.preview) URL.revokeObjectURL(it.preview);
    },
    [],
  );
  const patch = (id: string, p: Partial<PendingAttachment>) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const send = (id: string, f: File) => {
    if (!client || !target) return;
    sources.current.set(id, f);
    const abort = new AbortController();
    jobs.current.set(id, { retry: () => send(id, f), abort });
    patch(id, { state: "uploading", progress: 0, error: undefined });
    let shown = 0;
    uploadAttachment(client, target, f, {
      signal: abort.signal,
      onProgress: (sent, total) => {
        const p = total ? sent / total : 0;
        // A step a percent or more, so a fast upload doesn't re-render on
        // every chunk.
        if (p - shown < 0.01 && p < 1) return;
        shown = p;
        patch(id, { progress: p });
      },
    }).then(
      (a) => {
        if (jobs.current.get(id)?.abort !== abort) return;
        jobs.current.delete(id);
        patch(id, { state: "ready", progress: 1, path: a.path, size: a.size });
      },
      (err: unknown) => {
        if (abort.signal.aborted || jobs.current.get(id)?.abort !== abort) return;
        patch(id, { state: "error", error: errorMessage(err) });
      },
    );
  };

  // pasted: the files came from a paste, so screenshots among them shrink.
  const add = useCallback(
    (files: File[], pasted = false) => {
      if (!client || (!target && !waiting)) return;
      // A pasted screenshot over the limit may fit once it is shrunk.
      // (Not one waiting for a target: it goes as it is.)
      const ok = files.filter((f) => attachable(f) && (f.size <= MAX_ATTACHMENT || (!!target && shrinks(f, pasted))));
      const refused = files.filter((f) => !ok.includes(f));
      if (refused.length) {
        const big = refused.some((f) => attachable(f));
        toastManager.add({
          type: "warning",
          title: refused.length === 1 ? `Couldn't attach ${refused[0].name || "the file"}` : `Couldn't attach ${refused.length} files`,
          description: big ? "Attachments can be up to 20 MB." : "Images (PNG, JPEG, GIF, WebP), PDFs and text files can be attached.",
        });
      }
      for (const file of ok) {
        const f = named(file);
        const id = `att${++seq}`;
        const shrink = shrinks(f, pasted);
        const item: PendingAttachment = { id, name: f.name, type: f.type, size: f.size, preview: isImage(f.type) ? URL.createObjectURL(f) : undefined, state: shrink ? "shrinking" : "uploading", progress: 0 };
        setItems((l) => [...l, item]);
        // No target yet: it goes when there is one (the effect below).
        if (!target) {
          sources.current.set(id, f);
          jobs.current.set(id, { retry: () => {} });
          patch(id, { state: "uploading", progress: undefined });
          continue;
        }
        if (!shrink) {
          send(id, f);
          continue;
        }
        jobs.current.set(id, { retry: () => {} });
        void shrinkImage(f).then((g) => {
          // Taken out while it shrank.
          if (!jobs.current.has(id)) return;
          if (g !== f) patch(id, { name: g.name, type: g.type, size: g.size, original: f.size });
          send(id, g);
        });
      }
    },
    // send reads the same client and target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, target, waiting],
  );

  // sendLocal has the laptop agent upload a file on this computer. missing,
  // on the first try, is told when the path isn't a file here, and the
  // chip goes; any other failure stays on the chip, to retry.
  const sendLocal = (id: string, path: string, missing?: (oldAgent: boolean) => void) => {
    if (!client || !target) return;
    const job = { retry: () => sendLocal(id, path) };
    jobs.current.set(id, job);
    sources.current.set(id, path);
    patch(id, { state: "uploading", error: undefined });
    uploadLocalFile(client, target, path).then(
      (a) => {
        if (jobs.current.get(id) !== job) return;
        jobs.current.delete(id);
        patch(id, { name: a.name.replace(/^\d{8}-\d{6}-/, ""), size: a.size, state: "ready", path: a.path });
      },
      (err: unknown) => {
        if (jobs.current.get(id) !== job) return;
        const notHere = err instanceof ApiError && err.code === "attach_local" && /^no file at/.test(err.message);
        // An agent from before attach-local: the path goes as text, and
        // the person hears why the box may not see it.
        const oldAgent = err instanceof ApiError && err.status === 404 && !err.code;
        if (missing && (notHere || oldAgent)) {
          jobs.current.delete(id);
          sources.current.delete(id);
          setItems((l) => l.filter((x) => x.id !== id));
          missing(oldAgent);
        } else patch(id, { state: "error", error: errorMessage(err) });
      },
    );
  };

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
      sendLocal(id, path, (oldAgent) => {
        if (oldAgent && !missed) toastManager.add({ type: "warning", title: "Pasted the path as text", description: "Restart the Burf agent to upload files from this computer; the box can't read a path here." });
        if (++missed === paths.length) asText();
      });
    }
  };

  // Another target: what was sent goes again, to where the agent will be.
  const targetKey = target ? JSON.stringify(target) : "";
  const lastKey = useRef(targetKey);
  useEffect(() => {
    if (targetKey === lastKey.current) return;
    lastKey.current = targetKey;
    if (!targetKey) return;
    for (const it of live.current) {
      const src = sources.current.get(it.id);
      if (src === undefined) continue;
      jobs.current.get(it.id)?.abort?.abort();
      if (typeof src === "string") sendLocal(it.id, src);
      else send(it.id, src);
    }
    // send and sendLocal are this render's, with the new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Nowhere to send a file yet: say why, once a drop or a paste brings one.
  const refuse = () => toastManager.add({ type: "warning", title: "Can't attach files here yet", description: without });

  const onPaste = (e: React.ClipboardEvent) => {
    const files = pastedFiles(e.clipboardData);
    if (!target && waiting && files.length) {
      e.preventDefault();
      add(files, true);
      return;
    }
    if (!target) {
      if (files.length && without) {
        e.preventDefault();
        refuse();
      }
      return;
    }
    if (files.length) {
      e.preventDefault();
      add(files, true);
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
      if (!hasFiles(e) || (!target && !waiting && !without)) return;
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
      if (!files.length || (!target && !waiting && !without)) return;
      e.preventDefault();
      if (target || waiting) add(files);
      else refuse();
    },
  };
  const remove = (id: string) => {
    jobs.current.get(id)?.abort?.abort();
    jobs.current.delete(id);
    sources.current.delete(id);
    setItems((l) => {
      const gone = l.find((x) => x.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return l.filter((x) => x.id !== id);
    });
  };
  const retry = (id: string) => jobs.current.get(id)?.retry();
  const clear = () => {
    for (const j of jobs.current.values()) j.abort?.abort();
    jobs.current.clear();
    sources.current.clear();
    setItems((l) => {
      for (const x of l) if (x.preview) URL.revokeObjectURL(x.preview);
      return [];
    });
  };
  const paths = items.flatMap((x) => (x.state === "ready" && x.path ? [x.path] : []));
  const going = items.filter((x) => x.state === "uploading" || x.state === "shrinking");
  const uploading = going.length > 0;
  const failed = items.some((x) => x.state === "error");
  // What holds the prompt back, in words for a placeholder or a tip.
  let blocker: string | undefined;
  if (uploading) {
    const total = going.reduce((n, x) => n + x.size, 0);
    const sent = going.reduce((n, x) => n + x.size * (x.progress ?? 0), 0);
    const pct = total && going.every((x) => x.progress !== undefined) ? ` (${Math.floor((sent / total) * 100)}%)` : "";
    blocker = `Uploading ${going.length === 1 ? (isImage(going[0].type) ? "the image" : "the file") : `${going.length} files`}${pct}`;
  } else if (failed) blocker = "An attachment didn't upload: retry or remove it";
  return { items, paths, uploading, failed, blocker, dragging, onPaste, dropProps, remove, retry, clear, add };
}

export type Attachments = ReturnType<typeof useAttachments>;

const size = (n: number) => (n < 1024 ? `${n} B` : n < 2 ** 20 ? `${Math.round(n / 1024)} KB` : `${(n / 2 ** 20).toFixed(1)} MB`);

// ProgressRing is how much of an upload has gone, round a thumbnail.
function ProgressRing({ value, className }: { value: number; className?: string }) {
  const c = 2 * Math.PI * 8;
  return (
    <svg viewBox="0 0 20 20" className={[sx(paint.q29), className].filter(Boolean).join(" ")} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label="Uploaded">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth="2.5" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, value))} className={[sx(paint.s0), sx(paint.q28)].filter(Boolean).join(" ")} />
    </svg>
  );
}

// What a chip's second line says.
function status(it: PendingAttachment): string {
  if (it.state === "shrinking") return "Shrinking…";
  if (it.state === "uploading") return it.progress === undefined ? "Uploading…" : `${Math.floor(it.progress * 100)}% of ${size(it.size)}`;
  if (it.state === "error") return "Didn't upload";
  return it.original ? `${size(it.size)}, was ${size(it.original)}` : size(it.size);
}

// AttachmentChips shows a composer's attachments: a thumbnail (or an icon),
// the name, and how its upload is going, each with a way to take it out
// and, when an upload fails, to try again.
export function AttachmentChips({ items, onRemove, onRetry, className }: { items: PendingAttachment[]; onRemove(id: string): void; onRetry?(id: string): void; className?: string }) {
  if (!items.length) return null;
  return (
    <ul aria-label="Attachments" className={[sx(paint.s1), className].filter(Boolean).join(" ")}>
      {items.map((it) => {
        const busy = it.state === "uploading" || it.state === "shrinking";
        return (
          <li key={it.id} data-testid="attachment-chip" data-state={it.state} className={[sx(paint.s2), "group/chip"].filter(Boolean).join(" ")}>
            <Tip
              label={
                <span className={sx(paint.s3)}>
                  <span className={sx(paint.s4)}>{it.name}</span>
                  <span className={[sx(paint.s5), it.state === "error" && sx(paint.s6)].filter(Boolean).join(" ")}>
                    {it.state === "shrinking"
                      ? "Making the screenshot smaller before it goes…"
                      : it.state === "uploading"
                        ? `Uploading to the box${it.progress === undefined ? "…" : `: ${size(Math.round(it.size * it.progress))} of ${size(it.size)}`}`
                        : it.state === "error"
                          ? it.error
                          : `${it.original ? `${size(it.size)} (shrunk from ${size(it.original)})` : size(it.size)} · goes with the prompt as its path`}
                  </span>
                </span>
              }
            >
              <div
                className={[sx(paint.s7), it.state === "error" && sx(paint.s8)].filter(Boolean).join(" ")}
              >
                <span className={sx(paint.s9)}>
                  {it.preview ? (
                    <img src={it.preview} alt="" className={sx(paint.s10)} />
                  ) : it.type.startsWith("image/") ? (
                    <ImageIcon className={sx(paint.s11)} />
                  ) : (
                    <FileTextIcon className={sx(paint.s12)} />
                  )}
                  {busy && (
                    <span className={[sx(paint.s13), it.preview ? sx(paint.s14) : sx(paint.s15)].filter(Boolean).join(" ")}>
                      {it.state === "uploading" && it.progress !== undefined ? <ProgressRing value={it.progress} className={sx(paint.s16)} /> : <Spinner  size="lg"/>}
                    </span>
                  )}
                  {it.state === "error" && (
                    <span className={sx(paint.s17)}>
                      <CircleAlertIcon className={sx(paint.s18)} />
                    </span>
                  )}
                </span>
                <span className={sx(paint.s19)}>
                  <span className={sx(paint.s20)}>{it.name}</span>
                  <span className={[sx(paint.s21), it.state === "error" && sx(paint.s22)].filter(Boolean).join(" ")}>
                    {status(it)}
                    {it.state === "error" && onRetry && (
                      <>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          onClick={() => onRetry(it.id)}
                          className={[sx(paint.s23), sx(paint.q30)].filter(Boolean).join(" ")}
                        >
                          <RotateCwIcon className={sx(paint.s24)} />
                          Retry
                        </button>
                      </>
                    )}
                  </span>
                </span>
              </div>
            </Tip>
            <button
              type="button"
              aria-label={busy ? `Stop uploading ${it.name}` : `Remove ${it.name}`}
              onClick={() => onRemove(it.id)}
              className={[[sx(paint.s25), sx(paint.q31)].filter(Boolean).join(" "), it.state === "error" && sx(paint.s26)].filter(Boolean).join(" ")}
            >
              <XIcon className={sx(paint.s27)} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
