import { NONE, useStore } from "@/lib/store";
import { useAppVersion } from "@/views/settings/app-version";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const DOCS: [file: string, what: string][] = [
  ["docs/design.md", "How Berth works, and its security model"],
  ["docs/hooks.md", "Every event and gate, and how hooks run"],
  ["docs/orchestration.md", "Agents driving agents: send, wait, exec, loop"],
  ["docs/templates.md", ".berth/config.json and task templates"],
  ["docs/plugins.md", "Writing plugins"],
  ["docs/app-api.md", "The API this app uses"],
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
      <SettingsGroup title="Documentation" description="Markdown files in the docs folder of the Berth repository.">
        <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 px-4 py-3 text-xs">
          {DOCS.map(([file, what]) => (
            <div key={file} className="contents">
              <span className="font-mono text-foreground/90">{file.replace("docs/", "")}</span>
              <span className="text-muted-foreground">{what}</span>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </SettingsPage>
  );
}
