import { CopyIcon, FolderGitIcon, GitCommitHorizontalIcon } from "lucide-react";
import { useMemo } from "react";

import { RepoTrustBanner } from "@/components/repo-trust";
import { SkillsPanel } from "@/components/skills/skills-panel";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { flowsApi, type RepoConfig, trustPending } from "@/lib/flows";
import { errorMessage } from "@/lib/format";
import { useProjects } from "@/lib/project-groups";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Stepper } from "@/views/settings/controls";
import { AgentsSection } from "@/views/project/agents-section";
import { EnvSection } from "@/views/project/env-section";
import { FlowsSection } from "@/views/project/flows-section";
import { LayeredScript, Section, SourceBadge } from "@/views/project/parts";
import { ServicesSection } from "@/views/project/services-section";
import { clean, useProjectConfig } from "@/views/project/use-project-config";
import { ViewHeader } from "@/views/view-header";
import { ErrorText } from "@/components/error-note";

const SECTIONS = [
  { id: "scripts", label: "Setup & teardown" },
  { id: "env", label: "Environment" },
  { id: "ports", label: "Ports" },
  { id: "services", label: "Services" },
  { id: "agents", label: "Agents" },
  { id: "flows", label: "Automations" },
  { id: "skills", label: "Skills" },
];

