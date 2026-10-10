import * as stylex from "@stylexjs/stylex";
import { type HomeWidgetProps, useStorage } from "@berth/plugin";
import { Button, Icon, Textarea, WidgetEmpty } from "@berth/plugin/ui";
import { useState } from "react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "2px",
  },
  s1: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "fontSize": "13px",
    "lineHeight": "24px",
    ":not(#\\#) textarea": {
      "height": "100%",
      "resize": "none",
      "paddingLeft": "8px",
      "paddingRight": "8px",
      "paddingTop": "4px",
      "paddingBottom": "4px",
      "fieldSizing": "fixed",
    },
  },
  s2: {
    "position": "relative",
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "overflow": "hidden",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s3: {
    "minHeight": "20px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
    "lineHeight": "24px",
  },
  s4: {
    "fontWeight": 500,
  },
  s5: {
    "display": "flex",
    "minHeight": "24px",
    "width": "100%",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-sm)",
    "textAlign": "left",
    "fontSize": "13px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s6: {
    "display": "flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "4px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s7: {
    "borderColor": "var(--foreground)",
    "backgroundColor": "var(--foreground)",
    "color": "var(--background)",
  },
  s8: {
    "width": "10px",
    "height": "10px",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s10: {
    "color": "var(--muted-foreground)",
    "textDecoration": "line-through",
  },
  s11: {
    "position": "absolute",
    "right": "4px",
    "bottom": "0px",
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    ":is(.group\\/note:hover &)": {
      "opacity": 1,
    },
  },
  s12: {
    "width": "12px",
    "height": "12px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Notes widget on Home: one note kept on this Mac (the plugin's
// storage), for what doesn't belong to a worktree. Lines written "- [ ]"
// are a checklist, ticked with a click; the rest is text. Click Edit (or
// the note) to change it, Escape or a click away to stop.

const TASK = /^(\s*[-*]\s+)\[( |x|X)\]\s?(.*)$/;

export function toggleLine(text: string, i: number): string {
  const lines = text.split("\n");
  const m = TASK.exec(lines[i] ?? "");
  if (!m) return text;
  lines[i] = `${m[1]}[${m[2] === " " ? "x" : " "}] ${m[3]}`;
  return lines.join("\n");
}

export function HomeNote({ size, preview }: HomeWidgetProps) {
  const [text, setText] = useStorage("home-note", "");
  const [editing, setEditing] = useState(false);
  if (editing && !preview) {
    return (
      <div className={sx(paint.s0)}>
        <Textarea
          unstyled
          autoFocus
          spellCheck={false}
          aria-label="Home note"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value.slice(0, 4000))}
          onBlur={() => setEditing(false)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setEditing(false))}
          placeholder={"Release on Thursday\n- [ ] QA deck signed off\n- [ ] Tell support about the CSV export"}
          className={sx(paint.s1)}
        />
      </div>
    );
  }
  if (!text.trim()) return <WidgetEmpty scene="bottle" title="A note for Home" hint="Plans, a checklist, things to remember. Kept on this Mac." action="Write one" onAction={() => setEditing(true)} compact={size === "s" || size === "m"} />;
  const lines = text.split("\n");
  return (
    <div className={[sx(paint.s2), "group/note"].filter(Boolean).join(" ")}>
      {lines.map((l, i) => {
        const m = TASK.exec(l);
        if (!m)
          return (
            <p key={i} className={[sx(paint.s3), i === 0 && sx(paint.s4)].filter(Boolean).join(" ")}>
              {l}
            </p>
          );
        const done = m[2] !== " ";
        return (
          <button key={i} type="button" role="checkbox" aria-checked={done} onClick={() => setText(toggleLine(text, i))} className={sx(paint.s5)}>
            <span className={[sx(paint.s6), done && sx(paint.s7)].filter(Boolean).join(" ")}>{done && <Icon name="Check" className={sx(paint.s8)} />}</span>
            <span className={[sx(paint.s9), done && sx(paint.s10)].filter(Boolean).join(" ")}>{m[3]}</span>
          </button>
        );
      })}
      <Button size="xs" variant="outline" className={sx(paint.s11)} onClick={() => setEditing(true)}>
        <Icon name="Pencil" className={sx(paint.s12)} />
        Edit
      </Button>
    </div>
  );
}
