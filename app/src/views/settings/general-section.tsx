import { useEffect, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { type CliLink, cliLinkStatus, installCliLink, removeCliLink } from "@/lib/cli-link";
import { isWindows } from "@/lib/platform";
import { errorMessage } from "@/lib/format";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { ConfirmButton } from "@/views/settings/confirm";
import { Segmented } from "@/views/settings/controls";
import { Code, SettingsGroup, SettingsPage, SettingsRow, Value } from "@/views/settings/rows";

export function GeneralSection() {
  const confirmClose = usePrefs((p) => p.confirmCloseShells);
  const closeAgents = usePrefs((p) => p.closeAgents);
  const agentView = usePrefs((p) => p.agentView);
  const proxy = useStore((s) => s.status?.proxy);
  const port = proxy?.url_port ?? 1377;

  return (
    <SettingsPage title="General">
      <SettingsGroup title="Chats">
        <SettingsRow label="Open supported agents as">
          <Segmented value={agentView} options={[{ value: "conversation", label: "Chat" }, { value: "terminal", label: "Terminal" }]} onChange={(value) => setPrefs({ agentView: value })} />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="Notifications">
        <SettingsRow label="Notifications and Do not disturb" description="What shows in the centre, as toasts and as system notifications, and quiet hours.">
          <Button size="sm" variant="outline" onClick={() => useStore.getState().setView({ kind: "settings", section: "notifications" })}>
            Open
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Sessions">
        <SettingsRow
          label="Closing an agent's tab"
          description={
            closeAgents === "keep"
              ? "The agent keeps running on its box; pick it up again from the worktree or the dashboard."
              : closeAgents === "stop"
                ? "Stops the agent on its box, with a few seconds to undo."
                : "Asks whether to stop the agent or leave it running."
          }
        >
          <PickOne
            label="Closing an agent's tab"
            value={closeAgents}
            onChange={(v) => setPrefs({ closeAgents: v, closeAgentsChosen: true })}
            options={[
              { value: "stop", label: "Stop it" },
              { value: "keep", label: "Keep running" },
              { value: "ask", label: "Ask" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Confirm before closing stops something" description="Closing a shell's pane or tab stops the shell on its box, and so does closing an agent when it's set to stop.">
          <Switch checked={confirmClose} onCheckedChange={(confirmCloseShells) => setPrefs({ confirmCloseShells })} />
        </SettingsRow>
      </SettingsGroup>

      <CommandLineGroup />

      <SettingsGroup title="Startup">
        <SettingsRow label="Open Burf at login" description="Not available yet. Your boxes keep running either way: closing Burf never stops an agent.">
          <Switch checked={false} disabled />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Private URLs" description="Dev servers on your boxes open on this computer at names like these.">
        <SettingsRow
          label="Worktree URLs"
          description={
            <>
              <Code>{`http://checkout.shop.devl.localhost${port === 80 ? "" : `:${port}`}/`}</Code> for a worktree, <Code>{`http://shop.devl.localhost${port === 80 ? "" : `:${port}`}/`}</Code> for a repo's main checkout.
            </>
          }
        />
        <SettingsRow
          label="Port"
          description={
            port === 80 ? (
              "URLs have no port: port 80 on this computer points at Burf."
            ) : (
              <>
                URLs end in <Code>:{port}</Code>. To drop it, <Code>burf setup port80</Code> points port 80 on this computer at Burf (it asks for your password once; skip it if something else already uses port 80).
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

const LINK = "~/.local/bin/burf";

// CommandLineGroup puts the burf CLI that Burf.app carries on the PATH, as
// a link at ~/.local/bin/burf, so a terminal runs the same burf as the app
// and it updates with the app. It asks first, and says what it replaces.
function CommandLineGroup() {
  const [cli, setCli] = useState<CliLink | null | undefined>(undefined);
  useEffect(() => {
    cliLinkStatus().then(setCli, () => setCli(null));
  }, []);
  if (cli === undefined) return null;
  if (isWindows()) {
    return <WindowsCommandLine cli={cli} onChange={setCli} />;
  }

  let description: React.ReactNode;
  let control: React.ReactNode = null;
  if (!cli?.bundled) {
    description = (
      <>
        The Burf app carries its own <Code>burf</Code>; this build has none. From a clone, run <Code>bin/burf</Code> after <Code>make all</Code>.
      </>
    );
  } else if (cli.state === "linked") {
    description = (
      <>
        <Code>{LINK}</Code> runs the copy inside Burf.app, so it updates with the app. If a terminal can't find <Code>burf</Code>, add <Code>~/.local/bin</Code> to your <Code>PATH</Code>.
      </>
    );
    control = <Value>Installed</Value>;
  } else {
    const replaces =
      cli.state === "symlink" ? (
        <>
          {" "}
          It replaces the link there now, to <Code>{cli.target}</Code>.
        </>
      ) : cli.state === "file" ? (
        <>
          {" "}
          The <Code>burf</Code> there now is kept as <Code>burf.previous</Code>.
        </>
      ) : null;
    description = cli.blocked ?? (
      <>
        Links <Code>{LINK}</Code> to the copy inside Burf.app, so <Code>burf</Code> in a terminal is the one the app runs, and updates with it.{replaces}
      </>
    );
    control = (
      <ConfirmButton
        label="Install"
        disabled={!!cli.blocked}
        title="Install the burf command?"
        description={
          <>
            This links <Code>{LINK}</Code> to <Code>{cli.bundled}</Code>.{replaces} If <Code>~/.local/bin</Code> isn't on your <Code>PATH</Code>, add <Code>{'export PATH="$HOME/.local/bin:$PATH"'}</Code> to your shell's profile.
          </>
        }
        confirm="Install"
        onConfirm={async () => {
          try {
            setCli(await installCliLink());
            toastManager.add({ title: "Installed the burf command", description: `${LINK} now runs Burf's copy.`, type: "success" });
          } catch (e) {
            toastManager.add({ title: "Could not install the burf command", description: errorMessage(e), type: "error" });
          }
        }}
      />
    );
  }
  return (
    <SettingsGroup title="Command line">
      <SettingsRow label="The burf command" description={description}>
        {control}
      </SettingsRow>
    </SettingsGroup>
  );
}

function WindowsCommandLine({ cli, onChange }: { cli: CliLink | null; onChange(cli: CliLink): void }) {
  const installed = cli?.state === "linked";
  const external = cli?.state === "file";
  return (
    <SettingsGroup title="Command line">
      <SettingsRow label="The burf command" description={cli?.bundled ? <>
        <Code>{cli.bundled}</Code> is the app's command. {installed || external ? "New terminals can run burf." : "Add its folder to your user PATH so new terminals can run burf."}
      </> : "PATH integration is available in an installed build."}>
        {external ? <Value>Already on PATH</Value> : cli?.bundled && <ConfirmButton
          label={installed ? "Remove from PATH" : "Add to PATH"}
          title={installed ? "Remove Burf from your PATH?" : "Add Burf to your PATH?"}
          description={<>{installed ? "Removes only the folder Burf added." : "Adds this folder to your user PATH:"} <Code>{cli.link}</Code>. Existing terminals keep their current environment.</>}
          confirm={installed ? "Remove" : "Add"}
          onConfirm={async () => {
            try {
              onChange(await (installed ? removeCliLink() : installCliLink()));
            } catch (error) {
              toastManager.add({ title: "Could not change Burf's PATH entry", description: errorMessage(error), type: "error" });
            }
          }}
        />}
      </SettingsRow>
    </SettingsGroup>
  );
}
