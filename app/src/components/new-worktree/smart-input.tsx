import { ChevronDownIcon, CircleAlertIcon, GitBranchIcon, GitPullRequestIcon, InfoIcon, LoaderIcon, SparklesIcon, TicketIcon, TypeIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { Frame, FramePanel } from "@/components/ui/frame";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger, menuWidths } from "@/components/ui/menu";
import type { Branch, ResolveKind, Resolution } from "@/lib/projects";
import { color, font, radius } from "@/styles/tokens.stylex";


const still = "@media (prefers-reduced-motion: reduce)";
const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const styles = stylex.create({
  row: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
  },
  mode: {
    display: "inline-flex",
    height: 28,
    flexShrink: 0,
    alignItems: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingLeft: 8,
    paddingRight: 8,
    fontWeight: 500,
    fontSize: 13,
    color: { default: color.mutedForeground, ":hover": color.foreground, "[data-popup-open]": color.foreground },
    backgroundColor: { default: "transparent", ":hover": color.accent, "[data-popup-open]": color.accent },
  },
  modeIcon: { width: 14, height: 14 },
  chevron: { width: 12, height: 12, opacity: 0.6 },
  rule: { height: 16, width: 1, flexShrink: 0, backgroundColor: color.border },
  field: {
    height: 36,
    minWidth: 0,
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: 14,
    outline: "none",
    "::placeholder": { color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)" },
  },
  choice: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: 8,
  },
  choiceIcon: { width: 14, height: 14, marginTop: 2, flexShrink: 0, opacity: 0.8 },
  choiceText: { display: "flex", minWidth: 0, flexDirection: "column" },
  hint: { color: color.mutedForeground, fontSize: 12 },
  listWrap: { position: "relative", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: color.border },
  list: {
    height: "9.25rem",
    overflowY: "auto",
    padding: 4,
    maskImage: "linear-gradient(to bottom, black calc(100% - 1.25rem), transparent)",
  },
  empty: { paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, color: color.mutedForeground, fontSize: 13 },
  group: { paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 2, fontWeight: 500, fontSize: 11, color: color.mutedForeground },
  option: {
    display: "flex",
    height: 28,
    width: "100%",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingLeft: 8,
    paddingRight: 8,
    textAlign: "left",
    fontFamily: font.mono,
    fontSize: "12.5px",
  },
  optionOn: { backgroundColor: color.accent },
  branchIcon: { width: 14, height: 14, flexShrink: 0, color: color.mutedForeground },
  name: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: {
    marginLeft: "auto",
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: 6,
    fontFamily: font.sans,
    color: color.mutedForeground,
    fontSize: 12,
  },
  origin: { borderRadius: radius.sm, borderWidth: 1, borderStyle: "solid", borderColor: color.border, paddingLeft: 4, paddingRight: 4, fontSize: 11 },
  preview: {
    display: "flex",
    minHeight: 32,
    minWidth: 0,
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    fontSize: 13,
    color: color.mutedForeground,
  },
  previewIcon: { width: 14, height: 14, flexShrink: 0 },
  good: { color: color.success },
  warn: { color: "var(--warning)" },
  spin: { animationName: spin, animationDuration: { default: "1s", [still]: "0s" }, animationTimingFunction: "linear", animationIterationCount: "infinite" },
  stack: { display: "flex", flexDirection: "column" },
  dim: { opacity: 0.6 },
  what: { flexShrink: 0, fontWeight: 500, color: color.foreground },
  how: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font.mono, fontSize: "12.5px", color: color.mutedForeground },
  howCap: { maxWidth: "40%", flexShrink: 0 },
  title: { minWidth: 0, flexGrow: 1, flexBasis: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "color-mix(in oklab, var(--foreground) 80%, transparent)" },
  note: { marginTop: -6, fontSize: 12 },
  clip: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

