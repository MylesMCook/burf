import * as stylex from "@stylexjs/stylex";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, CloudDownloadIcon, FolderGit2Icon, FolderIcon, FolderOpenIcon, FolderPlusIcon, GitBranchIcon, ServerIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FolderBrowser } from "@/components/add-project/folder-browser";
import { dirname } from "@/components/add-project/intent";
import { mergeProgress, type RunResult, runPlan } from "@/components/add-project/run";
import { shortPath, uniqueName } from "@/components/add-project/unique-name";
import { type Destination, type Plan, type Row, usePlan } from "@/components/add-project/use-plan";
import { BoxStrip } from "@/components/add-project/box-strip";
import { Scene } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";
import { StepHeader } from "@/components/step-header";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import type { Location } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { Tip } from "@/components/tip";
import { selectWorktree } from "@/lib/workspaces";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { ErrorText } from "@/components/error-note";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "contents",
  },
  s1: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--input)",
      ":focus-within": "var(--ring)",
    },
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "4px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-within": "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    },
  },
  s2: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s3: {
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "fontFamily": {
      "default": "var(--font-mono)",
      "::placeholder": "var(--font-sans)",
    },
    "fontSize": {
      "default": "13px",
      "::placeholder": "14px",
    },
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "lineHeight": {
      "::placeholder": "20px",
    },
    "opacity": {
      ":disabled": 0.64,
    },
  },
  s4: {
    "flexShrink": 0,
  },
  s5: {
    "height": "224px",
    "overflowY": "auto",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--muted) 24%, transparent), color-mix(in oklab, var(--input) 16%, transparent))",
    },
    "padding": "4px",
  },
  s6: {
    "marginTop": "calc(4px * -1)",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "6px",
    "overflowX": "auto",
    "scrollbarWidth": "none",
  },
  s8: {
    "flexShrink": 0,
    "paddingInlineEnd": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "color": "var(--muted-foreground)",
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "marginInlineStart": "6px",
  },
  s12: {
    "marginInlineStart": "6px",
  },
  s13: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
  },
  s14: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "fontWeight": 500,
  },
  s17: {
    "fontWeight": 500,
  },
  s18: {
    "color": "var(--warning-foreground)",
  },
  s19: {
    "fontWeight": 500,
  },
  s20: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s21: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
  },
  s22: {
    "color": "color-mix(in oklab, var(--muted-foreground) 56%, transparent)",
  },
  s23: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s24: {
    "fontWeight": 500,
  },
  s25: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s26: {
    "color": "var(--foreground)",
  },
  s27: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s28: {
    "display": "flex",
    "height": "60px",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s29: {
    "opacity": 0.56,
  },
  s30: {
    "display": "inline-flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 48%, transparent)",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s31: {
    "color": "var(--foreground)",
  },
  s32: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "2px",
  },
  s33: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "baseline",
    "gap": "6px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s34: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s35: {
    "display": "flex",
    "width": "24px",
    "flexShrink": 0,
    "justifyContent": "flex-end",
  },
  s36: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12.5px",
  },
  s37: {
    "height": "20px",
    "minWidth": "0px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": {
      "default": "dashed",
      ":focus": "solid",
    },
    "borderColor": {
      "default": "transparent",
      ":hover": "var(--border)",
      ":focus": "var(--ring)",
    },
    "borderBottomColor": "var(--border)",
    "backgroundColor": "transparent",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "color-mix(in oklab, var(--foreground) 88%, transparent)",
    "outline": "none",
  },
  s38: {
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s39: {
    "marginTop": "4px",
  },
  s40: {
    "display": "flex",
    "height": "32px",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s41: {
    "backgroundColor": "var(--accent)",
    "color": "var(--accent-foreground)",
  },
  s42: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s43: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s44: {
    "color": "var(--muted-foreground)",
  },
  s45: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s46: {
    "marginInlineStart": "auto",
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s47: {
    "borderColor": "color-mix(in oklab, var(--foreground) 24%, transparent)",
    "color": "var(--foreground)",
  },
  s48: {
    "color": "var(--foreground)",
  },
  s49: {
    "color": "var(--success)",
  },
  s50: {
    "color": "var(--muted-foreground)",
  },
  s51: {
    "color": "var(--muted-foreground)",
  },
  s52: {
    "color": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
  },
  s53: {
    "display": "flex",
    "height": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "textWrap": "balance",
    "textAlign": "center",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s54: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "padding": "8px",
  },
  s55: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
  },
  s56: {
    "paddingBottom": "2px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s57: {
    "whiteSpace": "pre-wrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.625",
  },
  s58: {
    "display": "flex",
    "height": "22.5rem",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "textAlign": "center",
  },
  s59: {
    "marginBottom": "12px",
  },
  s60: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s61: {
    "textWrap": "balance",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s62: {
    "marginTop": "12px",
  },
  s63: {
    "display": "flex",
    "height": "22.5rem",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "textAlign": "center",
  },
  s64: {
    "marginBottom": "12px",
  },
  s65: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s66: {
    "textWrap": "balance",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s67: {
    "display": "inline-flex",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "cursor": {
      ":disabled": "default",
    },
  },
  s68: {
    "borderColor": "color-mix(in oklab, var(--foreground) 20%, transparent)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s69: {
    "borderColor": "var(--border)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s70: {
    "opacity": 0.56,
  },
  s71: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s72: {
    "backgroundColor": "var(--foreground)",
  },
  s73: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 56%, transparent)",
  },

  s74: {
    maxWidth: "20rem",
  },
  s75: {
    color: color.mutedForeground,
  },
  s76: {
    color: "var(--warning-foreground)",
  },
  s77: {
    width: 16,
    height: 16,
    flexShrink: 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// AddProjectDialog adds a repository on a box as a project. The boxes come
// first, because that is where a project lives; then one field takes
// whatever the person has (a path, a git URL, owner/repo, a PR link, a new
// name) and the box says what Enter will do there. Folders on the box and
// projects on the other boxes are offered below it, and the same repository
// can be set up on more boxes at once.
export function AddProjectDialog() {
  const draft = useStore((s) => s.locationDraft);
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && useStore.getState().closeAddLocation()}>
      {/* Anchored at the top, as New worktree is: Browse and the box's
          states differ in height, and a centred dialog would move its title. */}
      <DialogPopup anchored width="38" showCloseButton={false}>
        {draft && <Body key={draft.box ?? ""} startBox={draft.box} />}
      </DialogPopup>
    </Dialog>
  );
}

type Log = { box: string; lines: string[] };

function Body({ startBox }: { startBox?: string }) {
  const status = useStore((s) => s.status);
  const boxes = useMemo(() => status?.boxes ?? [], [status]);
  const firstOnline = boxes.find((b) => b.state === "online")?.name ?? "";
  const [box, setBox] = useState(startBox && boxes.some((b) => b.name === startBox) ? startBox : firstOnline);
  const online = boxes.find((b) => b.name === box)?.state === "online";
  const [browsing, setBrowsing] = useState(false);
  const [input, setInput] = useState("");
  const [dest, setDest] = useState<Destination>({});
  const [active, setActive] = useState(-1);
  const [also, setAlso] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "failed">("idle");
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController>(null);
  const queued = useRef(false);

  useEffect(() => {
    if (!box && firstOnline) setBox(firstOnline);
  }, [box, firstOnline]);
  useEffect(() => () => abort.current?.abort(), []);

  const { intent, plan, rows, pending, home } = usePlan(box, input, dest, online && !browsing);

  // A new repository starts from its own folder name and ~/work again.
  const repoKey = intent.kind === "repo" ? intent.url : "";
  useEffect(() => setDest({}), [repoKey]);
  // Typing a path is finding a folder: the first one that starts with what
  // was typed is what Enter takes, as Tab would complete it. Anything else
  // runs the plan.
  const rowsKey = rows.map((r) => r.key).join("|");
  useEffect(() => {
    const first = intent.kind === "path" && plan?.do === "create" ? rows.findIndex((r) => r.kind !== "new") : -1;
    setActive(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, plan?.do, box, input]);
  useEffect(() => setAlso((a) => a.filter((b) => b !== box)), [box]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Other boxes this repository could also be set up on.
  const slug = plan?.do === "clone" || plan?.do === "add" ? plan.slug : plan?.do === "open" ? plan.loc.slug : undefined;
  const canSpread = !!slug && (plan?.do === "clone" || plan?.do === "add" || (plan?.do === "open" && !!plan.loc.remote));
  // As one string, so the store selector returns something stable.
  const othersKey = useStore((s) =>
    boxes
      .filter((b) => b.name !== box && b.state === "online")
      .map((b) => `${b.name}:${!!slug && !!s.boxes[b.name]?.locations?.some((l) => l.slug?.toLowerCase() === slug.toLowerCase()) ? 1 : 0}`)
      .join(","),
  );
  const others = useMemo(() => (othersKey ? othersKey.split(",").map((x) => ({ name: x.slice(0, x.lastIndexOf(":")), has: x.endsWith(":1") })) : []), [othersKey]);
  const spreadTo = canSpread ? also.filter((b) => others.some((o) => o.name === b && !o.has)) : [];

  const busy = phase === "running";
  const actionable = !!plan && plan.do !== "blocked" && plan.do !== "look" && !busy;

  const finish = async ({ loc, extras }: RunResult, p: Plan) => {
    const st = useStore.getState();
    await Promise.all([st.refreshBox(box, ["locations"]), ...extras.filter((e) => e.loc).map((e) => st.refreshBox(e.box, ["locations"]))]);
    const main = loc.worktrees?.find((w) => w.main) ?? { name: loc.name, path: loc.path, main: true };
    st.closeAddLocation();
    selectWorktree({ box, location: loc.name, worktree: main.name, path: main.path, main: true });
    const placed = [box, ...extras.filter((e) => e.loc).map((e) => e.box)];
    const failed = extras.filter((e) => e.error);
    if (p.do !== "open" || placed.length > 1)
      toastManager.add({
        title: p.do === "open" ? `${loc.name} is on ${placed.join(", ")}` : `Added ${loc.name}`,
        description: `${shortPath(loc.path, home)} on ${placed.join(", ")}${failed.length ? `; not on ${failed.map((f) => f.box).join(", ")} (${failed[0].error})` : ""}`,
        type: failed.length ? "warning" : "success",
      });
    // A pull request or issue link: the project is here now, so make the
    // worktree for it next.
    const link = p.do === "clone" || p.do === "open" ? p.link : undefined;
    if (link) st.openNewWorktree({ box, location: loc.name, name: link.url });
  };

  const run = async (p: Plan) => {
    if (p.do === "blocked" || p.do === "look" || busy) return;
    setPhase("running");
    setError(undefined);
    setLogs([]);
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      const res = await runPlan(p, {
        box,
        home,
        // The boxes picked below are for the plan shown, not a row picked instead.
        also: p === plan ? spreadTo : [],
        signal,
        onLine: (b, line) =>
          setLogs((ls) => {
            const i = ls.findIndex((l) => l.box === b);
            if (i < 0) return [...ls, { box: b, lines: [line] }];
            return ls.map((l, n) => (n === i ? { ...l, lines: mergeProgress(l.lines, line) } : l));
          }),
      });
      await finish(res, p);
    } catch (err) {
      setError(signal.aborted ? "Stopped." : plainError(err));
      setPhase("failed");
    }
  };

  // Enter before the box has answered does, once it has, what Enter would
  // have done then: take the folder a typed path points at, or run the plan.
  useEffect(() => {
    if (!queued.current || pending) return;
    queued.current = false;
    const first = intent.kind === "path" && plan?.do === "create" ? rows.findIndex((r) => r.kind !== "new") : -1;
    if (first >= 0) pick(rows[first]);
    else if (plan?.do === "look") setActive(rows.length ? 0 : -1);
    else if (plan) void run(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, plan]);

  // The plan line follows the highlighted row when Enter would take it.
  const activeRow = active >= 0 ? rows[active] : undefined;
  const rowPlan: Plan | undefined =
    activeRow?.kind === "project" && activeRow.loc
      ? { do: "open", loc: activeRow.loc, note: `Already a project on ${box}` }
      : activeRow?.kind === "repo" && activeRow.entry
        ? { do: "add", path: activeRow.entry.path, name: uniqueName(box, activeRow.entry.name), git: true, slug: activeRow.entry.slug }
        : undefined;
  const shown = rowPlan ?? (input.trim() ? plan : undefined);

  const pick = (r: Row, complete = false) => {
    if (complete || r.kind === "folder" || r.kind === "elsewhere") {
      setInput(r.fill);
      field.current?.focus();
      return;
    }
    if (r.kind === "new") return void (plan && run(plan));
    if (r.loc) return void run({ do: "open", loc: r.loc });
    if (r.entry) return void run({ do: "add", path: r.entry.path, name: uniqueName(box, r.entry.name), git: !!r.entry.git, slug: r.entry.slug });
  };

  const submit = () => {
    if (busy) return;
    if (active >= 0 && rows[active]) return pick(rows[active]);
    if (!input.trim()) return;
    if (pending) {
      queued.current = true;
      return;
    }
    // Enter on a folder ("~/work/") goes into its list, as ↓ would; it
    // never adds the folder itself.
    if (plan?.do === "look") return setActive(rows.length ? 0 : -1);
    if (plan) void run(plan);
  };

  const close = () => useStore.getState().closeAddLocation();

  // No box at all: a project has nowhere to live yet, so the one thing to
  // do is add a box. Only once the status has come, so a slow start does
  // not flash it.
  if (status && boxes.length === 0) return <NoBoxes onCancel={close} />;

  if (browsing && online) {
    return (
      <>
        <StepHeader onBack={() => setBrowsing(false)} title="Browse folders" description={`Pick a repository or folder on ${box}.`} />
        <FolderBrowser box={box} start={intent.kind === "path" ? (input.trim().endsWith("/") ? input.trim().replace(/(.)\/+$/, "$1") : dirname(input.trim())) : undefined} onAdded={(loc: Location) => finish({ loc, extras: [] }, { do: "add", path: loc.path, name: loc.name, git: loc.repo })} />
      </>
    );
  }

  return (
    <form
      className={sx(paint.s0)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <StepHeader title="Add a project" description={boxes.length > 1 ? "Projects live on your boxes. Pick one, then type what to add: the box works out the rest." : `Projects live on your boxes. Type what to add on ${box || "it"}: the box works out the rest.`} />
      <DialogPanel inset="section" stack={3}>
        {boxes.length > 0 && <BoxStrip boxes={boxes} value={box} onChange={(b) => !busy && setBox(b)} />}

        {!online ? (
          <Moored box={box} others={boxes.some((b) => b.name !== box && b.state === "online")} />
        ) : (
          <>
            <div className={sx(paint.s1)}>
              <ChevronRightIcon aria-hidden className={sx(paint.s2)} />
              <input
                ref={field}
                autoFocus
                value={input}
                disabled={busy}
                spellCheck={false}
                autoComplete="off"
                aria-label="Path, git URL, owner/repo or new name"
                placeholder={`A path on ${box}, a git URL, owner/repo, or a new name`}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter is handled here, not by the form: a form whose
                  // button is disabled (the box still answering) ignores it.
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, rows.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, -1));
                  } else if (e.key === "Tab" && !e.shiftKey && (active >= 0 || (intent.kind === "path" && rows.length > 0))) {
                    // Tab completes, as in a shell.
                    e.preventDefault();
                    pick(rows[Math.max(active, 0)], true);
                  }
                }}
                className={sx(paint.s3)}
              />
              <span className={sx(paint.s4)}><Button type="button" size="xs" variant="ghost"  disabled={busy} onClick={() => setBrowsing(true)} muted>
                <FolderOpenIcon />
                Browse
              </Button></span>
            </div>

            <PlanLine plan={shown} pending={pending && !!input.trim() && shown === plan} box={box} home={home} target={active < 0 || shown !== plan || rows[active]?.kind === "new"} dest={dest} setDest={setDest} busy={busy} onEnter={() => (pending ? (queued.current = true) : plan && void run(plan))} />

            <div ref={listRef} className={sx(paint.s5)}>
              {phase !== "idle" ? (
                <Progress logs={logs} busy={busy} />
              ) : rows.length === 0 ? (
                <Quiet intent={intent.kind} plan={plan} box={box} pending={pending} />
              ) : (
                <Rows rows={rows} active={active} onHover={setActive} onPick={pick} />
              )}
            </div>
            {error && <ErrorText className={sx(paint.s6)} text={error} />}
          </>
        )}
      </DialogPanel>

      <DialogFooter pad="tall">
        <div className={sx(paint.s7)}>
          {online && canSpread && others.length > 0 ? (
            <>
              <span className={sx(paint.s8)}>Also on</span>
              {others.map((o) => (
                <Chip
                  key={o.name}
                  on={o.has || also.includes(o.name)}
                  disabled={o.has || busy}
                  title={o.has ? `${o.name} already has ${slug}` : `Clone it on ${o.name} too`}
                  onClick={() => setAlso((a) => (a.includes(o.name) ? a.filter((x) => x !== o.name) : [...a, o.name]))}
                >
                  {o.name}
                  {o.has && <span className={sx(paint.s9)}>has it</span>}
                </Chip>
              ))}
            </>
          ) : online ? (
            <span className={sx(paint.s10)}>
              <Kbd>↑↓</Kbd> pick <span className={sx(paint.s11)}><Kbd>⇥</Kbd></span> complete <span className={sx(paint.s12)}><Kbd>↵</Kbd></span> {activeRow && !rowPlan && activeRow.kind !== "new" ? "choose" : verb(shown)}
            </span>
          ) : null}
        </div>
        <div className={sx(paint.s13)}>
          {busy ? (
            <Button type="button" variant="ghost" onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
          {online && (
            <Button type="submit" loading={busy} disabled={!busy && (!actionable || !input.trim() || (pending && !queued.current)) && active < 0}>
              {active >= 0 && rows[active] && rows[active].kind !== "new" ? rowVerb(rows[active]) : primaryLabel(plan, spreadTo.length)}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}

const verb = (p?: Plan) => (p && p.do !== "blocked" ? { open: "open", add: "add", clone: "clone", create: "create", look: "choose" }[p.do] : "add");

function primaryLabel(p: Plan | undefined, extra: number): string {
  const more = extra ? ` on ${extra + 1} boxes` : "";
  switch (p?.do) {
    case "open":
      return extra ? `Open, and clone on ${extra === 1 ? "1 more box" : `${extra} more boxes`}` : "Open project";
    case "clone":
      return `Clone${more}`;
    case "create":
      return "Create project";
    case "add":
      return `Add project${more}`;
    default:
      return "Add project";
  }
}

const rowVerb = (r: Row) => ({ project: "Open project", repo: "Add project", elsewhere: "Choose", folder: "Open folder", new: "Create project" })[r.kind];

// PlanLine says exactly what Enter does, on which box. Two lines, always the
// same height, so nothing below moves as the answer changes.
function PlanLine({ plan, pending, box, home, target, dest, setDest, busy, onEnter }: { plan?: Plan; pending: boolean; box: string; home?: string; target: boolean; dest: Destination; setDest(d: Destination): void; busy: boolean; onEnter(): void }) {
  const short = (p: string) => shortPath(p, home);
  const on = <span className={sx(paint.s14)}>on {box}</span>;
  let icon: React.ReactNode = <ArrowRightIcon />;
  let line: React.ReactNode;
  let detail: React.ReactNode;
  let tone = "";
  switch (plan?.do) {
    case undefined:
      icon = <ArrowRightIcon />;
      line = <span className={sx(paint.s15)}>Add a folder, clone a repository, or start a new one.</span>;
      detail = <>The box checks what you type and says what Enter will do.</>;
      tone = (sx(paint.s75) ?? "");
      break;
    case "open":
      icon = <ArrowRightIcon />;
      line = (
        <>
          <b className={sx(paint.s16)}>Open</b> <Mono>{plan.loc.name}</Mono> {on}
        </>
      );
      detail = (
        <>
          {plan.link ? "Already here" : (plan.note ?? "Already a project here")}, at <Mono>{short(plan.loc.path)}</Mono>
          {plan.link && <>; {plan.link.kind === "pr" ? `PR #${plan.link.n}` : `issue #${plan.link.n}`} opens as a new worktree next</>}
        </>
      );
      break;
    case "add":
      icon = plan.git ? <FolderGit2Icon /> : <FolderIcon />;
      line = (
        <>
          <b className={sx(paint.s17)}>Add</b> <Mono>{short(plan.path)}</Mono> {on}
        </>
      );
      detail = plan.git ? (
        <>
          {plan.note ? `${plan.note} ` : ""}git{plan.slug ? ` · ${plan.slug}` : " · no remote"} · as <Mono>{plan.name}</Mono>
        </>
      ) : (
        <span className={sx(paint.s18)}>Not a git repository: it can be a project, but worktrees need git.</span>
      );
      break;
    case "clone":
      icon = <CloudDownloadIcon />;
      line = (
        <>
          <b className={sx(paint.s19)}>Clone</b> <Mono className={sx(paint.s20)}>{plan.display}</Mono> {on}
        </>
      );
      detail = (
        <span className={sx(paint.s21)}>
          into
          <Inline value={dest.parent ?? plan.parent} label="Parent folder" disabled={busy} onChange={(v) => setDest({ ...dest, parent: v })} onEnter={onEnter} />
          <span className={sx(paint.s22)}>/</span>
          <Inline value={dest.folder ?? plan.folder} label="Folder" disabled={busy} onChange={(v) => setDest({ ...dest, folder: v })} onEnter={onEnter} />
          {plan.link && <span className={sx(paint.s23)}>, then {plan.link.kind === "pr" ? `PR #${plan.link.n}` : `issue #${plan.link.n}`} as a worktree</span>}
        </span>
      );
      break;
    case "create":
      icon = <FolderPlusIcon />;
      line = (
        <>
          <b className={sx(paint.s24)}>Create</b> <Mono>{`${plan.parent}/${plan.folder}`}</Mono> <span className={sx(paint.s25)}>and git init {`on ${box}`}</span>
        </>
      );
      detail = <>A new repository with an empty first commit, ready for worktrees.</>;
      break;
    case "look":
      icon = <FolderOpenIcon />;
      tone = (sx(paint.s75) ?? "");
      line = (
        <>
          <span>Inside</span> <Mono className={sx(paint.s26)}>{short(plan.path)}</Mono> {on}
        </>
      );
      detail = <>A folder to look in: ↓ or Enter picks from what is in it, or keep typing.</>;
      break;
    case "blocked":
      icon = <TriangleAlertIcon />;
      tone = (sx(paint.s76) ?? "");
      line = <span className={sx(paint.s27)}>{plan.message}</span>;
      detail = <>Change what you typed, or browse the box.</>;
      break;
  }
  const ready = !!plan && plan.do !== "blocked" && plan.do !== "look";
  return (
    <div aria-live="polite" className={[sx(paint.s28), pending && plan && sx(paint.s29)].filter(Boolean).join(" ")}>
      <span className={[sx(paint.s30), ready && sx(paint.s31), tone].filter(Boolean).join(" ")}>{icon}</span>
      <div className={sx(paint.s32)}>
        <p className={[sx(paint.s33), tone].filter(Boolean).join(" ")}>{line}</p>
        <div className={sx(paint.s34)}>{detail}</div>
      </div>
      <span className={sx(paint.s35)}>{pending ? <Spinner  size="md" muted/> : ready && target ? <Kbd>↵</Kbd> : null}</span>
    </div>
  );
}

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={[sx(paint.s36), className].filter(Boolean).join(" ")}>{children}</span>;
}

// Inline is an editable piece of the plan's sentence: where a clone goes.
function Inline({ value, label, disabled, onChange, onEnter }: { value: string; label: string; disabled?: boolean; onChange(v: string): void; onEnter(): void }) {
  return (
    <input
      aria-label={label}
      value={value}
      disabled={disabled}
      spellCheck={false}
      size={Math.max(4, value.length)}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className={sx(paint.s37)}
    />
  );
}

function Rows({ rows, active, onHover, onPick }: { rows: Row[]; active: number; onHover(i: number): void; onPick(r: Row): void }) {
  let group = "";
  return (
    <div role="listbox" aria-label="Suggestions">
      {rows.map((r, i) => {
        const head = r.group !== group;
        group = r.group;
        return (
          <div key={r.key}>
            {head && <p className={[sx(paint.s38), i > 0 && sx(paint.s39)].filter(Boolean).join(" ")}>{r.group}</p>}
            <button
              type="button"
              role="option"
              data-row={i}
              aria-selected={i === active}
              tabIndex={-1}
              onMouseMove={() => i !== active && onHover(i)}
              onClick={() => onPick(r)}
              className={[sx(paint.s40), i === active ? sx(paint.s41) : sx(paint.s42)].filter(Boolean).join(" ")}
            >
              <RowIcon kind={r.kind} />
              <span className={[sx(paint.s43), r.kind === "folder" && sx(paint.s44)].filter(Boolean).join(" ")}>{r.title}</span>
              {r.detail && <span className={sx(paint.s45)}>{r.detail}</span>}
              {r.badge && <span className={[sx(paint.s46), r.kind === "new" && sx(paint.s47)].filter(Boolean).join(" ")}>{r.badge}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RowIcon({ kind }: { kind: Row["kind"] }) {
  const c = (sx(paint.s77) ?? "");
  if (kind === "new") return <FolderPlusIcon className={[c, sx(paint.s48)].filter(Boolean).join(" ")} />;
  if (kind === "repo") return <GitBranchIcon className={[c, sx(paint.s49)].filter(Boolean).join(" ")} />;
  if (kind === "project") return <CheckIcon className={[c, sx(paint.s50)].filter(Boolean).join(" ")} />;
  if (kind === "elsewhere") return <ServerIcon className={[c, sx(paint.s51)].filter(Boolean).join(" ")} />;
  return <FolderIcon className={[c, sx(paint.s52)].filter(Boolean).join(" ")} />;
}

// Quiet fills the list when there is nothing to pick: what the box will do
// for a clone, or that nothing matched.
function Quiet({ intent, plan, box, pending }: { intent: string; plan?: Plan; box: string; pending: boolean }) {
  let text = pending ? `Looking on ${box}…` : `Nothing here matches on ${box}.`;
  if (!pending && plan?.do === "clone") text = `${box} clones it with its own git credentials, so private repositories work as they do in a terminal there.`;
  if (!pending && plan?.do === "open") text = `Nothing to clone: ${box} has it already.`;
  if (!pending && plan?.do === "blocked") text = `Browse ${box} to find the folder you mean.`;
  if (!pending && plan?.do === "look") text = `Nothing in ${plan.path} yet. Type a name after the slash to start a project there.`;
  if (!pending && intent === "empty") text = `No folders in ${box}'s home or ~/work yet. Type a name to start a project.`;
  return <p className={sx(paint.s53)}>{text}</p>;
}

function Progress({ logs, busy }: { logs: Log[]; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);
  return (
    <div ref={ref} aria-live="polite" className={sx(paint.s54)}>
      {logs.length === 0 && busy && <p className={sx(paint.s55)}>Starting…</p>}
      {logs.map((l) => (
        <div key={l.box}>
          {logs.length > 1 && <p className={sx(paint.s56)}>{l.box}</p>}
          <pre className={sx(paint.s57)}>{l.lines.join("\n")}</pre>
        </div>
      ))}
    </div>
  );
}

// Moored is the dialog's body when the chosen box is out of reach, the same
// height as the field, plan and list it stands in for.
function Moored({ box, others }: { box: string; others: boolean }) {
  return (
    <div className={sx(paint.s58)}>
      <Scene name="offline" width={136} className={sx(paint.s59)} />
      <p className={sx(paint.s60)}>{box ? `${box} is offline` : "No box is online"}</p>
      <p className={[sx(paint.s61), sx(paint.s74)].filter(Boolean).join(" ")}>
        {others ? "Projects are added on a box that is online. Pick another above, or check on this one in Boxes." : "Projects are added on a box that is online. Check on your boxes in Settings."}
      </p>
      <span className={sx(paint.s62)}><Button
        size="sm"
        variant="outline"
        
        onClick={() => {
          // Boxes is a page: the dialog goes, or it would sit over it.
          useStore.getState().closeAddLocation();
          useStore.getState().setView({ kind: "settings", section: "boxes" });
        }}>
        <ServerIcon />
        Open Boxes
      </Button></span>
    </div>
  );
}

// NoBoxes is the whole dialog when there is no box yet: a project lives on
// one, so it says so and offers the one way forward.
function NoBoxes({ onCancel }: { onCancel(): void }) {
  return (
    <>
      <StepHeader title="Add a project" description="Projects live on your boxes, and there isn't one yet." />
      <DialogPanel inset="section">
        <div className={sx(paint.s63)}>
          {/* A quay with an empty hook: nothing loaded yet. */}
          <Scene name="dock" width={136} className={sx(paint.s64)} />
          <p className={sx(paint.s65)}>Add a box first</p>
          <p className={[sx(paint.s66), sx(paint.s74)].filter(Boolean).join(" ")}>A box is any VPS or dev machine: projects and their agents run there. Add one, then add a project on it.</p>
        </div>
      </DialogPanel>
      <DialogFooter pad="bar">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          autoFocus
          onClick={() => {
            onCancel();
            openAddBox();
          }}
        >
          <ServerIcon />
          Add a box
        </Button>
      </DialogFooter>
    </>
  );
}

function Chip({ on, disabled, title, onClick, children }: { on: boolean; disabled?: boolean; title?: string; onClick(): void; children: React.ReactNode }) {
  const chip = (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={[sx(paint.s67), on ? sx(paint.s68) : sx(paint.s69), disabled && !on && sx(paint.s70)].filter(Boolean).join(" ")}
    >
      <span className={[sx(paint.s71), on ? sx(paint.s72) : sx(paint.s73)].filter(Boolean).join(" ")} />
      {children}
    </button>
  );
  return title ? <Tip label={title}>{chip}</Tip> : chip;
}
