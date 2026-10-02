import { SearchIcon } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUTS } from "@/hooks/use-shortcuts";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

// Which group each shortcut belongs in; anything new lands in "Other".
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "General", keys: ["⌘K", "⌘N", "⌘J", "⌘\\"] },
  { title: "Tabs and panes", keys: ["⌘T", "⌘⇧B", "⌘1–9", "⌘W"] },
  { title: "Splits", keys: ["⌘D", "⌘⇧D", "⌘⌥ ←↑→↓"] },
];

export function ShortcutsSection() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = ([keys, what]: [string, string]) => !q || what.toLowerCase().includes(q) || keys.toLowerCase().includes(q);
  const grouped = [
    ...GROUPS.map((g) => ({ title: g.title, items: SHORTCUTS.filter(([k]) => g.keys.includes(k)) })),
    { title: "Other", items: SHORTCUTS.filter(([k]) => !GROUPS.some((g) => g.keys.includes(k))) },
  ]
    .map((g) => ({ ...g, items: g.items.filter(match) }))
    .filter((g) => g.items.length > 0);

  return (
    <SettingsPage title="Shortcuts" description="They work everywhere in the window, terminals included: the app sees them first.">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input size="sm" className="ps-7" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shortcuts" aria-label="Search shortcuts" />
      </div>
      {grouped.length === 0 && <p className="text-muted-foreground text-sm">No shortcut matches “{query}”.</p>}
      {grouped.map((g) => (
        <SettingsGroup key={g.title} title={g.title}>
          {g.items.map(([keys, what]) => (
            <SettingsRow key={keys} label={what} className="min-h-10 py-2">
              <Kbd>{keys}</Kbd>
            </SettingsRow>
          ))}
        </SettingsGroup>
      ))}
    </SettingsPage>
  );
}
