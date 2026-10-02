import { CheckIcon, CopyIcon, GitBranchIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";

import { AddLocationDialog } from "@/components/add-location-dialog";
import { AppSidebar } from "@/components/app-sidebar";
import { Scene } from "@/components/art/scenes";
import { CommandPalette } from "@/components/command-palette";
import { NewWorktreeDialog } from "@/components/new-worktree-dialog";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { LoopsPanel } from "@/components/orchestrate/loops-panel";
import { OrchestrateDialog } from "@/components/orchestrate/orchestrate-dialog";
import { PromptDialogs } from "@/components/prompts";
import { StatusBar } from "@/components/status-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { AddToBoxDialog } from "@/components/sidebar/add-to-box-dialog";
import { ConfirmHost } from "@/components/sidebar/confirm";
import { CustomizeSidebarSheet } from "@/components/sidebar/nav";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Launcher } from "@/components/workspace/launcher";
import { PaneLayer } from "@/components/workspace/pane-layer";
import { TabStrip } from "@/components/workspace/tab-strip";
import { useBerthConnection } from "@/hooks/use-berth-connection";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useApplyTheme } from "@/hooks/use-theme";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { recentWorktrees, selectWorktree, useWorkspaces } from "@/lib/workspaces";
import { AutomationsView } from "@/views/automations";
import { WorktreesView } from "@/views/worktrees/worktrees-view";
import { useKitDeepLinks } from "@/views/kits/deep-link";
import { KitsView } from "@/views/kits/kits-view";
import { ReviewSheet } from "@/views/kits/review-sheet";
import { ReviewView } from "@/views/review/review-view";
import { ProjectView } from "@/views/project/project-view";
import { DashboardView } from "@/views/dashboard";
import { PluginScreenView } from "@/views/plugin-screen-view";
import { AddBoxDialog } from "@/views/onboarding/add-box-dialog";
import { useOnboardingActive } from "@/views/onboarding/onboarding-state";
import { OnboardingView } from "@/views/onboarding/onboarding-view";
import { SettingsView } from "@/views/settings/settings-view";

const viewTitles = { dashboard: "Agent Dashboard", review: "Review", worktrees: "Worktrees", automations: "Automations", kits: "Kits", project: "Project settings", settings: "Settings", plugin: "" } as const;

export default function App() {
  useApplyTheme();
  useBerthConnection();
  useShortcuts();
  useKitDeepLinks();
  const view = useStore((s) => s.view);
  const workspace = view.kind === "workspace";
  // Onboarding has no tabs yet, so it gets the plain strip, not the tab strip.
  const onboarding = useOnboardingActive();

  return (
    <TooltipProvider delay={300}>
      {/* Toasts sit bottom-right, as in other desktop tools: above the status
          bar (26px) and above the loop panel when there is one, which says
          how tall it is in --berth-loops-h. Top-right covered the headers of
          pages (Review's, say). With a dialog or sheet open they move to
          the bottom-left; see components/ui/toast.tsx. */}
      <ToastProvider position="bottom-right" viewportClassName="data-[position=bottom-right]:bottom-[calc(38px+var(--berth-loops-h,0px))] data-[position=bottom-right]:right-3 data-[position=bottom-left]:bottom-[38px] data-[position=bottom-left]:left-3">
        <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
          <div className="flex min-h-0 flex-1">
            <Disconnectable>
              <AppSidebar />
            </Disconnectable>
            <div className="flex min-w-0 flex-1 flex-col">
              {workspace && !onboarding ? (
                <Disconnectable className="shrink-0 flex-col">
                  <TabStrip />
                </Disconnectable>
              ) : !workspace ? null /* every other view's ViewHeader is the strip */ : (
                // Onboarding names itself; the strip only drags the window.
                <div data-tauri-drag-region className="h-10 shrink-0 bg-background" />
              )}
              <main className="relative min-h-0 flex-1">
                {/* Always mounted: terminals keep running behind other views. */}
                <PaneLayer showing={workspace} />
                <ErrorBoundary key={view.kind} scope={viewTitles[view.kind as keyof typeof viewTitles] || (view.kind === "workspace" ? "the workspace" : undefined)} onLeave={view.kind === "workspace" ? undefined : () => useStore.getState().setView({ kind: "workspace" })}>
                  <MainView />
                </ErrorBoundary>
              </main>
            </div>
          </div>
          <StatusBar />
        </div>
        <ErrorBoundary scope="a dialog">
          <CommandPalette />
          <NewWorktreeDialog />
          <AddLocationDialog />
          <OrchestrateDialog />
          <PromptDialogs />
          <LoopsPanel />
          <AddBoxDialog />
          <ConfirmHost />
          <AddToBoxDialog />
          <CustomizeSidebarSheet />
          <ReviewSheet />
          <NotificationCenter />
        </ErrorBoundary>
      </ToastProvider>
    </TooltipProvider>
  );
}

