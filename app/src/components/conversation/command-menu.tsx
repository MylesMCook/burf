import * as stylex from "@stylexjs/stylex";
import { FileIcon, SlashIcon, SquareTerminalIcon, TerminalIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { type AgentCommand, commandIn, KIND_LABEL, rankCommands, searchFiles, useCommandCatalog } from "@/lib/commands";
import { agentLabel } from "@/lib/derive";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "position": {
      "default": "absolute",
      "::before": "absolute",
    },
    "left": {
      "default": 0,
      "::before": 0,
    },
    "right": {
      "default": 0,
      "::before": 0,
    },
    "zIndex": 30,
    "display": "flex",
    "maxHeight": "min(22rem,48vh)",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": {
      "default": "var(--radius-lg)",
      "::before": "calc(var(--radius-lg)-1px)",
    },
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "color": "var(--popover-foreground)",
    "boxShadow": {
      "default": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
      "::before": "light-dark(0 1px --theme(--color-black/4%), 0 -1px --theme(--color-white/6%))",
    },
    "pointerEvents": {
      "::before": "none",
    },
    "top": {
      "::before": 0,
    },
    "bottom": {
      "::before": 0,
    },
  },
  s1: {
    "bottom": "100%",
    "marginBottom": "8px",
  },
  s2: {
    "top": "100%",
    "marginTop": "8px",
  },
  s3: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "padding": "4px",
  },
  s4: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "6px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s5: {
    "display": "flex",
    "minHeight": "32px",
    "cursor": "default",
    "userSelect": "none",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-sm)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
  },
  s6: {
    "display": "flex",
    "minWidth": "0px",
    "flexShrink": 0,
    "alignItems": "baseline",
    "gap": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.7812rem",
  },
  s7: {
    "fontWeight": 500,
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "color": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
  },
  s13: {
    "color": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
  },
  s14: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s15: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.7812rem",
  },
  s16: {
    "color": "var(--muted-foreground)",
  },
  s17: {
    "fontWeight": 500,
  },
  s18: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s21: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s22: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s23: {
    "marginLeft": "auto",
  },
  s24: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.625rem",
  },
  s25: {
    "pointerEvents": "none",
    "position": "absolute",
    "zIndex": 20,
    "display": "flex",
    "height": "20px",
    "minWidth": "0px",
    "maxWidth": "min(72%,32rem)",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "0.6875rem",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "12px",
      "height": "12px",
      "flexShrink": 0,
    },
  },
  s26: {
    "top": "0px",
    "right": "12px",
  },
  s27: {
    "right": "8px",
    "bottom": "8px",
  },
  s28: {
    "display": "flex",
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s29: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  q30: {
    ":is(:root:not(.dark) &)": {
      "backgroundClip": "padding-box",
    },
  },
  q31: {
    "backgroundColor": {
      "[data-highlighted]": "var(--accent)",
    },
    "color": {
      "[data-highlighted]": "var(--accent-foreground)",
    },
  },
  q32: {
    "transform": "translateY(-50%)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// useComposerMenu gives a composer what the agent's own prompt has: "/" at
// the start lists its commands, skills and custom commands, fuzzy-matched,
// with what each is; "@" lists the worktree's files. ↑↓ move, Enter or Tab
// puts the pick in the text (sending stays the composer's), Esc closes. A
// prompt starting "!" or "#", or naming one of the agent's own commands,
// gets a chip saying what the agent does with it. What is typed is sent to
// the agent as typed.
//
// The composer wires it in: onKeyDown first (it says whether it took the
// key), onSelect for the caret, and places menu (over or under it) and chip.

export interface ComposerMenu {
  onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean;
  onSelect(e: React.SyntheticEvent<HTMLTextAreaElement>): void;
  menu: ReactNode;
  chip: ReactNode;
  // The agent's own command the text starts with, when it is one.
  command?: AgentCommand;
}

type Trigger = { kind: "command"; query: string; start: number; end: number } | { kind: "file"; query: string; start: number; end: number };

// triggerAt is what the text asks for at the caret: a command ("/mo" at the
// very start, before any space) or a file ("@chec" after a space or at the
// start).
export function triggerAt(text: string, caret: number): Trigger | undefined {
  const before = text.slice(0, caret);
  const tokenEnd = caret + (text.slice(caret).match(/^\S*/)?.[0].length ?? 0);
  const cmd = before.match(/^\/([^\s/]*)$/);
  if (cmd) return { kind: "command", query: cmd[1], start: 0, end: tokenEnd };
  const at = before.match(/(?:^|\s)@([^\s@]*)$/);
  if (at) return { kind: "file", query: at[1], start: caret - at[1].length - 1, end: tokenEnd };
  return undefined;
}

export function useComposerMenu({ box, session, agent, text, setText, side = "top" }: { box?: string; session?: string; agent?: string; text: string; setText(t: string): void; side?: "top" | "bottom" }): ComposerMenu {
  const cat = useCommandCatalog(box, session);
  const client = useStore((s) => s.client);
  const el = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [hi, setHi] = useState(0);
  // Closed with Esc: stays closed until the token changes.
  const [closed, setClosed] = useState<string>();
  const [files, setFiles] = useState<{ q: string; list: string[] }>();
  const pendingCaret = useRef<number | undefined>(undefined);

  const trigger = useMemo(() => {
    const t = triggerAt(text, Math.min(caret, text.length));
    if (!t || (t.kind === "command" && !cat)) return undefined;
    return t;
  }, [text, caret, cat]);
  const tkey = trigger ? `${trigger.kind}:${trigger.start}:${trigger.query}` : undefined;
  const open = !!trigger && closed !== tkey;

  const commands = useMemo(() => (trigger?.kind === "command" && cat ? rankCommands(cat.commands, trigger.query) : []), [trigger, cat]);

  // Files are asked of the box as the query changes, a moment after typing.
  const fileQuery = open && trigger?.kind === "file" && box && session ? trigger.query : undefined;
  useEffect(() => {
    if (fileQuery === undefined || !box || !session) return;
    let alive = true;
    const t = window.setTimeout(() => {
      searchFiles(client, box, session, fileQuery)
        .then((list) => alive && setFiles({ q: fileQuery, list }))
        .catch(() => alive && setFiles({ q: fileQuery, list: [] }));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [fileQuery, client, box, session]);
  const fileList = trigger?.kind === "file" ? (files?.list ?? []) : [];
  const loadingFiles = trigger?.kind === "file" && files?.q !== trigger.query;
  const count = trigger?.kind === "command" ? commands.length : fileList.length;

  useEffect(() => setHi(0), [tkey]);
  // The caret after an insert, once the text is in.
  useEffect(() => {
    if (pendingCaret.current === undefined || !el.current) return;
    const at = pendingCaret.current;
    pendingCaret.current = undefined;
    el.current.focus();
    el.current.setSelectionRange(at, at);
    setCaret(at);
  }, [text]);

  const insert = (value: string) => {
    if (!trigger) return;
    const next = `${text.slice(0, trigger.start)}${value} ${text.slice(trigger.end).replace(/^ /, "")}`;
    pendingCaret.current = trigger.start + value.length + 1;
    setText(next);
  };
  const pick = (i: number) => {
    if (trigger?.kind === "command" && commands[i]) insert(commands[i].name);
    else if (trigger?.kind === "file" && fileList[i]) insert(`@${fileList[i]}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    el.current = e.currentTarget;
    if (!open || e.nativeEvent.isComposing) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setClosed(tkey);
      return true;
    }
    if (!count) return false;
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setHi((h) => (h + 1) % count);
      return true;
    }
    if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setHi((h) => (h - 1 + count) % count);
      return true;
    }
    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      // A command typed out in full goes as it is: Enter sends it.
      if (e.key === "Enter" && trigger?.kind === "command" && commands[hi]?.name === `/${trigger.query}`) return false;
      e.preventDefault();
      pick(hi);
      return true;
    }
    return false;
  };
  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    el.current = e.currentTarget;
    setCaret(e.currentTarget.selectionStart ?? 0);
  };

  const who = agent ? agentLabel(agent) : "The agent";
  const command = commandIn(cat, text);
  const menu = open ? (
    <MenuPanel side={side}>
      {trigger?.kind === "command" ? (
        commands.length ? (
          <OptionList count={commands.length} hi={hi} onHover={setHi} onPick={pick} label={`${who}'s commands`}>
            {(i) => <CommandRow c={commands[i]} active={i === hi} />}
          </OptionList>
        ) : (
          <MenuEmpty>No command matches /{trigger.query}. It is sent as typed.</MenuEmpty>
        )
      ) : fileList.length ? (
        <OptionList count={fileList.length} hi={hi} onHover={setHi} onPick={pick} label="Files in this worktree">
          {(i) => <FileRow path={fileList[i]} />}
        </OptionList>
      ) : loadingFiles ? (
        <MenuEmpty>
          <Spinner  size="md"/> Looking through the worktree…
        </MenuEmpty>
      ) : (
        <MenuEmpty>No file matches @{trigger?.query}.</MenuEmpty>
      )}
      <MenuFooter kind={trigger?.kind ?? "command"} />
    </MenuPanel>
  ) : null;

  const chip = !open ? <PromptChip text={text} command={command} prefixes={cat?.prefixes} who={who} side={side} /> : null;
  return { onKeyDown, onSelect, menu, chip, command };
}

function MenuPanel({ side, children }: { side: "top" | "bottom"; children: ReactNode }) {
  return (
    <div
      // The composer keeps the keyboard: a click picks without taking it.
      onMouseDown={(e) => e.preventDefault()}
      className={[[sx(paint.s0), sx(paint.q30)].filter(Boolean).join(" "), side === "top" ? sx(paint.s1) : sx(paint.s2)].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

function OptionList({ count, hi, onHover, onPick, label, children }: { count: number; hi: number; onHover(i: number): void; onPick(i: number): void; label: string; children(i: number): ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);
  return (
    <div ref={list} role="listbox" aria-label={label} className={sx(paint.s3)}>
      <div className={sx(paint.s4)}>{label}</div>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="option"
          aria-selected={i === hi}
          data-index={i}
          data-highlighted={i === hi ? "" : undefined}
          onMouseMove={() => i !== hi && onHover(i)}
          onClick={() => onPick(i)}
          className={[sx(paint.s5), sx(paint.q31)].filter(Boolean).join(" ")}
        >
          {children(i)}
        </div>
      ))}
    </div>
  );
}

const KIND_BADGE: Record<AgentCommand["kind"], "outline" | "info" | "success" | "warning" | "secondary"> = { builtin: "outline", custom: "info", skill: "success", plugin: "warning", mcp: "secondary" };

function CommandRow({ c, active }: { c: AgentCommand; active: boolean }) {
  const alias = c.aliases?.length ? c.aliases.join(", ") : undefined;
  return (
    <>
      <span className={sx(paint.s6)}>
        <span className={sx(paint.s7)}>{c.name}</span>
        {c.args && <span className={sx(paint.s8)}>{c.args}</span>}
      </span>
      {/* The highlighted one reads in full, with where it comes from. */}
      <span className={[sx(paint.s9), active ? sx(paint.s10) : sx(paint.s11)].filter(Boolean).join(" ")}>
        {c.description}
        {alias && <span className={sx(paint.s12)}> · {alias}</span>}
        {active && c.source && <span className={sx(paint.s13)}> · from {c.source}</span>}
      </span>
      <Badge variant={KIND_BADGE[c.kind]} size="sm" >
        {KIND_LABEL[c.kind]}
      </Badge>
    </>
  );
}

function FileRow({ path }: { path: string }) {
  const cut = path.lastIndexOf("/");
  return (
    <>
      <FileIcon className={sx(paint.s14)} />
      <span className={sx(paint.s15)}>
        {cut >= 0 && <span className={sx(paint.s16)}>{path.slice(0, cut + 1)}</span>}
        <span className={sx(paint.s17)}>{path.slice(cut + 1)}</span>
      </span>
    </>
  );
}

function MenuEmpty({ children }: { children: ReactNode }) {
  return <div className={sx(paint.s18)}>{children}</div>;
}

function MenuFooter({ kind }: { kind: "command" | "file" }) {
  return (
    <div className={sx(paint.s19)}>
      <span className={sx(paint.s20)}>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> to move
      </span>
      <span className={sx(paint.s21)}>
        <Kbd>↵</Kbd>
        <Kbd>Tab</Kbd> to insert
      </span>
      <span className={sx(paint.s22)}>
        <Kbd>Esc</Kbd> to close
      </span>
      <span className={sx(paint.s23)}>{kind === "command" ? "Sent to the agent as typed" : "Mentioned by path"}</span>
    </div>
  );
}

// PromptChip says what the agent does with what is typed, when it is more
// than a prompt: a shell command, a "#" line, or one of its own commands.
// It floats (over the composer's top edge, or in its corner) and never
// moves or resizes the field.
function PromptChip({ text, command, prefixes, who, side }: { text: string; command?: AgentCommand; prefixes?: Record<string, string>; who: string; side: "top" | "bottom" }) {
  const t = text.trimStart();
  let icon = <SlashIcon />;
  let words: string | undefined;
  if (t.startsWith("!") && t.length > 1) {
    icon = <TerminalIcon />;
    words = prefixes?.["!"] ?? "Runs in the shell";
  } else if (t.startsWith("#") && t.length > 1) {
    words = prefixes?.["#"] ?? "Saves to memory";
    icon = <span className={sx(paint.s24)}>#</span>;
  } else if (command) {
    if (command.screen) {
      icon = <SquareTerminalIcon />;
      words = `${command.name} opens ${who}'s own screen: answer it in the terminal that opens below`;
    } else if (command.local) words = `${command.name} runs in ${who} itself: its output shows here`;
    else words = command.kind === "builtin" ? `${command.name}: ${command.description ?? "one of the agent's commands"}` : `${KIND_LABEL[command.kind]}${command.source ? ` from ${command.source}` : ""}: ${command.description ?? command.name}`;
  }
  if (!words) return null;
  return (
    <div
      role="status"
      className={[sx(paint.s25), side === "top" ? [sx(paint.s26), sx(paint.q32)].filter(Boolean).join(" ") : sx(paint.s27)].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s28)}>{icon}</span>
      <span className={sx(paint.s29)} title={words}>
        {words}
      </span>
    </div>
  );
}
