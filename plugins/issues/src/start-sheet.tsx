import * as stylex from "@stylexjs/stylex";
import { type AgentPreset, type BerthPluginContext, type Project, useStorage } from "@berth/plugin";
import {
  AgentIcon,
  AgentPicker,
  Button,
  Icon,
  Input,
  Kbd,
  PickOne,
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  Skeleton,
  Spinner,
  Textarea,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@berth/plugin/ui";
import { useEffect, useState } from "react";

import * as gh from "./gh";
import { type Run, loadDetail, runnerOf } from "./store";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s1: {
    "gap": "6px",
    "paddingBottom": "12px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s3: {
    "width": "16px",
    "height": "16px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "fontSize": "13px",
  },
  s5: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "20px",
  },
  s6: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "fontWeight": 500,
  },
  s10: {
    "width": "14px",
    "height": "14px",
  },
  s11: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "height": "28px",
    "width": "224px",
    "borderRadius": "var(--radius-lg)",
  },
  s13: {
    "fontFamily": "var(--font-mono)",
  },
  s14: {
    "display": "block",
  },
  s15: {
    "position": "relative",
  },
  s16: {
    "fontFamily": "var(--font-mono)",
  },
  s17: {
    "position": "absolute",
    "right": "8px",
    "width": "14px",
    "height": "14px",
  },
  s18: {
    "height": "160px",
    "width": "100%",
    "borderRadius": "var(--radius-lg)",
  },
  s19: {
    "minHeight": "160px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
    ":not(#\\#) textarea": {
      "maxHeight": "45vh",
    },
  },
  s20: {
    "minHeight": "128px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "display": "flex",
    "flexDirection": "column",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "fontSize": "13px",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s22: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s23: {
    "width": "48px",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s25: {
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--destructive)",
  },
  s26: {
    "alignItems": "center",
    "justifyContent": {
      "@media (min-width: 640px)": {
        "default": "space-between",
      },
    },
  },
  s27: {
    "display": {
      "default": "none",
      "@media (min-width: 640px)": {
        "default": "flex",
      },
    },
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "alignItems": {
      "@media (min-width: 640px)": {
        "default": "center",
      },
    },
    "gap": {
      "@media (min-width: 640px)": {
        "default": "6px",
      },
    },
  },
  s28: {
    "display": "flex",
    "gap": "8px",
  },
  s29: {
    "width": "14px",
    "height": "14px",
  },
  s30: {
    "width": "14px",
    "height": "14px",
  },
  s31: {
    "marginLeft": "4px",
    "height": "18px",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 15%, transparent)",
    "fontSize": "10px",
    "color": "var(--primary-foreground)",
  },
  s32: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s33: {
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s34: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s35: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s36: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s37: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s38: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--success)",
  },
  s39: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s40: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive)",
  },
  s41: {
    "maxWidth": "45%",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
  },
  s42: {
    "color": "var(--destructive)",
  },
  s43: {
    "color": "var(--muted-foreground)",
  },
  s44: {
    "fontFamily": "var(--font-mono)",
  },
  q46: {
    "top": "50%",
    "transform": "translateY(-50%)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The sheet behind "Start an agent": for one issue, a worktree named by the
// box's resolver, a box, an agent and the first prompt, all editable; for
// several, one agent each, started one after another with a summary.

export interface Target {
  project: Project;
  repo: string;
  number: number;
  title: string;
  runs: Run[];
}

interface Resolution {
  name: string;
  branch: string;
  base?: string;
  exists?: boolean;
  note?: string;
}

type Step = { state: "waiting" } | { state: "working"; what: string } | { state: "started"; worktree: string; box: string } | { state: "skipped"; why: string } | { state: "failed"; why: string };

const enc = encodeURIComponent;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function StartSheet({ berth, targets, onClose, onStarted }: { berth: BerthPluginContext; targets: Target[]; onClose(): void; onStarted?(): void }) {
  const open = targets.length > 0;
  return (
    <Sheet open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <SheetPopup side="right" width="lg">
        {open && <StartForm key={targets.map((t) => `${t.repo}#${t.number}`).join(",")} berth={berth} targets={targets} onClose={onClose} onStarted={onStarted} />}
      </SheetPopup>
    </Sheet>
  );
}

function StartForm({ berth, targets, onClose, onStarted }: { berth: BerthPluginContext; targets: Target[]; onClose(): void; onStarted?(): void }) {
  const single = targets.length === 1 ? targets[0] : undefined;
  const project = targets.every((t) => t.project.id === targets[0].project.id) ? targets[0].project : undefined;
  const [template, setTemplate] = useStorage("template", gh.DEFAULT_TEMPLATE);
  const [lastAgent, setLastAgent] = useStorage("agent", "claude");

  // The box: the project's default unless another is picked. Several
  // projects at once each go to their own.
  const online = project?.members.filter((m) => m.online) ?? [];
  const [box, setBox] = useState(() => (project ? runnerOf(project)?.box : undefined) ?? "");
  const member = project?.members.find((m) => m.box === box);
  const infoBox = box || (targets[0] && runnerOf(targets[0].project)?.box) || "";

  const [presets, setPresets] = useState<AgentPreset[]>();
  const repoAgents = JSON.stringify(member?.location.agents ?? []);
  useEffect(() => {
    let live = true;
    setPresets(undefined);
    if (!infoBox) return;
    berth.api.info(infoBox).then(
      (info) => {
        if (!live) return;
        const repo = JSON.parse(repoAgents) as AgentPreset[];
        const all = [...repo, ...(info.agents ?? []).filter((a) => !repo.some((r) => r.id === a.id))];
        setPresets(all.filter((a) => a.command && a.id !== "shell"));
      },
      () => live && setPresets([]),
    );
    return () => {
      live = false;
    };
  }, [berth, infoBox, repoAgents]);
  const [agent, setAgent] = useState(lastAgent);
  useEffect(() => {
    if (presets?.length && !presets.some((p) => p.id === agent)) setAgent(presets[0].id);
  }, [presets, agent]);

  // One issue: what the box would call its worktree, and the prompt with
  // the issue's body in it.
  const [resolution, setResolution] = useState<Resolution>();
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  useEffect(() => {
    if (!single || !member) return;
    let live = true;
    setResolution(undefined);
    berth.api
      .request<Resolution>(box, "POST", `locations/${enc(member.location.name)}/resolve`, { input: gh.issueUrl(single.repo, single.number), kind: "smart" })
      .catch((): Resolution => ({ name: `issue-${single.number}`, branch: `issue-${single.number}` }))
      .then((r) => {
        if (!live) return;
        setResolution(r);
        if (!nameEdited) setName(unique(r.name, member.location.worktrees?.map((w) => w.name) ?? []));
      });
    return () => {
      live = false;
    };
    // nameEdited is read once, when the answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth, single?.repo, single?.number, box, member?.location.name]);

  const [prompt, setPrompt] = useState<string>();
  const [promptEdited, setPromptEdited] = useState(false);
  useEffect(() => {
    if (!single) return;
    let live = true;
    void loadDetail(berth, single.project, single.number).then((d) => {
      if (live && !promptEdited) setPrompt(gh.renderPrompt(template, single.repo, { number: single.number, title: single.title, body: d?.body, url: d?.url }));
    });
    return () => {
      live = false;
    };
    // Rendered once from the template; edits after that are the person's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth, single?.repo, single?.number]);

  const [steps, setSteps] = useState<Step[]>();
  const [error, setError] = useState<string>();
  const busy = !!steps && steps.some((s) => s.state === "waiting" || s.state === "working");
  const finished = !!steps && !busy;
  const agentName = presets?.find((p) => p.id === agent)?.name ?? agent;

  const ready = !!agent && !busy && (single ? !!member && !!name.trim() && prompt !== undefined : targets.length > 0);

  async function start() {
    if (!ready) return;
    setError(undefined);
    setLastAgent(agent);
    if (!single) setTemplate(template);
    const next: Step[] = targets.map(() => ({ state: "waiting" }));
    const show = () => setSteps([...next]);
    show();
    for (const [i, t] of targets.entries()) {
      const where = project && member ? { box, member } : runnerOf(t.project);
      if (!where) {
        next[i] = { state: "failed", why: `None of ${t.project.name}'s boxes is online.` };
        show();
        continue;
      }
      if (!single && t.runs.length) {
        next[i] = { state: "skipped", why: `already has ${t.runs[0].worktree}` };
        show();
        continue;
      }
      const loc = where.member.location;
      try {
        let wt: Resolution;
        if (single) {
          const n = name.trim();
          wt = { name: n, branch: nameEdited ? n : (resolution?.branch ?? n), base: resolution?.base };
        } else {
          next[i] = { state: "working", what: "Naming the worktree" };
          show();
          const r = await berth.api
            .request<Resolution>(where.box, "POST", `locations/${enc(loc.name)}/resolve`, { input: gh.issueUrl(t.repo, t.number), kind: "smart" })
            .catch((): Resolution => ({ name: `issue-${t.number}`, branch: `issue-${t.number}` }));
          const n = unique(r.name, loc.worktrees?.map((w) => w.name) ?? []);
          wt = { name: n, branch: n === r.name ? r.branch : n, base: r.base };
        }
        let text = prompt ?? "";
        if (!single) {
          next[i] = { state: "working", what: "Reading the issue" };
          show();
          const d = await loadDetail(berth, t.project, t.number);
          text = gh.renderPrompt(template, t.repo, { number: t.number, title: t.title, body: d?.body, url: d?.url });
        }
        next[i] = { state: "working", what: `Starting ${agentName}` };
        show();
        await berth.api.createTask(where.box, {
          location: loc.name,
          name: wt.name,
          branch: wt.branch,
          base: wt.base || loc.default_branch,
          agent,
          prompt: text,
          // One agent comes to the front (or offers to); a batch would bury
          // the person in tabs, so it only reports.
          open: single ? "tab" : undefined,
        });
        next[i] = { state: "started", worktree: wt.name, box: where.box };
      } catch (err) {
        next[i] = { state: "failed", why: message(err) };
      }
      show();
    }
    const started = next.filter((s) => s.state === "started").length;
    if (started) onStarted?.();
    const failed = next.filter((s) => s.state === "failed").length;
    if (single) {
      const s = next[0];
      if (s.state === "started") {
        berth.notify(`${agentName} is on #${single.number}`, `${s.worktree} on ${s.box}`);
        onClose();
      } else if (s.state === "failed") {
        setError(s.why);
        setSteps(undefined);
      }
      return;
    }
    berth.notify(
      started ? `Started ${started} agent${started === 1 ? "" : "s"}` : "No agents started",
      [failed && `${failed} failed`, next.length - started - failed && `${next.length - started - failed} skipped`].filter(Boolean).join(", ") || `${agentName} on each issue`,
    );
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void start();
    }
  };

  return (
    <div className={sx(paint.s0)} onKeyDown={onKeyDown}>
      <SheetHeader className={sx(paint.s1)}>
        <SheetTitle className={sx(paint.s2)}>
          <Icon name="Bot" className={sx(paint.s3)} />
          {single ? `Start an agent on #${single.number}` : `Start ${targets.length} agents`}
        </SheetTitle>
        <SheetDescription className={sx(paint.s4)}>{single ? single.title : project ? `One worktree and agent per issue in ${project.name}, one after another.` : "One worktree and agent per issue, each on its project's default box."}</SheetDescription>
      </SheetHeader>
      <SheetPanel className={sx(paint.s5)}>
        {single && single.runs.length > 0 && (
          <div className={sx(paint.s6)}>
            <Icon name="TriangleAlert" className={sx(paint.s7)} />
            <span className={sx(paint.s8)}>
              <b className={sx(paint.s9)}>{single.runs[0].worktree}</b> on {single.runs[0].box} is already for this issue. This makes another worktree beside it.
            </span>
          </div>
        )}

        {project && online.length > 0 && (
          <Field label="Box" hint={box === project.defaultBox ? "The project's default box." : undefined}>
            <PickOne
              label="Box"
              value={box}
              onChange={setBox}
              options={online.map((m) => ({ value: m.box, label: m.box, icon: <Icon name="Server" className={sx(paint.s10)} /> }))}
            />
          </Field>
        )}

        <Field label="Agent">
          {presets ? (
            presets.length ? (
              <AgentPicker presets={presets} value={agent} onChange={(id: string) => !steps && setAgent(id)} />
            ) : (
              <p className={sx(paint.s11)}>{infoBox} has no agents installed.</p>
            )
          ) : (
            <Skeleton className={sx(paint.s12)} />
          )}
        </Field>

        {single && (
          <Field
            label="Worktree"
            hint={
              resolution ? (
                <>
                  Branch <span className={sx(paint.s13)}>{nameEdited ? name.trim() : resolution.branch}</span>
                  {resolution.exists && !nameEdited ? ", which already exists: the worktree checks it out." : ` from ${resolution.base || member?.location.default_branch || "the default branch"}.`}
                  {resolution.note && <span className={sx(paint.s14)}>{resolution.note}</span>}
                </>
              ) : (
                "Asking the box what to call it…"
              )
            }
          >
            <div className={sx(paint.s15)}>
              <Input
                size="sm"
                className={sx(paint.s16)}
                value={name}
                disabled={!resolution}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value);
                  setNameEdited(true);
                }}
              />
              {!resolution && <Spinner className={[sx(paint.s17), sx(paint.q46)].filter(Boolean).join(" ")} />}
            </div>
          </Field>
        )}

        <Field
          label={single ? "First prompt" : "Prompt for each"}
          hint={
            single ? undefined : (
              <>
                <Code>{"{{number}}"}</Code>, <Code>{"{{title}}"}</Code>, <Code>{"{{body}}"}</Code>, <Code>{"{{url}}"}</Code> and <Code>{"{{repo}}"}</Code> are filled in from each issue.
              </>
            )
          }
        >
          {single ? (
            prompt === undefined ? (
              <Skeleton className={sx(paint.s18)} />
            ) : (
              <Textarea
                className={sx(paint.s19)}
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setPrompt(e.target.value);
                  setPromptEdited(true);
                }}
              />
            )
          ) : (
            <Textarea className={sx(paint.s20)} disabled={!!steps} value={template} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTemplate(e.target.value)} />
          )}
        </Field>

        {!single && (
          <ol className={sx(paint.s21)}>
            {targets.map((t, i) => (
              <li key={`${t.repo}#${t.number}`} className={sx(paint.s22)}>
                <StepIcon step={steps?.[i]} />
                <span className={sx(paint.s23)}>#{t.number}</span>
                <span className={sx(paint.s24)}>{t.title}</span>
                <StepNote step={steps?.[i]} pending={!steps && t.runs.length ? `has ${t.runs[0].worktree}` : undefined} />
              </li>
            ))}
          </ol>
        )}

        {error && <pre className={sx(paint.s25)}>{error}</pre>}
      </SheetPanel>
      <SheetFooter className={sx(paint.s26)}>
        <span className={sx(paint.s27)}>
          {finished ? summary(steps!) : agent && <><AgentIcon agent={agent} /> {single ? `${agentName} opens in a new tab` : `${agentName} on each, one at a time`}</>}
        </span>
        <div className={sx(paint.s28)}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {finished ? "Close" : "Cancel"}
          </Button>
          {!finished && (
            <Button size="sm" onClick={() => void start()} disabled={!ready}>
              {busy ? <Spinner className={sx(paint.s29)} /> : <Icon name="Play" className={sx(paint.s30)} />}
              {single ? "Start agent" : `Start ${targets.length}`}
              <Kbd className={sx(paint.s31)}>⌘↵</Kbd>
            </Button>
          )}
        </div>
      </SheetFooter>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={sx(paint.s32)}>
      <span className={sx(paint.s33)}>{label}</span>
      {children}
      {hint && <span className={sx(paint.s34)}>{hint}</span>}
    </div>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className={sx(paint.s35)}>{children}</code>;

