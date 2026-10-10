import { SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { confirm } from "@/components/sidebar/confirm";
import type { Location, Worktree } from "@/lib/api";
import { boxNamesWorktrees, renameWorktree, startRenamingWorktree, suggestedTitle, WORKTREE_TITLE_MAX } from "@/lib/worktree-names";
import { color, font, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: "color-mix(in oklab, var(--sidebar-accent) 60%, transparent)",
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
  },
  input: {
    height: 24,
    width: "100%",
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.ring,
    backgroundColor: color.background,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 13,
    color: color.foreground,
    outline: "none",
    boxShadow: "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    "::placeholder": { color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)" },
  },
  hint: { paddingLeft: 2, paddingRight: 2, fontSize: 11, color: color.mutedForeground, lineHeight: 1.375, overflowWrap: "anywhere" },
  branch: { fontFamily: font.mono, fontSize: 10.5, color: "color-mix(in oklab, var(--foreground) 75%, transparent)" },
  suggest: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: 4,
    borderRadius: radius.md,
    paddingLeft: 2,
    paddingRight: 2,
    textAlign: "left",
    fontSize: 11,
    color: { default: color.mutedForeground, ":hover": color.foreground },
  },
  spark: { width: 12, height: 12, flexShrink: 0 },
  clip: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

// Renaming a worktree gives it a display name; its branch and folder keep
// theirs. In the sidebar the row turns into a field (double-click, F2, or
// Rename… in its menu); anywhere else the same asks in a dialog.

// branchHint says what stays as it is, under the field.
function branchHint(box: string, wt: Pick<Worktree, "name" | "branch">): string {
  const keeps = wt.branch && wt.branch !== wt.name ? `The branch stays ${wt.branch}` : `The branch stays ${wt.name}`;
  return boxNamesWorktrees(box) === false ? `${keeps}. Kept on this laptop: ${box} is older.` : `${keeps}.`;
}

// openRenameWorktree renames a worktree: in place when its sidebar row is
// on screen (unless inPlace is false), else in a dialog.
export function openRenameWorktree(box: string, loc: Location, wt: Worktree, { inPlace = true } = {}) {
  const row = inPlace && document.querySelector(`[data-testid="worktree-row"][data-worktree="${CSS.escape(`${box}/${wt.name}`)}"]`);
  if (row) return startRenamingWorktree(box, wt.path);
  const suggestion = suggestedTitle(box, wt);
  confirm({
    title: `Rename ${wt.title || wt.name}`,
    description: `A display name for every device you use Burf on. ${branchHint(box, wt)} Leave it empty to show ${wt.name} again.`,
    input: { label: "Display name", initial: wt.title ?? "", placeholder: suggestion ?? wt.name },
    confirm: "Rename",
    run: async (_c, value) => {
      if (!(await renameWorktree(box, loc, wt, value))) throw new Error("It wasn't renamed.");
    },
  });
}

// WorktreeNameField is a sidebar row while it is renamed: the field, then
// what stays as it is and, when its agent's task reads as a name, that name
// to use. Enter or leaving the field saves; Esc puts it back.
export function WorktreeNameField({ box, loc, wt, onDone }: { box: string; loc: Location; wt: Worktree; onDone(): void }) {
  const [v, setV] = useState(wt.title ?? "");
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  // A menu that asked gives focus back to its trigger as it closes: take it
  // after that, and only count a blur once the field has had it.
  const ready = useRef(false);
  const suggestion = suggestedTitle(box, wt);
  useEffect(() => {
    const t = window.setTimeout(() => {
      input.current?.focus();
      input.current?.select();
      ready.current = true;
    }, 60);
    return () => window.clearTimeout(t);
  }, []);
  const finish = (next?: string, refocus = false) => {
    if (done.current) return;
    done.current = true;
    onDone();
    if (next !== undefined) void renameWorktree(box, loc, wt, next);
    // Enter and Esc hand the keyboard back to the row, not to the page.
    if (refocus)
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="worktree-row"][data-worktree="${CSS.escape(`${box}/${wt.name}`)}"]`)?.focus());
  };
  return (
    <div data-testid="worktree-rename" {...stylex.props(styles.field)}>
      <input
        ref={input}
        value={v}
        maxLength={WORKTREE_TITLE_MAX}
        aria-label={`Display name for ${wt.name}`}
        aria-describedby={`wt-hint-${CSS.escape(wt.path)}`}
        placeholder={wt.name}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") finish(v, true);
          if (e.key === "Escape") finish(undefined, true);
        }}
        onBlur={(e) => {
          // A click on the suggestion is not leaving.
          if ((e.relatedTarget as HTMLElement | null)?.dataset?.suggestion !== undefined) return;
          if (ready.current) finish(v);
        }}
        {...stylex.props(styles.input)}
      />
      <span id={`wt-hint-${CSS.escape(wt.path)}`} {...stylex.props(styles.hint)}>
        The branch stays <span {...stylex.props(styles.branch)}>{wt.branch || wt.name}</span>.
        {boxNamesWorktrees(box) === false ? ` Kept on this laptop: ${box} is older.` : ""} Empty shows its name.
      </span>
      {suggestion && suggestion !== v.trim() && (
        <button
          type="button"
          data-suggestion=""
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setV(suggestion);
            input.current?.focus();
          }}
          {...stylex.props(styles.suggest)}
        >
          <SparklesIcon {...stylex.props(styles.spark)} />
          <span {...stylex.props(styles.clip)}>Use “{suggestion}”</span>
        </button>
      )}
    </div>
  );
}
