import type { TranscriptItem } from "./transcript.ts";

// A structured chat's side of in-app artifacts. `berthd artifact add`
// answers with a line of its own form (boxcmd.ArtifactLine):
//
//	Artifact 1a2b3c4d5e v1 · chart · p95 before and after
//
// and where a command's output carries it, the chat shows the artifact's
// card there, as the terminal chat does (internal/transcript/localartifacts.go:
// keep the two forms equal). Only the id is taken from the text; the card
// looks it up in the worktree's artifacts, so a forged line shows nothing
// that isn't there.
const LINE = /(?:^|\n)Artifact ([0-9a-f]{10}) v([0-9]{1,6}) · [a-z]{1,16} · ([^\n]{1,200})/g;

export type ChatArtifact = Extract<TranscriptItem, { kind: "artifact" }>;

export function chatArtifacts(item: { id: string; text: string }): ChatArtifact[] {
  if (!item.text.includes("Artifact ")) return [];
  const found: ChatArtifact[] = [];
  for (const m of item.text.matchAll(LINE)) {
    if (found.length === 4) break;
    const version = Number(m[2]);
    found.push({ kind: "artifact", id: `${item.id}:${m[1]}:${version}`, tool: item.id, text: m[3].trim().replace(/ \(no change\)$/, ""), local: m[1], version, updated: version > 1, done: true });
  }
  return found;
}