function StepIcon({ step }: { step?: Step }) {
  if (!step || step.state === "waiting") return <Icon name="Circle" className={sx(paint.s36)} />;
  if (step.state === "working") return <Spinner className={sx(paint.s37)} />;
  if (step.state === "started") return <Icon name="CircleCheck" className={sx(paint.s38)} />;
  if (step.state === "skipped") return <Icon name="CircleMinus" className={sx(paint.s39)} />;
  return <Icon name="CircleX" className={sx(paint.s40)} />;
}

function StepNote({ step, pending }: { step?: Step; pending?: string }) {
  const text = !step ? pending : step.state === "working" ? step.what : step.state === "started" ? step.worktree : step.state === "skipped" || step.state === "failed" ? step.why : undefined;
  if (!text) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={[sx(paint.s41), step?.state === "failed" ? sx(paint.s42) : sx(paint.s43), step?.state === "started" && sx(paint.s44)].filter(Boolean).join(" ")}>{text}</span>} />
      <TooltipPopup width="lg">{text}</TooltipPopup>
    </Tooltip>
  );
}

function summary(steps: Step[]) {
  const n = (s: Step["state"]) => steps.filter((x) => x.state === s).length;
  return [`${n("started")} started`, n("skipped") && `${n("skipped")} skipped`, n("failed") && `${n("failed")} failed`].filter(Boolean).join(" · ");
}

// unique keeps a new worktree's name clear of the location's others.
function unique(name: string, taken: string[]) {
  if (!taken.includes(name)) return name;
  for (let i = 2; ; i++) if (!taken.includes(`${name}-${i}`)) return `${name}-${i}`;
}

