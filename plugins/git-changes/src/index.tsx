import * as stylex from "@stylexjs/stylex";
import { definePlugin, useEvent, worktreeLocation, type WorktreePanelProps } from "@berth/plugin";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Icon,
  PickOne,
  Spinner,
  Textarea,
  Tip,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { describeCode, diffCommand, type DiffLine, type FileChange, type GitStatus, parseDiff, parseStatus, quote, STATUS_COMMAND, splitRows } from "./git";

const paint = stylex.create({
  s0: {
    "width": "16px",
    "height": "16px",
  },
  s1: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s2: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "color": "var(--success)",
  },
  s10: {
    "color": "var(--destructive)",
  },
  s11: {
    "width": "14px",
    "height": "14px",
  },
  s12: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s13: {
    "display": "flex",
    "width": "256px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s14: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s15: {
    "display": "flex",
    "height": "100%",
    "minHeight": "160px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "padding": "24px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "color": "var(--success)",
  },
  s17: {
    "color": "var(--success)",
  },
  s18: {
    "color": "var(--destructive)",
  },
  s19: {
    "color": "var(--warning)",
  },
  s20: {
    "color": "var(--info)",
  },
  s21: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s22: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s23: {
    "width": "12px",
    "flexShrink": 0,
    "textAlign": "center",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 600,
  },
  s24: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s25: {
    "marginLeft": "6px",
    "color": "var(--muted-foreground)",
  },
  s26: {
    "color": "var(--muted-foreground)",
  },
  s27: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s28: {
    "color": "var(--success)",
  },
  s29: {
    "color": "var(--destructive)",
  },
  s30: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s31: {
    "display": "flex",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s33: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "20px",
  },
  s34: {
    "width": "16px",
    "height": "16px",
  },
  s35: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-sans)",
    "color": "var(--warning)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s36: {
    "backgroundColor": "color-mix(in oklab, var(--success) 10%, transparent)",
  },
  s37: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
  },
  s38: {
    "backgroundColor": "color-mix(in oklab, var(--info) 8%, transparent)",
    "color": "var(--info)",
  },
  s39: {
    "color": "var(--muted-foreground)",
    "fontStyle": "italic",
  },
  s40: {
    "width": "44px",
    "flexShrink": 0,
    "userSelect": "none",
    "paddingRight": "8px",
    "textAlign": "right",
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s41: {
    "minWidth": "fit-content",
  },
  s42: {
    "display": "flex",
    "whiteSpace": "pre",
  },
  s43: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s44: {
    "width": "16px",
    "flexShrink": 0,
    "userSelect": "none",
    "color": "var(--muted-foreground)",
  },
  s45: {
    "paddingRight": "16px",
  },
  s46: {
    "minWidth": "fit-content",
  },
  s47: {
    "whiteSpace": "pre",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s48: {
    "display": "grid",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
  },
  s49: {
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s50: {
    "display": "flex",
    "minWidth": "0px",
    "whiteSpace": "pre",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s51: {
    "overflow": "hidden",
    "paddingRight": "12px",
  },
  s52: {
    "flexShrink": 0,
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "padding": "8px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s53: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s54: {
    "width": "100%",
  },
  s55: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s56: {
    "width": "14px",
    "height": "14px",
  },
  s57: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  q58: {
    "color": "var(--success)",
  },
  q59: {
    "color": "var(--success)",
  },
  q60: {
    "color": "var(--destructive)",
  },
  q61: {
    "color": "var(--warning)",
  },
  q62: {
    "color": "var(--info)",
  },
  q63: {
    "backgroundColor": "color-mix(in oklab, var(--success) 10%, transparent)",
  },
  q64: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
  },
  q65: {
    "backgroundColor": "color-mix(in oklab, var(--info) 8%, transparent)",
    "color": "var(--info)",
  },
  q66: {
    "color": "var(--muted-foreground)",
    "fontStyle": "italic",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Git changes: what an agent changed in a worktree, before you trust it.
// Everything is read with `git` on the box through orchestrate.exec; commit
// and push only happen behind a confirmation.

export default definePlugin((berth) => {
  berth.addWorktreePanel({ id: "changes", title: "Changes", icon: "GitCompareArrows", Component: ChangesPanel });
  berth.addCommand({ id: "open", title: "Show changes in this worktree", group: "Git", run: () => berth.openPanel("changes") });
});

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

function ChangesPanel({ berth, box, location, worktree, path, main }: WorktreePanelProps) {
  const where = worktreeLocation({ location, worktree, main });
  const [status, setStatus] = useState<Load<GitStatus>>({ state: "loading" });
  const [selected, setSelected] = useState<string>();
  const [stamp, setStamp] = useState(0);

  const run = useCallback((command: string) => berth.orchestrate.exec(box, where, command, "60s"), [berth, box, where]);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    run(STATUS_COMMAND)
      .then((r) => {
        if (!live) return;
        if (r.exit_code !== 0) setStatus({ state: "error", message: r.output.trim() || `git exited with ${r.exit_code}` });
        else setStatus({ state: "ready", value: parseStatus(r.output) });
      })
      .catch((err) => live && setStatus({ state: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [run, stamp]);

  // An agent finishing, or a terminal in this worktree, likely changed files.
  useEvent("agent.finished", (e) => e.box === box && e.data?.path === path && refresh());
  useEvent("session.stopped", (e) => e.box === box && refresh());

  const files = status.state === "ready" ? status.value.files : [];
  const current = files.find((f) => f.path === selected) ?? files[0];

  if (status.state === "loading") return <Centered><Spinner className={sx(paint.s0)} /> Reading changes…</Centered>;
  if (status.state === "error") {
    return (
      <Centered>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Couldn't read this worktree's changes</EmptyTitle>
            <EmptyDescription measure="md" mono size="xs" wrap>{status.message}</EmptyDescription>
          </EmptyHeader>
          <Button size="sm" variant="outline" onClick={refresh}>Try again</Button>
        </Empty>
      </Centered>
    );
  }
  const { branch } = status.value;
  const added = files.reduce((n, f) => n + (f.added ?? 0), 0);
  const removed = files.reduce((n, f) => n + (f.removed ?? 0), 0);

  return (
    <div className={sx(paint.s1)}>
      <header className={sx(paint.s2)}>
        <Icon name="GitBranch" className={sx(paint.s3)} />
        <span className={sx(paint.s4)}>{branch.branch || "detached"}</span>
        {branch.upstream ? (
          <span className={sx(paint.s5)}>
            {branch.ahead > 0 && `↑${branch.ahead} `}
            {branch.behind > 0 && `↓${branch.behind} `}
            {branch.ahead === 0 && branch.behind === 0 ? "up to date with " : "vs "}
            {branch.upstream}
          </span>
        ) : (
          <span className={sx(paint.s6)}>not pushed yet</span>
        )}
        <span className={sx(paint.s7)}>
          {files.length > 0 && (
            <>
              <span className={sx(paint.s8)}>{files.length} file{files.length === 1 ? "" : "s"}</span>
              <span className={sx(paint.s9)}>+{added}</span>
              <span className={sx(paint.s10)}>−{removed}</span>
            </>
          )}
        </span>
        <Button size="icon-sm" variant="ghost" aria-label="Refresh" onClick={refresh}>
          <Icon name="RefreshCw" className={sx(paint.s11)} />
        </Button>
      </header>

      {files.length === 0 ? (
        <Centered>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No changes</EmptyTitle>
              <EmptyDescription>
                The worktree matches its last commit.
                {branch.ahead > 0 && ` ${branch.ahead} commit${branch.ahead === 1 ? " is" : "s are"} not pushed yet.`}
              </EmptyDescription>
            </EmptyHeader>
            {branch.ahead > 0 || !branch.upstream ? <PushButton run={run} branch={branch.branch} onDone={refresh} berth={berth} /> : null}
          </Empty>
        </Centered>
      ) : (
        <div className={sx(paint.s12)}>
          <aside className={sx(paint.s13)}>
            <ul className={sx(paint.s14)}>
              {files.map((f) => (
                <FileRow key={f.path} file={f} active={f.path === current?.path} onSelect={() => setSelected(f.path)} />
              ))}
            </ul>
            <CommitBox run={run} count={files.length} branch={branch.branch} onDone={refresh} berth={berth} />
          </aside>
          {current && <DiffView key={`${current.path}:${stamp}`} file={current} run={run} />}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className={sx(paint.s15)}>{children}</div>;
}

const toneClass = {
  add: sx(paint.q58),
  new: sx(paint.q59),
  del: sx(paint.q60),
  mod: sx(paint.q61),
  ren: sx(paint.q62),
} as const;

function FileRow({ file, active, onSelect }: { file: FileChange; active: boolean; onSelect(): void }) {
  const { label, tone } = describeCode(file.code);
  const slash = file.path.lastIndexOf("/");
  const name = file.path.slice(slash + 1);
  const dir = slash > 0 ? file.path.slice(0, slash) : "";
  return (
    <li>
      <Tip side="right" label={`${label}: ${file.from ? `${file.from} → ` : ""}${file.path}`}>
        <button
          type="button"
          onClick={onSelect}
          className={[sx(paint.s21), active && sx(paint.s22)].filter(Boolean).join(" ")}
        >
          <span className={[sx(paint.s23), toneClass[tone]].filter(Boolean).join(" ")}>{file.code === "??" ? "U" : file.code.trim()[0]}</span>
          <span className={sx(paint.s24)}>
            {name}
            {dir && <span className={sx(paint.s25)}>{dir}</span>}
          </span>
          {file.binary ? (
            <span className={sx(paint.s26)}>bin</span>
          ) : (
            (file.added !== undefined || file.removed !== undefined) && (
              <span className={sx(paint.s27)}>
                <span className={sx(paint.s28)}>+{file.added ?? 0}</span> <span className={sx(paint.s29)}>−{file.removed ?? 0}</span>
              </span>
            )
          )}
        </button>
      </Tip>
    </li>
  );
}

type Run = (command: string) => Promise<{ exit_code: number; output: string; truncated?: boolean }>;

function DiffView({ file, run }: { file: FileChange; run: Run }) {
  const [diff, setDiff] = useState<Load<{ lines: DiffLine[]; truncated?: boolean }>>({ state: "loading" });
  const [mode, setMode] = useState<"unified" | "split">("unified");

  useEffect(() => {
    let live = true;
    run(diffCommand(file))
      .then((r) => live && setDiff({ state: "ready", value: { lines: parseDiff(r.output), truncated: r.truncated } }))
      .catch((err) => live && setDiff({ state: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [file, run]);

  return (
    <section className={sx(paint.s30)}>
      <div className={sx(paint.s31)}>
        <span className={sx(paint.s32)}>{file.from ? `${file.from} → ${file.path}` : file.path}</span>
        <Badge variant="outline" size="sm">{describeCode(file.code).label}</Badge>
        <PickOne
          label="Diff layout"
          align="end"
          value={mode}
          onChange={(v: string) => setMode(v as "unified" | "split")}
          options={[
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" },
          ]}
        />
      </div>
      <div className={sx(paint.s33)}>
        {diff.state === "loading" && <Centered><Spinner className={sx(paint.s34)} /></Centered>}
        {diff.state === "error" && <Centered>{diff.message}</Centered>}
        {diff.state === "ready" && diff.value.lines.length === 0 && <Centered>Nothing to show for this file.</Centered>}
        {diff.state === "ready" && diff.value.truncated && <p className={sx(paint.s35)}>Only the end of this diff is shown: it is longer than 64 KB.</p>}
        {diff.state === "ready" && (mode === "unified" ? <Unified lines={diff.value.lines} /> : <Split lines={diff.value.lines} />)}
      </div>
    </section>
  );
}

const lineBg = { add: sx(paint.q63), del: sx(paint.q64), ctx: "", hunk: sx(paint.q65), meta: sx(paint.q66) } as const;

function Num({ n }: { n?: number }) {
  return <span className={sx(paint.s40)}>{n ?? ""}</span>;
}

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <div className={sx(paint.s41)}>
      {lines.map((l, i) => (
        <div key={i} className={[sx(paint.s42), lineBg[l.kind]].filter(Boolean).join(" ")}>
          {l.kind === "hunk" ? (
            <span className={sx(paint.s43)}>{l.text}</span>
          ) : (
            <>
              <Num n={l.oldNo} />
              <Num n={l.newNo} />
              <span className={sx(paint.s44)}>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
              <span className={sx(paint.s45)}>{l.text || " "}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  const rows = useMemo(() => splitRows(lines), [lines]);
  return (
    <div className={sx(paint.s46)}>
      {rows.map((r, i) =>
        r.hunk ? (
          <div key={i} className={[sx(paint.s47), lineBg.hunk].filter(Boolean).join(" ")}>{r.hunk}</div>
        ) : (
          <div key={i} className={sx(paint.s48)}>
            <Half line={r.left} side="old" />
            <Half line={r.right} side="new" />
          </div>
        ),
      )}
    </div>
  );
}

function Half({ line, side }: { line?: DiffLine; side: "old" | "new" }) {
  if (!line) return <div className={sx(paint.s49)} />;
  return (
    <div className={[sx(paint.s50), line.kind !== "ctx" && lineBg[line.kind]].filter(Boolean).join(" ")}>
      <Num n={side === "old" ? line.oldNo : line.newNo} />
      <span className={sx(paint.s51)}>{line.text || " "}</span>
    </div>
  );
}

function CommitBox({ run, count, branch, onDone, berth }: { run: Run; count: number; branch: string; onDone(): void; berth: WorktreePanelProps["berth"] }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const commit = async (push: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await run(`git add -A && git commit -q -m ${quote(message.trim())}${push ? " && git push -u origin HEAD 2>&1" : ""}`);
      if (r.exit_code !== 0) throw new Error(r.output.trim() || `git exited with ${r.exit_code}`);
      berth.notify(push ? `Committed and pushed ${branch}` : `Committed on ${branch}`, message.trim().split("\n")[0]);
      setMessage("");
      setOpen(false);
      onDone();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={sx(paint.s52)}>
      <Textarea
        size="sm"
        value={message}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
        placeholder="Commit message"
        rows={2}
        className={sx(paint.s53)}
      />
      <Button size="sm" className={sx(paint.s54)} disabled={!message.trim()} onClick={() => setOpen(true)}>
        Commit {count} file{count === 1 ? "" : "s"}…
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit on {branch}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stages all {count} changed file{count === 1 ? "" : "s"} (including new ones) and commits them on the box. Push also sends the branch to origin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className={sx(paint.s55)}>{error}</p>}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button variant="outline" loading={busy} onClick={() => void commit(true)}>Commit and push</Button>
            <Button loading={busy} onClick={() => void commit(false)}>Commit</Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}

function PushButton({ run, branch, onDone, berth }: { run: Run; branch: string; onDone(): void; berth: WorktreePanelProps["berth"] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="Upload" className={sx(paint.s56)} /> Push {branch}…
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Push {branch} to origin?</AlertDialogTitle>
            <AlertDialogDescription>Runs git push -u origin HEAD on the box.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className={sx(paint.s57)}>{error}</p>}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(undefined);
                const r = await run("git push -u origin HEAD 2>&1").catch((err) => ({ exit_code: 1, output: String(err) }));
                setBusy(false);
                if (r.exit_code !== 0) return setError(r.output.trim());
                berth.notify(`Pushed ${branch}`);
                setOpen(false);
                onDone();
              }}
            >
              Push
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
