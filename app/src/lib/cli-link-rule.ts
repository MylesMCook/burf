import type { CliLink } from "./cli-link.ts";

// Whether Burf should put its burf command on the PATH now, by itself.
// Once per install, and only into an empty spot: never over a burf that is
// already there, never from a copy that cannot be linked (a disk image, or a
// copy running on a state folder of its own), and never again after the
// person has removed it in Settings.
export function shouldLinkCli(cli: CliLink | null, offered: boolean): boolean {
  return !offered && !!cli?.bundled && !cli.blocked && cli.state === "missing";
}

// Whether the decision is final for this install. A blocked copy has not
// decided: once it runs from its place, it gets its turn.
export function cliLinkDecided(cli: CliLink | null): boolean {
  return !!cli?.bundled && !cli.blocked;
}
