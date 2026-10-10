import * as stylex from "@stylexjs/stylex";
import { invoke } from "@tauri-apps/api/core";
import { BugIcon, ClipboardListIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { agentEndpointLine, updateUnavailableCopy } from "@/lib/about-status";
import { endpoint, isTauri } from "@/lib/api";
import { copyDiagnostics } from "@/lib/diagnostics";
import { ago, bytes, errorMessage } from "@/lib/format";
import { openDocs, openUrl } from "@/lib/open-url";
import { LINUX_ALPHA, LINUX_BUGS } from "@/lib/platform";
import { NONE, useStore } from "@/lib/store";
import { checkForUpdate, restartToUpdate, updatesSupported, useUpdater } from "@/lib/updater";
import { useAppVersion, useInterfaceVersion } from "@/views/settings/app-version";
import { hasWhatsNew, openWhatsNew } from "@/lib/whats-new";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const paint = stylex.create({
  s0: {
    "width": "64px",
    "height": "64px",
  },
  s1: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s5: {
    "display": "grid",
    "gridTemplateColumns": "max-content 1fr",
    "columnGap": "24px",
    "rowGap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "display": "contents",
  },
  s7: {
    "textAlign": "left",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "textDecoration": {
      ":hover": "underline",
    },
    "textUnderlineOffset": "2px",
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "minWidth": "96px",
  },
  s10: {
    "minWidth": "96px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const DOCS: [path: string, title: string, what: string][] = [
  ["/concepts/architecture", "How Burf works", "The box serves, the laptop connects, and the app is only a view"],
  ["/concepts/security", "Security model", "Identity, pinned mutual TLS, pairing, and where berthd listens"],
  ["/guides/hooks", "Hooks", "Run a command when something happens, or gate an action"],
  ["/reference/events", "Events", "Every event and gate, and what each carries"],
  ["/guides/orchestration", "Orchestration", "Agents driving agents: send, wait, exec, loop"],
  ["/reference/config", "Project config", ".berth/config.json, field by field"],
  ["/guides/task-templates", "Task templates", "Kinds of task you start often, with the agent, branch and prompt filled in"],
  ["/guides/plugins", "Plugins", "Writing plugins"],
  ["/reference/plugin-sdk", "Plugin SDK", "Everything a plugin can call"],
  ["/reference/app-api", "App API", "The API this app uses"],
];

export function AboutSection() {
  const version = useAppVersion();
  const interfaceVersion = useInterfaceVersion();
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const proxy = useStore((s) => s.status?.proxy);
  const [agentUrl, setAgentUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    endpoint().then(
      (ep) => {
        if (live) setAgentUrl(ep.url);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <SettingsPage title="About Burf" description="Agents on your own boxes, watched from here. Closing this window never stops one.">
      <img src={`${import.meta.env.BASE_URL}branding/burf-app-icon.svg`} alt="Burf" width="64" height="64" className={sx(paint.s0)} />
      <SettingsGroup title="Versions">
        <SettingsRow label="App">
          <span className={sx(paint.s1)}>{version}</span>
          {hasWhatsNew() && (
            <Button size="xs" variant="outline" data-testid="about-whats-new" onClick={() => openWhatsNew("about")}>
              What's new
            </Button>
          )}
        </SettingsRow>
        <SettingsRow label="Interface" description="Reload closes and reopens this window to use the installed interface. Agents keep running.">
          <span className={sx(paint.s2)}>{interfaceVersion}</span>
          {isTauri() && (
            <Button size="xs" variant="outline" onClick={() => void invoke("restart_app").catch((err) => toastManager.add({ title: "Could not reload interface", description: errorMessage(err), type: "error" }))}>
              Reload interface
            </Button>
          )}
        </SettingsRow>
        <SettingsRow label="Laptop agent" description="Holds the connection to every box, the private URLs and forwards.">
          <span className={sx(paint.s3)}>{agentUrl ? agentEndpointLine(agentUrl, proxy?.port) : "…"}</span>
        </SettingsRow>
        {boxes.map((b) => {
          const info = data[b.name]?.info;
          return (
            <SettingsRow key={b.name} label={`berthd on ${b.name}`}>
              <span className={sx(paint.s4)}>{[info?.build && `build ${info.build}`, info?.os && `${info.os}/${info.arch}`, b.state].filter(Boolean).join(" · ")}</span>
            </SettingsRow>
          );
        })}
      </SettingsGroup>
      <UpdatesGroup />
      <HelpGroup />
      <SettingsGroup title="Documentation" description="docs.berthd.app, opened in your browser.">
        <div className={sx(paint.s5)}>
          {DOCS.map(([path, title, what]) => (
            <div key={path} className={sx(paint.s6)}>
              <button type="button" onClick={() => void openDocs(path)} className={sx(paint.s7)}>
                {title}
              </button>
              <span className={sx(paint.s8)}>{what}</span>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </SettingsPage>
  );
}

// HelpGroup copies what someone helping needs to know, in one paste
// (lib/diagnostics); `burf doctor --report` prints the same.
function HelpGroup() {
  const [busy, setBusy] = useState(false);
  return (
    <SettingsGroup title="Help">
      <SettingsRow
        label="Copy diagnostics"
        description="Versions, burf doctor's checks, the local box and each box, the terminal renderer, theme, Labs, and the last errors and toasts. Tokens, op:// references, emails and your username are taken out."
      >
        <Button
          size="xs"
          variant="outline"
          data-testid="copy-diagnostics"
          loading={busy}
          onClick={() => {
            setBusy(true);
            void copyDiagnostics().finally(() => setBusy(false));
          }}
        >
          <ClipboardListIcon />
          Copy diagnostics
        </Button>
      </SettingsRow>
      {LINUX_ALPHA && (
        <SettingsRow
          label="Report a Linux bug"
          description="The Linux app is an alpha. Tell us what breaks in a GitHub issue on MylesMCook/burf, with your distribution and desktop, and the diagnostics above pasted in."
        >
          <Button size="xs" variant="outline" data-testid="report-linux-bug" onClick={() => void openUrl(LINUX_BUGS)}>
            <BugIcon />
            Report a Linux bug
          </Button>
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}

const RELEASES = "https://github.com/MylesMCook/burf/releases";

// UpdatesGroup says where the app's own updates stand. Burf checks when it
// opens and every few hours, and downloads quietly; the only step left to
// the person is the restart (lib/updater.ts).
function UpdatesGroup() {
  const u = useUpdater();
  if (!updatesSupported()) {
    const copy = updateUnavailableCopy(isTauri());
    return (
      <SettingsGroup title="Updates">
        <SettingsRow label={copy.label} description={copy.description} />
      </SettingsGroup>
    );
  }
  const busy = u.status === "checking" || u.status === "downloading" || u.status === "installing";
  const checkNow = (
    <span className={sx(paint.s9)}><Button size="xs" variant="outline"  loading={u.status === "checking"} disabled={busy} onClick={() => void checkForUpdate({ manual: true })}>
      Check now
    </Button></span>
  );
  let row;
  switch (u.status) {
    case "ready":
    case "installing":
      row = (
        <SettingsRow label={`Burf ${u.version} is ready`} description="Restarting closes and reopens this window. Agents keep running on their boxes.">
          <Button size="xs" variant="ghost" onClick={() => void openUrl(`${RELEASES}/tag/v${u.version}`)}>
            What's new
          </Button>
          <span className={sx(paint.s10)}><Button size="xs"  loading={u.status === "installing"} onClick={() => void restartToUpdate()}>
            Restart to update
          </Button></span>
        </SettingsRow>
      );
      break;
    case "downloading":
      row = (
        <SettingsRow label={`Downloading Burf ${u.version}`} description={u.total ? `${bytes(u.received)} of ${bytes(u.total)}` : bytes(u.received)}>
          {checkNow}
        </SettingsRow>
      );
      break;
    case "current":
      row = (
        <SettingsRow label="Burf is up to date" description={`Checked ${ago(new Date(u.checkedAt).toISOString())}.`}>
          {checkNow}
        </SettingsRow>
      );
      break;
    case "error":
      row = (
        <SettingsRow label="Couldn't check for updates" description={u.error}>
          {checkNow}
        </SettingsRow>
      );
      break;
    default:
      row = (
        <SettingsRow label={u.status === "checking" ? "Checking for updates…" : "Not checked yet"} description="Burf checks when it opens and every few hours.">
          {checkNow}
        </SettingsRow>
      );
  }
  return (
    <SettingsGroup title="Updates" description="New versions download in the background. Burf never restarts by itself: it waits for you to choose Restart to update.">
      {row}
    </SettingsGroup>
  );
}
