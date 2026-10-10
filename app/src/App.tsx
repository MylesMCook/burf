import { lazy, Suspense, useEffect } from "react";
import * as stylex from "@stylexjs/stylex";

import { AddLocationDialog } from "@/components/add-location-dialog";
import { Connecting } from "@/components/agent-offline";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { FilePicker } from "@/components/files/file-picker";
import { TreeDockFrame } from "@/components/files/tree-dock";
import { WorktreePicker } from "@/components/workspace/worktree-picker";
import { ComposerDialog } from "@/components/conversation/composer-dialog";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { LoopsPanel } from "@/components/orchestrate/loops-panel";
import { PluginConsentDialog } from "@/components/plugin-consent-dialog";
import { PromptDialogs } from "@/components/prompts";
import { StatusBar } from "@/components/status-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { AddToBoxDialog } from "@/components/sidebar/add-to-box-dialog";
import { ConfirmHost } from "@/components/sidebar/confirm";
import { ErrorDetailsHost } from "@/components/error-note";
import { ShortcutsSheet } from "@/components/shortcuts-sheet";
import { WhatsNewDialog } from "@/components/whats-new/whats-new-dialog";
import { CustomizeSidebarSheet } from "@/components/sidebar/nav";
import { ToastProvider } from "@/components/ui/toast";
import { FileDropGuard } from "@/components/file-drop-guard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Launcher } from "@/components/workspace/launcher";
import { PaneLayer } from "@/components/workspace/pane-layer";
import { TabStrip } from "@/components/workspace/tab-strip";
import { HomeTabs } from "@/components/workspace/home-tabs";
import { BoxPicker } from "@/components/box-picker";
import { FakeTrafficLights, ZenBar } from "@/components/workspace/zen";
import { Announcer } from "@/components/announcer";
import { fakeTrafficLights } from "@/lib/api";
import { linkCliOnce } from "@/lib/cli-setup";
import { useBerthConnection } from "@/hooks/use-burf-connection";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useWindowTitle } from "@/hooks/use-window-title";
import { useApplyTheme } from "@/hooks/use-theme";
import { startOutdatedWatch } from "@/lib/outdated";
import { startRunsWatch } from "@/lib/runs";
import { watchStillness } from "@/lib/still";
import { useStore } from "@/lib/store";
import { startUpdater } from "@/lib/updater";
import { useWhatsNewAfterUpdate } from "@/lib/whats-new";
import { homeBox, useWorkspaces } from "@/lib/workspaces";
import { AutomationsView } from "@/views/automations";
import { WorktreesView } from "@/views/worktrees/worktrees-view";
import { ReviewView } from "@/views/review/review-view";
import { ProjectView } from "@/views/project/project-view";
import { DashboardView } from "@/views/dashboard";
import { PluginScreenView } from "@/views/plugin-screen-view";
import { AddBoxDialog } from "@/views/onboarding/add-box-dialog";
import { setLocalAvailable, useOnboardingActive } from "@/views/onboarding/onboarding-state";
import { OnboardingView } from "@/views/onboarding/onboarding-view";
import { SettingsView } from "@/views/settings/settings-view";
import { HomeView } from "@/views/home/home-view";
import { usePrefs } from "@/lib/prefs";
import { useLocalComputer } from "@/lib/local-computer";
import { placeLabel } from "@/lib/worktree-names";
import { useRescueRemovedFocus } from "@/lib/focus-home";
import { color } from "@/styles/tokens.stylex";

// The live demo's guide and script (pnpm build:demo); not in the app.
const DemoGuide = __BERTH_DEMO__ ? lazy(() => import("@/demo/guide")) : null;
const LocalComputerView = lazy(() => import("@/views/local-computer").then((m) => ({ default: m.LocalComputerView })));

const viewTitles = { dashboard: "Agent Dashboard", local: "This computer", review: "Review", worktrees: "Worktrees", automations: "Automations", project: "Project settings", settings: "Settings", plugin: "" } as const;

const wide = "@media (min-width: 1300px)";