function cls(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

const modes: { kind: ResolveKind; label: string; hint: string; placeholder: string; Icon: typeof SparklesIcon }[] = [
  { kind: "smart", label: "Smart", hint: "Works out what you typed", placeholder: "A name, #1234, a branch, or a GitHub, GitLab or Jira link", Icon: SparklesIcon },
  { kind: "github", label: "GitHub", hint: "#123, or a pull request or issue link", placeholder: "#1234, or a pull request or issue link", Icon: GitPullRequestIcon },
  { kind: "gitlab", label: "GitLab", hint: "!123, or a merge request or issue link", placeholder: "!1234, or a merge request or issue link", Icon: GitPullRequestIcon },
  { kind: "branch", label: "Branch", hint: "Check out a branch that exists", placeholder: "Search branches", Icon: GitBranchIcon },
  { kind: "name", label: "Name", hint: "A new branch, named as typed", placeholder: "A name for the worktree and its new branch", Icon: TypeIcon },
];

// StartFrom is the one field that says what to make: a name, a branch, a
// pull request or an issue. Its mode narrows how the input is read; the row
// under it shows what the box made of it.
export function StartFrom({
  value,
  onChange,
  kind,
  onKind,
  resolution,
  pending,
  error,
  branches,
  defaultBranch,
  focus = true,
}: {
  value: string;
  onChange(v: string): void;
  kind: ResolveKind;
  onKind(k: ResolveKind): void;
  resolution?: Resolution;
  pending: boolean;
  error?: string;
  branches?: { default?: string; branches: Branch[] };
  defaultBranch?: string;
  // Take the keyboard once open (a dialog of its own); the composer keeps it.
  focus?: boolean;
}) {
  const mode = modes.find((m) => m.kind === kind) ?? modes[0];
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // The dialog moves focus to its first control as it opens; this field is
  // where typing should go, so take it back once it has.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [focus]);
  const shownBranches = useMemo(() => {
    if (kind !== "branch" || !branches) return [];
    const q = value.trim().toLowerCase();
    const sorted = [...branches.branches].sort((a, b) => Number(!!a.remote) - Number(!!b.remote));
    return (q ? sorted.filter((b) => b.name.toLowerCase().includes(q)) : sorted).slice(0, 50);
  }, [kind, branches, value]);

  return (
    <Frame radius="xl" tray>
      <FramePanel bare>
        <div className={cls(styles.row)}>
          <Menu>
            <MenuTrigger
              render={
                <button type="button" aria-label={`Read as: ${mode.label}`} className={cls(styles.mode)} />
              }
            >
              <mode.Icon className={cls(styles.modeIcon)} />
              {mode.label}
              <ChevronDownIcon className={cls(styles.chevron)} />
            </MenuTrigger>
            <MenuPopup align="start" width={menuWidths.w64}>
              <MenuRadioGroup
                value={kind}
                onValueChange={(v) => {
                  onKind(v as ResolveKind);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                {modes.map((m) => (
                  <MenuRadioItem key={m.kind} value={m.kind} closeOnClick>
                    <span className={cls(styles.choice)}>
                      <m.Icon className={cls(styles.choiceIcon)} />
                      <span className={cls(styles.choiceText)}>
                        <span>{m.label}</span>
                        <span className={cls(styles.hint)}>{m.hint}</span>
                      </span>
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
          <span aria-hidden className={cls(styles.rule)} />
          <input
            ref={inputRef}
            value={value}
            placeholder={mode.placeholder}
            aria-label="Start from"
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (kind !== "branch" || !shownBranches.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shownBranches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && shownBranches[active] && shownBranches[active].name !== value) {
                e.preventDefault();
                onChange(shownBranches[active].name);
              }
            }}
            className={cls(styles.field)}
          />
        </div>
        {kind === "branch" && branches && (
          <div className={cls(styles.listWrap)}>
            <div role="listbox" aria-label="Branches" className={cls(styles.list)}>
              {shownBranches.length === 0 && <p className={cls(styles.empty)}>No branch matches, so this makes a new one.</p>}
              {shownBranches.map((b, n) => (
                <div key={`${b.remote ? "r" : "l"}:${b.name}`}>
                  {(n === 0 || !!shownBranches[n - 1].remote !== !!b.remote) && <p className={cls(styles.group)}>{b.remote ? "Remote" : "Local"}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={b.name === value}
                    onMouseMove={() => setActive(n)}
                    onClick={() => onChange(b.name)}
                    className={cls(styles.option, n === active && styles.optionOn)}
                  >
                    <GitBranchIcon className={cls(styles.branchIcon)} />
                    <span className={cls(styles.name)}>{b.name}</span>
                    <span className={cls(styles.meta)}>
                      {b.current && "checked out"}
                      {!b.current && b.name === branches.default && "default"}
                      {b.remote && <span className={cls(styles.origin)}>origin</span>}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </FramePanel>
      <Preview kind={kind} value={value} resolution={resolution} pending={pending} error={error} defaultBranch={defaultBranch} />
    </Frame>
  );
}

function Preview({ kind, value, resolution, pending, error, defaultBranch }: { kind: ResolveKind; value: string; resolution?: Resolution; pending: boolean; error?: string; defaultBranch?: string }) {
  if (!value.trim())
    return (
      <div className={cls(styles.preview)}>
        <GitBranchIcon className={cls(styles.previewIcon)} />
        <span className={cls(styles.clip)}>
          {kind === "branch"
            ? "Pick a branch to check out in a new worktree."
            : kind === "github" || kind === "gitlab"
              ? "Paste a link or a number to start from a pull request or issue."
              : `Empty makes a new branch from ${defaultBranch ?? "the default branch"}, with a generated name.`}
        </span>
      </div>
    );
  if (error)
    return (
      <div className={cls(styles.preview)}>
        <CircleAlertIcon className={cls(styles.previewIcon, styles.warn)} />
        <span className={cls(styles.clip)}>Couldn't look it up, so it will be used as a name. {error}</span>
      </div>
    );
  if (!resolution)
    return (
      <div className={cls(styles.preview)}>
        <LoaderIcon className={cls(styles.previewIcon, styles.spin)} />
        Looking it up…
      </div>
    );
  const r = resolution;
  const Icon = r.kind === "pr" ? GitPullRequestIcon : r.kind === "issue" ? TicketIcon : GitBranchIcon;
  const issueNumber = /\/(?:-\/)?issues\/(\d+)/.exec(r.url ?? "")?.[1];
  const [what, how] =
    r.kind === "pr"
      ? [`PR #${r.pr}`, r.branch]
      : r.kind === "issue"
        ? [`Issue${issueNumber ? ` #${issueNumber}` : ""}`, `new branch ${r.branch}`]
        : r.kind === "remote-branch"
          ? ["Remote branch", `origin/${r.branch}`]
          : r.exists
            ? ["Existing branch", r.branch]
            : ["New branch", `${r.branch} from ${r.base ?? defaultBranch ?? "the default branch"}`];
  return (
    <div className={cls(styles.stack, pending && styles.dim)}>
      <div className={cls(styles.preview)}>
        <Icon className={cls(styles.previewIcon, (r.kind === "pr" || r.kind === "issue") && styles.good)} />
        <span className={cls(styles.what)}>{what}</span>
        <span className={cls(styles.how, !!r.title && styles.howCap)}>{how}</span>
        {r.title && <span className={cls(styles.title)}>{r.title}</span>}
      </div>
      {r.note && (
        <div className={cls(styles.preview, styles.note)}>
          <InfoIcon className={cls(styles.previewIcon)} />
          <span className={cls(styles.clip)}>{r.note}</span>
        </div>
      )}
    </div>
  );
}
