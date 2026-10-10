import * as stylex from "@stylexjs/stylex";
import { ArchiveIcon, CodeXmlIcon, GlobeIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { TaskComposer } from "@/components/conversation/task-composer";
import { openEditor } from "@/components/editors/open";
import { archiveWorktree } from "@/components/sidebar/actions";
import { toastManager } from "@/components/ui/toast";
import { WorktreeSections } from "@/components/workspace/worktree-sections";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { openBrowserAt, startSession, usePendingStops } from "@/lib/actions";
import { agentLabel, agentOf, type SessionState, sessionName, sessionState } from "@/lib/derive";
import { ago } from "@/lib/format";
import { useRemoval } from "@/lib/removing";
import { NONE, useStore } from "@/lib/store";
import { openSession, type WorktreeRef } from "@/lib/workspaces";
import { sessionWord } from "@/lib/state-model";
import { useTitleAt } from "@/lib/worktree-names";
import { openRemoteChat, useRemoteChats } from "@/lib/remote-chat";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "overflowY": "auto",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "position": "relative",
    "display": "flex",
    "minHeight": "100%",
    "alignItems": "flex-start",
    "justifyContent": "center",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "18vh",
    "paddingBottom": "40px",
  },
  s2: {
    "width": "100%",
    "maxWidth": "560px",
  },
  s3: {
    "marginBottom": "16px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 600,
    "fontSize": "18px",
    "lineHeight": "28px",
    "letterSpacing": "-0.025em",
  },
  s5: {
    "marginTop": "4px",
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s7: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s8: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s9: {
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  s11: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textAlign": "left",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": {
      ":hover": "var(--foreground)",
    },
    "direction": "rtl",
  },
  s12: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "marginTop": "2px",
    "display": "inline-flex",
  },
  s14: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
  },
  s15: {
    "fontWeight": 500,
  },
  s16: {
    "color": "var(--muted-foreground)",
  },
  s17: {
    "marginBottom": "20px",
  },
  s18: {
    "display": "flex",
    "flexDirection": "column",
  },
  s19: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus-visible": "var(--accent)",
    },
    ":not(#\\#) > svg": {
      "width": "16px",
      "height": "16px",
      "flexShrink": 0,
      "color": "var(--muted-foreground)",
    },
  },
  s20: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s21: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s22: {
    "marginTop": "24px",
  },
  s23: {
    "marginTop": "16px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--destructive)",
  },
  s24: {
    "marginTop": "24px",
  },
  s25: {
    "marginBottom": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
  },
  s26: {
    "display": "flex",
    "minHeight": "40px",
    "width": "100%",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s27: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s28: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s29: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s30: {
    "marginTop": "24px",
  },
  s31: {
    "marginBottom": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus-visible": "var(--accent)",
    },
  },
  s33: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s34: {
    "width": "16px",
    "height": "16px",
  },
  s35: {
    "fontFamily": "var(--font-mono)",
  },
  s36: {
    "minWidth": "0px",
    "maxWidth": "60%",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s37: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s38: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "6px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s39: {
    "width": "12px",
    "height": "12px",
  },
  s40: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s41: {
    "marginTop": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The model's words (lib/state-model.ts); a shell is just "open".
const stateWords = (s: SessionState) => (s === "idle" ? "open" : sessionWord(s, true));

// middle shortens a long name in the middle, keeping both ends readable:
// "me/eng-1234-…-checkout".
function middle(s: string, max = 32): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(s.length - (max - 1 - half))}`;
}

interface Row {
  key: string;
  icon: React.ReactNode;
  label: string;
  keys?: string;
  run(): void;
}

// Launcher fills a worktree's workspace while it has no tabs: the composer,
// to start an agent on a task here, then a compact command panel, like an
// empty state in Raycast or Linear: one list of what to start here, each
// with its shortcut, then the agents closed as tabs that are still running,
// to pick up again. Arrow keys move, Enter runs.
export function Launcher({ worktree: ref }: { worktree: WorktreeRef }) {
  useStore((s) => s.boxes[ref.box]?.info);
  const loc = useStore((s) => s.boxes[ref.box]?.locations?.find((l) => l.name === ref.location));
  const branch = loc?.worktrees?.find((w) => w.path === ref.path)?.branch;
  const sessions = useStore((s) => s.boxes[ref.box]?.sessions ?? NONE);
  const stats = useStore((s) => s.boxes[ref.box]?.stats);
  const leaving = useRemoval(ref.box, ref.path);
  const stopping = usePendingStops((s) => s.sessions);
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const name = useTitleAt(ref.box, ref.path) ?? (ref.main ? ref.location : ref.worktree);
  const remote = useRemoteChats(ref.box, ref.main ? ref.location : `${ref.location}/${ref.worktree}`);

  const rows: Row[] = [
    { key: "shell", icon: <SquareTerminalIcon />, label: "New shell", keys: "⌘T", run: () => void startSession("") },
    { key: "browser", icon: <GlobeIcon />, label: "New browser tab", keys: "⌘⇧B", run: () => openBrowserAt("") },
    { key: "editor", icon: <CodeXmlIcon />, label: "Open in editor", keys: "⌘⇧O", run: () => void openEditor({ box: ref.box, path: ref.path }) },
    // Done with it: archive keeps the branch; the sidebar's ⋯ has Remove.
    ...(loc && !ref.main
      ? [{ key: "archive", icon: <ArchiveIcon />, label: "Archive this worktree…", run: () => {
          const wt = loc.worktrees?.find((w) => w.path === ref.path);
          if (wt) archiveWorktree(ref.box, loc, wt);
        } }]
      : []),
  ];

  // The launcher shows while the worktree has no tabs, so every agent still
  // running here is one to pick up (but not one closed a moment ago, which
  // is about to stop).
  const closed = sessions
    .filter((s) => s.dir === ref.path && !s.exited && !stopping.includes(s.name) && agentOf(s))
    .sort((a, b) => (b.state_since ?? b.created).localeCompare(a.state_since ?? a.created));
  const shown = all ? closed : closed.slice(0, 5);

  // Take the keyboard on arrival, unless a dialog or a field has it. The
  // sidebar row that opened the worktree gives it up.
  useEffect(() => {
    if (document.querySelector("textarea[aria-label]")) return;
    const t = window.setTimeout(() => {
      const a = document.activeElement as HTMLElement | null;
      const typing = !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
      if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]") || typing) return;
      list.current?.querySelector<HTMLElement>("[data-row]")?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [ref.path]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    next?.focus();
    e.preventDefault();
  };

  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <div ref={list} onKeyDown={onKeyDown} className={sx(paint.s2)}>
          <header className={sx(paint.s3)}>
            <h1 className={sx(paint.s4)} title={name}>
              {name}
            </h1>
            <div className={sx(paint.s5)}>
              {branch && (
                <Tip label={middle(branch) !== branch ? branch : undefined}>
                  <span className={sx(paint.s6)}>{middle(branch)}</span>
                </Tip>
              )}
              <span className={sx(paint.s7)}>{ref.box}</span>
              <Tip
                width="md"
                label={
                  <span className={sx(paint.s8)}>
                    <span className={sx(paint.s9)}>{ref.path}</span>
                    <span className={sx(paint.s10)}>Click to copy</span>
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(ref.path);
                    toastManager.add({ title: "Copied the path", description: ref.path, type: "success" });
                  }}
                  // Truncated from the left, so the end of the path stays visible.
                  className={sx(paint.s11)}
                >
                  <bdi>{ref.path}</bdi>
                </button>
              </Tip>
            </div>
          </header>

          {/* On its way out (archive or remove): nothing new starts here. */}
          {leaving ? (
            <div role="status" aria-busy="true" className={sx(paint.s12)}>
              <span className={sx(paint.s13)}><Spinner size="lg" muted /></span>
              <div className={sx(paint.s14)}>
                <span className={sx(paint.s15)}>{leaving.kind === "archive" ? "Archiving" : "Removing"} {name}…</span>
                <span className={sx(paint.s16)}>
                  {leaving.script
                    ? `The repo's archive script is running on ${ref.box}. This worktree closes when it finishes, or comes back if it fails.`
                    : `Waiting for ${ref.box}.`}
                </span>
              </div>
            </div>
          ) : (
            <>
            {/* The one way to start work, here: an agent on a task in this
                worktree, or several attempts from its branch. */}
            <div className={sx(paint.s17)}>
              <TaskComposer fixed={{ box: ref.box, location: ref.location, at: ref.main ? ref.location : `${ref.location}/${ref.worktree}`, name, branch }} autoFocus placeholder={`What should an agent do in ${name}?`} />
            </div>
            <div className={sx(paint.s18)}>
              {rows.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  data-row
                  onClick={r.run}
                  className={sx(paint.s19)}
                >
                  <span className={sx(paint.s20)}>{r.icon}</span>
                  <span className={sx(paint.s21)}>{r.label}</span>
                  {r.keys && <Kbd>{r.keys}</Kbd>}
                </button>
              ))}
            </div>
            </>
          )}

          {/* What runs here, each with its URL, then plugins' sections. */}
          <WorktreeSections worktree={ref} className={sx(paint.s22)} />
          {remote.error && <p role="alert" className={sx(paint.s23)}>{remote.error}</p>}
          {remote.chats.length > 0 && <section aria-label="Chats" className={sx(paint.s24)}>
            <h2 className={sx(paint.s25)}>Chats</h2>
            {remote.chats.map((chat) => <button key={chat.id} type="button" onClick={() => openRemoteChat(ref.box, chat, ref)} className={sx(paint.s26)}>
              <AgentIcon agent={chat.agent} /><span className={sx(paint.s27)}>{agentLabel(chat.agent)} chat <span className={sx(paint.s28)}>{chat.id.slice(-8)}</span></span><span className={sx(paint.s29)}>{chat.state}</span>
            </button>)}
          </section>}

          {closed.length > 0 && (
            <section className={sx(paint.s30)}>
              <h2 className={sx(paint.s31)}>Pick up where you left off</h2>
              {shown.map((s) => {
                const state = sessionState(s, stats);
                return (
                  <div
                    key={s.name}
                    data-row
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openSession(ref.box, s)}
                    className={sx(paint.s32)}
                  >
                    <span className={sx(paint.s33)}>
                      <AgentIcon agent={agentOf(s)} className={sx(paint.s34)} />
                    </span>
                    <Tip label={<span className={sx(paint.s35)}>{s.name}</span>}>
                      <span className={sx(paint.s36)}>{sessionName(s, { sessions })}</span>
                    </Tip>
                    {s.title && <span className={sx(paint.s37)}>{agentLabel(agentOf(s)!)}</span>}
                    <span className={sx(paint.s38)}>
                      <StateGlyph state={state} className={sx(paint.s39)} />
                      <span className={sx(paint.s40)}>
                        {stateWords(state)} {ago(s.state_since ?? s.created)}
                      </span>
                    </span>
                    <Button size="xs" variant="outline" onClick={() => openSession(ref.box, s)}>
                      Resume
                    </Button>
                  </div>
                );
              })}
              {closed.length > 5 && (
                <button type="button" onClick={() => setAll(!all)} className={sx(paint.s41)}>
                  {all ? "Show fewer" : `Show all ${closed.length}`}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
