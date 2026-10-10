import * as stylex from "@stylexjs/stylex";
import { color } from "@/styles/tokens.stylex";
import { AlarmClockIcon, BellIcon, BellOffIcon, CheckCheckIcon, CheckIcon, ChevronDownIcon, CircleCheckIcon, CloudOffIcon, EllipsisIcon, GitPullRequestArrowIcon, GlobeIcon, KeyRoundIcon, MailIcon, MailOpenIcon, MegaphoneIcon, MessageCircleQuestionIcon, PuzzleIcon, SendIcon, ServerCrashIcon, SettingsIcon, ShieldAlertIcon, SquareTerminalIcon, TrashIcon, WorkflowIcon, WrenchIcon, XIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { watchReviewNotes } from "@/components/notifications/review-source";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Scene } from "@/components/art/scenes";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Session } from "@/lib/api";
import { sessionAgent, sessionName, sessionPlace, sessionState } from "@/lib/derive";
import { type Category, categoryInfo, clearEarlier, dismiss, markAllRead, markRead, type Note, needsYou, noteLabel, openNote, quietNow, runAction, quietState, setDoNotDisturb, setNotificationsOpen, snooze, snoozed, toggleNotifications, unsnooze, useNotifications, useNotifyPrefs } from "@/lib/notifications";
import { type BoxData, useStore } from "@/lib/store";
import { attentionCount, shownNoteTitle } from "@/lib/attention";
import { titleAt } from "@/lib/worktree-names";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s1: {
    "position": "relative",
    "display": "inline-flex",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--sidebar-accent)",
    },
  },
  s2: {
    "width": "32px",
    "height": "32px",
    "borderRadius": "var(--radius-lg)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s3: {
    "width": "26px",
    "height": "26px",
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s4: {
    "backgroundColor": "var(--sidebar-accent)",
    "color": "var(--foreground)",
  },
  s5: {
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s6: {
    "position": "absolute",
    "display": "flex",
    "height": "14px",
    "minWidth": "14px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 600,
    "fontSize": "9px",
    "color": "#000",
    "fontVariantNumeric": "tabular-nums",
    "lineHeight": "1",
  },
  s7: {
    "display": "flex",
    "height": "48px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingRight": "8px",
    "paddingLeft": "16px",
    "outline": "none",
  },
  s9: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.7,
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
  },
  s11: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s12: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s13: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s14: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s16: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s17: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "40px",
    "paddingBottom": "40px",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "6px",
    "paddingBottom": "8px",
  },
  s20: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": {
      "default": "light-dark(var(--success-foreground), var(--success))",
    },
  },
  s22: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "flex",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "fontSize": "12px",
    "color": {
      "default": "light-dark(var(--destructive-foreground), var(--destructive))",
    },
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
    "display": "flex",
    "height": "28px",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontWeight": 500,
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
  },
  s26: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
  },
  s27: {
    "fontVariantNumeric": "tabular-nums",
  },
  s28: {
    "display": "flex",
    "flexDirection": "column",
  },
  s29: {
    "display": "none",
    "flexShrink": 0,
    "alignItems": "center",
    ":is(.group\\/row:focus-within &)": {
      "display": "flex",
    },
    ":is(.group\\/row:hover &)": {
      "display": "flex",
    },
  },
  s30: {
    "flexShrink": 0,
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
    ":is(.group\\/row:focus-within &)": {
      "display": "none",
    },
    ":is(.group\\/row:hover &)": {
      "display": "none",
    },
  },
  s31: {
    "position": "relative",
    "display": "flex",
    "cursor": "default",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px color-mix(in oklab, var(--ring) 60%, transparent)",
    },
  },
  s33: {
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s34: {
    "display": "flex",
    "height": "20px",
    "width": "6px",
    "flexShrink": 0,
    "alignItems": "center",
  },
  s35: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s36: {
    "backgroundColor": "var(--warning)",
  },
  s37: {
    "backgroundColor": "var(--info)",
  },
  s38: {
    "display": "flex",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s44: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s45: {
    "display": "flex",
    "height": "20px",
    "alignItems": "center",
    "gap": "6px",
  },
  s46: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
  },
  s47: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s48: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s49: {
    "flexShrink": 0,
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s50: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s51: {
    "display": "flex",
    "height": "18px",
    "alignItems": "center",
    "gap": "8px",
  },
  s52: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s53: {
    "display": "none",
    "flexShrink": 0,
    "color": {
      "default": "color-mix(in oklab, var(--foreground) 80%, transparent)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "textDecoration": {
      ":hover": "underline",
    },
    ":is(.group\\/row:focus-within &)": {
      "display": "inline",
    },
    ":is(.group\\/row:hover &)": {
      "display": "inline",
    },
  },
  s54: {
    "position": "relative",
    "display": "flex",
    "cursor": "default",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px color-mix(in oklab, var(--ring) 60%, transparent)",
    },
  },
  s55: {
    "display": "flex",
    "height": "20px",
    "width": "6px",
    "flexShrink": 0,
    "alignItems": "center",
  },
  s56: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
  },
  s57: {
    "display": "flex",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s58: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s59: {
    "display": "flex",
    "height": "20px",
    "alignItems": "center",
    "gap": "6px",
  },
  s60: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "color": "var(--foreground)",
  },
  s61: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s62: {
    "flexShrink": 0,
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s63: {
    "display": "flex",
    "height": "18px",
    "alignItems": "center",
    "gap": "8px",
  },
  s64: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s65: {
    "display": "none",
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
    ":is(.group\\/row:focus-within &)": {
      "display": "inline",
    },
    ":is(.group\\/row:hover &)": {
      "display": "inline",
    },
  },
  s66: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s67: {
    "marginTop": "calc(4px * -1)",
    "marginBottom": "calc(4px * -1)",
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--background)",
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },

  s68: {
    top: -2,
    right: -2,
  },
  s69: {
    marginTop: { ":not(:first-child)": 6 },
  },
  s70: {
    textUnderlineOffset: 2,
  },
  s71: {
    color: color.mutedForeground,
  },
  s72: {
    color: { default: color.destructiveForeground, ":is(.dark *)": color.destructive },
  },
  s73: {
    color: { default: "var(--warning-foreground)", ":is(.dark *)": color.warning },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// useMinute re-renders once a minute, so relative times and snoozes move.
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

// NotificationBell opens the centre. The count is unresolved needs-you, the
// same set as the header, and it turns amber while that set is not empty.
export function NotificationBell({ className, size = "sm" }: { className?: string; size?: "sm" | "rail" }) {
  const now = useMinute();
  const notes = useNotifications((s) => s.notes);
  const boxes = useStore((s) => s.boxes);
  const needs = notes.filter((n) => needsYou(n, now)).length;
  const count = attentionCount(needs, liveWaiting(boxes, notes).length);
  const open = useNotifications((s) => s.open);
  const quiet = useNotifyPrefs((p) => quietNow(p, new Date(now)));
  const label = ["Notifications", count ? `${count} need${count === 1 ? "s" : ""} you` : "", quiet ? "Do not disturb is on" : ""].filter(Boolean).join(" · ");
  const Icon = quiet ? BellOffIcon : BellIcon;
  return (
    <Tip
      label={
        <span className={sx(paint.s0)}>
          {label}
          <Kbd>⌘⇧N</Kbd>
        </span>
      }
      side={size === "rail" ? "right" : "top"}
    >
      <button
        type="button"
        aria-label={label}
        aria-keyshortcuts="Meta+Shift+N"
        onClick={toggleNotifications}
        className={[sx(paint.s1), size === "rail" ? sx(paint.s2) : sx(paint.s3), open && sx(paint.s4), count > 0 && sx(paint.s5), className].filter(Boolean).join(" ")}
      >
        <Icon />
        {count > 0 && (
          <span className={[sx(paint.s6), sx(paint.s68)].filter(Boolean).join(" ")}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    </Tip>
  );
}

const icons: Record<Category, React.ComponentType<{ className?: string }>> = {
  waiting: MessageCircleQuestionIcon,
  finished: CircleCheckIcon,
  review: GitPullRequestArrowIcon,
  flowFailed: WorkflowIcon,
  setupFailed: WrenchIcon,
  serviceFailed: ServerCrashIcon,
  guard: ShieldAlertIcon,
  notify: MegaphoneIcon,
  opened: SquareTerminalIcon,
  plugin: PuzzleIcon,
  secret: KeyRoundIcon,
  queueDelivered: SendIcon,
  queueFailed: CloudOffIcon,
};

// ---- Filters -----------------------------------------------------------

type Kind = "agents" | "problems" | "messages";
type Filter = "all" | "unread" | Kind;

// The kinds the filter offers. A category not listed here counts as a
// message.
const kinds: Partial<Record<Category, Kind>> = {
  waiting: "agents",
  finished: "agents",
  review: "agents",
  opened: "agents",
  queueDelivered: "agents",
  flowFailed: "problems",
  setupFailed: "problems",
  serviceFailed: "problems",
  secret: "problems",
  queueFailed: "problems",
  guard: "problems",
};
const kindOf = (c: Category): Kind => kinds[c] ?? "messages";

const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: "all", label: "All", empty: "Nothing here." },
  { id: "unread", label: "Unread", empty: "Nothing unread." },
  { id: "agents", label: "Agents", empty: "Nothing from agents." },
  { id: "problems", label: "Problems", empty: "No problems." },
  { id: "messages", label: "Messages", empty: "No messages from automations or plugins." },
];

const matches = (f: Filter, n: Note) => (f === "all" ? true : f === "unread" ? !n.read : kindOf(n.category) === f);

// ---- Shaping -----------------------------------------------------------

function short(iso: string, now: number): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// contextOf says where a note happened the way the sidebar does: "shop /
// checkout-fix · devl", or "shop · devl" for a main checkout.
function contextOf(n: Note, boxes: Record<string, BoxData>): string {
  // A worktree given a display name since is called by it.
  const wt = (n.box && n.path && !placeIsMain(n) && titleAt(n.box, n.path, boxes)) || n.worktree;
  let where = n.project ? (wt && wt !== n.project ? `${n.project} / ${wt}` : n.project) : wt;
  if (!where && n.box && n.session) {
    const data = boxes[n.box];
    const s = data?.sessions?.find((x) => x.name === n.session);
    if (s) where = sessionPlace(s, data?.locations);
  }
  return [where, n.box].filter(Boolean).join(" · ");
}

const placeIsMain = (n: Note) => !n.worktree && !!n.project;

// An item is one row: a note, or resolved repeats of one folded together.
interface Item {
  note: Note;
  ids: string[];
  count: number;
}

const DAY = 86_400_000;

function dayOf(iso: string, now: number): "Today" | "Yesterday" | "Older" {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t = new Date(iso).getTime();
  if (t >= start.getTime()) return "Today";
  if (t >= start.getTime() - DAY) return "Yesterday";
  return "Older";
}

// fold groups Earlier by day, and folds resolved repeats of the same thing
// (the same agent waiting, then answered, again and again) into one row.
function fold(notes: Note[], now: number): { title: string; items: Item[] }[] {
  const groups: { title: string; items: Item[] }[] = [];
  for (const n of notes) {
    const title = dayOf(n.time, now);
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    const same = n.resolved ? g.items.find((i) => i.note.resolved && i.note.key === n.key) : undefined;
    if (same) {
      same.ids.push(n.id);
      same.count += n.count;
    } else {
      g.items.push({ note: n, ids: [n.id], count: n.count });
    }
  }
  return groups;
}

const byTime = (a: Note, b: Note) => b.time.localeCompare(a.time);

// The status bar's height (status-bar.tsx, h-6.5): the sheet ends above it,
// so its counts stay readable while the centre is open.
const STATUS_BAR = 26;

// ---- Agents waiting now ------------------------------------------------

// A live agent waiting for the person that no note covers: the centre only
// hears events while Burf is open, so an agent that asked before then (or
// whose note was cleared) would otherwise leave "all caught up" showing
// while the status bar says one is waiting.
interface Live {
  key: string;
  box: string;
  session: Session;
  name: string;
  place: string;
}

function liveWaiting(boxes: Record<string, BoxData>, notes: Note[]): Live[] {
  const out: Live[] = [];
  for (const [box, data] of Object.entries(boxes)) {
    for (const s of data.sessions ?? []) {
      if (s.exited || sessionState(s, data.stats) !== "waiting") continue;
      const covered = notes.some((n) => n.category === "waiting" && !n.resolved && n.box === box && (n.session ? n.session === s.name : n.path === s.dir));
      if (covered) continue;
      out.push({ key: `${box}|${s.name}`, box, session: s, name: sessionName(s, { sessions: data.sessions }), place: [sessionAgent(s), sessionPlace(s, data.locations), box].filter(Boolean).join(" · ") });
    }
  }
  return out;
}

// ---- The centre --------------------------------------------------------

// NotificationCenter is the sheet, mounted once beside the other dialogs.
// Rows answer the keyboard: ↑/↓ move, Enter opens, R toggles read, E or
// Backspace dismisses, Esc closes.
export function NotificationCenter() {
  const open = useNotifications((s) => s.open);
  const notes = useNotifications((s) => s.notes);
  const error = useNotifications((s) => s.error);
  const boxes = useStore((s) => s.boxes);
  const prefs = useNotifyPrefs();
  const now = useMinute();
  const hush = quietState(prefs, new Date(now));
  const quiet = hush.on;
  const [filter, setFilter] = useState<Filter>("all");
  // The row that takes Tab, so the list is one stop and arrows move in it.
  const [active, setActive] = useState<string>();
  // Focus lands on the panel itself, not on its first button.
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => watchReviewNotes(), []);

  // With no notes the filter is hidden, so it can't hide the agents.
  const live = notes.length === 0 || filter === "all" || filter === "agents" || filter === "unread" ? liveWaiting(boxes, notes) : [];
  const shown = notes.filter((n) => matches(filter, n)).sort(byTime);
  const needs = shown.filter((n) => needsYou(n, now)).map((n): Item => ({ note: n, ids: [n.id], count: n.count }));
  const groups = fold(
    shown.filter((n) => !needsYou(n, now)),
    now,
  );
  const items = [...needs, ...groups.flatMap((g) => g.items)];
  const unread = notes.some((n) => !n.read);
  const anyEarlier = notes.some((n) => !needsYou(n, now));
  // The panel is as tall as its rows, up to the window. A box without a set
  // height can't pass one down, so the list's viewport is capped itself:
  // the window less the inset (2rem), the status bar the sheet stays
  // above (26px), the header and the banners.
  const chrome = 32 + STATUS_BAR + 49 + (quiet ? 29 : 0) + (error ? 33 : 0);
  const current = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const tabStop = items.some((i) => i.note.id === active) || live.some((l) => l.key === active) ? active : (items[0]?.note.id ?? live[0]?.key);

  const settings = () => {
    setNotificationsOpen(false);
    useStore.getState().setView({ kind: "settings", section: "notifications" });
  };

  const rows = () => Array.from(list.current?.querySelectorAll<HTMLElement>("[data-note]") ?? []);
  const focusRow = (i: number) => {
    const all = rows();
    if (!all.length) return;
    all[Math.max(0, Math.min(all.length - 1, i))].focus();
  };

  // Arrows work from the header too, so ↓ after opening lands on the first
  // row. Keys from menus (portalled, but React bubbles them here) are left
  // alone.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!(e.currentTarget as HTMLElement).contains(target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const row = target.closest<HTMLElement>("[data-note]");
    const fromHeader = target === panel.current;
    if (!row && !fromHeader) return;
    const all = rows();
    const at = row ? all.indexOf(row) : -1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusRow(at + 1);
        return;
      case "ArrowUp":
        e.preventDefault();
        if (at > 0) focusRow(at - 1);
        else panel.current?.focus();
        return;
      case "Home":
        e.preventDefault();
        focusRow(0);
        return;
      case "End":
        e.preventDefault();
        focusRow(all.length - 1);
        return;
    }
    // The rest act on the focused row itself, not a button inside it.
    if (!row || target !== row) return;
    const one = live.find((l) => l.key === row.dataset.note);
    if (one) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLive(one);
      }
      return;
    }
    const item = items.find((i) => i.note.id === row.dataset.note);
    if (!item) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(item.note);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      markRead(item.note.id, !item.note.read);
    } else if (e.key === "e" || e.key === "E" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      // Stay in the list: focus moves to the row that slides up into this
      // place (rows are keyed, so it keeps its element) before this one goes.
      (all[at + 1] ?? all[at - 1] ?? panel.current)?.focus();
      for (const id of item.ids) dismiss(id);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setNotificationsOpen}>
      <SheetPopup
        variant="inset"
        tone="notices"
        showCloseButton={false}
        initialFocus={panel}
        data-notification-center=""
        onKeyDown={onKeyDown}
      >
        <div ref={panel} tabIndex={-1} className={sx(paint.s7)}>
          <SheetTitle size="sm">Notifications</SheetTitle>
          {notes.length > 0 && (
            <Menu>
              <MenuTrigger
                render={<Button size="xs" variant="ghost" data-filter="" aria-label={`Show: ${current.label}`} muted />}
              >
                {current.label}
                <ChevronDownIcon className={sx(paint.s9)} />
              </MenuTrigger>
              <MenuPopup align="start" width={menuWidths.w44}>
                <MenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                  {FILTERS.map((f, i) => {
                    const count = notes.filter((n) => matches(f.id, n)).length;
                    return (
                      <Fragment key={f.id}>
                        {i === 2 && <MenuSeparator />}
                        <MenuRadioItem value={f.id} closeOnClick>
                          <span className={sx(paint.s10)}>
                            <span className={sx(paint.s11)}>{f.label}</span>
                            <span className={sx(paint.s12)}>{count || ""}</span>
                          </span>
                        </MenuRadioItem>
                      </Fragment>
                    );
                  })}
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          )}
          <div className={sx(paint.s13)}>
            {notes.length > 0 && (
              <Button size="xs" variant="ghost" disabled={!unread} onClick={markAllRead} muted>
                <CheckCheckIcon />
                Mark all read
              </Button>
            )}
            <Menu>
              <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="More" muted />}>
                <EllipsisIcon />
              </MenuTrigger>
              <MenuPopup align="end" width={menuWidths.w56}>
                {quiet ? (
                  <MenuItem onClick={() => setDoNotDisturb(false)}>
                    <BellIcon />
                    Turn off Do not disturb
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem onClick={() => setDoNotDisturb(true, new Date(Date.now() + 3600_000))}>
                      <BellOffIcon />
                      Do not disturb for 1 hour
                    </MenuItem>
                    <MenuItem onClick={() => setDoNotDisturb(true)}>
                      <BellOffIcon />
                      Do not disturb until I turn it off
                    </MenuItem>
                  </>
                )}
                <MenuSeparator />
                <MenuItem disabled={!anyEarlier} onClick={clearEarlier}>
                  <TrashIcon />
                  Clear all but what needs you
                </MenuItem>
                <MenuItem onClick={settings}>
                  <SettingsIcon />
                  Notification settings
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Button size="icon-xs" variant="ghost" aria-label="Close"  onClick={() => setNotificationsOpen(false)} muted>
              <XIcon />
            </Button>
          </div>
        </div>

        {quiet && (
          <div className={sx(paint.s14)}>
            <BellOffIcon className={sx(paint.s15)} />
            <span className={sx(paint.s16)}>
              Do not disturb{hush.until ? ` until ${clock(hush.until.toISOString())}` : ""}
              {prefs.dnd.allowWaiting ? "; waiting agents still come through." : "; they still collect here."}
            </span>
          </div>
        )}

        {notes.length === 0 && live.length === 0 ? (
          <div className={sx(paint.s17)}>
            <Empty pad="none">
              <EmptyHeader>
                <EmptyMedia>
                  <Scene name="bottle" width={128} className={sx(paint.s18)} />
                </EmptyMedia>
                <EmptyTitle size="base">You're all caught up</EmptyTitle>
                <EmptyDescription>Agents that need you, failures and finished work land here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <ScrollArea
            cap
            contentSize="container"
            scrollFade
            style={{ height: "auto", "--list-max": `calc(100dvh - ${chrome}px)` } as React.CSSProperties}
          >
            <div ref={list} className={sx(paint.s19)}>
              {needs.length + live.length > 0 ? (
                <Section title="Needs you" count={attentionCount(needs.length, live.length)} amber>
                  {needs.map((i) => (
                    <Row key={i.note.id} item={i} now={now} boxes={boxes} tabStop={tabStop === i.note.id} onFocus={setActive} />
                  ))}
                  {live.map((l) => (
                    <LiveRow key={l.key} live={l} now={now} tabStop={tabStop === l.key} onFocus={setActive} />
                  ))}
                </Section>
              ) : (
                filter === "all" && (
                  <p className={sx(paint.s20)}>
                    <CheckIcon className={sx(paint.s21)} />
                    Nothing needs you right now
                  </p>
                )
              )}
              {groups.map((g) => (
                <Section key={g.title} title={g.title}>
                  {g.items.map((i) => (
                    <Row key={i.note.id} item={i} now={now} boxes={boxes} tabStop={tabStop === i.note.id} onFocus={setActive} />
                  ))}
                </Section>
              ))}
              {items.length === 0 && live.length === 0 && (
                <div className={sx(paint.s22)}>
                  {current.empty}
                  <Button size="xs" variant="ghost" onClick={() => setFilter("all")}>
                    Show all
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {error && (
          <div className={sx(paint.s23)}>
            <Tip label={error} width="lg">
              <span className={sx(paint.s24)}>Not saved: the Burf agent did not take the history.</span>
            </Tip>
          </div>
        )}
      </SheetPopup>
    </Sheet>
  );
}

function Section({ title, count, amber, children }: { title: string; count?: number; amber?: boolean; children: React.ReactNode }) {
  return (
    <section className={sx(paint.s69)}>
      <h3 className={sx(paint.s25)}>
        {amber && <span className={sx(paint.s26)} />}
        {title}
        {count !== undefined && <span className={sx(paint.s27)}>{count}</span>}
      </h3>
      <ul className={sx(paint.s28)}>{children}</ul>
    </section>
  );
}

// activate is a row's click: open what it is about, or, for a note with
// nothing to open, just mark it read.
function activate(n: Note) {
  if (noteLabel(n)) openNote(n.id);
  else markRead(n.id);
}

function Row({
  item,
  now,
  boxes,
  tabStop,
  onFocus,
}: {
  item: Item;
  now: number;
  boxes: Record<string, BoxData>;
  tabStop: boolean;
  onFocus(id: string): void;
}) {
  const n = item.note;
  const Icon = n.category === "opened" && n.title.startsWith("Preview") ? GlobeIcon : (icons[n.category] ?? BellIcon);
  const label = noteLabel(n);
  const isSnoozed = snoozed(n, now);
  const needs = needsYou(n, now);
  const info = categoryInfo(n.category);
  const context = contextOf(n, boxes);
  const folded = n.resolved;
  // Tone only where it signals: something that needs the person.
  const tone = !needs ? sx(paint.s71) : n.tone === "error" ? sx(paint.s72) : sx(paint.s73);
  const status = isSnoozed && n.snoozedUntil ? `Snoozed until ${clock(n.snoozedUntil)}` : folded ? (n.category === "review" ? "Reviewed" : "Resolved") : undefined;
  const line = [status, context, folded ? undefined : n.detail].filter(Boolean).join(" · ");

  const cluster = (
    <span className={sx(paint.s29)}>
      {n.category === "waiting" && !n.resolved && (
        <RowButton label={isSnoozed ? "Unsnooze" : "Snooze 1 hour"} onClick={() => (isSnoozed ? unsnooze(n.id) : snooze(n.id))}>
          <AlarmClockIcon />
        </RowButton>
      )}
      {!folded && (
        <RowButton label={n.read ? "Mark unread" : "Mark read"} shortcut="R" onClick={() => markRead(n.id, !n.read)}>
          {n.read ? <MailIcon /> : <MailOpenIcon />}
        </RowButton>
      )}
      <RowButton label={item.ids.length > 1 ? `Dismiss all ${item.ids.length}` : "Dismiss"} shortcut="E" onClick={() => item.ids.forEach(dismiss)}>
        <XIcon />
      </RowButton>
    </span>
  );
  const time = (
    <span className={sx(paint.s30)}>{short(n.time, now)}</span>
  );

  return (
    <li
      data-note={n.id}
      aria-label={[n.read ? undefined : "Unread", shownNoteTitle(n.title, n.resolved), line].filter(Boolean).join(", ")}
      tabIndex={tabStop ? 0 : -1}
      onFocus={(e) => e.target === e.currentTarget && onFocus(n.id)}
      onClick={() => activate(n)}
      className={[sx(paint.s31, paint.s33), "group/row"].filter(Boolean).join(" ")}
    >
      {/* Unread: a dot in its own column, so titles stay aligned. */}
      <span className={sx(paint.s34)} aria-hidden>
        {!n.read && !n.resolved && <span className={[sx(paint.s35), needs ? sx(paint.s36) : sx(paint.s37)].filter(Boolean).join(" ")} />}
      </span>
      <Tip label={folded ? `${info.label} · ${status}` : info.label} side="left" delay={600}>
        <span className={[sx(paint.s38), tone].filter(Boolean).join(" ")}>
          <Icon />
        </span>
      </Tip>
      <div className={sx(paint.s44)}>
        <div className={sx(paint.s45)}>
          <span className={sx(paint.s46, n.read || folded ? paint.s47 : paint.s48)}>{shownNoteTitle(n.title, n.resolved)}</span>
          {item.count > 1 && <span className={sx(paint.s49)}>×{item.count}</span>}
          <span className={sx(paint.s50)} />
          {time}
          {cluster}
        </div>
        {(line || label) && (
          <div className={sx(paint.s51)}>
            <Tip label={line || undefined} width="lg">
              <span className={sx(paint.s52)}>{line}</span>
            </Tip>
            {label && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openNote(n.id);
                }}
                className={[sx(paint.s53), sx(paint.s70)].filter(Boolean).join(" ")}
              >
                {label}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function openLive(l: Live) {
  setNotificationsOpen(false);
  runAction({ kind: "session", box: l.box, session: l.session.name });
}

// LiveRow is an agent waiting now with no note of its own. It reads like a
// note's row, but there is nothing to mark read or dismiss: it goes when
// the agent stops waiting.
function LiveRow({ live, now, tabStop, onFocus }: { live: Live; now: number; tabStop: boolean; onFocus(id: string): void }) {
  const since = live.session.state_since;
  return (
    <li
      data-note={live.key}
      aria-label={`${live.name} needs you, ${live.place}`}
      tabIndex={tabStop ? 0 : -1}
      onFocus={(e) => e.target === e.currentTarget && onFocus(live.key)}
      onClick={() => openLive(live)}
      className={[sx(paint.s54), "group/row"].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s55)} aria-hidden>
        <span className={sx(paint.s56)} />
      </span>
      <Tip label={categoryInfo("waiting").label} side="left" delay={600}>
        <span className={sx(paint.s57)}>
          <MessageCircleQuestionIcon />
        </span>
      </Tip>
      <div className={sx(paint.s58)}>
        <div className={sx(paint.s59)}>
          <span className={sx(paint.s60)}>{live.name} needs you</span>
          <span className={sx(paint.s61)} />
          {since && <span className={sx(paint.s62)}>{short(since, now)}</span>}
        </div>
        <div className={sx(paint.s63)}>
          <span className={sx(paint.s64)}>{live.place}</span>
          <span className={sx(paint.s65)}>Open session</span>
        </div>
      </div>
    </li>
  );
}

function RowButton({ label, shortcut, onClick, children }: { label: string; shortcut?: string; onClick(): void; children: React.ReactNode }) {
  return (
    <Tip
      label={
        <span className={sx(paint.s66)}>
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </span>
      }
    >
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={sx(paint.s67)}
      >
        {children}
      </button>
    </Tip>
  );
}
