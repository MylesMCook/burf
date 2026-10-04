import { FolderGitIcon, FolderPlusIcon, ServerIcon, ShieldAlertIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Scene } from "@/components/art/scenes";
import { Advanced, type AdvancedValues } from "@/components/new-worktree/advanced";
import { Picker, PickerAction, type PickerItem } from "@/components/new-worktree/picker";
import { RunOn, type RunOnOption } from "@/components/new-worktree/run-on";
import { RepoWants, trustRepo, useRepoTrustFor } from "@/components/repo-trust";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AgentSection } from "@/components/new-worktree/agent-section";
import { StartFrom } from "@/components/new-worktree/smart-input";
import { useBranches, useResolve } from "@/components/new-worktree/use-resolve";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { offerAgentHooks } from "@/lib/agent-hooks";
import { agentPresets } from "@/lib/actions";
import type { Session, TaskResult, Worktree } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { promptFor, type ResolveKind, worktreeSlug } from "@/lib/projects";
import { loadProjects, projectActions, useProjects, useProjectsDoc } from "@/lib/project-groups";
import { type InstalledKitOn, kitsApi } from "@/lib/kits";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { fill, templateVariables } from "@/lib/templates";
import { focusSession, selectWorktree } from "@/lib/workspaces";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { ErrorText } from "@/components/error-note";

