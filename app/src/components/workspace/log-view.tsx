import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

import { boxApi } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "wordBreak": "break-all",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "lineHeight": "1.45",
    "userSelect": "text",
  },
  s3: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

interface Props {
  box: string;
  location: string;
  worktree: string;
  service: string;
  visible: boolean;
}

// LogView tails a worktree service's log: read-only, refreshed every two
// seconds while shown, and kept at the bottom unless scrolled up.
export function LogView({ box, location, worktree, service, visible }: Props) {
  const client = useStore((s) => s.client);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const scroller = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    if (!client || !visible) return;
    let stopped = false;
    const load = async () => {
      try {
        const t = await boxApi.serviceLog(client, box, location, worktree, service);
        if (stopped) return;
        setText(t);
        setError(undefined);
      } catch (err) {
        if (!stopped) setError(plainError(err));
      }
    };
    void load();
    const timer = window.setInterval(() => !document.hidden && void load(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [client, visible, box, location, worktree, service]);

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div className={sx(paint.s0)}>
      {error && <ErrorText className={sx(paint.s1)} text={error} />}
      <pre
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className={sx(paint.s2)}
      >
        {text || <span className={sx(paint.s3)}>Nothing logged yet.</span>}
      </pre>
    </div>
  );
}
