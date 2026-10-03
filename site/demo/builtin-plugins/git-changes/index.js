// ../plugins/git-changes/src/index.tsx
import { definePlugin, useEvent, worktreeLocation } from "@berth/plugin";
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
  cn
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

// src/lib/git/parse.ts
var STATUS_MARK = "\n--berth-numstat--\n";
var STATUS_COMMAND = "git status --porcelain=v1 -b -z && printf '\\n--berth-numstat--\\n' && { git diff --numstat HEAD 2>/dev/null; true; }";
function parseStatus(output) {
  const [statusPart, numstatPart = ""] = output.split(STATUS_MARK);
  const entries = statusPart.split("\0").filter(Boolean);
  const branch = { branch: "", ahead: 0, behind: 0 };
  const files = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.startsWith("## ")) {
      const m = /^## (?:No commits yet on )?([^.\s]+(?:\.(?!\.)[^.\s]+)*)(?:\.\.\.(\S+))?(?: \[(.+)\])?/.exec(e);
      if (m) {
        branch.branch = m[1];
        branch.upstream = m[2];
        branch.ahead = Number(/ahead (\d+)/.exec(m[3] ?? "")?.[1] ?? 0);
        branch.behind = Number(/behind (\d+)/.exec(m[3] ?? "")?.[1] ?? 0);
      }
      continue;
    }
    const code = e.slice(0, 2);
    const path = e.slice(3);
    const change = { code, path };
    if (code[0] === "R" || code[0] === "C") change.from = entries[++i];
    files.push(change);
  }
  for (const line of numstatPart.split("\n")) {
    const [a, r, ...rest] = line.split("	");
    if (!rest.length) continue;
    const path = rest.join("	");
    const f = files.find((x) => x.path === path || path.endsWith(`=> ${x.path}}`) || path.endsWith(`=> ${x.path}`));
    if (!f) continue;
    if (a === "-") f.binary = true;
    else {
      f.added = Number(a);
      f.removed = Number(r);
    }
  }
  return { branch, files };
}
function describeCode(code) {
  if (code === "??") return { label: "New", tone: "new" };
  const c = code.trim()[0] ?? " ";
  if (c === "A") return { label: "Added", tone: "add" };
  if (c === "D") return { label: "Deleted", tone: "del" };
  if (c === "R") return { label: "Renamed", tone: "ren" };
  return { label: "Modified", tone: "mod" };
}
function parseDiff(diff) {
  const out = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of diff.split("\n")) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (h) {
      oldNo = Number(h[1]);
      newNo = Number(h[2]);
      out.push({ kind: "hunk", text: line });
      continue;
    }
    if (/^(diff --git|index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode|Binary files)/.test(line)) {
      if (line.startsWith("Binary files")) out.push({ kind: "meta", text: "Binary file" });
      continue;
    }
    if (line.startsWith("+")) out.push({ kind: "add", text: line.slice(1), newNo: newNo++ });
    else if (line.startsWith("-")) out.push({ kind: "del", text: line.slice(1), oldNo: oldNo++ });
    else if (line.startsWith(" ")) out.push({ kind: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    else if (line.startsWith("\\")) out.push({ kind: "meta", text: line.slice(2) });
  }
  return out;
}
function splitRows(lines) {
  const rows = [];
  let dels = [];
  let adds = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ left: dels[i], right: adds[i] });
    dels = [];
    adds = [];
  };
  for (const l of lines) {
    if (l.kind === "del") dels.push(l);
    else if (l.kind === "add") adds.push(l);
    else {
      flush();
      if (l.kind === "hunk") rows.push({ hunk: l.text });
      else if (l.kind === "ctx") rows.push({ left: l, right: l });
    }
  }
  flush();
  return rows;
}
var quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;
function diffCommand(f) {
  if (f.code === "??") return `git diff --no-color --no-index -- /dev/null ${quote(f.path)}; true`;
  return `git diff --no-color --find-renames HEAD -- ${f.from ? `${quote(f.from)} ` : ""}${quote(f.path)}`;
}

