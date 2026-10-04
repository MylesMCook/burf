import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { create } from "zustand";

import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { StepHeader } from "@/components/step-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { agentPresets } from "@/lib/actions";
import { errorMessage } from "@/lib/format";
import { boxHasRuns, runs, scheduleRuns } from "@/lib/runs";
import { load, save } from "@/lib/storage";
import { NONE, useStore } from "@/lib/store";

// "Try N ways…": one task, several agents, each in its own worktree. The box
// runs the attempts template: start each attempt, verify it with a check
// (sending the failing tail back for a round or two), have a headless judge
// rank them on diffstat, check status and short summaries, then wait for you
// to pick one in Review's Compare view; the pick gets a draft PR and the
// rest are archived.

export interface AttemptsDraft {
  box: string;
  location: string;
  // A branch to start every attempt from; default the repository's.
  base?: string;
  prompt?: string;
  // The attempts to start with, each its agent and, if picked, its model and
  // effort (the composer's agent picker); otherwise the last ones used here.
  agents?: { agent: string; model?: string; effort?: string }[];
}

export const useAttemptsDialog = create<{ draft?: AttemptsDraft }>()(() => ({}));
export const openAttempts = (d: AttemptsDraft) => useAttemptsDialog.setState({ draft: d });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

export function AttemptsDialog() {
  const draft = useAttemptsDialog((s) => s.draft);
  const close = () => useAttemptsDialog.setState({ draft: undefined });
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && close()}>
      <DialogPopup anchored className="sm:max-w-[34rem]" showCloseButton={false}>
        {draft && <Body key={`${draft.box}:${draft.location}`} d={draft} onDone={close} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body({ d, onDone }: { d: AttemptsDraft; onDone(): void }) {
  const presets = agentPresets(d.box, d.location);
  const locations = useStore((s) => s.boxes[d.box]?.locations) ?? NONE;
  const [location, setLocation] = useState(d.location);
  const [prompt, setPrompt] = useState(d.prompt ?? "");
  const [name, setName] = useState("");
  const firstTwo = [presets[0]?.id ?? "claude", presets.find((p) => p.id !== presets[0]?.id)?.id ?? presets[0]?.id ?? "claude"];
  const [agents, setAgents] = useState<{ agent: string; suffix: string; box?: string; model?: string; effort?: string }[]>(() =>
    d.agents?.length ? d.agents.map((a) => ({ ...a, suffix: "" })) : load(`berth.attempts.agents.${d.box}`, firstTwo.map((agent) => ({ agent, suffix: "" }))),
  );
  // Attempts may run on other boxes that have the project too: one run per
  // box, grouped, compared together in Review.
  const boxesData = useStore((s) => s.boxes);
  const otherBoxes = Object.keys(boxesData).filter((b) => b !== d.box && boxHasRuns(b) && boxesData[b]?.locations?.some((l) => l.name === location));
  const [check, setCheck] = useState(() => load(`berth.loop.check.${d.box}/${d.location}`, "pnpm test"));
  const [judge, setJudge] = useState(presets.find((p) => p.id === "claude")?.id ?? presets[0]?.id ?? "claude");
  const [auto, setAuto] = useState(false);
  const [pr, setPr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const runsHere = boxHasRuns(d.box);
  const ready = runsHere && !!prompt.trim() && agents.length >= 2 && !!location;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const n = slugify(name || prompt.split("\n")[0]) || "attempt";
      save(`berth.attempts.agents.${d.box}`, agents);
      if (check.trim()) save(`berth.loop.check.${d.box}/${location}`, check.trim());
      const byBox = new Map<string, typeof agents>();
      for (const a of agents) byBox.set(a.box || d.box, [...(byBox.get(a.box || d.box) ?? []), a]);
      // Across boxes the app compares and picks: each box's run waits at
      // its gate for the pick, made in Review.
      const group = byBox.size > 1 ? `g_${Date.now().toString(36)}` : undefined;
      let first: { box: string; id: string } | undefined;
      for (const [box, list] of byBox) {
        const run = await runs.start(box, {
          template: "attempts",
          group,
          params: {
            location,
            name: n,
            prompt: prompt.trim(),
            base: d.base ?? "",
            attempts: list.map((a) => ({
              agent: a.agent,
              ...(a.model ? { model: a.model } : {}),
              ...(a.effort ? { effort: a.effort } : {}),
              ...(a.suffix.trim() ? { prompt_suffix: a.suffix.trim() } : {}),
            })),
            verify: { check: check.trim() || "true", max_rounds: 2 },
            judge: { by: "agent", agent: judge, criteria: "correctness, tests, the smallest diff that does it" },
            pick: auto && !group ? "auto" : "human",
            then: pr ? { pr: { draft: true } } : {},
          },
        });
        scheduleRuns(box, 0);
        first ??= { box, id: run.id };
      }
      const run = first!;
      toastManager.add({
        type: "success",
        title: `Trying ${agents.length} ways on ${[...byBox.keys()].join(" and ")}`,
        description: auto ? "The judge's pick, if its check passes, gets a draft PR." : "You pick in Review once the judge has ranked them.",
        actionProps: { children: "Compare", onClick: () => useStore.getState().setView({ kind: "review", run: { box: run.box, id: run.id } }) },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <StepHeader title="Try N ways" description="Each agent tries the task in its own worktree; a check verifies them, a judge ranks them, and you pick one." />
      <DialogPanel className="flex flex-col gap-4 px-5 pb-5">
        {!runsHere && <p className="rounded-lg border border-warning/40 bg-warning/8 px-3 py-2 text-sm">{d.box} runs an older berthd without runs. Upgrade it from Settings → Boxes to try several ways.</p>}
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-[13px]">Project</span>
            <SimpleSelect size="sm" className="min-w-0" value={location} onChange={setLocation} options={locations.map((l) => ({ value: l.name, label: l.name }))} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[13px]">Worktree names</span>
            <Input size="sm" className="font-mono" value={name} placeholder={slugify(prompt.split("\n")[0]) || "refunds"} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-[13px]">Task</span>
          <Textarea autoFocus rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Implement partial refunds (issue 412)" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[13px]">Attempts</span>
          {agents.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-muted-foreground text-xs tabular-nums">{i + 1}</span>
              <div className="w-36 shrink-0">
                <SimpleSelect size="sm" className="min-w-0" value={a.agent} onChange={(agent) => setAgents(agents.map((x, j) => (j === i ? { agent, suffix: x.suffix, box: x.box } : x)))} options={presets.map((p) => ({ value: p.id, label: p.name }))} />
              </div>
              {(a.model || a.effort) && (
                <Badge variant="secondary" className="shrink-0">
                  {[a.model, a.effort].filter(Boolean).join(" · ")}
                </Badge>
              )}
              <Input size="sm" value={a.suffix} placeholder="and, for this one… (optional)" onChange={(e) => setAgents(agents.map((x, j) => (j === i ? { ...x, suffix: e.target.value } : x)))} />
              {otherBoxes.length > 0 && (
                <div className="w-28 shrink-0">
                  <SimpleSelect
                    size="sm"
                    className="min-w-0"
                    value={a.box || d.box}
                    onChange={(box) => setAgents(agents.map((x, j) => (j === i ? { ...x, box } : x)))}
                    options={[d.box, ...otherBoxes].map((b) => ({ value: b, label: b }))}
                  />
                </div>
              )}
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove this attempt" disabled={agents.length <= 2} onClick={() => setAgents(agents.filter((_, j) => j !== i))}>
                <MinusIcon />
              </Button>
            </div>
          ))}
          {agents.length < 5 && (
            <Button type="button" size="xs" variant="ghost" className="self-start" onClick={() => setAgents([...agents, { agent: presets[agents.length % Math.max(1, presets.length)]?.id ?? "claude", suffix: "" }])}>
              <PlusIcon />
              Another attempt
            </Button>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[13px]">Check</span>
            <Input className="font-mono" value={check} onChange={(e) => setCheck(e.target.value)} />
            <span className="text-muted-foreground text-xs">Exit 0 passes; a failure sends its failing tail back once.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[13px]">Judge</span>
            <div className="w-36">
              <SimpleSelect size="sm" className="min-w-0" value={judge} onChange={setJudge} options={presets.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={auto} onCheckedChange={setAuto} />
            Take the judge's pick
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={pr} onCheckedChange={setPr} />
            Open a draft PR
          </label>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </DialogPanel>
      <DialogFooter className="items-center px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!ready}>
          Try {agents.length} ways
          <Kbd className="-me-1 bg-primary-foreground/16 text-primary-foreground/80">⌘↵</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}
