import { CheckIcon, SearchIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";

import { SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { SYSTEM_THEME, useThemes } from "@/hooks/use-theme";
import type { Theme } from "@/lib/api";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { berthThemes } from "@/themes/builtin";
import { ChatBackgroundSettings, ChatWidthSettings } from "@/views/settings/chat-background-section";
import { CustomFontSettings } from "@/views/settings/custom-font-section";
import { Segmented } from "@/views/settings/controls";
import { Code, SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";
import { IS_MAC } from "@/lib/platform";
import { color, font, radius } from "@/styles/tokens.stylex";

const mid = "@media (max-width: 1100px)";
const narrow = "@media (max-width: 700px)";
const hidePicks = "@media (max-width: 800px)";

const styles = stylex.create({
  head: { display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 8 },
  headText: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  heading: { fontWeight: 500, fontSize: 13, color: color.mutedForeground },
  hint: { marginTop: 2, color: color.mutedForeground, fontSize: 12 },
  search: { position: "relative", width: 192, flexShrink: 0 },
  searchIcon: {
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
  group: { marginTop: 16 },
  groupTitle: { marginBottom: 8, fontWeight: 500, fontSize: 11, color: color.mutedForeground, textTransform: "uppercase", letterSpacing: "0.025em" },
  grid: {
    display: "grid",
    gridTemplateColumns: { default: "repeat(3, minmax(0, 1fr))", [mid]: "repeat(2, minmax(0, 1fr))", [narrow]: "1fr" },
    gap: 12,
  },
  empty: { marginTop: 16, color: color.mutedForeground, fontSize: 12 },
  system: {
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: color.border, ":hover": "color-mix(in oklab, var(--foreground) 25%, transparent)" },
    transitionProperty: "box-shadow, border-color",
    transitionDuration: "150ms",
  },
  picked: {
    borderColor: color.ring,
    boxShadow: { default: "0 0 0 1px var(--ring)", ":focus-visible": "0 0 0 2px var(--ring)" },
  },
  fill: { flexGrow: 1 },
  systemBtn: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    alignItems: "center",
    alignSelf: "stretch",
    textAlign: "left",
    outline: "none",
    boxShadow: { ":focus-visible": "inset 0 0 0 2px var(--ring)" },
  },
  thumb: { position: "relative", height: 56, width: 112, flexShrink: 0, borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: color.border },
  clip: { position: "absolute", inset: 0, clipPath: "polygon(100% 0, 100% 100%, 0 100%)" },
  systemLabel: { display: "flex", minWidth: 0, flexGrow: 1, alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 14, fontSize: 13 },
  systemCopy: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  block: { display: "block" },
  sub: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: color.mutedForeground },
  check: { width: 14, height: 14, flexShrink: 0 },
  picks: { display: { default: "flex", [hidePicks]: "none" }, flexShrink: 0, alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12 },
  card: {
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: color.border, ":hover": "color-mix(in oklab, var(--foreground) 25%, transparent)" },
    textAlign: "left",
    outline: "none",
    transitionProperty: "box-shadow, border-color",
    transitionDuration: "150ms",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--ring)" },
  },
  preview: { position: "relative", height: 88 },
  caption: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    backgroundColor: color.card,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
  },
  name: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  row: { display: "flex", height: "100%" },
  side: { display: "flex", width: "38%", flexDirection: "column", gap: 6, borderRightWidth: 1, borderRightStyle: "solid", paddingLeft: 10, paddingRight: 10, paddingTop: 12, paddingBottom: 12 },
  bar: { height: 6, borderRadius: radius.full },
  wide: { width: "80%" },
  midBar: { width: "60%" },
  twoThirds: { width: "66%" },
  threeQuarters: { width: "75%" },
  line: { display: "flex", alignItems: "center", gap: 4 },
  pip: { width: 6, height: 6, borderRadius: radius.full },
  term: { flexGrow: 1, flexShrink: 1, flexBasis: "0%", padding: 10, fontFamily: font.mono, fontSize: 10, lineHeight: 1.5 },
  caret: { marginLeft: 2, display: "inline-block", height: 10, width: 4, verticalAlign: "middle" },
  swatchSide: { display: "flex", width: "40%", flexDirection: "column", gap: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 8, paddingBottom: 8 },
  hair: { height: 4, borderRadius: radius.full },
  swatchTerm: { flexGrow: 1, paddingLeft: 6, paddingRight: 6, paddingTop: 8, paddingBottom: 8 },
  cursorBit: { marginTop: 4, height: 6, width: 4, borderRadius: 1 },
  dots: {
    position: "absolute",
    right: 8,
    bottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "solid",
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});

const BERTH = new Set(berthThemes.map((t) => t.id));

function withPaint(painted: ReturnType<typeof stylex.props>, extra?: CSSProperties) {
  return { ...painted, style: extra ? { ...painted.style, ...extra } : painted.style };
}

