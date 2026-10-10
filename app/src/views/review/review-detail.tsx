import * as stylex from "@stylexjs/stylex";
import { CheckCheckIcon, CheckIcon, ChevronDownIcon, GitBranchIcon, GitCommitHorizontalIcon, GitPullRequestIcon, GlobeIcon, MessageSquareReplyIcon, MessageSquareTextIcon, SendIcon, SquareArrowOutUpRightIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tip } from "@/components/tip";
import { AgentIcon } from "@/components/agent-glyph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { boxApi } from "@/lib/api";
import { useShotUrl } from "@/lib/agent-browser";
import { agentLabel } from "@/lib/derive";
import { ago } from "@/lib/format";
import { DiffView, FileRow, type LineComments, type Run } from "@/lib/git/diff-view";
import type { FileChange } from "@/lib/git/parse";
import { useLoops } from "@/lib/loops";
import { addComment, commentsPrompt, dismissComments, type LineComment, pending, removeComment, sendComments, useComments } from "@/lib/review-comments";
import { toastManager } from "@/components/ui/toast";
import { errorMessage } from "@/lib/format";
import { openUrl } from "@/lib/open-url";
import { useStore } from "@/lib/store";
import { useSessionTitle } from "@/hooks/use-session-name";
import type { ApproveMode } from "@/views/review/review-actions";
import { type ReviewEntry, useReview, useReviewName, where } from "@/views/review/review-store";
import { lastMessage } from "@/views/review/summary";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "flexShrink": 0,
    "flexDirection": "column",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "16px",
    "paddingBottom": "12px",
  },
  s2: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s3: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s5: {
    "width": "16px",
    "height": "16px",
  },
  s6: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 600,
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s7: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "marginTop": "4px",
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "8px",
    "rowGap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "display": "inline-flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "fontFamily": "var(--font-mono)",
  },
  s10: {
    "width": "12px",
    "height": "12px",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "color": "var(--muted-foreground)",
  },
  s13: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s14: {
    "width": "12px",
    "height": "12px",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
  },
  s17: {
    "display": "flex",
  },
  s18: {
    "borderTopRightRadius": "0px",
    "borderBottomRightRadius": "0px",
  },
  s19: {
    "marginLeft": "2px",
    "display": "none",
    "height": "18px",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 15%, transparent)",
    "fontSize": "10px",
    "color": "var(--primary-foreground)",
  },
  s20: {
    "borderTopLeftRadius": "0px",
    "borderBottomLeftRadius": "0px",
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "color-mix(in oklab, var(--primary-foreground) 20%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
  },
  s21: {
    "marginLeft": "2px",
    "display": "none",
    "height": "18px",
    "fontSize": "10px",
  },
  s22: {
    "marginLeft": "2px",
    "display": "none",
    "height": "18px",
    "fontSize": "10px",
  },
  s23: {
    "marginLeft": "4px",
    "marginRight": "4px",
    "height": "20px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s24: {
    "display": "none",
  },
  s25: {
    "marginLeft": "2px",
    "display": "none",
    "height": "18px",
    "fontSize": "10px",
  },
  s26: {
    "marginLeft": "auto",
  },
  s27: {
    "display": "none",
  },
  s28: {
    "marginLeft": "2px",
    "display": "none",
    "height": "18px",
    "fontSize": "10px",
  },
  s29: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s30: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "16px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
  },
  s31: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s32: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 400,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "display": "grid",
    "gridTemplateColumns": "repeat(3, minmax(0, 1fr))",
    "gap": "8px",
  },
  s34: {
    "maxHeight": "128px",
    "overflow": "auto",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--destructive-foreground)",
  },
  s35: {
    "display": "block",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s36: {
    "aspectRatio": "16/10",
    "width": "100%",
    "objectFit": "cover",
  },
  s37: {
    "aspectRatio": "16/10",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s38: {
    "height": "48px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
  },
  s39: {
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s40: {
    "maxHeight": "224px",
    "overflowY": "auto",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s41: {
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
  },
  s42: {
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
  },
  s43: {
    "backgroundColor": "var(--muted)",
  },
  s44: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted-foreground)",
  },
  s45: {
    "width": "12px",
    "height": "12px",
  },
  s46: {
    "width": "12px",
    "height": "12px",
  },
  s47: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s48: {
    "marginLeft": "auto",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    "maxHeight": "160px",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s50: {
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "13px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--background) 60%, transparent)",
    },
  },
  s51: {
    "backgroundColor": "var(--background)",
    "fontWeight": 500,
    "color": "var(--foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s52: {
    "marginLeft": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s53: {
    "marginLeft": "auto",
    "paddingRight": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s54: {
    "color": "var(--success-foreground)",
  },
  s55: {
    "color": "var(--destructive-foreground)",
  },
  s56: {
    "width": "240px",
    "flexShrink": 0,
    "overflowY": "auto",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "padding": "6px",
  },
  s57: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "13px",
  },
  s58: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success-foreground)",
  },
  s59: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s60: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s61: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "fontSize": "13px",
  },
  s62: {
    "display": "flex",
    "minWidth": "0px",
    "gap": "8px",
  },
  s63: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
  },
  s64: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s65: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s66: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s67: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s68: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s69: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13px",
  },
  s70: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s71: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s72: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s73: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  n0: {
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--muted)",
  },
  n2: {
    "backgroundColor": "color-mix(in oklab, var(--success) 15%, transparent)",
    "color": "var(--success-foreground)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 15%, transparent)",
    "color": "var(--destructive-foreground)",
  },

  s74: {
    "@media (min-width: 1280px)": {
      display: "inline-flex",
    },
  },
  s75: {
    "@media (min-width: 1280px)": {
      display: "inline",
    },
  },
  s76: {
    "@media (min-width: 1280px)": {
      display: "none",
    },
  },
  s77: {
    objectPosition: "top",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface DetailActions {
  approve(mode: ApproveMode): void;
  sendBack(): void;
  discard(): void;
  open(): void;
  markReviewed(): void;
}

// ReviewDetail is one item: what the agent said last, what it changed, its
// commits, its last check, and the four things to do about it.
export function ReviewDetail({ entry, actions }: { entry: ReviewEntry; actions: DetailActions }) {
  const pr = useReview((s) => s.prs[entry.key]);
  const run = useReview((s) => s.runs[entry.key]);
  const loop = useLoops((s) => s.loops.filter((l) => l.box === entry.box && l.session === entry.session).at(-1));
  const hasFiles = entry.files.length > 0;
  const unpushed = entry.upstream ? entry.ahead : entry.base_ahead;
  // Led by the work the agent did, when its session has a title.
  const work = useSessionTitle(entry.box, entry.session);
  const name = useReviewName(entry);
  const title = work ?? name;

  return (
    <div className={sx(paint.s0)}>
      <header className={sx(paint.s1)}>
        <div className={sx(paint.s2)}>
          <div className={sx(paint.s3)}>
            <div className={sx(paint.s4)}>
              <AgentIcon agent={entry.agent} className={sx(paint.s5)} />
              <h2 className={sx(paint.s6)}>{title}</h2>
              {entry.agent_state === "waiting" ? (
                <Badge variant="warning" size="sm">
                  Waiting for you
                </Badge>
              ) : (
                <span className={sx(paint.s7)}>
                  {agentLabel(entry.agent)} finished {ago(entry.state_since)}
                </span>
              )}
            </div>
            <div className={sx(paint.s8)}>
              <span>
                {work && `${name} · `}
                {entry.box} · {entry.location}
              </span>
              {entry.branch && (
                <span className={sx(paint.s9)}>
                  <GitBranchIcon className={sx(paint.s10)} />
                  <span className={sx(paint.s11)}>{entry.branch}</span>
                  {entry.base && <span className={sx(paint.s12)}>→ {entry.base.replace(/^origin\//, "")}</span>}
                </span>
              )}
              {unpushed > 0 && (
                <span>
                  {unpushed} commit{unpushed === 1 ? "" : "s"} {entry.upstream ? "not pushed" : "not on origin yet"}
                </span>
              )}
              {pr && (
                <button type="button" onClick={() => void openUrl(pr.url)} className={sx(paint.s13)}>
                  <GitPullRequestIcon className={sx(paint.s14)} />
                  PR #{pr.number}
                  <span className={sx(paint.s15)}>· {pr.isDraft ? "draft" : pr.state.toLowerCase()}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className={sx(paint.s16)}>
          <div className={sx(paint.s17)}>
            <span className={sx(paint.s18)}><Button size="sm"  onClick={() => actions.approve(hasFiles ? "commit" : "push")}>
              <CheckIcon />
              Approve…
              <span className={[sx(paint.s19), sx(paint.s74)].filter(Boolean).join(" ")}><Kbd>A</Kbd></span>
            </Button></span>
            <Menu>
              <MenuTrigger render={<span className={sx(paint.s20)}><Button size="sm"  aria-label="More ways to approve" /></span>}>
                <ChevronDownIcon />
              </MenuTrigger>
              <MenuPopup align="start">
                {hasFiles && (
                  <MenuItem onClick={() => actions.approve("commit")}>
                    <GitCommitHorizontalIcon />
                    Commit…
                  </MenuItem>
                )}
                <MenuItem onClick={() => actions.approve("push")}>
                  <CheckIcon />
                  {hasFiles ? "Commit & push…" : "Push…"}
                </MenuItem>
                <MenuItem onClick={() => actions.approve("pr")}>
                  <GitPullRequestIcon />
                  {pr?.state === "OPEN" ? `${hasFiles ? "Commit & push" : "Push"} to PR #${pr.number}…` : `${hasFiles ? "Commit, push & open PR" : "Push & open PR"}…`}
                </MenuItem>
              </MenuPopup>
            </Menu>
          </div>
          <Button size="sm" variant="outline" onClick={actions.sendBack}>
            <MessageSquareReplyIcon />
            Send back…
            <span className={[sx(paint.s21), sx(paint.s74)].filter(Boolean).join(" ")}><Kbd>S</Kbd></span>
          </Button>
          <Tip label={hasFiles ? undefined : "Nothing uncommitted to discard"}>
            <Button size="sm" variant="outline" onClick={actions.discard} disabled={!hasFiles}>
              <Trash2Icon />
              Discard…
              <span className={[sx(paint.s22), sx(paint.s74)].filter(Boolean).join(" ")}><Kbd>D</Kbd></span>
            </Button>
          </Tip>
          <span className={sx(paint.s23)} />
          <Button size="sm" variant="ghost" onClick={actions.open}>
            <SquareArrowOutUpRightIcon />
            <span className={[sx(paint.s24), sx(paint.s75)].filter(Boolean).join(" ")}>Open worktree</span>
            <span className={sx(paint.s76)}>Open</span>
            <span className={[sx(paint.s25), sx(paint.s74)].filter(Boolean).join(" ")}><Kbd>↵</Kbd></span>
          </Button>
          <Tip label="Mark reviewed (E): it comes back if the agent changes anything">
            <span className={sx(paint.s26)}><Button size="sm" variant="ghost"  onClick={actions.markReviewed} muted>
              <CheckCheckIcon />
              <span className={[sx(paint.s27), sx(paint.s75)].filter(Boolean).join(" ")}>Mark reviewed</span>
              <span className={[sx(paint.s28), sx(paint.s74)].filter(Boolean).join(" ")}><Kbd>E</Kbd></span>
            </Button></span>
          </Tip>
        </div>
      </header>

      <div className={sx(paint.s29)}>
        <div className={sx(paint.s30)}>
          <LastWords entry={entry} />
          {(run || loop) && <LastCheck run={run} loop={loop} />}
          {entry.browser && <AgentBrowserArtifacts entry={entry} />}
          <CommentsBar entry={entry} />
          <Changes entry={entry} />
          {entry.commits.length > 0 && <Commits entry={entry} />}
        </div>
      </div>
    </div>
  );
}

// AgentBrowserArtifacts shows what the agent saw in its browser: its last
// shots, the page it ended on, and the console errors it left.
function AgentBrowserArtifacts({ entry }: { entry: ReviewEntry }) {
  const b = entry.browser!;
  return (
    <Frame>
      <FrameHeader>
        <FrameTitle row>
          <GlobeIcon className={sx(paint.s31)} />
          The agent's browser
          {b.url && <span className={sx(paint.s32)}>{b.url}</span>}
        </FrameTitle>
      </FrameHeader>
      <FramePanel stack gap={2}>
        {(b.shots?.length ?? 0) > 0 && (
          <div className={sx(paint.s33)}>
            {b.shots!.map((name) => (
              <Shot key={name} entry={entry} name={name} />
            ))}
          </div>
        )}
        {(b.errors?.length ?? 0) > 0 && (
          <pre className={sx(paint.s34)}>{b.errors!.join("\n")}</pre>
        )}
      </FramePanel>
    </Frame>
  );
}

function Shot({ entry, name }: { entry: ReviewEntry; name: string }) {
  const url = useShotUrl(entry.box, entry.location, entry.worktree, name);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={sx(paint.s35)}>
      <img src={url} alt={`The agent's screenshot ${name}`} className={[sx(paint.s36), sx(paint.s77)].filter(Boolean).join(" ")} />
    </a>
  ) : (
    <div className={sx(paint.s37)} />
  );
}

function LastWords({ entry }: { entry: ReviewEntry }) {
  const client = useStore((s) => s.client);
  const [lines, setLines] = useState<string[]>();
  useEffect(() => {
    if (!client) return;
    let live = true;
    setLines(undefined);
    boxApi
      .screen(client, entry.box, entry.session)
      .then((r) => live && setLines(lastMessage(r.screen ?? "")))
      .catch(() => live && setLines([]));
    return () => {
      live = false;
    };
  }, [client, entry.box, entry.session, entry.state_since]);
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="bar">
        <AgentIcon agent={entry.agent} />
        <FrameTitle size="13">{agentLabel(entry.agent)}'s last message</FrameTitle>
      </FrameHeader>
      <FramePanel pad="field">
        {lines === undefined ? (
          <div className={[sx(paint.s38), "burf-pulse"].filter(Boolean).join(" ")} />
        ) : lines.length === 0 ? (
          <p className={sx(paint.s39)}>Nothing on its screen to show.</p>
        ) : (
          <div className={sx(paint.s40)}>
            {lines.map((l, i) => (
              <div key={i} className={sx(paint.s41)}>
                {l || " "}
              </div>
            ))}
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}

function LastCheck({ run, loop }: { run?: ReturnType<typeof useReview.getState>["runs"][string]; loop?: ReturnType<typeof useLoops.getState>["loops"][number] }) {
  // The loop is newer when it started after the flow run.
  const useLoop = loop && (!run || loop.started > Date.parse(run.started));
  const passed = useLoop ? loop!.outcome === "passed" : run!.status === "succeeded";
  const pending = useLoop ? !loop!.outcome : run!.status === "running";
  const failedStep = !useLoop ? run!.steps.find((s) => s.status === "failed") : undefined;
  const output = useLoop ? loop!.output : (failedStep ?? run!.steps.filter((s) => s.kind === "run").at(-1))?.output;
  const what = useLoop ? `Loop: ${loop!.check}` : `Flow: ${run!.flow}`;
  const when = useLoop ? ago(new Date(loop!.ended ?? loop!.started).toISOString()) : ago(run!.finished ?? run!.started);
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="bar">
        <span className={[sx(paint.n0), pending ? sx(paint.n1) : passed ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}>
          {pending ? <span className={[sx(paint.s44), "burf-pulse"].filter(Boolean).join(" ")} /> : passed ? <CheckIcon className={sx(paint.s45)} /> : <XIcon className={sx(paint.s46)} />}
        </span>
        <FrameTitle size="13" truncate>
          Last check {pending ? "running" : passed ? "passed" : "failed"}
        </FrameTitle>
        <span className={sx(paint.s47)}>{what}</span>
        <span className={sx(paint.s48)}>{when}</span>
      </FrameHeader>
      {!passed && output && (
        <FramePanel pad="field">
          <pre className={sx(paint.s49)}>{output.trim()}</pre>
        </FramePanel>
      )}
    </Frame>
  );
}

function Changes({ entry }: { entry: ReviewEntry }) {
  const client = useStore((s) => s.client);
  const groups = useMemo(
    () =>
      [
        { id: "uncommitted" as const, label: "Uncommitted", files: entry.files as FileChange[] },
        { id: "committed" as const, label: `On ${entry.branch ?? "the branch"}`, files: entry.committed as FileChange[] },
      ].filter((g) => g.files.length > 0),
    [entry],
  );
  const [group, setGroup] = useState<"uncommitted" | "committed">(groups[0]?.id ?? "uncommitted");
  const [selected, setSelected] = useState<string>();
  const current = groups.find((g) => g.id === group) ?? groups[0];
  const file = current?.files.find((f) => f.path === selected) ?? current?.files[0];
  const run: Run = useCallback((command: string) => (client ? boxApi.exec(client, entry.box, where(entry), command, "60s") : Promise.reject(new Error("Not connected"))), [client, entry]);
  const all = useComments((s) => s.byKey[entry.key]) ?? NO_COMMENTS;
  const comments = useMemo<LineComments | undefined>(
    () =>
      file && {
        list: all.filter((c) => c.file === file.path),
        onAdd: (line, side, text) => addComment(entry.key, { file: file.path, line, side, text }),
        onRemove: (id) => removeComment(entry.key, id),
      },
    [all, file, entry.key],
  );
  const counts = useMemo(() => {
    const n: Record<string, number> = {};
    for (const c of pending(all)) n[c.file] = (n[c.file] ?? 0) + 1;
    return n;
  }, [all]);

  useEffect(() => {
    // "Open in Review" from a conversation names the file to show.
    const focus = useComments.getState().focus;
    if (focus?.key === entry.key) {
      const g = groups.find((x) => x.files.some((f) => f.path === focus.file));
      setGroup(g?.id ?? groups[0]?.id ?? "uncommitted");
      setSelected(focus.file);
      useComments.setState({ focus: undefined });
      return;
    }
    setGroup(groups[0]?.id ?? "uncommitted");
    setSelected(undefined);
  }, [entry.key, groups]);

  if (!current) return null;
  const added = current.files.reduce((n, f) => n + (f.added ?? 0), 0);
  const removed = current.files.reduce((n, f) => n + (f.removed ?? 0), 0);
  return (
    <Frame variant="card">
      <FrameHeader row gap={1} pad="short">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGroup(g.id);
              setSelected(undefined);
            }}
            className={[sx(paint.s50), g.id === current.id && sx(paint.s51)].filter(Boolean).join(" ")}
          >
            {g.label}
            <span className={sx(paint.s52)}>{g.files.length}</span>
          </button>
        ))}
        <span className={sx(paint.s53)}>
          <span className={sx(paint.s54)}>+{added}</span> <span className={sx(paint.s55)}>−{removed}</span>
        </span>
      </FrameHeader>
      <FramePanel tall pad="none">
        <ul className={sx(paint.s56)}>
          {current.files.map((f) => (
            <FileRow key={`${current.id}:${f.path}`} file={f} active={f.path === file?.path} onSelect={() => setSelected(f.path)} comments={counts[f.path]} />
          ))}
        </ul>
        {file && <DiffView key={`${entry.key}:${current.id}:${file.path}:${entry.head}`} file={file} run={run} base={current.id === "committed" ? entry.base : undefined} comments={comments} />}
      </FramePanel>
    </Frame>
  );
}

const NO_COMMENTS: LineComment[] = [];

// CommentsBar collects the notes left on this worktree's diff and sends
// them to its agent as one short prompt, held until the agent is idle.
function CommentsBar({ entry }: { entry: ReviewEntry }) {
  const all = useComments((s) => s.byKey[entry.key]) ?? NO_COMMENTS;
  const [busy, setBusy] = useState(false);
  const todo = pending(all);
  const sent = all.filter((c) => c.sent);
  const who = agentLabel(entry.agent);
  if (!all.length) {
    return null;
  }
  const fit = commentsPrompt(todo).included.length;
  const send = async () => {
    setBusy(true);
    try {
      const r = await sendComments(entry.box, entry.session, entry.key);
      toastManager.add({
        type: "success",
        title: `Sent ${r.sent} comment${r.sent === 1 ? "" : "s"} to ${who}`,
        description: r.queued ? `Queued: ${who} gets them when its turn ends.` : r.left ? `${r.left} more didn't fit in one message; send again for them.` : undefined,
      });
    } catch (err) {
      toastManager.add({ type: "error", title: `Couldn't send the comments to ${who}`, description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  if (!todo.length) {
    const last = Math.max(...sent.map((c) => c.sent ?? 0));
    return (
      <div className={sx(paint.s57)}>
        <CheckIcon className={sx(paint.s58)} />
        <span className={sx(paint.s59)}>
          Sent {sent.length} comment{sent.length === 1 ? "" : "s"} to {who} {ago(new Date(last).toISOString())}
        </span>
        <Button size="xs" variant="ghost" onClick={() => dismissComments(entry.key, true)}>
          Clear
        </Button>
      </div>
    );
  }
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="bar">
        <MessageSquareTextIcon className={sx(paint.s60)} />
        <FrameTitle size="13" truncate grow>
          {todo.length} comment{todo.length === 1 ? "" : "s"} for {who}
        </FrameTitle>
        <Button size="xs" variant="ghost" onClick={() => dismissComments(entry.key, false)}>
          Discard
        </Button>
        <Button size="xs" loading={busy} onClick={() => void send()}>
          <SendIcon />
          Send to {who}
        </Button>
      </FrameHeader>
      <FramePanel pad="text">
        <ul className={sx(paint.s61)}>
          {todo.slice(0, 5).map((c) => (
            <li key={c.id} className={sx(paint.s62)}>
              <span className={sx(paint.s63)}>
                {c.file.split("/").pop()}:{c.line}
                {c.side === "old" && " (removed)"}
              </span>
              <span className={sx(paint.s64)}>{c.text}</span>
            </li>
          ))}
          {todo.length > 5 && <li className={sx(paint.s65)}>and {todo.length - 5} more</li>}
        </ul>
        <p className={sx(paint.s66)}>
          {fit < todo.length
            ? `The first ${fit} fit in one message (2 KB); send again for the rest.`
            : `${who} gets each file and line with your note, not the code: it reads the file itself. It waits until ${who} is idle.`}
        </p>
      </FramePanel>
    </Frame>
  );
}

function Commits({ entry }: { entry: ReviewEntry }) {
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="bar">
        <GitCommitHorizontalIcon className={sx(paint.s67)} />
        <FrameTitle size="13">
          {entry.base_ahead} commit{entry.base_ahead === 1 ? "" : "s"} not on {(entry.base ?? "base").replace(/^origin\//, "")}
        </FrameTitle>
      </FrameHeader>
      <FramePanel pad="none">
        <ul className={sx(paint.s68)}>
          {entry.commits.map((c) => (
            <li key={c.sha} className={sx(paint.s69)}>
              <span className={sx(paint.s70)}>{c.sha.slice(0, 7)}</span>
              <span className={sx(paint.s71)}>{c.subject}</span>
              <span className={sx(paint.s72)}>
                {c.author} · {ago(c.when)}
              </span>
            </li>
          ))}
        </ul>
        {entry.base_ahead > entry.commits.length && <p className={sx(paint.s73)}>and {entry.base_ahead - entry.commits.length} older</p>}
      </FramePanel>
    </Frame>
  );
}