const NO_AGENT = "";
const lastAgentKey = (box: string, loc: string) => `berth.newWorktree.agent.${box}/${loc}`;
// A project id from lib/projects now, not the box and location it used to be.
const lastProjectKey = "berth.newWorktree.project.v2";
const lastBoxKey = (project: string) => `berth.newWorktree.box.${project}`;
const presetsOn = (box: string, location: string) => (box ? agentPresets(box, location) : []);

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
      {/* Anchored at the top: Advanced and the agent's options open below,
          and a centred dialog would move its title as they do. */}
      <DialogPopup anchored className="max-h-[min(calc(88vh-2rem),56rem)] sm:max-w-[34rem]" showCloseButton={false}>
        {draft && <Body key={`${draft.box ?? ""}/${draft.location ?? ""}/${draft.template ?? ""}`} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body() {
  const draft = useStore((s) => s.worktreeDraft)!;
  const status = useStore((s) => s.status);
  const templates = useStore((s) => s.templates);

  // Each project once, however many boxes have it: lib/projects groups
  // them, and keeps the person's merges, splits and default box.
  const { projects: everything } = useProjects();
  const loaded = useProjectsDoc((st) => st.loaded);
  // Every online box has said which projects it has.
  const settled = useStore((s) => !!s.status && s.status.boxes.every((b) => b.state !== "online" || s.boxes[b.name]?.locations !== undefined));
  const projects = useMemo(
    () =>
      everything
        .map((p) => ({ ...p, places: p.members.filter((m) => m.loc.repo).map((m): RunOnOption => ({ box: m.box.name, location: m.loc, online: m.box.state === "online" })) }))
        .filter((p) => p.places.some((x) => x.online)),
    [everything],
  );
  const [kits, setKits] = useState<InstalledKitOn[]>([]);
  useEffect(() => {
    const client = useStore.getState().client;
    if (!client) return;
    if (!useProjectsDoc.getState().loaded) void loadProjects();
    kitsApi.installed(client).then(setKits, () => setKits([]));
  }, []);

  // The box a project's worktree goes to unless chosen: its default, the
  // last one used for it, or the first online.
  const pickBox = (id: string) => {
    const p = projects.find((x) => x.id === id);
    const online = p?.places.filter((x) => x.online) ?? [];
    const has = (b?: string) => (b && online.some((x) => x.box === b) ? b : undefined);
    return has(p?.defaultBox) ?? has(load(lastBoxKey(id), "")) ?? online[0]?.box ?? "";
  };

  const draftProject = draft.box && draft.location ? projects.find((p) => p.places.some((x) => x.box === draft.box && x.location.name === draft.location)) : undefined;
  const [project, setProject] = useState(() => {
    if (draftProject) return draftProject.id;
    const last = load(lastProjectKey, "");
    if (projects.some((p) => p.id === last)) return last;
    const sameBox = draft.box && projects.find((p) => p.places.some((x) => x.box === draft.box));
    return (sameBox || projects[0])?.id ?? "";
  });
  const [box, setBox] = useState(() => (draftProject ? draft.box! : pickBox(project)));
  // Set once someone (or the caller) chose a box, so the project's default
  // arriving late does not move it.
  const [boxChosen, setBoxChosen] = useState(!!draftProject);
  const current = projects.find((p) => p.id === project);
  const location = current?.places.find((x) => x.box === box)?.location;
  const locName = location?.name ?? "";

  useEffect(() => {
    if (!boxChosen && loaded && project) setBox(pickBox(project));
    // Once the saved defaults arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
  // The repository's committed config waits to be trusted on this box: say
  // what it would run, and create with or without it.
  const pendingTrust = useRepoTrustFor(box, location?.name, location?.repo_trust);
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

  const chooseProject = (id: string) => {
    setProject(id);
    const b = pickBox(id);
    setBox(b);
    setBoxChosen(false);
    const l = projects.find((p) => p.id === id)?.places.find((x) => x.box === b)?.location.name ?? "";
    setAgent(load(lastAgentKey(b, l), NO_AGENT));
  };

  const chooseBox = (b: string) => {
    setBox(b);
    setBoxChosen(true);
    const l = current?.places.find((x) => x.box === b)?.location.name ?? "";
    setAgent((a) => (presetsOn(b, l).some((p) => p.id === a) ? a : load(lastAgentKey(b, l), NO_AGENT)));
  };

  const setDefault = async (b: string) => {
    if (!current) return;
    try {
      await projectActions.setDefaultBox(current, b);
      toastManager.add({ title: `New ${current?.name ?? "project"} worktrees go to ${b}`, type: "success" });
    } catch (err) {
      toastManager.add({ title: "Could not save the default box", description: errorMessage(err), type: "error" });
    }
  };

  const chooseAgent = (a: string) => {
    setAgent(a);
    if (box) save(lastAgentKey(box, locName), a);
  };

  const projectItems: PickerItem[] = projects.map((p) => ({
    value: p.id,
    label: p.name,
    detail: p.places.length > 1 ? `${p.places.length} boxes` : `on ${p.places[0].box}`,
    icon: <FolderGitIcon className="size-4 shrink-0 text-muted-foreground" />,
    trailing: p.slug ? <span className="font-mono">{p.slug}</span> : undefined,
    keywords: p.places.map((x) => `${x.box} ${x.location.path}`).join(" "),
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

  const submit = async (trustFirst = false) => {
    const client = useStore.getState().client;
    if (!client || !box || !location || busy) return;
    if (input.trim() && pending) return; // wait for the box's answer
    setBusy(true);
    setError(undefined);
    if (trustFirst && pendingTrust) {
      try {
        await trustRepo(box, locName, pendingTrust);
      } catch (err) {
        setError(plainError(err));
        setBusy(false);
        return;
      }
    }
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
      save(lastBoxKey(project), box);
      await useStore.getState().refreshBox(box, ["locations", "sessions"]);
      selectWorktree({ box, location: locName, worktree: wt.name, path: wt.path, main: wt.main });
      if (session) void focusSession(box, session.name);
      if (session) void offerAgentHooks(box, template?.command ?? presets.find((p) => p.id === agent)?.command ?? agent);
      toastManager.add({ title: `Created ${wt.name}`, description: `${wt.branch ?? ""} on ${box}${session ? ` · ${agentItems.find((a) => a.value === agent)?.label} started` : ""}`, type: "success" });
      if (createMore) {
        setInput("");
        setAdv((v) => ({ ...emptyAdvanced, template: v.template, vars: v.vars, prompt: edited.has("prompt") && !resolution ? v.prompt : "" }));
        setEdited(new Set());
      } else {
        useStore.getState().closeNewWorktree();
      }
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };

  // Nothing to make a worktree in: say why, and offer the one way on,
  // instead of a form that can't create anything.
  if (settled && projects.length === 0) return <NoProjects />;

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
          <DialogDescription render={<div />} className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[13px]">
            {location ? (
              <>
                In <span className="truncate text-foreground">{location.slug ?? location.name}</span> on{" "}
                {current && current.places.length > 1 ? (
                  <RunOn options={current.places} value={box} onChange={chooseBox} defaultBox={current.defaultBox} onSetDefault={(b) => void setDefault(b)} kits={kits} />
                ) : (
                  <span className="text-foreground">{box}</span>
                )}{" "}
                <span className="min-w-0 truncate font-mono text-xs">{location.path}</span>
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
        {pendingTrust?.wants && (
          <Alert variant="warning">
            <ShieldAlertIcon />
            <AlertTitle>This repository wants to run commands on {box}</AlertTitle>
            <AlertDescription>
              <p>
                {pendingTrust.state === "changed" ? "Its .berth/config.json changed since it was trusted here." : "Its .berth/config.json has not been trusted on this box."} Without trust, the
                worktree is made but none of this runs.
              </p>
              <RepoWants wants={pendingTrust.wants} />
            </AlertDescription>
          </Alert>
        )}
        {error && <ErrorText className="text-destructive text-sm" text={error} />}
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
          {pendingTrust?.wants && (
            <Button type="button" variant="outline" disabled={busy || !location || (!!input.trim() && pending)} onClick={() => void submit(true)}>
              Trust and create
            </Button>
          )}
          <Button type="submit" loading={busy} disabled={!location || (!!input.trim() && pending)}>
            {pendingTrust?.wants ? "Create without it" : agent ? "Create and start" : "Create worktree"}
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

// NoProjects is the dialog when no online box has a project: with no box
// yet, add one; with none online, see to them; otherwise add a project.
function NoProjects() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE_BOXES);
  const online = boxes.some((b) => b.state === "online");
  const close = () => useStore.getState().closeNewWorktree();
  const state = boxes.length === 0 ? "no-boxes" : !online ? "offline" : "no-projects";
  const copy = {
    "no-boxes": { scene: "dock", title: "No boxes yet", text: "Worktrees live in a project on a box: any VPS or dev machine. Add a box, then a project on it." },
    offline: { scene: "offline", title: "No box is online", text: "Worktrees are made on a box that is online. Check on your boxes in Settings." },
    "no-projects": { scene: "dock", title: "No projects yet", text: "A worktree is made in a project: a git repository on one of your boxes. Add one first." },
  }[state] as { scene: "dock" | "offline"; title: string; text: string };
  const go = () => {
    close();
    if (state === "no-boxes") openAddBox();
    else if (state === "offline") useStore.getState().setView({ kind: "settings", section: "boxes" });
    else useStore.getState().openAddProject();
  };
  return (
    <>
      <DialogHeader className="px-5 pt-5 pb-3">
        <DialogTitle className="text-base">New worktree</DialogTitle>
        <DialogDescription className="text-[13px]">A worktree is made in a project, on one of your boxes.</DialogDescription>
      </DialogHeader>
      <DialogPanel className="px-5 pb-5">
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-8 text-center">
          <Scene name={copy.scene} width={136} className="mb-3" />
          <p className="font-medium text-sm">{copy.title}</p>
          <p className="max-w-xs text-balance text-muted-foreground text-xs">{copy.text}</p>
        </div>
      </DialogPanel>
      <DialogFooter className="items-center px-5 py-3">
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="button" autoFocus onClick={go}>
          {state === "no-projects" ? <FolderPlusIcon /> : <ServerIcon />}
          {state === "no-boxes" ? "Add a box" : state === "offline" ? "Open Boxes" : "Add a project"}
        </Button>
      </DialogFooter>
    </>
  );
}

const NONE_BOXES: { name: string; state: string }[] = [];
