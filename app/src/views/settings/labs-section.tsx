import { Switch } from "@/components/ui/switch";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

// Labs: things being tried, on unless turned off.
export function LabsSection() {
  const labs = usePrefs((p) => p.labs);
  return (
    <SettingsPage title="Labs" description="Newer ideas, on by default. They may change or go away.">
      <SettingsGroup>
        <SettingsRow label="Burf Home and experimental tools" description="On shows Burf Home. Off shows Agent Dashboard as the home page and hides experimental tools. Your saved preference is kept.">
          <Switch checked={labs} onCheckedChange={(on) => setPrefs({ labs: on, labsChosen: true })} />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
