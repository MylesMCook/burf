import { BotIcon, InfoIcon, KeyboardIcon, PaletteIcon, PuzzleIcon, ServerIcon, SlidersHorizontalIcon, SmartphoneIcon, SquareTerminalIcon, WrenchIcon } from "lucide-react";
import type { ComponentType } from "react";

import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AboutSection } from "@/views/settings/about-section";
import { AgentsSection } from "@/views/settings/agents-section";
import { AppearanceSection } from "@/views/settings/appearance-section";
import { BoxesSection } from "@/views/settings/boxes-section";
import { DeveloperSection } from "@/views/settings/developer-section";
import { GeneralSection } from "@/views/settings/general-section";
import { PhoneSection } from "@/views/settings/phone-section";
import { PluginsSection } from "@/views/settings/plugins-section";
import { ShortcutsSection } from "@/views/settings/shortcuts-section";
import { TerminalSection } from "@/views/settings/terminal-section";

export type SettingsSectionId = "general" | "appearance" | "terminal" | "boxes" | "phone" | "agents" | "plugins" | "shortcuts" | "about" | "developer";

const SECTIONS: { id: SettingsSectionId; title: string; icon: ComponentType<{ className?: string }>; Component: ComponentType }[] = [
  { id: "general", title: "General", icon: SlidersHorizontalIcon, Component: GeneralSection },
  { id: "appearance", title: "Appearance", icon: PaletteIcon, Component: AppearanceSection },
  { id: "terminal", title: "Terminal", icon: SquareTerminalIcon, Component: TerminalSection },
  { id: "boxes", title: "Boxes", icon: ServerIcon, Component: BoxesSection },
  { id: "phone", title: "Phone", icon: SmartphoneIcon, Component: PhoneSection },
  { id: "agents", title: "Agents", icon: BotIcon, Component: AgentsSection },
  { id: "plugins", title: "Plugins", icon: PuzzleIcon, Component: PluginsSection },
  { id: "shortcuts", title: "Shortcuts", icon: KeyboardIcon, Component: ShortcutsSection },
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
    <div className="flex h-full">
      <nav aria-label="Settings sections" className="flex w-48 shrink-0 flex-col gap-px border-r px-2 pt-4 max-[1200px]:w-12 max-[1200px]:px-1.5">
        {SECTIONS.map((s) => (
          <div key={s.id}>
            {s.id === "about" && <div className="mx-2.5 my-2 border-t max-[1200px]:mx-1" />}
            <button
              type="button"
              onClick={() => openSettings(s.id)}
              aria-current={s.id === id ? "page" : undefined}
              aria-label={s.title}
              title={s.title}
              className={cn(
                "flex h-7.5 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors max-[1200px]:justify-center max-[1200px]:px-0",
                s.id === id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <s.icon className="size-3.5 shrink-0" />
              <span className="max-[1200px]:hidden">{s.title}</span>
            </button>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <current.Component key={id} />
      </div>
    </div>
  );
}