// ProjectView is one repo on one box: how its worktrees are set up, what
// they run, and what runs on its own. Committed config shows through; this
// box can override any of it without touching the repo.
export function ProjectView({ box, location }: { box: string; location: string }) {
  const { config, draft, setDraft, dirty, save, saving, discard, error, reload } = useProjectConfig(box, location);
  const urlPort = useStore((s) => s.status?.proxy.url_port ?? 1377);
  const repo = config?.repo ?? null;

  const trust = config?.repo_trust;
  const untrust = async () => {
    const client = useStore.getState().client;
    if (!client) return;
    try {
      await flowsApi.untrustRepo(client, box, location);
      await useStore.getState().refreshBox(box, ["locations"]);
      toastManager.add({ title: `${box} no longer runs ${location}'s committed config`, type: "success" });
    } catch (err) {
      toastManager.add({ title: "Could not stop trusting the config", description: errorMessage(err), type: "error" });
    }
    void reload();
  };

  const copy = (what: "effective" | "local") => {
    const c = what === "effective" ? config?.effective : config?.local;
    void navigator.clipboard.writeText(`${JSON.stringify(clean(c ?? {}), null, 2)}\n`);
    toastManager.add({
      title: what === "effective" ? "Copied the effective config" : `Copied ${box}'s settings`,
      description: "Paste it into .berth/config.json to commit it. Check the environment for secrets first.",
      type: "success",
    });
  };

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={
          <span className="flex items-center gap-2">
            <FolderGitIcon className="size-3.5 text-muted-foreground" />
            {location}
            <span className="font-normal text-muted-foreground">on</span>
            <MemberSwitcher box={box} location={location} />
          </span>
        }
        description={
          repo ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <GitCommitHorizontalIcon className="size-3 shrink-0" />
              <code className="truncate font-mono">{config?.repo_path}</code>
              <span className="shrink-0 rounded-md border px-1.5 text-[11px]">committed in the repo</span>
              {trustPending(trust) ? (
                <span className="shrink-0 rounded-md border border-warning/30 px-1.5 text-[11px] text-warning-foreground">not trusted on {box}</span>
              ) : (
                trust?.state === "trusted" &&
                (runsAnything(repo) ? (
                  <Button size="xs" variant="ghost" className="shrink-0" onClick={() => void untrust()}>
                    Stop trusting
                  </Button>
                ) : null)
              )}
            </span>
          ) : config ? (
            `No .berth/config.json in the repo yet. Everything here is ${box}'s own.`
          ) : null
        }
        actions={
          <>
            <Menu>
              <MenuTrigger render={<Button size="sm" variant="ghost" disabled={!config} />}>
                <CopyIcon />
                Copy as .berth/config.json
              </MenuTrigger>
              <MenuPopup align="end" className="min-w-64">
                <MenuItem onClick={() => copy("effective")}>
                  <span className="flex flex-col">
                    <span>Everything that applies</span>
                    <span className="text-muted-foreground text-xs">The repo's config with {box}'s changes</span>
                  </span>
                </MenuItem>
                <MenuItem onClick={() => copy("local")}>
                  <span className="flex flex-col">
                    <span>Only {box}'s changes</span>
                    <span className="text-muted-foreground text-xs">To move them into the repo</span>
                  </span>
                </MenuItem>
              </MenuPopup>
            </Menu>
            {dirty && (
              <Button size="sm" variant="ghost" onClick={discard}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty}>
              Save to {box}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-48 shrink-0 border-r px-3 py-6 lg:block">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent hover:text-foreground">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-8 pt-7 pb-24">
            {error && <ErrorText className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-destructive-foreground text-sm" text={error} />}
            {!config ? (
              <div className="space-y-4">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            ) : (
              <>
                <RepoTrustBanner box={box} location={location} config={config} onChanged={() => void reload()} />
                <Section id="scripts" title="Setup & teardown" description="Run in a new worktree after it is made, and before one is removed. A failing teardown keeps the worktree.">
                  <div className="divide-y divide-border/70">
                    <LayeredScript
                      label="Setup"
                      hint="Install dependencies, create the worktree's database, seed it."
                      repo={repo?.setup}
                      local={draft.setup}
                      box={box}
                      placeholder="pnpm install && createdb $BERTH_WORKTREE_SLUG"
                      onChange={(setup) => setDraft({ ...draft, setup })}
                    />
                    <LayeredScript
                      label="Teardown"
                      hint="Drop what setup made, so a removed worktree leaves nothing behind."
                      repo={repo?.archive}
                      local={draft.archive}
                      box={box}
                      placeholder="dropdb --if-exists $BERTH_WORKTREE_SLUG"
                      onChange={(archive) => setDraft({ ...draft, archive })}
                    />
                  </div>
                </Section>

                <EnvSection repo={repo} draft={draft} setDraft={setDraft} box={box} />
                <PortsSection repo={repo} draft={draft} setDraft={setDraft} box={box} />
                <ServicesSection repo={repo} draft={draft} setDraft={setDraft} box={box} location={location} urlPort={urlPort} />
                <AgentsSection repo={repo} draft={draft} setDraft={setDraft} box={box} />
                <FlowsSection box={box} location={location} />
                <section id="skills" className="scroll-mt-6">
                  <SkillsPanel box={box} location={location} />
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortsSection({ repo, draft, setDraft, box }: { repo: RepoConfig | null; draft: RepoConfig; setDraft(c: RepoConfig): void; box: string }) {
  const value = draft.ports || repo?.ports || 1;
  const source = draft.ports ? (repo?.ports ? "override" : "box") : repo?.ports ? "repo" : undefined;
  const names = useMemo(() => ["$BERTH_PORT", ...Array.from({ length: value - 1 }, (_, i) => `$BERTH_PORT_${i + 1}`)], [value]);
  return (
    <Section id="ports" title="Ports" description="Each worktree gets its own block of ports, so every worktree's servers can run at once.">
      <div className="flex items-center gap-6 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            Ports per worktree
            {source && <SourceBadge source={source} box={box} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {names.map((n) => (
              <code key={n} className={cn("rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground")}>
                {n}
              </code>
            ))}
          </div>
        </div>
        {draft.ports && repo?.ports ? (
          <Button size="xs" variant="ghost" onClick={() => setDraft({ ...draft, ports: undefined })}>
            Use the repo's {repo.ports}
          </Button>
        ) : null}
        <Stepper value={value} min={1} max={10} onChange={(ports) => setDraft({ ...draft, ports: ports === (repo?.ports || 1) && !draft.ports ? undefined : ports })} />
      </div>
    </Section>
  );
}

// MemberSwitcher picks which box's copy of the project these settings are
// for: settings are each box's own, so a project on three boxes has three.
function MemberSwitcher({ box, location }: { box: string; location: string }) {
  const { projects } = useProjects();
  const p = projects.find((x) => x.members.some((m) => m.box.name === box && m.loc.name === location));
  if (!p || p.members.length < 2) return <span className="font-normal text-muted-foreground">{box}</span>;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border p-0.5 font-normal text-xs" role="group" aria-label="Box">
      {p.members.map((m) => (
        <button
          key={m.box.name}
          type="button"
          onClick={() => useStore.getState().setView({ kind: "project", box: m.box.name, location: m.loc.name })}
          className={cn("rounded px-1.5 py-0.5", m.box.name === box ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground", m.box.state !== "online" && "opacity-60")}
        >
          {m.box.name}
        </button>
      ))}
    </span>
  );
}

// runsAnything: a committed config with only ports needs no trust.
const runsAnything = (c: RepoConfig | null) =>
  !!c && !!(c.setup || c.archive || Object.keys(c.env ?? {}).length || c.services?.length || c.hooks?.length || c.flows?.length || c.agents?.length);
