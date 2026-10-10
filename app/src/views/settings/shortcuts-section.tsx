import { SearchIcon } from "lucide-react";
import { useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { color } from "@/styles/tokens.stylex";
import { isTauri } from "@/lib/api";
import { IS_LINUX, LINUX_TERMINAL_KEYS, platformKeys } from "@/lib/platform";
import { usePrefs } from "@/lib/prefs";
import { describe, SHORTCUT_GROUPS, SHORTCUTS } from "@/lib/shortcuts";
import { SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

const styles = stylex.create({
  search: { position: "relative" },
  icon: {
    pointerEvents: "none",
    position: "absolute",
    top: "50%",
    left: 10,
    zIndex: 10,
    width: 14,
    height: 14,
    transform: "translateY(-50%)",
    color: color.mutedForeground,
  },
  empty: { color: color.mutedForeground, fontSize: 14 },
  keys: { display: "flex", alignItems: "center", gap: 8 },
});

// Every shortcut, searchable, grouped as the menu bar groups them; the same
// table as the Keyboard shortcuts sheet (lib/shortcuts.json).
export function ShortcutsSection() {
  const [query, setQuery] = useState("");
  const labs = usePrefs((p) => p.labs);
  const q = query.trim().toLowerCase();
  const grouped = SHORTCUT_GROUPS.map((title) => ({
    title,
    items: SHORTCUTS.filter((s) => s.group === title && (!q || describe(s).toLowerCase().includes(q) || platformKeys(s.keys).toLowerCase().includes(q))),
  })).filter((g) => g.items.length > 0);

  return (
    <SettingsPage
      title="Shortcuts"
      description={IS_LINUX ? LINUX_TERMINAL_KEYS : `They work everywhere in the window, terminals included: the app sees them first.${isTauri() ? " Most are in the menu bar too." : ""}`}
    >
      <div {...stylex.props(styles.search)}>
        <SearchIcon {...stylex.props(styles.icon)} />
        <Input size="sm" inset="shell" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shortcuts" aria-label="Search shortcuts" />
      </div>
      {grouped.length === 0 && <p {...stylex.props(styles.empty)}>No shortcut matches “{query}”.</p>}
      {grouped.map((g) => (
        <SettingsGroup key={g.title} title={g.title}>
          {g.items.map((s) => (
            <SettingsRow key={s.id} label={describe(s)} min="short" pad="snug">
              <span {...stylex.props(styles.keys)}>
                {s.labs && !labs && <Badge variant="outline">Labs</Badge>}
                <Kbd>{s.keys}</Kbd>
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      ))}
    </SettingsPage>
  );
}
