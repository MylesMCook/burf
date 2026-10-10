import * as stylex from "@stylexjs/stylex";
import { PlayIcon, PlusIcon, RotateCwIcon, SquareIcon, SquareTerminalIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { serviceRunning, showServiceTerminal } from "@/components/workspace/service-terminal";
import { sortedWorktrees } from "@/lib/derive";
import { type RepoConfig, type ServiceStatus, flowsApi, type WorktreeService } from "@/lib/flows";
import { errorMessage } from "@/lib/format";
import { NONE, useStore } from "@/lib/store";
import { Section, SourceBadge } from "@/views/project/parts";

const paint = stylex.create({
  s0: {
    "fontFamily": "var(--font-mono)",
  },
  s1: {
    "fontFamily": "var(--font-mono)",
  },
  s2: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s5: {
    "display": "grid",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "display": "grid",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s7: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "display": "flex",
    "justifyContent": "flex-end",
  },
  s10: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
  },
  s11: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "paddingBottom": "4px",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s13: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "16px",
    "rowGap": "6px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s14: {
    "width": "144px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "paddingRight": "2px",
    "paddingLeft": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s17: {
    "backgroundColor": "var(--success)",
  },
  s18: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s19: {
    "fontFamily": "var(--font-mono)",
  },
  s20: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },

  s21: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s22: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 50%, transparent)",
    },
  },
  s23: {
    gridTemplateColumns: "9rem minmax(0,1fr) 5.5rem 5rem auto 3.5rem",
  },
  s24: {
    gridTemplateColumns: "9rem minmax(0,1fr) 5.5rem auto 3.5rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

// ServicesSection is what every worktree runs, each on its own ports, and
// below it, what is running in each worktree right now.
export function ServicesSection({ repo, draft, setDraft, box, location, urlPort }: { repo: RepoConfig | null; draft: RepoConfig; setDraft(c: RepoConfig): void; box: string; location: string; urlPort: number }) {
  const committed = repo?.services ?? [];
  const own = draft.services ?? [];
  const names = [...new Set([...committed.map((s) => s.name), ...own.map((s) => s.name)])];
  const setOwn = (services: WorktreeService[]) => setDraft({ ...draft, services });
  const update = (name: string, patch: Partial<WorktreeService>) => setOwn(own.map((s) => (s.name === name ? { ...s, ...patch } : s)));
  const host = `<worktree>.${location}.${box}.localhost${urlPort === 80 ? "" : `:${urlPort}`}`;
  // Boxes that can run a service in a terminal of its own offer it.
  const terminals = useStore((s) => !!s.boxes[box]?.info?.capabilities?.includes("service.terminal"));
  const cols = terminals ? sx(paint.s23) : sx(paint.s24);

  return (
    <Section
      id="services"
      title="Services"
      description={
        <>
          Long-running programs every worktree runs, like its dev server. Each gets the worktree's environment and listens on its own <code className={sx(paint.s0)}>$BERTH_PORT</code>, reachable at <code className={sx(paint.s1)}>{host}</code>.
        </>
      }
      actions={
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            let n = own.length + committed.length + 1;
            while (names.includes(n === 1 ? "web" : `svc-${n}`)) n++;
            setOwn([...own, { name: n === 1 ? "web" : `svc-${n}`, run: "", autostart: true }]);
          }}
        >
          <PlusIcon />
          Add service
        </Button>
      }
    >
      {names.length === 0 ? (
        <p className={sx(paint.s2)}>
          No services. Add the dev server, for example <code className={sx(paint.s3)}>pnpm dev --port $BERTH_PORT</code>, and every worktree gets its own.
        </p>
      ) : (
        <div className={[sx(paint.s4), sx(paint.s21)].filter(Boolean).join(" ")}>
          <div className={[sx(paint.s5), cols].filter(Boolean).join(" ")}>
            <span>Name</span>
            <span>Run</span>
            <span>Autostart</span>
            {terminals && (
              <Tip label="Run it in a terminal of its own, shown as a tab in each worktree. Ctrl-C there stops it.">
                <span>Terminal</span>
              </Tip>
            )}
            <span />
            <span />
          </div>
          {names.map((name, i) => {
            const c = committed.find((s) => s.name === name);
            const mine = own.find((s) => s.name === name);
            const s = mine ?? c!;
            const source = mine ? (c ? "override" : "box") : "repo";
            const bad = mine && !NAME.test(mine.name);
            return (
              // By position, so renaming a service keeps its field focused.
              <div key={i} className={[sx(paint.s6), cols].filter(Boolean).join(" ")}>
                {mine && !c ? (
                  // Always the same tooltip: switching it on as the name goes bad would remount the field mid-word.
                  <Tip label="Lowercase letters, digits and dashes">
                    <Input value={mine.name} onChange={(e) => update(name, { name: e.target.value })} size="sm" mono text="xs" aria-invalid={!!bad} />
                  </Tip>
                ) : (
                  <code className={sx(paint.s7)}>{name}</code>
                )}
                {mine ? (
                  <Input value={mine.run} onChange={(e) => update(name, { run: e.target.value })} placeholder="pnpm dev --port $BERTH_PORT" size="sm" mono text="xs" spellCheck={false} />
                ) : (
                  <code className={sx(paint.s8)} title={s.run}>
                    {s.run}
                  </code>
                )}
                <Switch checked={!!s.autostart} disabled={!mine} onCheckedChange={(v) => update(name, { autostart: v })} aria-label={`Start ${name} with each new worktree`} />
                {terminals && <Switch checked={!!s.terminal} disabled={!mine} onCheckedChange={(v) => update(name, { terminal: v })} aria-label={`Run ${name} in a terminal tab`} />}
                <SourceBadge source={source} box={box} />
                <span className={sx(paint.s9)}>
                  {!mine && (
                    <Tip label={`Override on ${box}`}>
                      <Button size="icon-xs" variant="ghost" aria-label={`Override ${name} on ${box}`} onClick={() => setOwn([...own, { ...c! }])}>
                        <PlusIcon />
                      </Button>
                    </Tip>
                  )}
                  {mine && (
                    <Tip label={c ? "Use the repo's" : "Remove"}>
                      <Button size="icon-xs" variant="ghost" aria-label={c ? `Use the repo's ${name}` : `Remove ${name}`} onClick={() => setOwn(own.filter((x) => x.name !== name))}>
                        {c ? <Undo2Icon /> : <Trash2Icon />}
                      </Button>
                    </Tip>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <LiveServices box={box} location={location} />
    </Section>
  );
}

// LiveServices shows the saved services' state in each worktree, with
// start, stop and restart.
function LiveServices({ box, location }: { box: string; location: string }) {
  const client = useStore((s) => s.client);
  const loc = useStore((s) => s.boxes[box]?.locations?.find((l) => l.name === location));
  const worktrees = loc ? sortedWorktrees(loc) : NONE;
  const [state, setState] = useState<Record<string, ServiceStatus[] | string>>({});
  const [busy, setBusy] = useState<string>();
  const sessions = useStore((s) => s.boxes[box]?.sessions);

  const load = useCallback(async () => {
    if (!client) return;
    const entries = await Promise.all(
      worktrees.slice(0, 12).map(async (wt) => {
        try {
          return [wt.name, await flowsApi.services(client, box, location, wt.name)] as const;
        } catch (err) {
          return [wt.name, errorMessage(err)] as const;
        }
      }),
    );
    setState(Object.fromEntries(entries));
  }, [client, box, location, worktrees.map((w) => w.name).join(",")]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (wt: string, svc: string, action: "start" | "stop" | "restart") => {
    if (!client) return;
    setBusy(`${wt}/${svc}`);
    try {
      await flowsApi.serviceAction(client, box, location, wt, svc, action);
      await load();
    } finally {
      setBusy(undefined);
    }
  };

  const rows = worktrees.filter((wt) => Array.isArray(state[wt.name]) && (state[wt.name] as ServiceStatus[]).length > 0);
  if (rows.length === 0) return null;
  return (
    <div className={sx(paint.s10)}>
      <div className={sx(paint.s11)}>Running now</div>
      <div className={[sx(paint.s12), sx(paint.s22)].filter(Boolean).join(" ")}>
        {rows.map((wt) => (
          <div key={wt.name} className={sx(paint.s13)}>
            <span className={sx(paint.s14)}>{wt.main ? location : wt.name}</span>
            {(state[wt.name] as ServiceStatus[]).map((s) => {
              const running = s.terminal ? serviceRunning(s, sessions) : s.state === "running" || s.state === "active";
              const key = `${wt.name}/${s.name}`;
              return (
                <span key={s.name} className={sx(paint.s15)}>
                  <span className={[sx(paint.s16), running ? sx(paint.s17) : sx(paint.s18)].filter(Boolean).join(" ")} />
                  <code className={sx(paint.s19)}>{s.name}</code>
                  {s.port && <span className={sx(paint.s20)}>:{s.port}</span>}
                  {s.terminal && s.session && (
                    <Tip label="Show terminal">
                      <Button size="icon-xs" variant="ghost" aria-label={`Show ${s.name}'s terminal in ${wt.name}`} onClick={() => void showServiceTerminal({ box, location, worktree: wt.name }, s)}>
                        <SquareTerminalIcon />
                      </Button>
                    </Tip>
                  )}
                  {running ? (
                    <>
                      <Button size="icon-xs" variant="ghost" aria-label={`Restart ${s.name} in ${wt.name}`} disabled={busy === key} onClick={() => void act(wt.name, s.name, "restart")}>
                        <RotateCwIcon />
                      </Button>
                      <Button size="icon-xs" variant="ghost" aria-label={`Stop ${s.name} in ${wt.name}`} disabled={busy === key} onClick={() => void act(wt.name, s.name, "stop")}>
                        <SquareIcon />
                      </Button>
                    </>
                  ) : (
                    <Button size="icon-xs" variant="ghost" aria-label={`Start ${s.name} in ${wt.name}`} disabled={busy === key} onClick={() => void act(wt.name, s.name, "start")}>
                      <PlayIcon />
                    </Button>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