export function AppearanceSection() {
  const themes = useThemes();
  const themeId = useStore((s) => s.themeId);
  const density = usePrefs((p) => p.density);
  const uiFontSize = usePrefs((p) => p.uiFontSize);
  const [query, setQuery] = useState("");

  // Burf's own, then every other theme (built-in ports, yours, plugins')
  // by appearance; a search narrows them by name.
  const q = query.trim().toLowerCase();
  const shown = q ? themes.filter((t) => t.name.toLowerCase().includes(q) || t.id.includes(q)) : themes;
  const groups = [
    { title: "Burf", themes: shown.filter((t) => BERTH.has(t.id)) },
    { title: "Dark", themes: shown.filter((t) => !BERTH.has(t.id) && t.appearance === "dark") },
    { title: "Light", themes: shown.filter((t) => !BERTH.has(t.id) && t.appearance !== "dark") },
  ].filter((g) => g.themes.length);

  return (
    <SettingsPage title="Appearance">
      <section>
        <div {...stylex.props(styles.head)}>
          <div {...stylex.props(styles.headText)}>
            <h2 {...stylex.props(styles.heading)}>Theme</h2>
            <p {...stylex.props(styles.hint)}>
              Add your own as JSON in <Code>~/.berth/themes/</Code>, or install a plugin that ships one.
            </p>
          </div>
          <div {...stylex.props(styles.search)}>
            <SearchIcon {...stylex.props(styles.searchIcon)} />
            <Input size="sm" type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Find a theme" aria-label="Find a theme" inset="field" />
          </div>
        </div>
        {!q && <SystemCard selected={themeId === SYSTEM_THEME} themes={themes} />}
        {groups.map((g) => (
          <div key={g.title} {...stylex.props(styles.group)}>
            <h3 {...stylex.props(styles.groupTitle)}>{g.title}</h3>
            <div {...stylex.props(styles.grid)}>
              {g.themes.map((t) => (
                <ThemeCard key={t.id} theme={t} selected={t.id === themeId} onSelect={() => useStore.getState().setTheme(t.id)} />
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p {...stylex.props(styles.empty)}>No theme is called “{query.trim()}”.</p>}
      </section>

      <SettingsGroup title="Interface">
        <SettingsRow label="Text size" description="Everything outside the terminal. ⌘+ and ⌘− step it from 11 to 20px.">
          <Segmented
            value={String(uiFontSize)}
            options={[
              { value: "12", label: "Small" },
              { value: "13", label: "Default" },
              { value: "14", label: "Large" },
              // A size zoomed to (⌘+, ⌘−) that none of these is.
              ...(uiFontSize < 12 || uiFontSize > 14 ? [{ value: String(uiFontSize), label: `${uiFontSize}px` }] : []),
            ]}
            onChange={(v) => setPrefs({ uiFontSize: Number(v) })}
          />
        </SettingsRow>
        <SettingsRow label="Density" description="How tightly the sidebar and lists are packed.">
          <Segmented
            value={density}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
            onChange={(density) => setPrefs({ density })}
          />
        </SettingsRow>
      </SettingsGroup>

      <CustomFontSettings />

      <ChatWidthSettings />

      <ChatBackgroundSettings />
    </SettingsPage>
  );
}

// SystemCard follows the computer's appearance: one theme by day, another
// when macOS is dark (Burf Light and Burf Dark unless picked here). Its
// preview is half of each.
function SystemCard({ selected, themes }: { selected: boolean; themes: Theme[] }) {
  const picks = usePrefs((p) => p.systemThemes);
  const light = themes.find((t) => t.id === picks.light) ?? themes.find((t) => t.id === "berth-light");
  const dark = themes.find((t) => t.id === picks.dark) ?? themes.find((t) => t.id === "berth-dark");
  if (!light || !dark) return null;
  const pick = (side: "light" | "dark", id: string) => {
    setPrefs({ systemThemes: { ...picks, [side]: id } });
    useStore.getState().setTheme(SYSTEM_THEME);
  };
  const options = (appearance: "light" | "dark") => themes.filter((t) => (t.appearance === "dark") === (appearance === "dark")).map((t) => ({ value: t.id, label: t.name }));
  return (
    <div {...stylex.props(styles.system, selected && styles.picked)}>
      <button
        type="button"
        onClick={() => useStore.getState().setTheme(SYSTEM_THEME)}
        aria-pressed={selected}
        {...stylex.props(styles.systemBtn)}
      >
        <div {...stylex.props(styles.thumb)}>
          <Swatch theme={light} />
          <div {...stylex.props(styles.clip)}>
            <Swatch theme={dark} />
          </div>
        </div>
        <span {...stylex.props(styles.systemLabel)}>
          <span {...stylex.props(styles.systemCopy)}>
            <span {...stylex.props(styles.block)}>Match system</span>
            <span {...stylex.props(styles.sub)}>{IS_MAC ? "Follows macOS" : "Follows your desktop"}</span>
          </span>
          {selected && <CheckIcon {...stylex.props(styles.check)} />}
        </span>
      </button>
      <div {...stylex.props(styles.picks)}>
        <SimpleSelect size="sm" measure="40" aria-label="Theme by day" value={light.id} options={options("light")} onChange={(id) => id && pick("light", id)} />
        <SimpleSelect size="sm" measure="40" aria-label={IS_MAC ? "Theme when macOS is dark" : "Theme when your desktop is dark"} value={dark.id} options={options("dark")} onChange={(id) => id && pick("dark", id)} />
      </div>
    </div>
  );
}

// ThemeCard previews a theme with its own colors: a sidebar beside a
// terminal, whatever theme the app itself is in.
function ThemeCard({ theme, selected, onSelect }: { theme: Theme; selected: boolean; onSelect(): void }) {
  const painted = stylex.props(styles.card, selected && styles.picked);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid="theme-option"
      data-theme-id={theme.id}
      {...painted}
      className={["group", painted.className].filter(Boolean).join(" ")}
    >
      {/* A picture of the theme (its name says which): its sample text is in
          the theme's terminal colours, which the axe spec leaves out. */}
      <div aria-hidden data-a11y-skip {...stylex.props(styles.preview)}>
        <Preview theme={theme} />
        <Dots theme={theme} />
      </div>
      <div {...stylex.props(styles.caption)}>
        <span {...stylex.props(styles.name)}>{theme.name}</span>
        {selected && <CheckIcon {...stylex.props(styles.check)} />}
      </div>
    </button>
  );
}

// Preview draws a theme's sidebar beside its terminal, in its own colors.
function Preview({ theme }: { theme: Theme }) {
  const c = theme.colors;
  const t = theme.terminal;
  return (
    <div {...withPaint(stylex.props(styles.row), { background: c.background })}>
      <div {...withPaint(stylex.props(styles.side), { background: c.sidebar, borderColor: c.border })}>
        <div {...withPaint(stylex.props(styles.bar, styles.wide), { background: c.sidebarForeground, opacity: 0.55 })} />
        <div {...withPaint(stylex.props(styles.bar, styles.midBar), { background: c.sidebarForeground, opacity: 0.3 })} />
        <div {...stylex.props(styles.line)}>
          <span {...withPaint(stylex.props(styles.pip), { background: c.warning })} />
          <div {...withPaint(stylex.props(styles.bar, styles.fill), { background: c.accent })} />
        </div>
        <div {...withPaint(stylex.props(styles.bar, styles.twoThirds), { background: c.sidebarForeground, opacity: 0.3 })} />
      </div>
      <div {...withPaint(stylex.props(styles.term), { background: t.background, color: t.foreground })}>
        <div>
          <span style={{ color: t.green }}>●</span> tests pass
        </div>
        <div>
          <span style={{ color: t.yellow }}>●</span> <span style={{ color: t.blue }}>~/work/shop</span>
        </div>
        <div>
          <span style={{ color: t.magenta }}>❯</span> <span style={{ color: t.cyan }}>berth</span>
          <span {...withPaint(stylex.props(styles.caret), { background: t.cursor })} />
        </div>
      </div>
    </div>
  );
}

// Swatch is a theme's colours without text, for a thumbnail too small to
// read: sidebar, terminal, and an accent and a cursor.
function Swatch({ theme }: { theme: Theme }) {
  const c = theme.colors;
  const t = theme.terminal;
  return (
    <div {...stylex.props(styles.row)}>
      <div {...withPaint(stylex.props(styles.swatchSide), { background: c.sidebar })}>
        <div {...withPaint(stylex.props(styles.hair, styles.wide), { background: c.sidebarForeground, opacity: 0.5 })} />
        <div {...withPaint(stylex.props(styles.hair, styles.midBar), { background: c.accent })} />
      </div>
      <div {...withPaint(stylex.props(styles.swatchTerm), { background: t.background })}>
        <div {...withPaint(stylex.props(styles.hair, styles.threeQuarters), { background: t.green })} />
        <div {...withPaint(stylex.props(styles.cursorBit), { background: t.cursor })} />
      </div>
    </div>
  );
}

// Dots are a theme's colours at a glance, in the corner of its preview: its
// primary, then the terminal's red, yellow, green, blue and magenta.
function Dots({ theme }: { theme: Theme }) {
  const t = theme.terminal;
  return (
    <span {...withPaint(stylex.props(styles.dots), { background: theme.colors.background, borderColor: theme.colors.border })} aria-hidden>
      {[theme.colors.primary, t.red, t.yellow, t.green, t.blue, t.magenta].map((c, i) => (
        <span key={i} {...withPaint(stylex.props(styles.dot), { background: c })} />
      ))}
    </span>
  );
}
