import { desktopKind, invoke } from "@/lib/desktop";
import { ChevronRightIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toastManager } from "@/components/ui/toast";
import { isMock } from "@/hooks/use-burf-connection";
import { endpoint, isDesktop } from "@/lib/api";
import { useEventLog } from "@/lib/events";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { loadPlugins } from "@/plugins/host";
import { useRegistry } from "@/plugins/registry";
import { showOnboardingAgain } from "@/views/onboarding/onboarding-state";
import { appVersion } from "@/views/settings/app-version";
import { ConfirmButton } from "@/views/settings/confirm";
import { Code, SettingsGroup, SettingsPage, SettingsRow, Value } from "@/views/settings/rows";
import { color, font, radius } from "@/styles/tokens.stylex";

const panelOpen = ":is(.group[data-panel-open] &)";

const styles = stylex.create({
  slot: { minWidth: 96, display: "inline-flex" },
  token: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: font.mono,
    fontSize: 12,
    color: { default: color.mutedForeground, ":hover": color.foreground },
  },
  eye: { width: 14, height: 14 },
  chevron: {
    width: 14,
    height: 14,
    color: color.mutedForeground,
    transitionProperty: "transform",
    transitionDuration: "150ms",
    transform: { default: "rotate(0deg)", [panelOpen]: "rotate(90deg)" },
  },
  aside: { marginLeft: "auto", color: color.mutedForeground, fontSize: 12 },
  json: {
    marginTop: 8,
    maxHeight: 288,
    overflow: "auto",
    borderRadius: radius.lg,
    backgroundColor: "color-mix(in oklab, var(--muted) 50%, transparent)",
    padding: 12,
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 1.625,
  },
});

// Everything here acts on this window's own storage. The agent, its files,
// ~/.berth and the boxes are never touched.

function berthKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith("berth.")) keys.push(k);
  }
  return keys;
}

function clear(keep: (key: string) => boolean = () => false, session = false) {
  try {
    for (const k of berthKeys(localStorage)) if (!keep(k)) localStorage.removeItem(k);
    if (session) sessionStorage.clear();
  } catch {
    // Storage that cannot be read holds nothing to reset.
  }
  location.reload();
}

function withQuery(params: Record<string, string> | null) {
  const url = new URL(location.href);
  for (const k of ["mock", "fresh"]) url.searchParams.delete(k);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  location.href = url.toString();
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toastManager.add({ title: `Copied ${what}`, type: "success" });
  } catch (err) {
    toastManager.add({ title: `Couldn't copy ${what}`, description: errorMessage(err), type: "error" });
  }
}

