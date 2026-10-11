import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { openComposer } from "@/lib/composer";
import { openUrl } from "@/lib/open-url";
import { SkillsPanel } from "@/components/skills/skills-panel";
import { type AgentReadiness, localAgentReadiness, remoteAgentReadiness } from "@/lib/agent-readiness";
import { useLocalComputer } from "@/lib/local-computer";
import type { AgentPreset } from "@/lib/api";
import { NONE, useStore } from "@/lib/store";
import { Segmented } from "@/views/settings/controls";
import { Code, SettingsGroup, SettingsPage } from "@/views/settings/rows";

const paint = stylex.create({
  s1: {
    "overflowX": "auto",
  },
  s2: {
    "width": "100%",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "fontWeight": 400,
  },
  s5: {
    "width": "128px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "center",
    "fontWeight": 400,
  },
  s6: {
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
  },
  s7: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s9: {
    "width": "14px",
    "height": "14px",
  },
  s10: {
    "marginTop": "2px",
    "paddingLeft": "22px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "textAlign": "center",
  },
  s16: {
    "marginBottom": "8px",
    "display": "flex",
    "alignItems": "flex-end",
    "gap": "12px",
  },
  s17: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s18: {
    "fontWeight": 500,
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s19: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  capability: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const BUILTIN: Pick<AgentPreset, "id" | "name">[] = [
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "opencode", name: "OpenCode" },
  { id: "gemini", name: "Gemini CLI" },
  { id: "cursor", name: "Cursor Agent" },
];

const INSTALL_GUIDES: Record<string, string> = {
  claude: "https://code.claude.com/docs/en/setup",
  codex: "https://developers.openai.com/codex/cli/",
  opencode: "https://opencode.ai/docs/",
  gemini: "https://geminicli.com/docs/get-started/installation/",
  cursor: "https://cursor.com/docs/cli/installation",
};

export function AgentsSection() {
  const local = useLocalComputer();
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const online = boxes.filter((b) => b.state === "online");
  const [skillsBox, setSkillsBox] = useState<string>();
  const shownSkills = online.some((b) => b.name === skillsBox) ? skillsBox! : online[0]?.name;

  // Built-ins first, then each online box's custom presets.
  const found = new Map<string, AgentPreset>();
  for (const b of online) for (const a of data[b.name]?.info?.agents ?? []) if (!found.has(a.id)) found.set(a.id, a);
  const rows = [...BUILTIN.map((a) => found.get(a.id) ?? { ...a, command: "" }), ...[...found.values()].filter((a) => !BUILTIN.some((x) => x.id === a.id))];

  return (
    <SettingsPage
      title="Agents"
      description={
        <>
          Installed agent CLIs and the chat paths Burf supports on This computer and online paired computers. Provider CLIs handle sign-in; installation does not verify authentication. A repository adds its own agents, or changes how one starts, in <Code>.berth/config.json</Code>.
        </>
      }
    >
      <SettingsGroup title="Agent CLIs" description="Installed means the CLI or preset is available. Start chat opens the composer with that computer and provider selected; it starts after you submit. Terminal only uses the existing terminal path.">
        <div className={sx(paint.s1)}>
          <table className={sx(paint.s2)}>
            <thead>
              <tr className={sx(paint.s3)}>
                <th scope="col" className={sx(paint.s4)}>Agent</th>
                <th scope="col" className={sx(paint.s5)}>This computer</th>
                {online.map((b) => (
                  <th scope="col" key={b.name} className={sx(paint.s5)}>
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={sx(paint.s6)}>
                  <td className={sx(paint.s7)}>
                    <div className={sx(paint.s8)}>
                      <AgentIcon agent={a.id} className={sx(paint.s9)} />
                      {a.name}
                    </div>
                    <div className={sx(paint.s10)}>{a.command ? a.command + (a.prompt_flag ? ` ${a.prompt_flag} …` : "") : found.has(a.id) ? "$SHELL -l" : a.id}</div>
                  </td>
                  <td className={sx(paint.s11)}>
                    <ReadinessCell agent={a} computer="This computer" readiness={localAgentReadiness(local, a.id)} onStart={() => openComposer({ mode: "start", place: { kind: "local" }, agents: [{ agent: a.id }] })} />
                  </td>
                  {online.map((b) => (
                    <td key={b.name} className={sx(paint.s11)}>
                      <ReadinessCell
                        agent={a}
                        computer={b.name}
                        readiness={remoteAgentReadiness(data[b.name]?.info, a.id)}
                        blocker={!data[b.name]?.locations ? `Projects on ${b.name} are unavailable.` : !data[b.name]?.locations?.length ? `Add a project on ${b.name} first.` : undefined}
                        onAddProject={() => useStore.getState().openAddLocation(b.name)}
                        onStart={() => {
                          const location = data[b.name]?.locations?.[0]?.name;
                          if (location) openComposer({ mode: "start", place: { kind: "box", box: b.name }, box: b.name, location, where: "main", agents: [{ agent: a.id }] });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsGroup>

      {shownSkills && (
        <section>
          <div className={sx(paint.s16)}>
            <div className={sx(paint.s17)}>
              <h2 className={sx(paint.s18)}>Skills{online.length === 1 ? ` on ${shownSkills}` : ""}</h2>
            </div>
            {online.length > 1 && <Segmented label="Computer" value={shownSkills} options={online.map((b) => ({ value: b.name, label: b.name }))} onChange={setSkillsBox} />}
          </div>
          <SkillsPanel key={shownSkills} box={shownSkills} hideTitle />
        </section>
      )}

      {boxes.length > online.length && <p className={sx(paint.s19)}>Offline paired computers appear here after they reconnect.</p>}
    </SettingsPage>
  );
}

function ReadinessCell({ agent, computer, readiness, blocker, onStart, onAddProject }: {
  agent: Pick<AgentPreset, "id" | "name">;
  computer: string;
  readiness: AgentReadiness;
  blocker?: string;
  onStart(): void;
  onAddProject?(): void;
}) {
  const reasonId = useId();
  if (readiness.mode === "unknown") return <span>Status unavailable</span>;
  const guide = INSTALL_GUIDES[agent.id];
  return (
    <div className={sx(paint.capability)}>
      <span>{readiness.installed ? "Installed" : "Not installed"}</span>
      <div className={sx(paint.s19)}>{readiness.mode === "chat" ? "Chat supported" : readiness.mode === "terminal" ? "Terminal only" : "Unavailable"}</div>
      {readiness.mode === "chat" && (
        <>
          <Button size="xs" variant="outline" aria-label={`Start chat with ${agent.name} on ${computer}`} disabled={!!blocker} aria-describedby={blocker ? reasonId : undefined} onClick={onStart}>Start chat</Button>
          {blocker && <p id={reasonId} className={sx(paint.s19)}>{blocker}</p>}
          {blocker && onAddProject && <Button size="xs" variant="outline" onClick={onAddProject} aria-label={`Add a project on ${computer} for ${agent.name}`}>Add project</Button>}
        </>
      )}
      {!readiness.installed && (
        <>
          <p className={sx(paint.s19)}>{guide ? `Install ${agent.name} and sign in on ${computer}.` : `Configure this preset on ${computer} in .berth/config.json.`}</p>
          {guide && <Button size="xs" variant="outline" aria-label={`${agent.name} installation guide for ${computer}`} onClick={() => void openUrl(guide)}>Install guide</Button>}
        </>
      )}
      {readiness.mode === "terminal" && <p className={sx(paint.s19)}>Burf chat is unavailable for this preset.</p>}
      {readiness.canContinueChat && <div className={sx(paint.s19)}>Continue supported</div>}
    </div>
  );
}
