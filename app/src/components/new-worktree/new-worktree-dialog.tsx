import { FolderGitIcon, FolderPlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Advanced, type AdvancedValues } from "@/components/new-worktree/advanced";
import { Picker, PickerAction, type PickerItem } from "@/components/new-worktree/picker";
import { AgentSection } from "@/components/new-worktree/agent-section";
import { StartFrom } from "@/components/new-worktree/smart-input";
import { useBranches, useResolve } from "@/components/new-worktree/use-resolve";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { agentPresets } from "@/lib/actions";
import type { Location, Session, TaskResult, Worktree } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { promptFor, type ResolveKind, worktreeSlug } from "@/lib/projects";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { fill, templateVariables } from "@/lib/templates";
import { focusSession, selectWorktree } from "@/lib/workspaces";

const NO_AGENT = "";
const SEP = "\u0000";
const lastAgentKey = (box: string, loc: string) => `berth.newWorktree.agent.${box}/${loc}`;
const lastProjectKey = "berth.newWorktree.project";

const emptyAdvanced: AdvancedValues = { name: "", branch: "", base: "", prompt: "", template: "", vars: {} };

// A name for a worktree nobody named: short, readable, unlikely to clash.
const words = ["amber", "brisk", "cedar", "dune", "ember", "fern", "harbor", "iris", "juniper", "kelp", "lumen", "maple", "north", "olive", "pine", "quartz", "reed", "sable", "tidal", "umber"];
const randomName = () => `${words[Math.floor(Math.random() * words.length)]}-${Math.random().toString(36).slice(2, 6)}`;

