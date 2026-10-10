import * as stylex from "@stylexjs/stylex";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { FileGlyph } from "@/components/files/file-bits";
import { Spinner } from "@/components/ui/spinner";
import { agentMarks } from "@/lib/file-marks";
import { dirName, fileName } from "@/lib/file-match";
import { docKey, openDoc, useFiles } from "@/lib/files";
import { useHereRef } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "height": "36px",
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
  s2: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "color": "var(--foreground)",
  },
  s4: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "width": "12px",
    "height": "12px",
  },
  s6: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s7: {
    "margin": "auto",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "margin": "24px",
    "display": "inline-flex",
  },
  s9: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
  },

  s10: {
    maxWidth: "20rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const CodeEditor = lazy(() => import("@/components/files/code-editor"));

// Preview is the highlighted file, read only, at the agent's first change.
export default function Preview({ ws, path }: { ws: string; path: string }) {
  const ref = useHereRef();
  const [shown, setShown] = useState(path);
  // Arrowing through the list fetches only where it rests.
  useEffect(() => {
    const id = window.setTimeout(() => setShown(path), 90);
    return () => window.clearTimeout(id);
  }, [path]);
  useEffect(() => {
    if (ref) void openDoc(ws, ref, shown);
  }, [ws, ref, shown]);
  const doc = useFiles((s) => s.docs[docKey(ws, shown)]);
  const marks = useMemo(() => (doc?.state === "ready" && !doc.binary && !doc.tooLarge ? agentMarks(doc.turn ? doc.turn.before : undefined, doc.agentText, doc.base, doc.text) : undefined), [doc]);
  const hunks = marks?.hunks.length ?? 0;
  return (
    <div className={sx(paint.s0)} data-testid="file-preview" data-path={shown}>
      <div className={sx(paint.s1)}>
        <FileGlyph path={shown} />
        <span className={sx(paint.s2)}>
          {dirName(shown) && <span>{dirName(shown)}/</span>}
          <span className={sx(paint.s3)}>{fileName(shown)}</span>
        </span>
        {doc?.turn && hunks > 0 && (
          <span className={sx(paint.s4)}>
            <AgentIcon agent={doc.turn.agent} className={sx(paint.s5)} />
            {hunks} {hunks === 1 ? "change" : "changes"}
          </span>
        )}
      </div>
      {!doc || doc.state === "loading" ? (
        <div className={sx(paint.s6)}>
          <Spinner  size="lg" muted/>
        </div>
      ) : doc.state !== "ready" || doc.binary || doc.tooLarge ? (
        <p className={[sx(paint.s7), sx(paint.s10)].filter(Boolean).join(" ")}>{doc.reason ?? doc.error ?? (doc.image ? "A picture: open it to see it." : "Nothing to show.")}</p>
      ) : (
        <Suspense fallback={<span className={sx(paint.s8)}><Spinner size="lg" /></span>}>
          <CodeEditor key={shown} path={shown} text={doc.text} changes={marks} readOnly revealLine={marks?.hunks[0]?.from} fontSize={11.5} className={sx(paint.s9)} />
        </Suspense>
      )}
    </div>
  );
}