function MainView() {
  const view = useStore((s) => s.view);
  const connection = useStore((s) => s.connection);
  const client = useStore((s) => s.client);
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const onboarding = useOnboardingActive();

  if (!client) return <Connecting state={connection.state} error={connection.error} />;
  // A new account starts here; Settings and the other views stay reachable.
  if (view.kind === "workspace" && onboarding) {
    return (
      <div className="absolute inset-0">
        <OnboardingView />
      </div>
    );
  }
  if (view.kind === "workspace") {
    if (!ws) return <NoWorktree />;
    return ws.tabs.length ? null : <Launcher worktree={ws.ref} />;
  }
  return (
    <div className="absolute inset-0 bg-background">
      {view.kind === "dashboard" && <DashboardView />}
      {view.kind === "automations" && <AutomationsView />}
      {view.kind === "review" && <ReviewView />}
      {view.kind === "kits" && <KitsView />}
      {view.kind === "worktrees" && <WorktreesView />}
      {view.kind === "project" && <ProjectView key={`${view.box}/${view.location}`} box={view.box} location={view.location} />}
      {view.kind === "settings" && <SettingsView />}
      {view.kind === "plugin" && <PluginScreenView screen={view.screen} />}
    </div>
  );
}

// NoWorktree is the workspace before any worktree is picked: a new one, or
// one opened recently.
function NoWorktree() {
  const spaces = useWorkspaces((st) => st.spaces);
  const recent = recentWorktrees(spaces);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Scene name="dawn" />
          </EmptyMedia>
          <EmptyTitle>Pick a worktree</EmptyTitle>
          <EmptyDescription>Open one from the sidebar to see its terminals and agents, or start a new one.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => useStore.getState().openNewWorktree()}>
            New worktree
            <Kbd className="ml-1 bg-primary-foreground/15 text-primary-foreground">⌘N</Kbd>
          </Button>
          {recent.length > 0 && (
            <div className="mt-2 flex w-72 flex-col gap-1">
              <p className="text-left text-muted-foreground text-xs">Recent</p>
              {recent.map((w) => (
                <button
                  key={`${w.ref.box}:${w.ref.path}`}
                  type="button"
                  onClick={() => selectWorktree(w.ref)}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent"
                >
                  <GitBranchIcon className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{w.ref.main ? w.ref.location : `${w.ref.location} / ${w.ref.worktree}`}</span>
                  <span className="text-muted-foreground text-xs">{w.ref.box}</span>
                </button>
              ))}
            </div>
          )}
        </EmptyContent>
      </Empty>
    </div>
  );
}

// Disconnectable dims what cannot work until the agent answers.
// Inert as well, so the keyboard cannot reach it either.
function Disconnectable({ children, className }: { children: React.ReactNode; className?: string }) {
  const offline = useStore((s) => !s.client);
  return (
    <div className={cn("flex", className, offline && "pointer-events-none opacity-50")} aria-disabled={offline || undefined} inert={offline || undefined}>
      {children}
    </div>
  );
}

const START = "berth status";

// Connecting is shown until the laptop agent answers. Any berth command
// starts the agent; this window reconnects by itself once it is up.
function Connecting({ state, error }: { state: string; error?: string }) {
  const [copied, setCopied] = useState(false);
  if (state === "connecting") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Scene name="lighthouse" />
            </EmptyMedia>
            <EmptyTitle>Finding the Berth agent…</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia>
            <Scene name="offline" />
          </EmptyMedia>
          <EmptyTitle>The Berth agent is not running</EmptyTitle>
          <EmptyDescription>It keeps your boxes connected while this window is closed. Run this in a terminal to start it; Berth connects as soon as it is up.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 py-1 pr-1 pl-3 text-left">
            <code className="flex-1 font-mono text-sm">{START}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard?.writeText(START);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => location.reload()}>
            <RotateCwIcon />
            Retry now
          </Button>
          {error && (
            <details className="w-full text-left text-muted-foreground text-xs">
              <summary className="cursor-default select-none hover:text-foreground">Details</summary>
              <pre className="mt-2 rounded-md bg-muted p-2 font-mono whitespace-pre-wrap">{error}</pre>
            </details>
          )}
        </EmptyContent>
      </Empty>
    </div>
  );
}
