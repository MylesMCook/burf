import { type ReactNode, useEffect, useRef } from "react";
import * as stylex from "@stylexjs/stylex";

import { useActiveTheme } from "@/hooks/use-theme";
import { font, radius, color } from "@/styles/tokens.stylex";

const pulse = stylex.keyframes({
  "50%": { opacity: 0.5 },
});
const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  log: {
    maxHeight: 256,
    marginTop: 12,
    overflowY: "auto",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    fontFamily: font.mono,
    fontSize: 11.5,
    lineHeight: 1.55,
  },
  line: { whiteSpace: "pre-wrap", opacity: 0.85, overflowWrap: "anywhere" },
  caret: {
    display: "inline-block",
    marginTop: 2,
    height: 12,
    width: 6,
    verticalAlign: "middle",
  },
  blink: {
    animationName: pulse,
    animationDuration: { default: "2s", [still]: "0s" },
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
    animationIterationCount: "infinite",
  },
  note: { marginTop: 4, whiteSpace: "pre-wrap" },
});

// CommandLog shows a running command's output as a terminal would, in the
// theme's terminal colors, keeping the newest line in view.
export function CommandLog({ lines, error, done }: { lines: string[]; error?: string; done?: boolean }) {
  const t = useActiveTheme().terminal;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length, error, done]);
  const shell = stylex.props(styles.log);
  return (
    <div {...shell} style={{ ...shell.style, background: t.background, color: t.foreground }}>
      {lines.map((l, i) => (
        <div key={i} {...stylex.props(styles.line)}>
          {l || " "}
        </div>
      ))}
      {!done && !error && <Caret color={t.cursor} />}
      {error && <Note color={t.red}>✕ {error}</Note>}
      {done && !error && <Note color={t.green}>✓ Done</Note>}
      <div ref={end} />
    </div>
  );
}

function Caret({ color }: { color: string }) {
  const painted = stylex.props(styles.caret, styles.blink);
  return <span {...painted} style={{ ...painted.style, background: color }} />;
}

function Note({ color, children }: { color: string; children: ReactNode }) {
  const painted = stylex.props(styles.note);
  return (
    <div {...painted} style={{ ...painted.style, color }}>
      {children}
    </div>
  );
}