export function DeveloperSection() {
  const status = useStore((s) => s.status);
  const connection = useStore((s) => s.connection);
  const [ep, setEp] = useState<{ url: string; token: string }>();
  const [reveal, setReveal] = useState(false);
  const mock = isMock();

  useEffect(() => {
    if (!mock) endpoint().then(setEp, () => {});
  }, [mock]);

  const diagnostics = async () => {
    const s = useStore.getState();
    return JSON.stringify(
      {
        app: { version: await appVersion(), shell: desktopKind(window), mock, userAgent: navigator.userAgent, location: location.href.replace(/token=[^&]+/, "token=…") },
        connection: s.connection,
        status: s.status,
        boxes: Object.fromEntries(Object.entries(s.boxes).map(([name, b]) => [name, { info: b.info, error: b.error, locations: b.locations?.length, sessions: b.sessions?.map((x) => ({ name: x.name, agent: x.agent, state: x.agent_state, exited: x.exited })) }])),
        plugins: useRegistry.getState().plugins,
        events: useEventLog.getState().events.slice(0, 50),
      },
      null,
      2,
    );
  };

  return (
    <SettingsPage
      title="Developer"
      description="Tools for working on Burf itself. Resets only clear this window's own memory of tabs and preferences; your agent, ~/.berth and every box stay exactly as they are. Shift-click Settings in the sidebar to come straight here."
    >
      <SettingsGroup title="Reset">
        <SettingsRow label="Reset workspaces" description="Forget open tabs, splits and each worktree's layout. Sessions keep running on their boxes.">
          <ConfirmButton
            label="Reset tabs"
            title="Reset workspaces?"
            description="Open tabs and splits are forgotten and the window reloads. Every session keeps running on its box; reopen it from the sidebar."
            confirm="Reset and reload"
            onConfirm={() => clear((k) => k !== "berth.workspaces")}
          />
        </SettingsRow>
        <SettingsRow label="Reset preferences" description="Theme, terminal and notification settings, back to defaults. Tabs stay.">
          <ConfirmButton label="Reset settings" title="Reset preferences?" description="Theme, terminal and other settings go back to their defaults, and the window reloads." confirm="Reset and reload" onConfirm={() => clear((k) => k === "berth.workspaces")} />
        </SettingsRow>
        <SettingsRow label="Reset everything local" description={<>Every <Code>berth.*</Code> key in this window's storage, and its session storage.</>}>
          <ConfirmButton
            label="Reset all"
            destructive
            title="Reset everything local?"
            description="Tabs, layouts and preferences are forgotten and the window reloads as if new. Nothing changes on the agent or any box."
            confirm="Reset everything"
            onConfirm={() => clear(undefined, true)}
          />
        </SettingsRow>
        <SettingsRow label="Show onboarding again" description="In this window, until you finish or skip it, even though you have boxes. The next launch starts without it.">
          <span {...stylex.props(styles.slot)}><Button
            size="xs"
            variant="outline"
            
            onClick={() => {
              showOnboardingAgain();
              useStore.getState().setView({ kind: "workspace" });
            }}>
            Show again
          </Button></span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Reload">
        <SettingsRow label="Reload plugins" description="Re-read ~/.berth/plugins and load them again.">
          <span {...stylex.props(styles.slot)}><Button
            size="xs"
            variant="outline"
            
            onClick={async () => {
              const client = useStore.getState().client;
              if (client) await loadPlugins(client);
              toastManager.add({ title: "Plugins reloaded", type: "success" });
            }}>
            Reload plugins
          </Button></span>
        </SettingsRow>
        <SettingsRow label="Reload window">
          <span {...stylex.props(styles.slot)}><Button size="xs" variant="outline"  onClick={() => location.reload()}>
            Reload window
          </Button></span>
        </SettingsRow>
        {isDesktop() && (
          <SettingsRow label="Developer tools" description="The Web Inspector for Burf's own window. A Browser tab's page has its own: Inspect in its toolbar.">
            <span {...stylex.props(styles.slot)}><Button
              size="xs"
              variant="outline"
              
              onClick={() => invoke("open_devtools").catch((err) => toastManager.add({ title: "No developer tools", description: errorMessage(err), type: "error" }))}>
              Open tools
            </Button></span>
          </SettingsRow>
        )}
      </SettingsGroup>

      <SettingsGroup title="Mock data">
        <SettingsRow label="Mock mode" description="Run the app on built-in sample boxes, without the agent.">
          <span {...stylex.props(styles.slot)}><Button size="xs" variant="outline"  onClick={() => withQuery(mock ? null : { mock: "1" })}>
            {mock ? "Turn mock off" : "Turn mock on"}
          </Button></span>
        </SettingsRow>
        <SettingsRow label="Fresh account preview" description="Mock mode with no boxes, to see onboarding.">
          <span {...stylex.props(styles.slot)}><Button size="xs" variant="outline"  onClick={() => withQuery({ mock: "1", fresh: "1" })}>
            Open preview
          </Button></span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Connection">
        <SettingsRow label="Agent" description={mock ? "Mock mode: no agent." : connection.state === "online" ? "Connected" : (connection.error ?? connection.state)}>
          <Value>{mock ? "mock" : (ep?.url ?? "127.0.0.1:1378")}</Value>
        </SettingsRow>
        {ep && (
          <SettingsRow label="Token" description="Anyone with it can drive your boxes from this computer. burf ui-token prints it too.">
            <button type="button" onClick={() => setReveal((r) => !r)} {...stylex.props(styles.token)}>
              {reveal ? ep.token : `${ep.token.slice(0, 4)}${"•".repeat(12)}`}
              {reveal ? <EyeOffIcon {...stylex.props(styles.eye)} /> : <EyeIcon {...stylex.props(styles.eye)} />}
            </button>
            <Button size="icon-xs" variant="ghost" aria-label="Copy token" onClick={() => void copy(ep.token, "the token")}>
              <CopyIcon />
            </Button>
          </SettingsRow>
        )}
        <Collapsible section>
          <CollapsibleTrigger look="row" marker="group">
            <ChevronRightIcon {...stylex.props(styles.chevron)} />
            Agent status
            <span {...stylex.props(styles.aside)}>JSON</span>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <pre {...stylex.props(styles.json)}>{JSON.stringify(status, null, 2) ?? "No status yet."}</pre>
          </CollapsiblePanel>
        </Collapsible>
        <SettingsRow label="Diagnostics" description="Versions, connection, boxes, plugins and the last 50 events, as JSON for a bug report. The token is left out.">
          <span {...stylex.props(styles.slot)}><Button size="xs" variant="outline"  onClick={async () => void copy(await diagnostics(), "diagnostics")}>
            <CopyIcon /> Copy diagnostics
          </Button></span>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