const styles = stylex.create({
  shell: {
    display: "flex",
    height: "100svh",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: color.background,
    color: color.foreground,
  },
  drag: { height: 40, flexShrink: 0 },
  dragFill: { height: 40, flexShrink: 0, backgroundColor: color.background },
  main: { position: "relative", minHeight: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  body: { display: "flex", minHeight: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  column: { position: "relative", display: "flex", minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%", flexDirection: "column" },
  fill: { position: "absolute", inset: 0 },
  view: { position: "absolute", inset: 0, backgroundColor: color.background },
  zen: {
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: 1280,
    borderLeftWidth: { default: 0, [wide]: 1 },
    borderRightWidth: { default: 0, [wide]: 1 },
    borderLeftStyle: "solid",
    borderRightStyle: "solid",
    borderLeftColor: color.border,
    borderRightColor: color.border,
  },
  loading: { padding: 24, fontSize: 14, color: color.mutedForeground },
  sr: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  row: { display: "flex" },
  stack: { flexShrink: 0, flexDirection: "column" },
  offline: { pointerEvents: "none", opacity: 0.5 },
});

export default function App() {
  useApplyTheme();
  useBerthConnection();
  const local = useLocalComputer();
  const noBoxes = useStore((s) => !!s.status && s.status.boxes.length === 0);
  useEffect(() => {
    setLocalAvailable(!!local?.supported);
    if (local?.supported && noBoxes && useStore.getState().view.kind === "workspace") useStore.getState().setView({ kind: "local" });
  }, [local?.supported, noBoxes]);
  useShortcuts();
  useWindowTitle();
  // Checks for a newer Burf on launch and every few hours (lib/updater.ts).
  useEffect(startUpdater, []);
  // First run of an installed Burf: its burf command goes on the PATH, once
  // (lib/cli-setup.ts).
  useEffect(() => void linkCliOnce(), []);
  // Spinners and shimmers hold still while the window is in the background.
  useEffect(watchStillness, []);
  // Runs on the boxes (loops, attempts, flows): kept fresh for the loops
  // panel, Automations and Review (lib/runs.ts).
  const connectedToAgent = useStore((s) => !!s.client);
  useEffect(() => (connectedToAgent ? startRunsWatch() : undefined), [connectedToAgent]);
  // Which boxes run an older berthd (lib/outdated.ts).
  useEffect(() => (connectedToAgent ? startOutdatedWatch() : undefined), [connectedToAgent]);
  const view = useStore((s) => s.view);
  const workspace = view.kind === "workspace";
  // Labs: zen (⌘.) puts away the sidebar, the tab strip and the status bar.
  const zen = usePrefs((p) => p.labs && p.zen);
  // Without the status bar, what floats over its corner (toasts, the loops
  // panel) comes down to the window's edge.
  useEffect(() => document.documentElement.style.setProperty("--berth-status-h", zen ? "0px" : "26px"), [zen]);
  // The keyboard is never dropped on <body> by what had it going away.
  useRescueRemovedFocus();
  // Onboarding has no tabs yet, so it gets the plain strip, not the tab strip.
  const onboarding = useOnboardingActive();
  // Home (no worktree, or a box's home terminals over it) has its own strip.
  const onHome = useWorkspaces((s) => !s.current || !!homeBox(s.current));
  const connected = useStore((s) => !!s.client);
  // Until onboarding is done it is the whole window: no sidebar, status
  // bar, palette or shortcuts to wander off through.
  const gated = onboarding && connected;
  // Once after an update: the release's highlights (lib/whats-new.ts),
  // never over onboarding.
  useWhatsNewAfterUpdate(!gated);
  useEffect(() => {
    if (gated && useStore.getState().view.kind !== "workspace") useStore.getState().setView({ kind: "workspace" });
  }, [gated]);

  if (gated) {
    return (
      <TooltipProvider delay={300}>
        <ToastProvider position="bottom-right" clear="onboarding">
          <div {...stylex.props(styles.shell)}>
            {/* Room for the traffic lights; the strip drags the window. */}
            <div data-tauri-drag-region {...stylex.props(styles.drag)} />
            <main {...stylex.props(styles.main)}>
              <ErrorBoundary scope="onboarding">
                <OnboardingView />
              </ErrorBoundary>
            </main>
          </div>
          <ErrorBoundary scope="a dialog">
            <AddBoxDialog />
            <ConfirmHost />
            <ErrorDetailsHost />
          </ErrorBoundary>
          <FileDropGuard />
          <Announcer />
        </ToastProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delay={300}>
      {/* Toasts sit bottom-right, as in other desktop tools: above the status
          bar (26px) and above the loop panel when there is one, which says
          how tall it is in --berth-loops-h. Top-right covered the headers of
          pages (Review's, say). A bar floating at a page's bottom (the
          Dashboard's selection, the Worktrees bulk bar) lifts them above
          it through --berth-bar-lift (hooks/lift-toasts.ts). With a dialog
          or sheet open they move to a corner clear of it; see
          components/ui/toast.tsx. The stack is as wide as the loops panel. */}
      <ToastProvider position="bottom-right" clear="chrome">
        <div {...stylex.props(styles.shell)}>
          {fakeTrafficLights() && <FakeTrafficLights />}
          <div {...stylex.props(styles.body)}>
            {!zen && (
              <Disconnectable>
                <AppSidebar />
              </Disconnectable>
            )}
            <div {...stylex.props(styles.column)}>
              {zen && !onboarding ? (
                <ZenBar />
              ) : workspace && !onboarding ? (
                <Disconnectable stack label="Tab bar">
                  {!onHome && <WorkspaceHeading />}
                  {onHome ? <HomeTabs /> : <TabStrip />}
                </Disconnectable>
              ) : !workspace ? null /* every other view's ViewHeader is the strip */ : (
                // Onboarding names itself; the strip only drags the window.
                <div data-tauri-drag-region {...stylex.props(styles.dragFill)} />
              )}
              <main {...stylex.props(styles.main)}>
                {/* Always mounted: terminals keep running behind other views. */}
                <TreeDockFrame showing={workspace && view.kind === "workspace"}>
                  <PaneLayer showing={workspace} />
                </TreeDockFrame>
                <ErrorBoundary key={view.kind} scope={viewTitles[view.kind as keyof typeof viewTitles] || (view.kind === "workspace" ? "the workspace" : undefined)} onLeave={view.kind === "workspace" ? undefined : () => useStore.getState().setView({ kind: "workspace" })}>
                  <MainView />
                </ErrorBoundary>
              </main>
            </div>
          </div>
          {!zen && <StatusBar />}
        </div>
        <ErrorBoundary scope="a dialog">
          <CommandPalette />
          <FilePicker />
          <WorktreePicker />
          <BoxPicker />
          <ComposerDialog />
          <AddLocationDialog />
          <PromptDialogs />
          <LoopsPanel />
          <AddBoxDialog />
          <ConfirmHost />
          <ErrorDetailsHost />
          <AddToBoxDialog />
          <PluginConsentDialog />
          <CustomizeSidebarSheet />
          <ShortcutsSheet />
          <NotificationCenter />
          <WhatsNewDialog />
        </ErrorBoundary>
        <FileDropGuard />
        <Announcer />
        {DemoGuide && (
          <Suspense>
            <DemoGuide />
          </Suspense>
        )}
      </ToastProvider>
    </TooltipProvider>
  );
}

function MainView() {
  const view = useStore((s) => s.view);
  const connection = useStore((s) => s.connection);
  const client = useStore((s) => s.client);
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const home = useWorkspaces((s) => !!homeBox(s.current));
  const onboarding = useOnboardingActive();
  const zen = usePrefs((p) => p.labs && p.zen);

  if (!client) return <Connecting state={connection.state} error={connection.error} />;
  // A new account starts here; Settings and the other views stay reachable.
  if (view.kind === "workspace" && onboarding) {
    return (
      <div {...stylex.props(styles.fill)}>
        <OnboardingView />
      </div>
    );
  }
  if (view.kind === "workspace") {
    // A box's home terminals show over Home, which shows again without them.
    if (!ws || home) return ws?.tabs.length ? null : <NoWorktree />;
    return ws.tabs.length ? null : <Launcher worktree={ws.ref} />;
  }
  return (
    // In zen there is no sidebar: a view keeps the width it has beside one,
    // centred, rather than stretching across the window.
    <div {...stylex.props(styles.view, zen && styles.zen)}>
      {view.kind === "dashboard" && <DashboardView />}
      {view.kind === "local" && <Suspense fallback={<p role="status" {...stylex.props(styles.loading)}>Loading this computer...</p>}><LocalComputerView /></Suspense>}
      {view.kind === "automations" && <AutomationsView />}
      {view.kind === "review" && <ReviewView />}
      {view.kind === "worktrees" && <WorktreesView />}
      {view.kind === "project" && <ProjectView key={`${view.box}/${view.location}`} box={view.box} location={view.location} />}
      {view.kind === "settings" && <SettingsView />}
      {view.kind === "plugin" && <PluginScreenView screen={view.screen} />}
    </div>
  );
}

// NoWorktree is the workspace before any worktree is picked: the composer,
// to start work, and the agents and worktrees to go back to. Labs adds the
// harbour across the top.
function NoWorktree() {
  return <HomeView />;
}

// Disconnectable dims what cannot work until the agent answers.
// Inert as well, so the keyboard cannot reach it either.
// WorkspaceHeading names the worktree in front for screen readers, as the
// window's title does: the page's one heading while its tabs show.
function WorkspaceHeading() {
  const ref = useWorkspaces((s) => (s.current && !homeBox(s.current) ? s.spaces[s.current]?.ref : undefined));
  const label = useStore((s) => (ref?.path ? placeLabel(ref, s.boxes) : undefined));
  return label ? <h1 {...stylex.props(styles.sr)}>{label}</h1> : null;
}

function Disconnectable({ children, label, stack = false }: { children: React.ReactNode; label?: string; stack?: boolean }) {
  const offline = useStore((s) => !s.client);
  return (
    <div role={label ? "region" : undefined} aria-label={label} {...stylex.props(styles.row, stack && styles.stack, offline && styles.offline)} aria-disabled={offline || undefined} inert={offline || undefined}>
      {children}
    </div>
  );
}
