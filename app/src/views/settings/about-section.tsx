import { openDocs } from "@/lib/open-url";
import { NONE, useStore } from "@/lib/store";
import { useAppVersion } from "@/views/settings/app-version";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const DOCS: [path: string, title: string, what: string][] = [
  ["/concepts/architecture", "How Berth works", "The box serves, the laptop connects, and the app is only a view"],
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
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);
  const proxy = useStore((s) => s.status?.proxy);

  return (
    <SettingsPage title="About Berth" description="Agents on your own boxes, watched from here. Closing this window never stops one.">
      <SettingsGroup title="Versions">
        <SettingsRow label="App">
          <span className="font-mono text-muted-foreground text-xs">{version}</span>
        </SettingsRow>
        <SettingsRow label="Laptop agent" description="Holds the connection to every box, the private URLs and forwards.">
          <span className="font-mono text-muted-foreground text-xs">127.0.0.1:1378 · proxy :{proxy?.port ?? "-"}</span>
        </SettingsRow>
        {boxes.map((b) => {
          const info = data[b.name]?.info;
          return (
            <SettingsRow key={b.name} label={`berthd on ${b.name}`}>
              <span className="font-mono text-muted-foreground text-xs">{[info?.build && `build ${info.build}`, info?.os && `${info.os}/${info.arch}`, b.state].filter(Boolean).join(" · ")}</span>
            </SettingsRow>
          );
        })}
      </SettingsGroup>
      <SettingsGroup title="Documentation" description="docs.berthd.app, opened in your browser.">
        <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 px-4 py-3 text-xs">
          {DOCS.map(([path, title, what]) => (
            <div key={path} className="contents">
              <button type="button" onClick={() => void openDocs(path)} className="text-left text-foreground/90 underline-offset-2 hover:underline">
                {title}
              </button>
              <span className="text-muted-foreground">{what}</span>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </SettingsPage>
  );
}
