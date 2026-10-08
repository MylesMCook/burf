import { toastManager } from "@/components/ui/toast";
import { cliLinkStatus, installCliLink } from "@/lib/cli-link";
import { cliLinkDecided, shouldLinkCli } from "@/lib/cli-link-rule";
import { usePrefs } from "@/lib/prefs";

// First run of an installed Burf: its burf command goes on the PATH, so
// what the app and its docs say to type in a terminal works without a trip
// to Settings. Once, into an empty spot only (lib/cli-link-rule.ts);
// Settings › General still shows it and removes it.
export async function linkCliOnce(): Promise<void> {
  if (usePrefs.getState().cliLinkOffered) return;
  const cli = await cliLinkStatus().catch(() => null);
  if (!cliLinkDecided(cli)) return;
  if (shouldLinkCli(cli, false)) {
    try {
      const linked = await installCliLink();
      if (linked.state === "linked") {
        toastManager.add({ title: "The burf command is ready", description: "New terminals can run burf. Settings › General can remove it.", type: "success" });
      }
    } catch {
      // Settings › General still offers it, and says why it failed.
    }
  }
  usePrefs.setState({ cliLinkOffered: true });
}
