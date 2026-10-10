import * as stylex from "@stylexjs/stylex";
import { ArrowLeftIcon, CheckIcon, Columns2Icon, CrownIcon, GitCompareArrowsIcon, SquareTerminalIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { ago, errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import type { RunCompare } from "@/lib/orchestrate-core";
import { allRuns, type BoxRun, runs as runsApi, scheduleRuns, useRuns } from "@/lib/runs";
import { confirm } from "@/components/sidebar/confirm";
import { focusSession, wsKey } from "@/lib/workspaces";
import { openCompare } from "@/lib/compare-actions";
import { usePrefs } from "@/lib/prefs";
import { tokens } from "@/views/automations/flows/runs-tab";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "color": "var(--muted-foreground)",
  },
  s3: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s4: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s5: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s6: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
    "padding": "24px",
  },
  s11: {
    "marginBottom": "16px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "fontWeight": 500,
  },
  s13: {
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "display": "grid",
    "gap": "12px",
  },
  s15: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s16: {
    "borderColor": "color-mix(in oklab, var(--success) 60%, transparent)",
  },
  s17: {
    "borderColor": "color-mix(in oklab, var(--primary) 50%, transparent)",
  },
  s18: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s19: {
    "flexShrink": 0,
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--primary)",
  },
  s22: {
    "width": "12px",
    "height": "12px",
  },
  s23: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--success-foreground)",
  },
  s24: {
    "width": "12px",
    "height": "12px",
  },
  s25: {
    "display": "grid",
    "gridTemplateColumns": "80px 1fr",
    "columnGap": "8px",
    "rowGap": "4px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "color": "var(--muted-foreground)",
  },
  s27: {
    "color": "var(--success-foreground)",
  },
  s28: {
    "color": "var(--destructive-foreground)",
  },
  s29: {
    "color": "var(--muted-foreground)",
  },
  s30: {
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s31: {
    "color": "var(--success-foreground)",
  },
  s32: {
    "color": "var(--destructive-foreground)",
  },
  s33: {
    "color": "var(--muted-foreground)",
  },
  s34: {
    "color": "var(--muted-foreground)",
  },
  s35: {
    "color": "var(--muted-foreground)",
  },
  s36: {
    "color": "var(--muted-foreground)",
  },
  s37: {
    "color": "var(--muted-foreground)",
  },
  s38: {
    "marginLeft": "12px",
    "marginRight": "12px",
    "marginBottom": "8px",
    "maxHeight": "112px",
    "overflow": "auto",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s39: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  s40: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s41: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s42: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--success-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s43: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s44: {
    "color": "var(--muted-foreground)",
  },
  s45: {
    "color": "var(--muted-foreground)",
  },
  s46: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// CompareStrip lists attempts runs with candidates to compare, at the top of
// Review: the ones waiting for a pick first.
export function CompareStrip({ runs, onOpen }: { runs: BoxRun[]; onOpen(r: BoxRun): void }) {
  if (!runs.length) return null;
  return (
    <div className={sx(paint.s0)}>
      <GitCompareArrowsIcon className={sx(paint.s1)} />
      <span className={sx(paint.s2)}>Attempts to compare:</span>
      {runs.map((r) => (
        <Button key={`${r.box}/${r.id}`} size="xs" variant={r.status === "waiting_gate" ? "default" : "outline"} onClick={() => onOpen(r)}>
          {r.title ?? r.id}
          {r.status === "waiting_gate" && " · pick one"}
        </Button>
      ))}
    </div>
  );
}

// CompareView is Review's Compare mode for an attempts run: a column per
// attempt, with its check, diffstat, commits, the judge's ranking and
// reasons, and the files it changed. Picking one decides the run's gate;
// the run then opens its pull request and archives the rest.
export function CompareView({ box, id, onClose }: { box: string; id: string; onClose(): void }) {
  // Attempts across boxes are a group of per-box runs, compared here as one.
  const byBox = useRuns((s) => s.byBox);
  const group = allRuns(byBox).find((r) => r.box === box && r.id === id)?.group;
  const members = group ? allRuns(byBox).filter((r) => r.group === group && r.template === "attempts") : [];
  const runsKey = (members.length ? members.map((r) => `${r.box}/${r.id}`) : [`${box}/${id}`]).sort().join(",");
  const [all, setAll] = useState<{ box: string; id: string; data: RunCompare }[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const list = runsKey.split(",").map((k) => ({ box: k.slice(0, k.indexOf("/")), id: k.slice(k.indexOf("/") + 1) }));
      setAll(await Promise.all(list.map(async (r) => ({ ...r, data: await runsApi.compare(r.box, r.id) }))));
    } catch (err) {
      setError(plainError(err));
    }
  };
  useEffect(() => {
    void load();
    const t = setInterval(() => !document.hidden && void load(), 4000);
    return () => clearInterval(t);
  }, [runsKey]);

  // A pick decides every run of the group: the picked one's run takes it,
  // the others pick none and archive their attempts.
  const pick = async (approve: boolean, at?: { box: string; id: string; index: number }) => {
    setBusy(true);
    try {
      for (const r of all) {
        if (!r.data.gate) continue;
        const mine = at && r.box === at.box && r.id === at.id;
        await runsApi.decide(r.box, r.id, approve ? { approve: true, pick: mine ? at.index : -1 } : { approve: false });
        scheduleRuns(r.box, 0);
      }
      toastManager.add({ type: "success", title: approve && at ? `Picked attempt ${at.index + 1}${all.length > 1 ? ` on ${at.box}` : ""}` : "Rejected every attempt", description: approve ? "The run goes on: its pull request, then the others are archived." : undefined });
      await load();
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't decide", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const data = all.find((r) => r.box === box && r.id === id)?.data ?? all[0]?.data;
  const canPick = all.some((r) => r.data.gate?.pick);
  const multi = all.length > 1;
  // A group's runs each say how many they tried; the page shows them all.
  const titleOf = (t?: string) => (t ?? id).replace(/: \d+ attempts?$/, "");
  const cands = all.flatMap((r) => r.data.candidates.map((c) => ({ ...c, box: r.box, runId: r.id, winner: r.data.gate?.default === c.index })));
  // One winner across the group: each box's judge ranks only its own, so of
  // their first picks the one whose check passed, then the smallest change.
  const firsts = cands.filter((c) => c.judge.rank === 1);
  const best = [...firsts].sort((a, b) => Number(b.verify.passed) - Number(a.verify.passed) || a.diff.added + a.diff.removed - (b.diff.added + b.diff.removed))[0];
  const isBest = (c: (typeof cands)[number]) => !!best && c.box === best.box && c.runId === best.runId && c.index === best.index;
  const title = data ? `${titleOf(data.run.title)}: ${cands.length} attempt${cands.length === 1 ? "" : "s"}` : id;
  // Side by side (Labs): an attempt in a Compare tab beside the judge's
  // pick, or the pick beside the runner-up.
  const labs = usePrefs((p) => p.labs);
  const partner = (c: (typeof cands)[number]) => {
    const others = cands.filter((o) => o !== c && o.path);
    return (best && !isBest(c) && best.path ? best : undefined) ?? [...others].sort((x, y) => (x.judge.rank ?? 99) - (y.judge.rank ?? 99))[0];
  };
  const sideBySide = (c: (typeof cands)[number], o: (typeof cands)[number]) => {
    if (!c.path || !o.path || !openCompare(wsKey(c.box, c.path), wsKey(o.box, o.path)))
      toastManager.add({ type: "error", title: "Couldn't put them side by side", description: "One of the attempts' worktrees isn't on its box any more." });
  };
  // Picking one whose check failed takes work that does not pass: ask first.
  const choose = (c: (typeof cands)[number]) => {
    const go = () => pick(true, { box: c.box, id: c.runId, index: c.index });
    if (c.verify.passed) return void go();
    confirm({
      title: `Pick attempt ${c.index + 1}? Its check failed`,
      description: "Its pull request opens with work that doesn't pass the check, and the other attempts are archived.",
      confirm: "Pick it anyway",
      destructive: true,
      run: go,
    });
  };
  return (
    <div className={sx(paint.s3)}>
      <div className={sx(paint.s4)}>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeftIcon />
          Review
        </Button>
        <div className={sx(paint.s5)}>
          <p className={sx(paint.s6)}>{title}</p>
          <p className={sx(paint.s7)}>
            {multi ? all.map((r) => r.box).join(" and ") : box} · {data ? `${data.run.status.replace("_", " ")} · started ${ago(data.run.created)}` : "…"}
            {data?.run.usage && ` · ${tokens(data.run.usage)}`}
          </p>
        </div>
        {canPick && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void pick(false)}>
            <XIcon />
            Reject all
          </Button>
        )}
      </div>
      {error && <ErrorText className={sx(paint.s8)} text={error} />}
      {!data && !error && (
        <div className={sx(paint.s9)}>
          <Spinner  size="lg"/> Reading the attempts…
        </div>
      )}
      {data && (
        <div className={sx(paint.s10)}>
          {all
            .filter((r) => r.data.judge)
            .map((r) => (
              <p key={`${r.box}/${r.id}`} className={sx(paint.s11)}>
                <span className={sx(paint.s12)}>Judge{multi ? ` on ${r.box}` : ""}: </span>
                {r.data.judge}
              </p>
            ))}
          {!cands.length && <p className={sx(paint.s13)}>No attempt has finished yet.</p>}
          <div className={sx(paint.s14)} style={{ gridTemplateColumns: `repeat(${Math.max(1, cands.length)}, minmax(260px, 1fr))` }}>
            {cands.map((c) => {
              const files = c.review?.files ?? [];
              return (
                <section key={`${c.box}/${c.runId}/${c.index}`} className={[sx(paint.s15), c.picked && sx(paint.s16), isBest(c) && canPick && sx(paint.s17)].filter(Boolean).join(" ")}>
                  <header className={sx(paint.s18)}>
                    <AgentIcon agent={c.agent} />
                    <span className={sx(paint.s19)}>Attempt {c.index + 1}</span>
                    <span className={sx(paint.s20)}>{multi ? `${c.box} · ${c.worktree}` : c.worktree}</span>
                    {isBest(c) && (
                      <span className={sx(paint.s21)}>
                        <CrownIcon className={sx(paint.s22)} />
                        judge's pick
                      </span>
                    )}
                    {c.picked && (
                      <span className={sx(paint.s23)}>
                        <CheckIcon className={sx(paint.s24)} />
                        picked
                      </span>
                    )}
                  </header>
                  <dl className={sx(paint.s25)}>
                    <dt className={sx(paint.s26)}>Check</dt>
                    <dd className={c.verify.passed ? sx(paint.s27) : sx(paint.s28)}>
                      {c.verify.passed ? "passed" : `failed (exit ${c.verify.exit_code})`}
                      {c.verify.rounds ? ` in ${c.verify.rounds} round${c.verify.rounds === 1 ? "" : "s"}` : ""}
                    </dd>
                    <dt className={sx(paint.s29)}>Changes</dt>
                    <dd className={sx(paint.s30)}>
                      {c.diff.files} files <span className={sx(paint.s31)}>+{c.diff.added}</span> <span className={sx(paint.s32)}>−{c.diff.removed}</span> · {c.diff.commits} commits
                    </dd>
                    {c.judge.rank ? (
                      <>
                        <dt className={sx(paint.s33)}>Judge</dt>
                        <dd>
                          #{c.judge.rank}
                          {c.judge.reason && <span className={sx(paint.s34)}> · {c.judge.reason}</span>}
                        </dd>
                      </>
                    ) : null}
                    {c.tokens && (
                      <>
                        <dt className={sx(paint.s35)}>Spent</dt>
                        <dd>{tokens(c.tokens)}</dd>
                      </>
                    )}
                    {c.summary && (
                      <>
                        <dt className={sx(paint.s36)}>Commits</dt>
                        <dd className={sx(paint.s37)}>{c.summary}</dd>
                      </>
                    )}
                  </dl>
                  {!c.verify.passed && c.verify.tail && <pre className={sx(paint.s38)}>{c.verify.tail}</pre>}
                  <ul className={sx(paint.s39)}>
                    {files.slice(0, 14).map((f) => (
                      <li key={f.path} className={sx(paint.s40)}>
                        <span className={sx(paint.s41)}>{f.path}</span>
                        <span className={sx(paint.s42)}>+{f.added ?? 0}</span>
                        <span className={sx(paint.s43)}>−{f.removed ?? 0}</span>
                      </li>
                    ))}
                    {files.length > 14 && <li className={sx(paint.s44)}>and {files.length - 14} more</li>}
                    {!files.length && <li className={sx(paint.s45)}>No uncommitted changes.</li>}
                  </ul>
                  <footer className={sx(paint.s46)}>
                    {canPick && (
                      <Button size="xs" variant={isBest(c) && c.verify.passed ? "default" : "outline"} disabled={busy} onClick={() => choose(c)}>
                        Pick this one
                      </Button>
                    )}
                    {c.session && (
                      <Button size="xs" variant="ghost" onClick={() => void focusSession(c.box, c.session!)}>
                        <SquareTerminalIcon />
                        Open session
                      </Button>
                    )}
                    {labs && c.path && partner(c) && (() => {
                      const o = partner(c)!;
                      const which = `#${o.index + 1}${multi && o.box !== c.box ? ` on ${o.box}` : ""}`;
                      return (
                        <Button size="xs" variant="ghost" onClick={() => sideBySide(c, o)} aria-label={`Compare attempt ${c.index + 1} side by side with attempt ${which}`}>
                          <Columns2Icon />
                          Compare with {which}
                        </Button>
                      );
                    })()}
                  </footer>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
