import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { Code, SettingsGroup, SettingsPage, SettingsRow, Value } from "@/views/settings/rows";

export function GeneralSection() {
  const confirmClose = usePrefs((p) => p.confirmCloseShells);
  const proxy = useStore((s) => s.status?.proxy);
  const port = proxy?.url_port ?? 1377;

  return (
    <SettingsPage title="General">
      <SettingsGroup title="Notifications">
        <SettingsRow label="Notifications and Do not disturb" description="What shows in the centre, as toasts and as system notifications, and quiet hours.">
          <Button size="sm" variant="outline" onClick={() => useStore.getState().setView({ kind: "settings", section: "notifications" })}>
            Open
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Terminals">
        <SettingsRow label="Confirm before closing terminals" description="Closing a shell's pane or tab stops the shell on its box. Agents keep running when closed, so they never ask.">
          <Switch checked={confirmClose} onCheckedChange={(confirmCloseShells) => setPrefs({ confirmCloseShells })} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Startup">
        <SettingsRow label="Open Berth at login" description="Not available yet. Your boxes keep running either way: closing Berth never stops an agent.">
          <Switch checked={false} disabled />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Private URLs" description="Dev servers on your boxes open on this computer at names like these.">
        <SettingsRow
          label="Worktree URLs"
          description={
            <>
              <Code>{`http://billing.cal.devl.localhost${port === 80 ? "" : `:${port}`}/`}</Code> for a worktree, <Code>{`http://cal.devl.localhost${port === 80 ? "" : `:${port}`}/`}</Code> for a repo's main checkout.
            </>
          }
        />
        <SettingsRow
          label="Port"
          description={
            port === 80 ? (
              "URLs have no port: port 80 on this computer points at Berth."
            ) : (
              <>
                URLs end in <Code>:{port}</Code> while port 80 stays with calport. Once your Cal.com work has moved to Berth, <Code>berth setup port80</Code> drops it (it asks for your password once).
              </>
            )
          }
        >
          <Value>:{port}</Value>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
