import * as stylex from "@stylexjs/stylex";
import { FileCodeIcon, FileIcon, FileImageIcon, FileJsonIcon, FileTextIcon, HashIcon, TriangleAlertIcon } from "lucide-react";

import { Tip } from "@/components/tip";
import { usePreferredEditor } from "@/lib/editors";
import { docKey, isDirty, useFiles } from "@/lib/files";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s1: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s2: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 60%, transparent)",
  },
  n0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The small pieces of the ⌘P picker and File tabs that load with the app:
// a file's icon, its tab's state, and names. The editor and the File tab
// itself are chunks of their own (file-pane.tsx, code-editor.tsx).

export const EDITOR_NAMES: Record<string, string> = { cursor: "Cursor", vscode: "VS Code", windsurf: "Windsurf", zed: "Zed" };
export const useEditorName = () => EDITOR_NAMES[usePreferredEditor() ?? "cursor"] ?? "your editor";
export const AGENT_NAMES: Record<string, string> = { claude: "Claude", codex: "Codex" };
export const agentName = (a?: string) => (a ? (AGENT_NAMES[a] ?? a.charAt(0).toUpperCase() + a.slice(1)) : "The agent");

// FileGlyph is a file's icon in tabs, headers and the picker, by its kind.
export function FileGlyph({ path, className }: { path: string; className?: string }) {
  const cls = [sx(paint.n0), className].filter(Boolean).join(" ");
  if (/\.(tsx?|jsx?|mjs|cjs|go|py|rs|rb|java|kt|swift|c|h|cpp|cs|php|sh|vue|svelte)$/i.test(path)) return <FileCodeIcon className={cls} />;
  if (/\.jsonc?$/i.test(path)) return <FileJsonIcon className={cls} />;
  if (/\.(md|mdx|txt|rst)$/i.test(path)) return <FileTextIcon className={cls} />;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i.test(path)) return <FileImageIcon className={cls} />;
  if (/\.(sql|ya?ml|toml|css|scss|env|ini|lock)$/i.test(path)) return <HashIcon className={cls} />;
  return <FileIcon className={cls} />;
}

// FileTabState is what a File tab says about its file in the strip: the
// agent wrote it under your unsaved edits, or you have unsaved edits.
export function FileTabState({ ws, path }: { ws: string; path: string }) {
  const state = useFiles((s) => {
    const d = s.docs[docKey(ws, path)];
    return !d ? undefined : d.conflict ? "conflict" : isDirty(d) ? "dirty" : undefined;
  });
  if (state === "conflict")
    return (
      <Tip label="Changed on the box under your unsaved edits" side="bottom">
        <TriangleAlertIcon aria-label="Changed under your edits" data-testid="file-tab-conflict" className={sx(paint.s1)} />
      </Tip>
    );
  if (state === "dirty") return <span role="img" aria-label="Unsaved" data-testid="file-tab-dirty" className={sx(paint.s2)} />;
  return null;
}

