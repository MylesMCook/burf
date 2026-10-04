import type { Client } from "@/lib/api";

// Attachments are files pasted or dropped for an agent: a screenshot, a PDF,
// a log. Agents run on a box, so the file goes up to the box first (into the
// worktree's .berth/attachments, which git ignores) and the agent is given
// its path there, the way Claude Code takes an image in a prompt: "What's in
// this image? /path/to/shot.png". In its own terminal, a pasted image is
// typed as that path, which Claude Code shows as [Image #1].
//
// What else a paste can hold is left to the field: text (however long) and a
// Berth URL paste as they are, and rich text pastes as plain text, as a
// textarea and a terminal only take text. A file copied in Finder uploads
// too: its path names a file on this computer, which the box can't read.

// MAX_ATTACHMENT is the most the box takes, in bytes.
export const MAX_ATTACHMENT = 20 << 20;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const TEXT_EXT = /\.(txt|md|log|csv|tsv|json|ya?ml|toml|xml|html|css|jsx?|tsx?|go|py|rb|rs|java|kt|swift|c|h|cpp|sh|sql|diff|patch)$/i;

// Where an attachment goes: a running session's worktree, or a worktree an
// agent is about to start in.
export type AttachTarget = { box: string; session: string } | { box: string; location: string; worktree: string };

export interface Attachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

export const isImage = (type: string) => IMAGE_TYPES.includes(type);

// attachable says whether the box takes a file: an image, a PDF or text.
export function attachable(f: File): boolean {
  return isImage(f.type) || f.type === "application/pdf" || f.type.startsWith("text/") || TEXT_EXT.test(f.name);
}

// pastedFiles is the files in a paste or a drop, if any. A screenshot copied
// to the clipboard comes as one image file; an image copied in a browser as
// a file plus HTML (the file wins).
export function pastedFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = [...data.files];
  if (files.length) return files;
  return [...data.items].flatMap((it) => (it.kind === "file" ? [it.getAsFile()].filter((f): f is File => !!f) : []));
}

// A pasted image has no useful name ("image.png"); it is named for when.
export function fileName(f: File): string {
  if (f.name && f.name !== "image.png" && f.name !== "blob") return f.name;
  const ext = f.type === "image/jpeg" ? "jpg" : (f.type.split("/")[1] ?? "png");
  return `pasted-${new Date().toTimeString().slice(0, 8).replaceAll(":", "")}.${ext}`;
}

function base64(f: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error ?? new Error("Couldn't read the file"));
    r.readAsDataURL(f);
  });
}

// uploadAttachment sends a file to the box and resolves to where it is.
export async function uploadAttachment(client: Client, target: AttachTarget, f: File): Promise<Attachment> {
  if (f.size > MAX_ATTACHMENT) throw new Error(`${f.name || "The file"} is ${Math.round(f.size / 2 ** 20)} MB; attachments can be up to 20 MB.`);
  const route =
    "session" in target
      ? `sessions/${encodeURIComponent(target.session)}/attachments`
      : `locations/${encodeURIComponent(target.location)}/worktrees/${encodeURIComponent(target.worktree)}/attachments`;
  return client.box<Attachment>(target.box, "POST", route, { name: fileName(f), data: await base64(f) });
}

// withAttachments is a prompt with the attachments' paths after it, one to a
// line, as Claude Code reads them.
export function withAttachments(text: string, paths: string[]): string {
  if (!paths.length) return text;
  return [text.trim(), paths.join("\n")].filter(Boolean).join("\n\n");
}


// A path pasted as text that names a file on this computer: a screenshot's
// /var/folders/…/Screenshot.png, "Copy as Pathname" in Finder, a file:// URL.
// An agent on a remote box can't read it, so it is uploaded like a pasted
// file, by the laptop agent (POST /v1/boxes/{box}/attach-local).
const LOCAL_PATH = /^(?:file:\/\/)?(?:~\/|\/(?:Users|var\/folders|private\/var|private\/tmp|tmp|Volumes)\/).+\.(?:png|jpe?g|gif|webp|pdf)$/i;

// localPaths is the laptop paths a paste is made of, or none when it is
// anything else (text that only mentions a path stays text).
export function localPaths(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(['"])(.*)\1$/, "$2").replaceAll("\\ ", " "))
    .filter(Boolean);
  if (!lines.length || lines.length > 10 || !lines.every((l) => LOCAL_PATH.test(l))) return [];
  return lines.map((l) => (l.startsWith("file://") ? decodeURIComponent(l.slice(7)) : l));
}

// onThisComputer is true for a box that runs here (a loopback address), where
// a laptop path is the box's own and needs no upload.
export function onThisComputer(address?: string): boolean {
  return !!address && /^(127\.|localhost[:]|\[::1\])/.test(address);
}

// uploadLocalFile has the laptop agent read a file on this computer and
// upload it to the box.
export function uploadLocalFile(client: Client, target: AttachTarget, path: string): Promise<Attachment> {
  const { box, ...to } = target;
  return client.laptop<Attachment>("POST", `/v1/boxes/${encodeURIComponent(box)}/attach-local`, { path, ...to });
}
