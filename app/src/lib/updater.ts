import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

import { isTauri } from "@/lib/api";

// Updates to the app itself. Berth checks the latest GitHub release's
// latest.json when it opens and every few hours after, and downloads a newer
// version quietly. Nothing changes on disk until the person clicks "Restart
// to update" (the status bar, or Settings → About): then the download is
// installed over Berth.app and the app relaunches. It never restarts by
// itself. Restarting stops no agent (they run on their boxes), but it does
// close the window, which is the person's call.
//
// The update must carry a signature from the key in tauri.conf.json
// (plugins.updater.pubkey); the plugin refuses anything else.

export type UpdaterState =
  | { status: "idle" } // not checked yet, or not in the app
  | { status: "checking" }
  | { status: "current"; checkedAt: number }
  | { status: "downloading"; version: string; received: number; total?: number }
  | { status: "ready"; version: string }
  | { status: "installing"; version: string }
  | { status: "error"; error: string; checkedAt: number };

export const useUpdater = create<UpdaterState>(() => ({ status: "idle" }));

const EVERY = 4 * 60 * 60 * 1000;
let pending: Update | null = null;
let running: Promise<void> | null = null;

// updatesSupported is whether this copy of Berth can update itself: the
// packaged app. A dev build (pnpm tauri dev) can check, but only by hand.
export const updatesSupported = () => isTauri();

// checkForUpdate checks once, and downloads what it finds. A check while
// one runs joins it. `manual` is a click on Check now: only then is a
// failure worth showing; a failed check in the background waits for the
// next one.
export function checkForUpdate({ manual = false } = {}): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  running ??= run(manual).finally(() => {
    running = null;
  });
  return running;
}

async function run(manual: boolean) {
  const set = useUpdater.setState;
  const before = useUpdater.getState();
  // A downloaded update waits for its restart; checking again would only
  // fetch the same bytes.
  if (before.status === "ready" || before.status === "installing") return;
  set({ status: "checking" }, true);
  try {
    const update = await check({ timeout: 30_000 });
    if (!update) {
      set({ status: "current", checkedAt: Date.now() }, true);
      return;
    }
    set({ status: "downloading", version: update.version, received: 0 }, true);
    let received = 0;
    let total: number | undefined;
    await update.download(
      (e) => {
        if (e.event === "Started") total = e.data.contentLength;
        if (e.event === "Progress") received += e.data.chunkLength;
        set({ status: "downloading", version: update.version, received, total }, true);
      },
      { timeout: 10 * 60_000 },
    );
    await pending?.close().catch(() => {});
    pending = update;
    set({ status: "ready", version: update.version }, true);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (manual) set({ status: "error", error, checkedAt: Date.now() }, true);
    else set(before.status === "checking" ? { status: "idle" } : before, true);
    console.warn("berth: update check failed:", error);
  }
}

// restartToUpdate installs the downloaded update and relaunches Berth. Only
// ever from a click.
export async function restartToUpdate() {
  const update = pending;
  const state = useUpdater.getState();
  if (!update || state.status !== "ready") return;
  useUpdater.setState({ status: "installing", version: state.version }, true);
  try {
    await update.install();
    await invoke("restart_app");
  } catch (e) {
    useUpdater.setState({ status: "error", error: e instanceof Error ? e.message : String(e), checkedAt: Date.now() }, true);
    pending = null;
  }
}

let started = false;

// startUpdater checks on launch and every few hours, in the packaged app
// only: a dev build would otherwise offer to replace itself with a release.
export function startUpdater() {
  if (started || !isTauri() || import.meta.env.DEV) return;
  started = true;
  // Let the window and the agent connection settle first.
  window.setTimeout(() => void checkForUpdate(), 10_000);
  window.setInterval(() => void checkForUpdate(), EVERY);
}
