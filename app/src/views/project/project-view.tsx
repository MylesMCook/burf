import * as stylex from "@stylexjs/stylex";
import { CopyIcon, FolderGitIcon, GitCommitHorizontalIcon } from "lucide-react";
import { useMemo } from "react";

import { RepoTrustBanner } from "@/components/repo-trust";
import { SkillsPanel } from "@/components/skills/skills-panel";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { flowsApi, type RepoConfig, trustPending } from "@/lib/flows";
import { errorMessage } from "@/lib/format";
import { useProjects } from "@/lib/project-groups";
import { useStore } from "@/lib/store";
import { Stepper } from "@/views/settings/controls";
import { AgentsSection } from "@/views/project/agents-section";
import { EnvSection } from "@/views/project/env-section";
import { FlowsSection } from "@/views/project/flows-section";
import { LayeredScript, Section, SourceBadge } from "@/views/project/parts";
import { ServicesSection } from "@/views/project/services-section";
import { clean, useProjectConfig } from "@/views/project/use-project-config";
import { ViewHeader } from "@/views/view-header";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
  },
  s4: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s5: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
  },
  s6: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s7: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
  },
  s8: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "color": "var(--warning-foreground)",
  },
  s9: {
    "flexShrink": 0,
  },
  s10: {
    "display": "flex",
    "flexDirection": "column",
  },
  s11: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "display": "flex",
    "flexDirection": "column",
  },
  s13: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s15: {
    "display": {
      "default": "none",
      "@media (min-width: 1024px)": {
        "default": "block",
      },
    },
    "width": "192px",
    "flexShrink": 0,
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
  },
  s16: {
    "display": "block",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s17: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s18: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "paddingTop": "28px",
    "paddingBottom": "96px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "32px",
    },
  },
  s19: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "16px",
    },
  },
  s21: {
    "height": "160px",
  },
  s22: {
    "height": "224px",
  },
  s23: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s24: {
    "display": "flex",
    "alignItems": "center",
    "gap": "24px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "14px",
    "paddingBottom": "14px",
  },
  s25: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s26: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s27: {
    "marginTop": "4px",
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "4px",
  },
  s28: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s29: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
  },
  s30: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "2px",
    "fontWeight": 400,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
  },
  s32: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s33: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s34: {
    "opacity": 0.6,
  },

  s35: {
    maxWidth: "48rem",
  },
  s36: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s37: {
    scrollMarginTop: 24,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

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
    <div className={sx(paint.s0)}>
      <ViewHeader
        title={
          <span className={sx(paint.s1)}>
            <FolderGitIcon className={sx(paint.s2)} />
            {location}
            <span className={sx(paint.s3)}>on</span>
            <MemberSwitcher box={box} location={location} />
          </span>
        }
        description={
          repo ? (
            <span className={sx(paint.s4)}>
              <GitCommitHorizontalIcon className={sx(paint.s5)} />
              <code className={sx(paint.s6)}>{config?.repo_path}</code>
              <span className={sx(paint.s7)}>committed in the repo</span>
              {trustPending(trust) ? (
                <span className={sx(paint.s8)}>not trusted on {box}</span>
              ) : (
                trust?.state === "trusted" &&
                (runsAnything(repo) ? (
                  <span className={sx(paint.s9)}><Button size="xs" variant="ghost"  onClick={() => void untrust()}>
                    Stop trusting
                  </Button></span>
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
              <MenuPopup align="end" width={menuWidths.w64}>
                <MenuItem onClick={() => copy("effective")}>
                  <span className={sx(paint.s10)}>
                    <span>Everything that applies</span>
                    <span className={sx(paint.s11)}>The repo's config with {box}'s changes</span>
                  </span>
                </MenuItem>
                <MenuItem onClick={() => copy("local")}>
                  <span className={sx(paint.s12)}>
                    <span>Only {box}'s changes</span>
                    <span className={sx(paint.s13)}>To move them into the repo</span>
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

      <div className={sx(paint.s14)}>
        <nav className={sx(paint.s15)}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={sx(paint.s16)}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className={sx(paint.s17)}>
          <div className={[sx(paint.s18), sx(paint.s35)].filter(Boolean).join(" ")}>
            {error && <ErrorText className={sx(paint.s19)} text={error} />}
            {!config ? (
              <div className={sx(paint.s20)}>
                <div className={sx(paint.s21)}><Skeleton  shape="lg" /></div>
                <div className={sx(paint.s22)}><Skeleton  shape="lg" /></div>
              </div>
            ) : (
              <>
                <RepoTrustBanner box={box} location={location} config={config} onChanged={() => void reload()} />
                <Section id="scripts" title="Setup & teardown" description="Run in a new worktree after it is made, and before one is removed. A failing teardown keeps the worktree.">
                  <div className={[sx(paint.s23), sx(paint.s36)].filter(Boolean).join(" ")}>
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
                <section id="skills" className={sx(paint.s37)}>
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
      <div className={sx(paint.s24)}>
        <div className={sx(paint.s25)}>
          <div className={sx(paint.s26)}>
            Ports per worktree
            {source && <SourceBadge source={source} box={box} />}
          </div>
          <div className={sx(paint.s27)}>
            {names.map((n) => (
              <code key={n} className={sx(paint.s28)}>
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
  if (!p || p.members.length < 2) return <span className={sx(paint.s29)}>{box}</span>;
  return (
    <span className={sx(paint.s30)} role="group" aria-label="Box">
      {p.members.map((m) => (
        <button
          key={m.box.name}
          type="button"
          onClick={() => useStore.getState().setView({ kind: "project", box: m.box.name, location: m.loc.name })}
          className={[sx(paint.s31), m.box.name === box ? sx(paint.s32) : sx(paint.s33), m.box.state !== "online" && sx(paint.s34)].filter(Boolean).join(" ")}
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
