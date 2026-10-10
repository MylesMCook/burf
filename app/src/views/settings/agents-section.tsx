import * as stylex from "@stylexjs/stylex";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { SkillsPanel } from "@/components/skills/skills-panel";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { AgentPreset } from "@/lib/api";
import { NONE, useStore } from "@/lib/store";
import { Segmented } from "@/views/settings/controls";
import { Code, SettingsGroup, SettingsPage } from "@/views/settings/rows";

const paint = stylex.create({
  s0: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
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
    "width": "96px",
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
  s12: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "width": "16px",
    "height": "16px",
    "color": "var(--success-foreground)",
  },
  s13: {
    "display": "inline-flex",
    "cursor": "help",
    "borderRadius": "var(--radius-md)",
    "color": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s14: {
    "width": "16px",
    "height": "16px",
  },
  s15: {
    "marginTop": "4px",
    "display": "block",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
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
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// How to put each built-in agent on a box's PATH.
const INSTALL: Record<string, string> = {
  claude: "npm install -g @anthropic-ai/claude-code",
  codex: "npm install -g @openai/codex",
  opencode: "npm install -g opencode-ai",
  gemini: "npm install -g @google/gemini-cli",
  cursor: "curl https://cursor.com/install -fsS | bash",
};

const BUILTIN: Pick<AgentPreset, "id" | "name">[] = [
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "opencode", name: "OpenCode" },
  { id: "gemini", name: "Gemini CLI" },
  { id: "cursor", name: "Cursor Agent" },
];

export function AgentsSection() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const online = boxes.filter((b) => b.state === "online");
  const [skillsBox, setSkillsBox] = useState<string>();
  const shownSkills = online.some((b) => b.name === skillsBox) ? skillsBox! : online[0]?.name;

  // Every agent any box has, built-ins first, then each box's own.
  const found = new Map<string, AgentPreset>();
  for (const b of online) for (const a of data[b.name]?.info?.agents ?? []) if (!found.has(a.id)) found.set(a.id, a);
  const rows = [...BUILTIN.map((a) => found.get(a.id) ?? { ...a, command: "" }), ...[...found.values()].filter((a) => !BUILTIN.some((x) => x.id === a.id))];

  return (
    <SettingsPage
      title="Agents"
      description={
        <>
          The agent CLIs each box can start, and the skills that teach them to use Burf. A repository adds its own agents, or changes how one starts, in <Code>.berth/config.json</Code>.
        </>
      }
    >
      {online.length === 0 ? (
        <p className={sx(paint.s0)}>No box is online. Agents are listed once one connects.</p>
      ) : (
        <SettingsGroup title="Agent CLIs" description="Found on each box's PATH when berthd checks.">
          <div className={sx(paint.s1)}>
            <table className={sx(paint.s2)}>
              <thead>
                <tr className={sx(paint.s3)}>
                  <th className={sx(paint.s4)}>Agent</th>
                  {online.map((b) => (
                    <th key={b.name} className={sx(paint.s5)}>
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
                      <div className={sx(paint.s10)}>{!found.has(a.id) ? "not found on any box" : a.command ? a.command + (a.prompt_flag ? ` ${a.prompt_flag} …` : "") : "$SHELL -l"}</div>
                    </td>
                    {online.map((b) => {
                      const has = data[b.name]?.info?.agents?.some((x) => x.id === a.id);
                      return (
                        <td key={b.name} className={sx(paint.s11)}>
                          {has ? (
                            <CheckIcon className={sx(paint.s12)} aria-label={`On ${b.name}`} />
                          ) : (
                            <Tooltip>
                              <TooltipTrigger render={<button type="button" className={sx(paint.s13)} />} aria-label={`Not on ${b.name}`}>
                                <MinusIcon className={sx(paint.s14)} />
                              </TooltipTrigger>
                              <TooltipPopup width="72">
                                Not on {b.name}'s PATH.{INSTALL[a.id] && <span className={sx(paint.s15)}>{INSTALL[a.id]}</span>}
                              </TooltipPopup>
                            </Tooltip>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsGroup>
      )}

      {shownSkills && (
        <section>
          <div className={sx(paint.s16)}>
            <div className={sx(paint.s17)}>
              <h2 className={sx(paint.s18)}>Skills{online.length === 1 ? ` on ${shownSkills}` : ""}</h2>
            </div>
            {online.length > 1 && <Segmented label="Box" value={shownSkills} options={online.map((b) => ({ value: b.name, label: b.name }))} onChange={setSkillsBox} />}
          </div>
          <SkillsPanel key={shownSkills} box={shownSkills} hideTitle />
        </section>
      )}

      {boxes.length > online.length && <p className={sx(paint.s19)}>Offline boxes are listed once they reconnect.</p>}
    </SettingsPage>
  );
}