// NewWorktreeDialog creates a worktree from whatever you have: a name, a
// branch, a pull request or an issue, optionally with an agent already
// working in it. One smart field does the common case; Advanced has the
// details it worked out.
export function NewWorktreeDialog() {
  const draft = useStore((s) => s.worktreeDraft);
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && useStore.getState().closeNewWorktree()}>
      <DialogPopup className="max-h-[min(88vh,56rem)] sm:max-w-[34rem]" showCloseButton={false}>
        {draft && <Body key={`${draft.box ?? ""}/${draft.location ?? ""}/${draft.template ?? ""}`} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body() {
  const draft = useStore((s) => s.worktreeDraft)!;
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const templates = useStore((s) => s.templates);

  // Every repository on every online box, the draft's or the last used first.
  const projects = useMemo(() => {
    const out: { box: string; loc: Location }[] = [];
    for (const b of status?.boxes ?? []) {
      if (b.state !== "online") continue;
      for (const loc of boxes[b.name]?.locations ?? []) if (loc.repo) out.push({ box: b.name, loc });
    }
    return out;
  }, [status, boxes]);

  const initial = () => {
    const want = draft.box && draft.location ? `${draft.box}${SEP}${draft.location}` : load(lastProjectKey, "");
    if (projects.some((p) => `${p.box}${SEP}${p.loc.name}` === want)) return want;
    const sameBox = draft.box && projects.find((p) => p.box === draft.box);
    const p = sameBox || projects[0];
    return p ? `${p.box}${SEP}${p.loc.name}` : "";
  };
  const [project, setProject] = useState(initial);
  const [box, locName] = project ? project.split(SEP) : ["", ""];
  const location = boxes[box]?.locations?.find((l) => l.name === locName);

  const [input, setInput] = useState(draft.name ?? "");
  const [kind, setKind] = useState<ResolveKind>("smart");
  const [agent, setAgent] = useState(() => draft.agent ?? (box ? load(lastAgentKey(box, locName), NO_AGENT) : NO_AGENT));
  const [adv, setAdv] = useState<AdvancedValues>(emptyAdvanced);
  // Fields typed by hand are never overwritten by what the input resolves to.
  const [edited, setEdited] = useState<Set<keyof AdvancedValues>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const { resolution, pending, error: resolveError } = useResolve(box, locName, input, kind);
  const branches = useBranches(box, locName, kind === "branch");
  const presets = box ? agentPresets(box, location) : [];
  const template = templates.find((t) => t.id === adv.template);
  const variables = templateVariables(template);

  const set = (patch: Partial<AdvancedValues>, by?: (keyof AdvancedValues)[]) => {
    setAdv((v) => ({ ...v, ...patch }));
    if (by?.length) setEdited((e) => new Set([...e, ...by]));
  };

  // Follow what the input resolves to, except where typed by hand.
  useEffect(() => {
    setAdv((v) => ({
      ...v,
      name: edited.has("name") ? v.name : (resolution?.name ?? ""),
      branch: edited.has("branch") ? v.branch : (resolution?.branch ?? ""),
      base: edited.has("base") ? v.base : (resolution?.base ?? ""),
      prompt: edited.has("prompt") || !resolution || !agent ? v.prompt : promptFor(resolution) || v.prompt,
    }));
    // edited is read, not followed: typing must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, agent]);

  // A template fills the agent, branch, base and prompt it has.
  useEffect(() => {
    const t = templates.find((x) => x.id === adv.template);
    if (!t) return;
    if (t.agent) setAgent(t.agent);
    setAdv((v) => ({
      ...v,
      branch: t.branch ?? v.branch,
      base: t.base ?? v.base,
      prompt: t.prompt ?? v.prompt,
      vars: Object.fromEntries(templateVariables(t).map((x) => [x.id, v.vars[x.id] ?? x.default ?? ""])),
    }));
    setEdited((e) => new Set([...e, ...(t.branch ? ["branch" as const] : []), ...(t.base ? ["base" as const] : []), ...(t.prompt ? ["prompt" as const] : [])]));
    setShowAdvanced(true);
    // Only when the template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adv.template]);

  useEffect(() => {
    if (draft.template) set({ template: draft.template });
    // Once, for a draft that names a template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseProject = (p: string) => {
    setProject(p);
    const [b, l] = p.split(SEP);
    setAgent(load(lastAgentKey(b, l), NO_AGENT));
  };

  const chooseAgent = (a: string) => {
    setAgent(a);
    if (box) save(lastAgentKey(box, locName), a);
  };

  const projectItems: PickerItem[] = projects.map(({ box: b, loc }) => ({
    value: `${b}${SEP}${loc.name}`,
    label: loc.name,
    detail: `on ${b}`,
    icon: <FolderGitIcon className="size-4 shrink-0 text-muted-foreground" />,
    trailing: loc.slug ? <span className="font-mono">{loc.slug}</span> : undefined,
    keywords: `${loc.path} ${loc.slug ?? ""}`,
  }));

  const agentItems: PickerItem[] = [
    { value: NO_AGENT, label: "No agent", detail: "just the worktree", icon: <span className="size-3.5 shrink-0" /> },
    ...presets.map((p) => ({ value: p.id, label: p.name, icon: <AgentIcon agent={p.id} className="size-3.5" />, trailing: <span className="font-mono">{p.command}</span> })),
  ];

  // If the box cannot resolve the input, it is still a fine name.
  const name = worktreeSlug(adv.name || resolution?.name || (resolveError ? input : ""));
  const placeholders = {
    name: resolution?.name || "generated",
    branch: resolution?.branch || name || "same as name",
    base: `${resolution?.base || location?.default_branch || "main"} (default)`,
  };

  const submit = async () => {
    const client = useStore.getState().client;
    if (!client || !box || !location || busy) return;
    if (input.trim() && pending) return; // wait for the box's answer
    setBusy(true);
    setError(undefined);
    const wtName = name || randomName();
    const values = { ...adv.vars, name: wtName };
    const req = {
      location: locName,
      name: wtName,
      branch: fill(adv.branch.trim(), values) || resolution?.branch || undefined,
      base: adv.base.trim() || resolution?.base || undefined,
      pr: resolution?.pr,
      ref: resolution?.ref,
    };
    try {
      let wt: Worktree;
      let session: Session | undefined;
      if (agent) {
        const res = await client.box<TaskResult>(box, "POST", "tasks", { ...req, agent, command: template?.command, prompt: fill(adv.prompt.trim(), values) || undefined });
        wt = res.worktree;
        session = res.session;
      } else {
        const { location: _, ...body } = req;
        wt = await client.box<Worktree>(box, "POST", `locations/${encodeURIComponent(locName)}/worktrees`, body);
      }
      save(lastProjectKey, project);
      await useStore.getState().refreshBox(box, ["locations", "sessions"]);
      selectWorktree({ box, location: locName, worktree: wt.name, path: wt.path, main: wt.main });
      if (session) void focusSession(box, session.name);
      toastManager.add({ title: `Created ${wt.name}`, description: `${wt.branch ?? ""} on ${box}${session ? ` · ${agentItems.find((a) => a.value === agent)?.label} started` : ""}`, type: "success" });
      if (createMore) {
        setInput("");
        setAdv((v) => ({ ...emptyAdvanced, template: v.template, vars: v.vars, prompt: edited.has("prompt") && !resolution ? v.prompt : "" }));
        setEdited(new Set());
      } else {
        useStore.getState().closeNewWorktree();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const summary = [adv.branch || resolution?.branch || name || "generated name", `from ${adv.base || resolution?.base || location?.default_branch || "default"}`, adv.template && template ? template.name : ""].filter(Boolean).join(" · ");

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
      <DialogHeader className="flex-row items-start gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <DialogTitle className="text-base">New worktree</DialogTitle>
          <DialogDescription className="truncate text-[13px]">
            {location ? (
              <>
                In <span className="text-foreground">{location.slug ?? location.name}</span> on <span className="text-foreground">{box}</span> <span className="font-mono text-xs">{location.path}</span>
              </>
            ) : status ? (
              "Add a repository on an online box to make worktrees in it."
            ) : (
              "Connecting…"
            )}
          </DialogDescription>
        </div>
        <div className="max-w-52 shrink-0">
          <Picker
            variant="chip"
            aria-label="Project"
            items={projectItems}
            value={project}
            onChange={chooseProject}
            placeholder="Choose a project"
            searchPlaceholder="Search projects…"
            footer={(close) => (
              <PickerAction
                icon={<FolderPlusIcon className="size-4" />}
                onClick={() => {
                  close();
                  useStore.getState().openAddProject(box || undefined);
                }}
              >
                Add a project…
              </PickerAction>
            )}
          />
        </div>
      </DialogHeader>

      <DialogPanel className="flex flex-col gap-4 px-5 pb-5">
        <Section label="Start from" hidden>
          <StartFrom value={input} onChange={setInput} kind={kind} onKind={setKind} resolution={resolution} pending={pending} error={resolveError} branches={branches} defaultBranch={location?.default_branch} />
        </Section>
        <Section label="Agent">
          <AgentSection presets={presets} agent={agent} onAgent={chooseAgent} prompt={adv.prompt} onPrompt={(v) => set({ prompt: v }, ["prompt"])} promptRef={promptRef} />
        </Section>
        <Advanced open={showAdvanced} onOpen={setShowAdvanced} summary={summary} v={adv} set={set} placeholders={placeholders} location={location} templates={templates} variables={variables} />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </DialogPanel>

      <DialogFooter className="items-center px-5 py-3 sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <Switch checked={createMore} onCheckedChange={setCreateMore} />
          Create more
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => useStore.getState().closeNewWorktree()}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!location || (!!input.trim() && pending)}>
            {agent ? "Create and start" : "Create worktree"}
            <Kbd className="-me-1 bg-primary-foreground/16 text-primary-foreground/80">⌘↵</Kbd>
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

// Section names a part of the form; hidden keeps the name for screen
// readers where the control already says what it is.
function Section({ label, hidden, children }: { label: string; hidden?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
      <h3 className={hidden ? "sr-only" : "font-medium text-[13px]"}>{label}</h3>
      {children}
    </section>
  );
}