// ../plugins/git-changes/src/index.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var index_default = definePlugin((berth) => {
  berth.addWorktreePanel({ id: "changes", title: "Changes", icon: "GitCompareArrows", Component: ChangesPanel });
  berth.addCommand({ id: "open", title: "Show changes in this worktree", group: "Git", run: () => berth.openPanel("changes") });
});
function ChangesPanel({ berth, box, location, worktree, path, main }) {
  const where = worktreeLocation({ location, worktree, main });
  const [status, setStatus] = useState({ state: "loading" });
  const [selected, setSelected] = useState();
  const [stamp, setStamp] = useState(0);
  const run = useCallback((command) => berth.orchestrate.exec(box, where, command, "60s"), [berth, box, where]);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    run(STATUS_COMMAND).then((r) => {
      if (!live) return;
      if (r.exit_code !== 0) setStatus({ state: "error", message: r.output.trim() || `git exited with ${r.exit_code}` });
      else setStatus({ state: "ready", value: parseStatus(r.output) });
    }).catch((err) => live && setStatus({ state: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [run, stamp]);
  useEvent("agent.finished", (e) => e.box === box && e.data?.path === path && refresh());
  useEvent("session.stopped", (e) => e.box === box && refresh());
  const files = status.state === "ready" ? status.value.files : [];
  const current = files.find((f) => f.path === selected) ?? files[0];
  if (status.state === "loading") return /* @__PURE__ */ jsxs(Centered, { children: [
    /* @__PURE__ */ jsx(Spinner, { className: "size-4" }),
    " Reading changes\u2026"
  ] });
  if (status.state === "error") {
    return /* @__PURE__ */ jsx(Centered, { children: /* @__PURE__ */ jsxs(Empty, { children: [
      /* @__PURE__ */ jsxs(EmptyHeader, { children: [
        /* @__PURE__ */ jsx(EmptyTitle, { children: "Couldn't read this worktree's changes" }),
        /* @__PURE__ */ jsx(EmptyDescription, { className: "max-w-md whitespace-pre-wrap font-mono text-xs", children: status.message })
      ] }),
      /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: refresh, children: "Try again" })
    ] }) });
  }
  const { branch } = status.value;
  const added = files.reduce((n, f) => n + (f.added ?? 0), 0);
  const removed = files.reduce((n, f) => n + (f.removed ?? 0), 0);
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full min-h-0 flex-col", children: [
    /* @__PURE__ */ jsxs("header", { className: "flex h-10 shrink-0 items-center gap-2 border-b px-3 text-sm", children: [
      /* @__PURE__ */ jsx(Icon, { name: "GitBranch", className: "size-3.5 text-muted-foreground" }),
      /* @__PURE__ */ jsx("span", { className: "truncate font-medium", children: branch.branch || "detached" }),
      branch.upstream ? /* @__PURE__ */ jsxs("span", { className: "truncate text-muted-foreground text-xs", children: [
        branch.ahead > 0 && `\u2191${branch.ahead} `,
        branch.behind > 0 && `\u2193${branch.behind} `,
        branch.ahead === 0 && branch.behind === 0 ? "up to date with " : "vs ",
        branch.upstream
      ] }) : /* @__PURE__ */ jsx("span", { className: "text-muted-foreground text-xs", children: "not pushed yet" }),
      /* @__PURE__ */ jsx("span", { className: "ml-auto flex items-center gap-2 text-xs tabular-nums", children: files.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground", children: [
          files.length,
          " file",
          files.length === 1 ? "" : "s"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-success", children: [
          "+",
          added
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-destructive", children: [
          "\u2212",
          removed
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(Button, { size: "icon-sm", variant: "ghost", "aria-label": "Refresh", onClick: refresh, children: /* @__PURE__ */ jsx(Icon, { name: "RefreshCw", className: "size-3.5" }) })
    ] }),
    files.length === 0 ? /* @__PURE__ */ jsx(Centered, { children: /* @__PURE__ */ jsxs(Empty, { children: [
      /* @__PURE__ */ jsxs(EmptyHeader, { children: [
        /* @__PURE__ */ jsx(EmptyTitle, { children: "No changes" }),
        /* @__PURE__ */ jsxs(EmptyDescription, { children: [
          "The worktree matches its last commit.",
          branch.ahead > 0 && ` ${branch.ahead} commit${branch.ahead === 1 ? " is" : "s are"} not pushed yet.`
        ] })
      ] }),
      branch.ahead > 0 || !branch.upstream ? /* @__PURE__ */ jsx(PushButton, { run, branch: branch.branch, onDone: refresh, berth }) : null
    ] }) }) : /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ jsxs("aside", { className: "flex w-64 shrink-0 flex-col border-r", children: [
        /* @__PURE__ */ jsx("ul", { className: "min-h-0 flex-1 overflow-y-auto py-1", children: files.map((f) => /* @__PURE__ */ jsx(FileRow, { file: f, active: f.path === current?.path, onSelect: () => setSelected(f.path) }, f.path)) }),
        /* @__PURE__ */ jsx(CommitBox, { run, count: files.length, branch: branch.branch, onDone: refresh, berth })
      ] }),
      current && /* @__PURE__ */ jsx(DiffView, { file: current, run }, `${current.path}:${stamp}`)
    ] })
  ] });
}
function Centered({ children }) {
  return /* @__PURE__ */ jsx("div", { className: "flex h-full min-h-40 flex-1 items-center justify-center gap-2 p-6 text-muted-foreground text-sm", children });
}
var toneClass = {
  add: "text-success",
  new: "text-success",
  del: "text-destructive",
  mod: "text-warning",
  ren: "text-info"
};
function FileRow({ file, active, onSelect }) {
  const { label, tone } = describeCode(file.code);
  const slash = file.path.lastIndexOf("/");
  const name = file.path.slice(slash + 1);
  const dir = slash > 0 ? file.path.slice(0, slash) : "";
  return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Tip, { side: "right", label: `${label}: ${file.from ? `${file.from} \u2192 ` : ""}${file.path}`, children: /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: onSelect,
      className: cn("flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-accent/60", active && "bg-accent text-foreground"),
      children: [
        /* @__PURE__ */ jsx("span", { className: cn("w-3 shrink-0 text-center font-mono font-semibold", toneClass[tone]), children: file.code === "??" ? "U" : file.code.trim()[0] }),
        /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1 truncate", children: [
          name,
          dir && /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-muted-foreground", children: dir })
        ] }),
        file.binary ? /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "bin" }) : (file.added !== void 0 || file.removed !== void 0) && /* @__PURE__ */ jsxs("span", { className: "shrink-0 tabular-nums", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-success", children: [
            "+",
            file.added ?? 0
          ] }),
          " ",
          /* @__PURE__ */ jsxs("span", { className: "text-destructive", children: [
            "\u2212",
            file.removed ?? 0
          ] })
        ] })
      ]
    }
  ) }) });
}
function DiffView({ file, run }) {
  const [diff, setDiff] = useState({ state: "loading" });
  const [mode, setMode] = useState("unified");
  useEffect(() => {
    let live = true;
    run(diffCommand(file)).then((r) => live && setDiff({ state: "ready", value: { lines: parseDiff(r.output), truncated: r.truncated } })).catch((err) => live && setDiff({ state: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [file, run]);
  return /* @__PURE__ */ jsxs("section", { className: "flex min-w-0 flex-1 flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs", children: [
      /* @__PURE__ */ jsx("span", { className: "truncate font-mono", children: file.from ? `${file.from} \u2192 ${file.path}` : file.path }),
      /* @__PURE__ */ jsx(Badge, { variant: "outline", size: "sm", children: describeCode(file.code).label }),
      /* @__PURE__ */ jsx(
        PickOne,
        {
          label: "Diff layout",
          className: "ml-auto",
          value: mode,
          onChange: (v) => setMode(v),
          options: [
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" }
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-5", children: [
      diff.state === "loading" && /* @__PURE__ */ jsx(Centered, { children: /* @__PURE__ */ jsx(Spinner, { className: "size-4" }) }),
      diff.state === "error" && /* @__PURE__ */ jsx(Centered, { children: diff.message }),
      diff.state === "ready" && diff.value.lines.length === 0 && /* @__PURE__ */ jsx(Centered, { children: "Nothing to show for this file." }),
      diff.state === "ready" && diff.value.truncated && /* @__PURE__ */ jsx("p", { className: "border-b bg-warning/8 px-3 py-1 font-sans text-warning text-xs", children: "Only the end of this diff is shown: it is longer than 64 KB." }),
      diff.state === "ready" && (mode === "unified" ? /* @__PURE__ */ jsx(Unified, { lines: diff.value.lines }) : /* @__PURE__ */ jsx(Split, { lines: diff.value.lines }))
    ] })
  ] });
}
var lineBg = { add: "bg-success/10", del: "bg-destructive/10", ctx: "", hunk: "bg-info/8 text-info", meta: "text-muted-foreground italic" };
function Num({ n }) {
  return /* @__PURE__ */ jsx("span", { className: "w-11 shrink-0 select-none pr-2 text-right text-muted-foreground/60", children: n ?? "" });
}
function Unified({ lines }) {
  return /* @__PURE__ */ jsx("div", { className: "min-w-fit", children: lines.map((l, i) => /* @__PURE__ */ jsx("div", { className: cn("flex whitespace-pre", lineBg[l.kind]), children: l.kind === "hunk" ? /* @__PURE__ */ jsx("span", { className: "px-3", children: l.text }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Num, { n: l.oldNo }),
    /* @__PURE__ */ jsx(Num, { n: l.newNo }),
    /* @__PURE__ */ jsx("span", { className: "w-4 shrink-0 select-none text-muted-foreground", children: l.kind === "add" ? "+" : l.kind === "del" ? "\u2212" : "" }),
    /* @__PURE__ */ jsx("span", { className: "pr-4", children: l.text || " " })
  ] }) }, i)) });
}
function Split({ lines }) {
  const rows = useMemo(() => splitRows(lines), [lines]);
  return /* @__PURE__ */ jsx("div", { className: "min-w-fit", children: rows.map(
    (r, i) => r.hunk ? /* @__PURE__ */ jsx("div", { className: cn("whitespace-pre px-3", lineBg.hunk), children: r.hunk }, i) : /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2", children: [
      /* @__PURE__ */ jsx(Half, { line: r.left, side: "old" }),
      /* @__PURE__ */ jsx(Half, { line: r.right, side: "new" })
    ] }, i)
  ) });
}
function Half({ line, side }) {
  if (!line) return /* @__PURE__ */ jsx("div", { className: "border-r bg-muted/40" });
  return /* @__PURE__ */ jsxs("div", { className: cn("flex min-w-0 whitespace-pre border-r", line.kind !== "ctx" && lineBg[line.kind]), children: [
    /* @__PURE__ */ jsx(Num, { n: side === "old" ? line.oldNo : line.newNo }),
    /* @__PURE__ */ jsx("span", { className: "overflow-hidden pr-3", children: line.text || " " })
  ] });
}
function CommitBox({ run, count, branch, onDone, berth }) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState();
  const commit = async (push) => {
    setBusy(true);
    setError(void 0);
    try {
      const r = await run(`git add -A && git commit -q -m ${quote(message.trim())}${push ? " && git push -u origin HEAD 2>&1" : ""}`);
      if (r.exit_code !== 0) throw new Error(r.output.trim() || `git exited with ${r.exit_code}`);
      berth.notify(push ? `Committed and pushed ${branch}` : `Committed on ${branch}`, message.trim().split("\n")[0]);
      setMessage("");
      setOpen(false);
      onDone();
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "shrink-0 space-y-2 border-t p-2", children: [
    /* @__PURE__ */ jsx(
      Textarea,
      {
        size: "sm",
        value: message,
        onChange: (e) => setMessage(e.target.value),
        placeholder: "Commit message",
        rows: 2,
        className: "text-xs"
      }
    ),
    /* @__PURE__ */ jsxs(Button, { size: "sm", className: "w-full", disabled: !message.trim(), onClick: () => setOpen(true), children: [
      "Commit ",
      count,
      " file",
      count === 1 ? "" : "s",
      "\u2026"
    ] }),
    /* @__PURE__ */ jsx(AlertDialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxs(AlertDialogPopup, { children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsxs(AlertDialogTitle, { children: [
          "Commit on ",
          branch,
          "?"
        ] }),
        /* @__PURE__ */ jsxs(AlertDialogDescription, { children: [
          "Stages all ",
          count,
          " changed file",
          count === 1 ? "" : "s",
          " (including new ones) and commits them on the box. Push also sends the branch to origin."
        ] })
      ] }),
      error && /* @__PURE__ */ jsx("p", { className: "mx-6 whitespace-pre-wrap rounded-md bg-destructive/8 p-2 font-mono text-destructive text-xs", children: error }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogClose, { render: /* @__PURE__ */ jsx(Button, { variant: "ghost" }), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { variant: "outline", loading: busy, onClick: () => void commit(true), children: "Commit and push" }),
        /* @__PURE__ */ jsx(Button, { loading: busy, onClick: () => void commit(false), children: "Commit" })
      ] })
    ] }) })
  ] });
}
function PushButton({ run, branch, onDone, berth }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Button, { size: "sm", variant: "outline", onClick: () => setOpen(true), children: [
      /* @__PURE__ */ jsx(Icon, { name: "Upload", className: "size-3.5" }),
      " Push ",
      branch,
      "\u2026"
    ] }),
    /* @__PURE__ */ jsx(AlertDialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxs(AlertDialogPopup, { children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsxs(AlertDialogTitle, { children: [
          "Push ",
          branch,
          " to origin?"
        ] }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { children: "Runs git push -u origin HEAD on the box." })
      ] }),
      error && /* @__PURE__ */ jsx("p", { className: "mx-6 whitespace-pre-wrap rounded-md bg-destructive/8 p-2 font-mono text-destructive text-xs", children: error }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogClose, { render: /* @__PURE__ */ jsx(Button, { variant: "ghost" }), children: "Cancel" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            loading: busy,
            onClick: async () => {
              setBusy(true);
              setError(void 0);
              const r = await run("git push -u origin HEAD 2>&1").catch((err) => ({ exit_code: 1, output: String(err) }));
              setBusy(false);
              if (r.exit_code !== 0) return setError(r.output.trim());
              berth.notify(`Pushed ${branch}`);
              setOpen(false);
              onDone();
            },
            children: "Push"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  index_default as default
};
