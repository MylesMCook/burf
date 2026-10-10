import * as stylex from "@stylexjs/stylex";
import { ShieldAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { flowsApi, type LocationConfig, type RepoConfig, type RepoTrust } from "@/lib/flows";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "maxHeight": "224px",
    "overflowY": "auto",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--background) 60%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "gap": "12px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
  },
  s2: {
    "width": "144px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "whiteSpace": "pre-wrap",
    "wordBreak": "break-all",
    "color": "var(--foreground)",
  },
  s4: {
    "display": "flex",
    "gap": "8px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A repository's committed .berth/config.json runs on the box: its setup
// script, services, hooks, flows, environment and agent commands. The box
// runs none of it until someone trusts the file on that box, and asks again
// whenever the file changes. These show what it wants and let you trust it.

// RepoWants lists what a committed config would run, command by command, so
// trusting it is a decision about something you have read.
export function RepoWants({ wants }: { wants: RepoConfig }) {
  const rows: [string, string][] = [];
  if (wants.setup) rows.push(["setup", wants.setup]);
  if (wants.archive) rows.push(["teardown", wants.archive]);
  for (const s of wants.services ?? []) rows.push([`service ${s.name}`, s.run + (s.autostart ? "  (starts with each worktree)" : "")]);
  for (const h of wants.hooks ?? []) rows.push([`hook ${h.on}`, h.run]);
  for (const f of wants.flows ?? []) {
    rows.push([`automation ${f.name || f.id}`, (f.steps ?? []).map((s) => s.command || s.text || s.url || s.kind).join(" → ")]);
  }
  for (const a of wants.agents ?? []) rows.push([`agent ${a.id}`, a.command]);
  for (const [k, v] of Object.entries(wants.env ?? {})) rows.push([`env ${k}`, v]);
  if (!rows.length) return null;
  return (
    <dl className={sx(paint.s0)}>
      {rows.map(([k, v], i) => (
        <div key={i} className={sx(paint.s1)}>
          <dt className={sx(paint.s2)}>{k}</dt>
          <dd className={sx(paint.s3)}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// trustRepo trusts exactly the version of the file that was shown.
export async function trustRepo(box: string, location: string, trust: RepoTrust): Promise<LocationConfig | undefined> {
  const client = useStore.getState().client;
  if (!client || !trust.hash) return undefined;
  const c = await flowsApi.trustRepo(client, box, location, trust.hash);
  await useStore.getState().refreshBox(box, ["locations"]);
  return c;
}

const intro = (t: RepoTrust) =>
  t.state === "changed"
    ? "Its .berth/config.json changed since it was trusted on this box, so none of it runs until you look again."
    : "Its .berth/config.json runs commands on this box. None of it runs until you trust it here; only its port count applies.";

// RepoTrustBanner is Project settings' prompt: "This repository wants to
// run …", with Trust and Not now. Not now hides it until the next visit.
export function RepoTrustBanner({ box, location, config, onChanged }: { box: string; location: string; config: LocationConfig; onChanged(): void }) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = config.repo_trust;
  if (!t || hidden || (t.state !== "untrusted" && t.state !== "changed") || !t.wants) return null;
  const trust = async () => {
    setBusy(true);
    try {
      await trustRepo(box, location, t);
      toastManager.add({ title: `Trusted ${location}'s config on ${box}`, description: "It runs in new worktrees from now on.", type: "success" });
      onChanged();
    } catch (err) {
      toastManager.add({ title: "Could not trust the config", description: errorMessage(err), type: "error" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Alert variant="warning">
      <ShieldAlertIcon />
      <AlertTitle>This repository wants to run commands on {box}</AlertTitle>
      <AlertDescription>
        <p>{intro(t)} Trust it only if you trust everyone who can commit to it.</p>
        <RepoWants wants={t.wants} />
        <div className={sx(paint.s4)}>
          <Button size="sm" onClick={() => void trust()} loading={busy}>
            Trust and run it
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
            Not now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// useRepoTrustFor loads a location's trust when the box says it is pending,
// for the new-worktree dialog to ask before creating.
export function useRepoTrustFor(box: string, location: string | undefined, state: string | undefined) {
  const [trust, setTrust] = useState<{ key: string; t?: RepoTrust }>();
  const pending = !!location && (state === "untrusted" || state === "changed");
  const key = `${box}/${location ?? ""}/${state ?? ""}`;
  useEffect(() => {
    const client = useStore.getState().client;
    if (!pending || !client || !location) return;
    let live = true;
    flowsApi.config(client, box, location).then(
      (c) => live && setTrust({ key, t: c.repo_trust }),
      () => live && setTrust({ key }),
    );
    return () => {
      live = false;
    };
  }, [box, location, pending, key]);
  return pending && trust?.key === key ? trust.t : undefined;
}
