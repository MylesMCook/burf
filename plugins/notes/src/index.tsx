import * as stylex from "@stylexjs/stylex";
import { definePlugin, worktreeLocation, type WorktreePanelProps } from "@berth/plugin";
import { Button, Icon, Spinner, Textarea, Tooltip, TooltipPopup, TooltipTrigger } from "@berth/plugin/ui";

import { HomeNote } from "./home";
import { useCallback, useEffect, useRef, useState } from "react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "width": "16px",
    "height": "16px",
  },
  s2: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s3: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "cursor": "help",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
  },
  s7: {
    "maxWidth": "288px",
  },
  s8: {
    "marginLeft": "auto",
  },
  s9: {
    "color": "var(--destructive)",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  s11: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontFamily": "var(--font-mono)",
    "fontSize": "13px",
    "lineHeight": "24px",
    ":not(#\\#) textarea": {
      "height": "100%",
      "resize": "none",
      "paddingLeft": "16px",
      "paddingRight": "16px",
      "paddingTop": "12px",
      "paddingBottom": "12px",
      "fieldSizing": "fixed",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Notes: a scratchpad for each worktree. It lives in the worktree itself, as
// .berth/notes.md, so it travels with the work rather than this laptop, and
// the agents working there can read it ("see .berth/notes.md"). Git ignores
// it through the repository's info/exclude, so it is never committed by
// accident.

export const FILE = ".berth/notes.md";
const LIMIT = 40_000; // what one exec request comfortably carries

export default definePlugin((berth) => {
  berth.addWorktreePanel({ id: "notes", title: "Notes", icon: "NotebookPen", Component: NotesPanel });
  berth.addCommand({ id: "open", title: "Open this worktree's notes", group: "Notes", run: () => berth.openPanel("notes") });
  berth.addHomeWidget({
    id: "note",
    title: "Notes",
    description: "A note or checklist that stays on Home, kept on this Mac.",
    icon: "NotebookPen",
    category: "You",
    sizes: ["m", "s", "t", "l"],
    source: "Kept on this Mac; nothing is read",
    Component: HomeNote,
  });
});

// base64 of UTF-8 text, so any note survives the trip through a shell.
function toBase64(text: string) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

// The write and the git exclude happen in one command on the box.
export function saveCommand(text: string) {
  return [
    "mkdir -p .berth",
    `printf %s '${toBase64(text)}' | base64 -d > ${FILE}.tmp && mv ${FILE}.tmp ${FILE}`,
    `x="$(git rev-parse --git-common-dir 2>/dev/null)/info/exclude"; [ -d "$(dirname "$x")" ] && { grep -qxF '${FILE}' "$x" 2>/dev/null || echo '${FILE}' >> "$x"; }; true`,
  ].join(" && ");
}

type Save = "loading" | "saved" | "unsaved" | "saving" | "error";

function NotesPanel({ berth, box, location, worktree, main }: WorktreePanelProps) {
  const where = worktreeLocation({ location, worktree, main });
  const [text, setText] = useState("");
  const [state, setState] = useState<Save>("loading");
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef("");

  const exec = useCallback((command: string) => berth.orchestrate.exec(box, where, command, "30s"), [berth, box, where]);

  useEffect(() => {
    let live = true;
    exec(`cat ${FILE} 2>/dev/null; true`)
      .then((r) => {
        if (!live) return;
        setText(r.output);
        latest.current = r.output;
        setState("saved");
      })
      .catch((err) => {
        if (!live) return;
        setError(String(err?.message ?? err));
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [exec]);

  const save = useCallback(async () => {
    const value = latest.current;
    setState("saving");
    try {
      const r = await exec(saveCommand(value));
      if (r.exit_code !== 0) throw new Error(r.output.trim() || `exit ${r.exit_code}`);
      setError(undefined);
      // Typing while it saved leaves it unsaved, and saves again.
      setState(latest.current === value ? "saved" : "unsaved");
      if (latest.current !== value) timer.current = setTimeout(() => void save(), 800);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      setState("error");
    }
  }, [exec]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value: string) => {
    if (value.length > LIMIT) return;
    setText(value);
    latest.current = value;
    setState("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  };

  if (state === "loading") {
    return (
      <div className={sx(paint.s0)}>
        <Spinner className={sx(paint.s1)} /> Opening notes…
      </div>
    );
  }

  return (
    <div className={sx(paint.s2)}>
      <header className={sx(paint.s3)}>
        <Icon name="NotebookPen" className={sx(paint.s4)} />
        <span className={sx(paint.s5)}>Notes</span>
        <Tooltip>
          <TooltipTrigger render={<span className={sx(paint.s6)} />}>{FILE}</TooltipTrigger>
          <TooltipPopup className={sx(paint.s7)}>Kept in this worktree on {box} and never committed. Agents here can read it: ask them to check {FILE}.</TooltipPopup>
        </Tooltip>
        <span className={[sx(paint.s8), state === "error" ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")}>
          {state === "saving" ? "Saving…" : state === "unsaved" ? "Edited" : state === "error" ? "Not saved" : "Saved"}
        </span>
        {state === "error" && (
          <Button size="xs" variant="outline" onClick={() => void save()}>
            Retry
          </Button>
        )}
      </header>
      {error && <p className={sx(paint.s11)}>{error}</p>}
      <Textarea
        unstyled
        spellCheck={false}
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            clearTimeout(timer.current);
            void save();
          }
        }}
        placeholder={`Plans, links, things to remember about ${worktree}…\n\nAgents working here can read this file too.`}
        className={sx(paint.s12)}
      />
    </div>
  );
}
