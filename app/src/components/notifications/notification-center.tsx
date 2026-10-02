import {
  AlarmClockIcon,
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  EllipsisIcon,
  GitPullRequestArrowIcon,
  GlobeIcon,
  MegaphoneIcon,
  MessageCircleQuestionIcon,
  PackageIcon,
  PuzzleIcon,
  ServerCrashIcon,
  SettingsIcon,
  ShieldAlertIcon,
  SquareTerminalIcon,
  TrashIcon,
  WorkflowIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { watchReviewNotes } from "@/components/notifications/review-source";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type Category,
  categoryInfo,
  clearEarlier,
  dismiss,
  markAllRead,
  markRead,
  type Note,
  needsYou,
  noteLabel,
  openNote,
  quietNow,
  setNotificationsOpen,
  setQuietHours,
  snooze,
  snoozed,
  toggleNotifications,
  unsnooze,
  useNotifications,
  useNotifyPrefs,
  useUnread,
} from "@/lib/notifications";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// useMinute re-renders once a minute, so relative times and snoozes move.
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

// NotificationBell opens the centre. The count is what is unread; it turns
// amber while anything needs the person.
export function NotificationBell({ className, size = "sm" }: { className?: string; size?: "sm" | "rail" }) {
  const now = useMinute();
  const { unread, needs } = useUnread(now);
  const open = useNotifications((s) => s.open);
  const quiet = useNotifyPrefs((p) => quietNow(p, new Date(now)));
  const label = [
    "Notifications (⌘⇧N)",
    needs ? `${needs} need${needs === 1 ? "s" : ""} you` : unread ? `${unread} unread` : "",
    quiet ? "Do not disturb is on" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const Icon = quiet ? BellOffIcon : BellIcon;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleNotifications}
      className={cn(
        "relative inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        size === "rail" ? "size-8 rounded-lg [&_svg]:size-4" : "size-6.5 [&_svg]:size-3.5",
        open && "bg-sidebar-accent text-foreground",
        needs > 0 && "text-warning-foreground dark:text-warning",
        className,
      )}
    >
      <Icon />
      {unread > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 font-semibold text-[9px] tabular-nums leading-none",
            needs > 0 ? "bg-warning text-black" : "bg-foreground/80 text-background",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
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
  kit: PackageIcon,
  notify: MegaphoneIcon,
  opened: SquareTerminalIcon,
  plugin: PuzzleIcon,
};

const tones = {
  info: "bg-info/10 text-info-foreground dark:text-info",
  success: "bg-success/10 text-success-foreground dark:text-success",
  warning: "bg-warning/12 text-warning-foreground dark:text-warning",
  error: "bg-destructive/10 text-destructive-foreground dark:text-destructive",
} as const;

function short(iso: string, now: number): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// NotificationCenter is the sheet, mounted once beside the other dialogs.
export function NotificationCenter() {
  const open = useNotifications((s) => s.open);
  const notes = useNotifications((s) => s.notes);
  const error = useNotifications((s) => s.error);
  const prefs = useNotifyPrefs();
  const now = useMinute();
  const quiet = quietNow(prefs, new Date(now));
  // Focus lands on the panel itself, not on its first button.
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => watchReviewNotes(), []);

  const needs = notes.filter((n) => needsYou(n, now));
  const earlier = notes.filter((n) => !needsYou(n, now));
  const unread = notes.some((n) => !n.read);

  const settings = () => {
    setNotificationsOpen(false);
    useStore.getState().setView({ kind: "settings", section: "notifications" });
  };

  return (
    <Sheet open={open} onOpenChange={setNotificationsOpen}>
      <SheetPopup className="outline-none sm:max-w-[400px]" showCloseButton={false} initialFocus={panel} data-notification-center="">
        <div ref={panel} tabIndex={-1} className="flex h-12 outline-none shrink-0 items-center gap-2 border-b pr-2 pl-4">
          <SheetTitle className="font-semibold text-sm">Notifications</SheetTitle>
          <Kbd className="h-4.5 text-[10px]">⌘⇧N</Kbd>
          <div className="ml-auto flex items-center gap-0.5">
            <Button size="xs" variant="ghost" disabled={!unread} onClick={markAllRead} className="text-muted-foreground">
              <CheckCheckIcon />
              Mark all read
            </Button>
            <Menu>
              <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="More" className="text-muted-foreground" />}>
                <EllipsisIcon />
              </MenuTrigger>
              <MenuPopup align="end" className="min-w-52">
                {quiet ? (
                  <MenuItem onClick={() => setQuietHours({ on: false, until: undefined, ...(prefs.dnd.scheduled && !prefs.dnd.on ? { scheduled: false } : {}) })}>
                    <BellIcon />
                    Turn off Do not disturb
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem onClick={() => setQuietHours({ on: true, until: new Date(Date.now() + 3600_000).toISOString() })}>
                      <BellOffIcon />
                      Do not disturb for 1 hour
                    </MenuItem>
                    <MenuItem onClick={() => setQuietHours({ on: true, until: undefined })}>
                      <BellOffIcon />
                      Do not disturb until I turn it off
                    </MenuItem>
                  </>
                )}
                <MenuSeparator />
                <MenuItem disabled={!earlier.length} onClick={clearEarlier}>
                  <TrashIcon />
                  Clear earlier
                </MenuItem>
                <MenuItem onClick={settings}>
                  <SettingsIcon />
                  Notification settings
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Button size="icon-xs" variant="ghost" aria-label="Close" className="text-muted-foreground" onClick={() => setNotificationsOpen(false)}>
              <XIcon />
            </Button>
          </div>
        </div>

        {quiet && (
          <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
            <BellOffIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              Do not disturb{prefs.dnd.on && prefs.dnd.until ? ` until ${clock(prefs.dnd.until)}` : prefs.dnd.on ? "" : ` until ${prefs.dnd.to}`}. Notifications still collect here
              {prefs.dnd.allowWaiting ? "; waiting agents come through." : "."}
            </span>
          </div>
        )}

        {notes.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <Empty className="p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyTitle className="text-base">You're all caught up</EmptyTitle>
                <EmptyDescription className="text-sm">
                  Agents waiting for you, failures and finished work land here. Berth hears events only while it is open, so anything that happened while it was closed can't be recovered here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1" scrollFade>
            <div className="pb-3">
              {needs.length > 0 && (
                <Section title="Needs you" count={needs.length} amber>
                  {needs.map((n) => (
                    <Row key={n.id} note={n} now={now} />
                  ))}
                </Section>
              )}
              {earlier.length > 0 && (
                <Section title="Earlier">
                  {earlier.map((n) => (
                    <Row key={n.id} note={n} now={now} />
                  ))}
                </Section>
              )}
              {needs.length === 0 && (
                <p className="px-4 pt-1 pb-2 text-muted-foreground text-xs">Nothing needs you right now.</p>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex h-9 shrink-0 items-center gap-2 border-t px-4 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={error}>
            {error ? "Not saved: the Berth agent did not take the history." : "The last 500 are kept on this laptop."}
          </span>
          <button type="button" className="shrink-0 hover:text-foreground" onClick={settings}>
            Settings
          </button>
        </div>
      </SheetPopup>
    </Sheet>
  );
}

function Section({ title, count, amber, children }: { title: string; count?: number; amber?: boolean; children: React.ReactNode }) {
  return (
    <section className="pt-2">
      <h3 className="flex items-center gap-1.5 px-4 pt-1 pb-1.5 font-medium text-[11px] text-muted-foreground">
        {amber && <span className="size-1.5 rounded-full bg-warning" />}
        {title}
        {count !== undefined && <span className="tabular-nums">{count}</span>}
      </h3>
      <ul className="flex flex-col px-1.5">{children}</ul>
    </section>
  );
}

function Row({ note: n, now }: { note: Note; now: number }) {
  const Icon = n.category === "opened" && n.title.startsWith("Preview") ? GlobeIcon : icons[n.category];
  const label = noteLabel(n);
  const isSnoozed = snoozed(n, now);
  const needs = needsYou(n, now);
  const chips = [n.box, n.project, n.worktree].filter(Boolean) as string[];
  const info = categoryInfo(n.category);

  return (
    <li
      className={cn(
        "group/row relative flex cursor-default gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent/60",
        (n.resolved || isSnoozed) && "opacity-70",
      )}
      onClick={() => openNote(n.id)}
      onKeyDown={(e) => e.key === "Enter" && openNote(n.id)}
      tabIndex={0}
      title={info.label}
    >
      {!n.read && <span className={cn("absolute top-3.5 left-0.5 size-1.5 rounded-full", needs ? "bg-warning" : "bg-info")} aria-label="Unread" />}
      <span className={cn("mt-px flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5", n.resolved ? "bg-muted text-muted-foreground" : tones[n.tone])}>
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("min-w-0 truncate text-[13px] leading-5", n.read ? "text-foreground/85" : "font-medium text-foreground")}>{n.title}</span>
          {n.count > 1 && <span className="shrink-0 rounded bg-muted px-1 font-medium text-[10px] text-muted-foreground tabular-nums">{n.count}×</span>}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums group-focus-within/row:hidden group-hover/row:hidden" title={new Date(n.time).toLocaleString()}>
            {short(n.time, now)}
          </span>
          <span className="-my-1 ml-auto hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex">
            {n.category === "waiting" && !n.resolved && (
              <RowButton label={isSnoozed ? "Unsnooze" : "Snooze 1 hour"} onClick={() => (isSnoozed ? unsnooze(n.id) : snooze(n.id))}>
                <AlarmClockIcon />
              </RowButton>
            )}
            <RowButton label={n.read ? "Mark unread" : "Mark read"} onClick={() => markRead(n.id, !n.read)}>
              <span className={cn("size-2 rounded-full border border-current", !n.read && "bg-current")} />
            </RowButton>
            <RowButton label="Dismiss" onClick={() => dismiss(n.id)}>
              <XIcon />
            </RowButton>
          </span>
        </div>
        {n.detail && <p className="truncate text-muted-foreground text-xs leading-4.5" title={n.detail}>{n.detail}</p>}
        {(chips.length > 0 || label || isSnoozed || n.resolved) && (
        <div className="mt-1 flex min-h-5 items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-muted-foreground">
            {chips.map((c, i) => (
              <span key={`${i}:${c}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/50">·</span>}
                <span className={cn("truncate", i === 0 && "rounded bg-muted px-1 py-px font-medium")}>{c}</span>
              </span>
            ))}
            {isSnoozed && n.snoozedUntil && <span className="ml-1 shrink-0">· Snoozed until {clock(n.snoozedUntil)}</span>}
            {n.resolved && n.category !== "review" && <span className="ml-1 shrink-0">· Resolved</span>}
          </div>
          {label && (
            <Button
              size="xs"
              variant="outline"
              className={cn("h-5.5 shrink-0 px-1.5 text-[11px] sm:h-5.5", !needs && "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100")}
              onClick={(e) => {
                e.stopPropagation();
                openNote(n.id);
              }}
            >
              {label}
            </Button>
          )}
        </div>
        )}
      </div>
    </li>
  );
}

function RowButton({ label, onClick, children }: { label: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}
