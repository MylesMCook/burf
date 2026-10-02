import { ArrowUpRightIcon, CodeXmlIcon, GlobeIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Scene } from "@/components/art/scenes";
import { openEditor } from "@/components/editors/open";
import { toastManager } from "@/components/ui/toast";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { agentPresets, openBrowserAt, startSession } from "@/lib/actions";
import { portUrl } from "@/lib/browser-url";
import { agentLabel, agentOf, type SessionState, sessionState } from "@/lib/derive";
import { ago } from "@/lib/format";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openSession, useWorkspaces, type WorktreeRef, wsKey } from "@/lib/workspaces";

const stateWords: Record<SessionState, string> = { waiting: "waiting for you", running: "working", finished: "finished", ready: "ready", idle: "open", exited: "exited" };

// middle shortens a long name in the middle, keeping both ends readable:
// "sean/eng-1234-…-billing".
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

// Launcher fills a worktree's workspace while it has no tabs: a compact
// command panel, like an empty state in Raycast or Linear. One list of what
// to start here, each with its shortcut, then the agents closed as tabs that
// are still running, to pick up again. Arrow keys move, Enter runs.
export function Launcher({ worktree: ref }: { worktree: WorktreeRef }) {
  useStore((s) => s.boxes[ref.box]?.info);
  const loc = useStore((s) => s.boxes[ref.box]?.locations?.find((l) => l.name === ref.location));
  const branch = loc?.worktrees?.find((w) => w.path === ref.path)?.branch;
  const services = useStore((s) => s.boxes[ref.box]?.services ?? NONE);
  const sessions = useStore((s) => s.boxes[ref.box]?.sessions ?? NONE);
  const stats = useStore((s) => s.boxes[ref.box]?.stats);
  const urlPort = useStore((s) => s.status?.proxy.url_port);
  const hidden = useWorkspaces((s) => s.spaces[wsKey(ref.box, ref.path)]?.hidden ?? NONE);
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const name = ref.main ? ref.location : ref.worktree;

  const rows: Row[] = [
    ...agentPresets(ref.box, ref.location).map((p) => ({
      key: `agent:${p.id}`,
      icon: <AgentIcon agent={p.id} className="size-4" />,
      label: `New ${p.name}`,
      run: () => void startSession(p.command, { kind: "tab" }, p.name),
    })),
    { key: "shell", icon: <SquareTerminalIcon />, label: "New shell", keys: "⌘T", run: () => void startSession("") },
    { key: "browser", icon: <GlobeIcon />, label: "New browser tab", keys: "⌘⇧B", run: () => openBrowserAt("") },
    { key: "editor", icon: <CodeXmlIcon />, label: "Open in editor", keys: "⌘⇧O", run: () => void openEditor({ box: ref.box, path: ref.path }) },
    ...services
      .filter((s) => s.path === ref.path)
      .sort((a, b) => a.port - b.port)
      .map((s) => ({
        key: `svc:${s.port}`,
        icon: <ArrowUpRightIcon />,
        label: `Open ${s.port}${s.process ? ` · ${s.process}` : ""}`,
        run: () => {
          const u = portUrl(s.port, { ref, services, urlPort });
          if (u) openBrowserAt(u);
        },
      })),
  ];

  const closed = sessions
    .filter((s) => s.dir === ref.path && !s.exited && hidden.includes(s.name) && agentOf(s))
    .sort((a, b) => (b.state_since ?? b.created).localeCompare(a.state_since ?? a.created));
  const shown = all ? closed : closed.slice(0, 5);

  // Take the keyboard on arrival, unless a dialog or a field has it. The
  // sidebar row that opened the worktree gives it up.
  useEffect(() => {
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
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className="flex min-h-full items-start justify-center px-6 pt-[18vh] pb-10">
        <div ref={list} onKeyDown={onKeyDown} className="w-full max-w-[560px]">
          {/* A boat tied up and ready: the same drawing language as a pane
              whose session ended. Fixed size, so nothing below moves. */}
          <div aria-hidden className="mb-3 px-1">
            <Scene name="moored" width={144} />
          </div>
          <header className="mb-4 px-2">
            <h1 className="truncate font-semibold text-lg tracking-tight" title={name}>
              {name}
            </h1>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {branch && (
                <span className="shrink-0 rounded bg-accent px-1.5 py-px font-mono text-[11px]" title={branch}>
                  {middle(branch)}
                </span>
              )}
              <span className="shrink-0 rounded bg-accent px-1.5 py-px font-mono text-[11px]">{ref.box}</span>
              <Tip
                className="max-w-md"
                label={
                  <span className="flex flex-col gap-0.5">
                    <span className="break-all font-mono">{ref.path}</span>
                    <span className="text-muted-foreground">Click to copy</span>
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
                  className="min-w-0 truncate text-left font-mono text-[11px] hover:text-foreground [direction:rtl]"
                >
                  <bdi>{ref.path}</bdi>
                </button>
              </Tip>
            </div>
          </header>

          <div className="flex flex-col">
            {rows.map((r) => (
              <button
                key={r.key}
                type="button"
                data-row
                onClick={r.run}
                className="flex h-9 items-center gap-3 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">{r.icon}</span>
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.keys && <Kbd>{r.keys}</Kbd>}
              </button>
            ))}
          </div>

          {closed.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-1 px-2 font-medium text-muted-foreground text-xs">Pick up where you left off</h2>
              {shown.map((s) => {
                const state = sessionState(s, stats);
                return (
                  <div
                    key={s.name}
                    data-row
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openSession(ref.box, s)}
                    className="flex h-10 items-center gap-3 rounded-md px-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <AgentIcon agent={agentOf(s)} className="size-4" />
                    </span>
                    <Tip label={<span className="font-mono">{s.name}</span>}>
                      <span className="shrink-0">{agentLabel(agentOf(s)!)}</span>
                    </Tip>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-muted-foreground text-xs">
                      <StateGlyph state={state} className="size-3" />
                      <span className="truncate">
                        {stateWords[state]} {ago(s.state_since ?? s.created)}
                      </span>
                    </span>
                    <Button size="xs" variant="outline" onClick={() => openSession(ref.box, s)}>
                      Resume
                    </Button>
                  </div>
                );
              })}
              {closed.length > 5 && (
                <button type="button" onClick={() => setAll(!all)} className={cn("mt-1 px-2 text-muted-foreground text-xs hover:text-foreground")}>
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
