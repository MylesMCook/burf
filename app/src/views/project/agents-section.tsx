import * as stylex from "@stylexjs/stylex";
import { PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react";

import { Tip } from "@/components/tip";
import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentPreset } from "@/lib/api";
import type { RepoConfig } from "@/lib/flows";
import { Section, SourceBadge } from "@/views/project/parts";

const paint = stylex.create({
  s0: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s2: {
    "display": "grid",
    "gridTemplateColumns": "1.25rem 8rem minmax(0,10rem) minmax(0,1fr) auto 3.5rem",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s3: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
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
  s6: {
    "display": "flex",
    "justifyContent": "flex-end",
  },

  s7: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// AgentsSection is how agents start in this repo: the built-ins, replaced
// or added to by id, e.g. claude with --model opus.
export function AgentsSection({ repo, draft, setDraft, box }: { repo: RepoConfig | null; draft: RepoConfig; setDraft(c: RepoConfig): void; box: string }) {
  const committed = repo?.agents ?? [];
  const own = draft.agents ?? [];
  const ids = [...new Set([...committed.map((a) => a.id), ...own.map((a) => a.id)])];
  const setOwn = (agents: AgentPreset[]) => setDraft({ ...draft, agents });
  const update = (i: number, patch: Partial<AgentPreset>) => setOwn(own.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <Section
      id="agents"
      title="Agents"
      description="How agents start in this repo. A preset with a built-in's id (claude, codex, opencode, gemini, cursor) replaces it here."
      actions={
        <Button size="xs" variant="ghost" onClick={() => setOwn([...own, { id: ids.includes("claude") ? `agent-${own.length + 1}` : "claude", name: "", command: "" }])}>
          <PlusIcon />
          Add preset
        </Button>
      }
    >
      {ids.length === 0 ? (
        <p className={sx(paint.s0)}>Using the built-ins. Add a preset to change how one starts, like Claude with a model or flags.</p>
      ) : (
        <div className={[sx(paint.s1), sx(paint.s7)].filter(Boolean).join(" ")}>
          {ids.map((id, row) => {
            const c = committed.find((a) => a.id === id);
            const i = own.findIndex((a) => a.id === id);
            const mine = i >= 0 ? own[i] : undefined;
            const a = mine ?? c!;
            const source = mine ? (c ? "override" : "box") : "repo";
            return (
              <div key={row} className={sx(paint.s2)}>
                <AgentIcon agent={a.id} />
                {mine && !c ? <Input value={mine.id} onChange={(e) => update(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} size="sm" mono text="xs" aria-label="Preset id" /> : <code className={sx(paint.s3)}>{id}</code>}
                {mine ? <Input value={mine.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" size="sm" /> : <span className={sx(paint.s4)}>{a.name}</span>}
                {mine ? (
                  <Input value={mine.command} onChange={(e) => update(i, { command: e.target.value })} placeholder="claude --model opus" size="sm" mono text="xs" spellCheck={false} />
                ) : (
                  <code className={sx(paint.s5)}>{a.command}</code>
                )}
                <SourceBadge source={source} box={box} />
                <span className={sx(paint.s6)}>
                  {!mine && (
                    <Tip label={`Override on ${box}`}>
                      <Button size="icon-xs" variant="ghost" aria-label={`Override ${id} on ${box}`} onClick={() => setOwn([...own, { ...c! }])}>
                        <PlusIcon />
                      </Button>
                    </Tip>
                  )}
                  {mine && (
                    <Tip label={c ? "Use the repo's" : "Remove"}>
                      <Button size="icon-xs" variant="ghost" aria-label={c ? `Use the repo's ${id}` : `Remove ${id}`} onClick={() => setOwn(own.filter((_, j) => j !== i))}>
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
    </Section>
  );
}
