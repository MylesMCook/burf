import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isTauri } from "@/lib/api";
import {
  CATEGORIES,
  type Channels,
  quietNow,
  route,
  setChannel,
  setNotificationsOpen,
  setQuietHours,
  useNotifications,
  useNotifyPrefs,
} from "@/lib/notifications";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NotificationsSection() {
  const prefs = useNotifyPrefs();
  const count = useNotifications((s) => s.notes.length);
  const system = isTauri() ? "macOS" : "System";
  const dnd = prefs.dnd;
  const quiet = quietNow(prefs);
  const columns: [keyof Channels, string, string][] = [
    ["centre", "Centre", "Kept in the notification centre"],
    ["toast", "Toast", "A toast in the window"],
    ["system", system, `A ${system} notification while Berth is in the background`],
  ];

  return (
    <SettingsPage
      title="Notifications"
      description="Choose where each kind of notification shows. Everything goes through the notification centre (⌘⇧N); toasts and system notifications are on top of that."
      actions={
        <Button size="sm" variant="outline" onClick={() => setNotificationsOpen(true)}>
          <BellIcon />
          Open centre
        </Button>
      }
    >
      <SettingsGroup title="What to show">
        <div className="flex items-center gap-6 px-4 pt-2.5 pb-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1">Kind</span>
          {columns.map(([key, label, title]) => (
            <span key={key} className="w-14 text-center" title={title}>
              {label}
            </span>
          ))}
        </div>
        {CATEGORIES.map((c) => {
          const ch = prefs.categories[c.id];
          return (
            <SettingsRow key={c.id} label={c.label} description={c.description} className="gap-6 py-2">
              <div className="flex items-center gap-6">
                {columns.map(([key, label]) => (
                  <span key={key} className="flex w-14 justify-center">
                    <Checkbox aria-label={`${c.label}: ${label}`} checked={ch[key]} onCheckedChange={(v) => setChannel(c.id, { [key]: v === true })} />
                  </span>
                ))}
              </div>
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <SettingsGroup
        title="Do not disturb"
        description={quiet ? "On now: notifications collect in the centre without toasts, sounds or system notifications." : "Quiet hours keep notifications in the centre, without toasts, sounds or system notifications."}
      >
        <SettingsRow label="Do not disturb" description={dnd.on && dnd.until ? `Until ${new Date(dnd.until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.` : "Until you turn it off."}>
          <Switch checked={dnd.on && (!dnd.until || new Date(dnd.until) > new Date())} onCheckedChange={(on) => setQuietHours({ on, until: undefined })} />
        </SettingsRow>
        <SettingsRow label="On a schedule" description="Every day it applies, for example overnight.">
          <Switch checked={dnd.scheduled} onCheckedChange={(scheduled) => setQuietHours({ scheduled })} />
        </SettingsRow>
        {dnd.scheduled && (
          <SettingsRow label="Quiet hours">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Input type="time" size="sm" aria-label="From" className="w-28" value={dnd.from} onChange={(e) => e.target.value && setQuietHours({ from: e.target.value })} />
                to
                <Input type="time" size="sm" aria-label="To" className="w-28" value={dnd.to} onChange={(e) => e.target.value && setQuietHours({ to: e.target.value })} />
              </div>
              <ToggleGroup
                multiple
                variant="outline"
                size="sm"
                value={dnd.days.map(String)}
                onValueChange={(v) => setQuietHours({ days: (v as string[]).map(Number).sort() })}
              >
                {DAYS.map((d, i) => (
                  <ToggleGroupItem key={DAY_NAMES[i]} value={String(i)} aria-label={DAY_NAMES[i]} title={DAY_NAMES[i]} className="min-w-7 px-0 text-xs">
                    {d}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </SettingsRow>
        )}
        <SettingsRow label="Let waiting agents through" description="An agent waiting for you still toasts and notifies during quiet hours.">
          <Switch checked={dnd.allowWaiting} onCheckedChange={(allowWaiting) => setQuietHours({ allowWaiting })} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Sound and history">
        <SettingsRow label="Play a sound" description="A soft chime with each toast or system notification.">
          <Switch checked={prefs.sound} onCheckedChange={(sound) => useNotifyPrefs.setState({ sound })} />
        </SettingsRow>
        <SettingsRow
          label="History"
          description={`${count} kept on this laptop, up to 500. Berth only hears events while it is open, so anything from while it was closed isn't here.`}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              route({ category: "plugin", title: "Test notification", detail: "This is how notifications look.", tone: "info", key: `test|${Date.now()}` })
            }
          >
            Send a test
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
