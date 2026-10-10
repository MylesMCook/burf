import { BellIcon, BotIcon, FlaskConicalIcon, InfoIcon, KeyboardIcon, LaptopIcon, PaletteIcon, PuzzleIcon, ServerIcon, SlidersHorizontalIcon, SmartphoneIcon, SquareTerminalIcon, WrenchIcon } from "lucide-react";
import type { ComponentType } from "react";
import * as stylex from "@stylexjs/stylex";

import { Tip } from "@/components/tip";
import { useStore } from "@/lib/store";
import { color, radius } from "@/styles/tokens.stylex";
import { AboutSection } from "@/views/settings/about-section";
import { AgentsSection } from "@/views/settings/agents-section";
import { AppearanceSection } from "@/views/settings/appearance-section";
import { BoxesSection } from "@/views/settings/boxes-section";
import { ComputersSection } from "@/views/settings/computers-section";
import { DeveloperSection } from "@/views/settings/developer-section";
import { GeneralSection } from "@/views/settings/general-section";
import { LabsSection } from "@/views/settings/labs-section";
import { NotificationsSection } from "@/views/settings/notifications-section";
import { PhoneSection } from "@/views/settings/phone-section";
import { PluginsSection } from "@/views/settings/plugins-section";
import { ShortcutsSection } from "@/views/settings/shortcuts-section";
import { TerminalSection } from "@/views/settings/terminal-section";
import { ViewHeaderHost } from "@/views/view-header";

export type SettingsSectionId = "general" | "notifications" | "appearance" | "terminal" | "boxes" | "computers" | "phone" | "agents" | "plugins" | "shortcuts" | "labs" | "about" | "developer";

const narrow = "@media (max-width: 1200px)";

const styles = stylex.create({
  page: { display: "flex", height: "100%", flexDirection: "column" },
  body: { display: "flex", minHeight: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  nav: {
    display: "flex",
    width: { default: 192, [narrow]: 48 },
    flexShrink: 0,
    flexDirection: "column",
    gap: 1,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: color.border,
    paddingTop: 16,
    paddingLeft: { default: 8, [narrow]: 6 },
    paddingRight: { default: 8, [narrow]: 6 },
  },
  rule: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: { default: 10, [narrow]: 4 },
    marginRight: { default: 10, [narrow]: 4 },
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
  },
  item: {
    display: "flex",
    height: 30,
    width: "100%",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.md,
    paddingLeft: { default: 10, [narrow]: 0 },
    paddingRight: { default: 10, [narrow]: 0 },
    justifyContent: { default: "flex-start", [narrow]: "center" },
    textAlign: "left",
    fontSize: 13,
    transitionProperty: "color, background-color",
    transitionDuration: "150ms",
  },
  idle: {
    color: { default: color.mutedForeground, ":hover": color.foreground },
    backgroundColor: { default: "transparent", ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)" },
  },
  current: { backgroundColor: color.accent, color: color.foreground },
  icon: { width: 14, height: 14, flexShrink: 0 },
  title: { display: { default: "inline", [narrow]: "none" } },
  panel: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%", overflowY: "auto" },
});

const SECTIONS: { id: SettingsSectionId; title: string; icon: ComponentType<Record<string, unknown>>; Component: ComponentType }[] = [
  { id: "general", title: "General", icon: SlidersHorizontalIcon, Component: GeneralSection },
  { id: "notifications", title: "Notifications", icon: BellIcon, Component: NotificationsSection },
  { id: "appearance", title: "Appearance", icon: PaletteIcon, Component: AppearanceSection },
  { id: "terminal", title: "Terminal", icon: SquareTerminalIcon, Component: TerminalSection },
  { id: "boxes", title: "Boxes", icon: ServerIcon, Component: BoxesSection },
  { id: "computers", title: "Computers", icon: LaptopIcon, Component: ComputersSection },
  { id: "phone", title: "Phone", icon: SmartphoneIcon, Component: PhoneSection },
  { id: "agents", title: "Agents", icon: BotIcon, Component: AgentsSection },
  { id: "plugins", title: "Plugins", icon: PuzzleIcon, Component: PluginsSection },
  { id: "shortcuts", title: "Shortcuts", icon: KeyboardIcon, Component: ShortcutsSection },
  { id: "labs", title: "Labs", icon: FlaskConicalIcon, Component: LabsSection },
  { id: "about", title: "About", icon: InfoIcon, Component: AboutSection },
  { id: "developer", title: "Developer", icon: WrenchIcon, Component: DeveloperSection },
];

// openSettings shows Settings, on a section when given one.
export function openSettings(section?: SettingsSectionId) {
  useStore.getState().setView({ kind: "settings", section });
}

// Below 1200px of window the section list shrinks to its icons, so the
// settings themselves keep their width.
export function SettingsView() {
  const view = useStore((s) => s.view);
  const id = (view.kind === "settings" && SECTIONS.some((s) => s.id === view.section) ? view.section : "general") as SettingsSectionId;
  const current = SECTIONS.find((s) => s.id === id)!;

  return (
    <div {...stylex.props(styles.page)}>
      <ViewHeaderHost fallback={{ title: "Settings" }}>
        <div {...stylex.props(styles.body)}>
          <nav aria-label="Settings sections" {...stylex.props(styles.nav)}>
            {SECTIONS.map((s) => (
              <div key={s.id}>
                {s.id === "about" && <div {...stylex.props(styles.rule)} />}
                {/* The tooltip is for the narrow window, where only icons show. */}
                <Tip label={s.title} side="right" narrow>
                  <button
                    type="button"
                    onClick={() => openSettings(s.id)}
                    data-testid={`settings-nav-${s.id}`}
                    aria-current={s.id === id ? "page" : undefined}
                    aria-label={s.title}
                    {...stylex.props(styles.item, s.id === id ? styles.current : styles.idle)}
                  >
                    <s.icon {...stylex.props(styles.icon)} />
                    <span {...stylex.props(styles.title)}>{s.title}</span>
                  </button>
                </Tip>
              </div>
            ))}
          </nav>
          <div data-testid={`settings-${id}`} {...stylex.props(styles.panel)}>
            <current.Component key={id} />
          </div>
        </div>
      </ViewHeaderHost>
    </div>
  );
}
