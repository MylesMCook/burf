import * as stylex from "@stylexjs/stylex";
import { BookOpenIcon, CheckIcon, ArrowUpCircleIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Card, CardFrameAction, CardFrameDescription, CardFrameFooter, CardFrameHeader, CardFrameTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { type SkillAgent, type SkillRow, type SkillsChange, type SkillsReport, type SkillState, skillSummary, skillsApi } from "@/lib/skills";
import { useStore } from "@/lib/store";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s1: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s2: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,1fr) 7.5rem 7.5rem",
    "alignItems": "center",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s4: {
    "width": "12px",
    "height": "12px",
  },
  s5: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,1fr) 7.5rem 7.5rem",
    "alignItems": "center",
    "rowGap": "4px",
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
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s8: {
    "minWidth": "0px",
    "paddingRight": "12px",
  },
  s9: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s10: {
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
    "fontSize": "12.5px",
  },
  s11: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.375",
  },
  s13: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
  },
  s16: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
    "gap": "4px",
  },
  s17: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--success-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "width": "14px",
    "height": "14px",
  },
  s19: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group\\/cell:hover &)": {
      "opacity": 1,
    },
  },
  s20: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
  },
  s21: {
    "color": "var(--warning-foreground)",
  },
  s22: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
  },
  s23: {
    "opacity": 0.5,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const agentNames: Record<SkillAgent, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

// SkillsPanel shows Burf's skills on one box, for its user or, with a
// location, inside that repository, and installs, updates or removes them.
// hideTitle drops the panel's own title where the page around it already
// names it, as Settings → Agents does.
export function SkillsPanel({ box, location, hideTitle }: { box: string; location?: string; hideTitle?: boolean }) {
  const client = useStore((s) => s.client);
  const [report, setReport] = useState<SkillsReport>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [commit, setCommit] = useState(false);
  const target = location ? "project" : "user";

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setReport(await skillsApi.list(client, box, location));
      setError(undefined);
    } catch (err) {
      setError(plainError(err));
    }
  }, [client, box, location]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (key: string, install: boolean, req: Omit<SkillsChange, "target" | "location" | "commit">) => {
    if (!client) return;
    setBusy(key);
    try {
      const body: SkillsChange = {
        ...req,
        target,
        location,
        commit: install && target === "project" ? commit : undefined,
      };
      setReport(await (install ? skillsApi.install(client, box, body) : skillsApi.uninstall(client, box, body)));
    } catch (err) {
      toastManager.add({
        title: install ? "Could not install" : "Could not remove",
        description: errorMessage(err),
        type: "error",
      });
    } finally {
      setBusy(undefined);
    }
  };

  const states = (s: SkillRow) => (target === "project" ? s.project : s.user);
  const pending = report?.skills.some((s) => report.agents.some((a) => states(s)?.[a] !== "installed")) ?? false;
  const dirs = target === "project" ? report?.project_dirs : report?.user_dirs;

  return (
    <Card clip>
      <CardFrameHeader pad="tight">
        {!hideTitle && (
          <CardFrameTitle row>
            <BookOpenIcon className={sx(paint.s0)} />
            {location ? "Skills in this project" : `Skills on ${box}`}
          </CardFrameTitle>
        )}
        <CardFrameDescription size="xs">
          {location ? "Only agents working in this repository learn them." : "Every agent the box's user runs learns them."} They teach Claude Code and Codex to use Burf.
        </CardFrameDescription>
        <CardFrameAction>
          <Button size="xs" variant={pending ? "default" : "outline"} disabled={!report || !pending || !!busy} onClick={() => change("all", true, { skills: "all", agent: "all" })}>
            {busy === "all" && <Spinner  size="sm"/>}
            {pending ? "Install all" : "All installed"}
          </Button>
        </CardFrameAction>
      </CardFrameHeader>

      <div className={sx(paint.s1)}>
        <div className={sx(paint.s2)}>
          <span>Skill</span>
          {(["claude", "codex"] as const).map((a) => (
            <span key={a} className={sx(paint.s3)}>
              <AgentIcon agent={a} className={sx(paint.s4)} />
              {agentNames[a]}
            </span>
          ))}
        </div>
        {error && <ErrorText className={sx(paint.s5)} text={error} />}
        {!report && !error && (
          <div className={sx(paint.s6)}>
            <Spinner  size="sm"/> Checking {box}…
          </div>
        )}
        {report?.skills.map((s) => (
          <div key={s.name} className={sx(paint.s7)}>
            <div className={sx(paint.s8)}>
              <div className={sx(paint.s9)}>
                <span className={sx(paint.s10)}>{s.name}</span>
                <span className={sx(paint.s11)}>{s.version.slice(0, 7)}</span>
              </div>
              <p className={sx(paint.s12)} title={s.description}>
                {skillSummary(s)}
              </p>
            </div>
            {(["claude", "codex"] as const).map((a) => {
              const key = `${s.name}:${a}`;
              return (
                <StateCell
                  key={a}
                  state={states(s)?.[a]}
                  committed={target === "project" && states(s)?.[a] !== "missing" && s.excluded?.[a] === false}
                  busy={busy === key}
                  disabled={!!busy}
                  onInstall={() => change(key, true, { skills: [s.name], agent: a })}
                  onRemove={() => change(key, false, { skills: [s.name], agent: a })}
                />
              );
            })}
          </div>
        ))}
      </div>

      <CardFrameFooter bar>
        <span className={sx(paint.s13)} title={dirs ? `${dirs.claude}\n${dirs.codex}` : undefined}>
          {dirs ? `${shortDir(dirs.claude)} · ${shortDir(dirs.codex)}` : " "}
        </span>
        {target === "project" && (
          <label className={sx(paint.s14)}>
            <Switch checked={commit} onCheckedChange={setCommit} />
            Commit with the repository
          </label>
        )}
      </CardFrameFooter>
    </Card>
  );
}

function shortDir(dir: string): string {
  return dir.replace(/^\/(Users|home)\/[^/]+/, "~");
}

function StateCell({ state, committed, busy, disabled, onInstall, onRemove }: { state?: SkillState; committed: boolean; busy: boolean; disabled: boolean; onInstall(): void; onRemove(): void }) {
  if (busy) {
    return (
      <span className={sx(paint.s15)}>
        <Spinner  size="md"/>
      </span>
    );
  }
  if (state === "installed") {
    return (
      <span className={[sx(paint.s16), "group/cell"].filter(Boolean).join(" ")}>
        <span className={sx(paint.s17)}>
          <CheckIcon className={sx(paint.s18)} />
          {committed ? "Committed" : "Installed"}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className={sx(paint.s19)}><Button
                size="icon-xs"
                variant="ghost"
                aria-label="Remove"
                disabled={disabled}
                
                onClick={onRemove} /></span>
            }
          >
            <Trash2Icon />
          </TooltipTrigger>
          <TooltipPopup>Remove</TooltipPopup>
        </Tooltip>
      </span>
    );
  }
  if (state === "outdated") {
    return (
      <span className={sx(paint.s20)}>
        <span className={sx(paint.s21)}><Button size="xs" variant="outline" disabled={disabled} onClick={onInstall}>
          <ArrowUpCircleIcon />
          Update
        </Button></span>
      </span>
    );
  }
  return (
    <span className={[sx(paint.s22), !state && sx(paint.s23)].filter(Boolean).join(" ")}>
      <Button size="xs" variant="outline" disabled={disabled || !state} onClick={onInstall}>
        Install
      </Button>
    </span>
  );
}
