import { Switch } from "@/components/ui/switch";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

// Labs: things being tried, on unless turned off.
export function LabsSection() {
  const labs = usePrefs((p) => p.labs);
  return (
    <SettingsPage title="Labs" description="Newer ideas, on by default. They may change or go away.">
      <SettingsGroup>
        <SettingsRow label="Harbour home and experimental tools">
          <Switch checked={labs} onCheckedChange={(on) => setPrefs({ labs: on, labsChosen: true })} />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
