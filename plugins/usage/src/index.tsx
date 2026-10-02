import { definePlugin, useBoxes, useCurrentWorktree, useLocations, useStorage, type BerthPluginContext, type ScreenProps } from "@berth/plugin";
import { Alert, AlertDescription, Button, Icon, Menu, MenuItem, MenuPopup, MenuTrigger, Tabs, TabsList, TabsTab, ToggleGroup, ToggleGroupItem } from "@berth/plugin/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { AccountsView, type Choices } from "./accounts-view";
import { ACCOUNT_VAR, runScript, where, type Accounts, type Report } from "./box";
import type { Period } from "./data";
import { UsageView } from "./usage-view";

// Usage & accounts: how many tokens Claude Code and Codex used on each box,
// read from the transcripts they write there, and which login each one uses
// for new sessions. Off until turned on in Settings → Plugins.

export default definePlugin((berth) => {
  berth.addScreen({ id: "usage", title: "Usage", Component: UsageScreen });
  berth.addSidebarItem({ id: "usage", title: "Usage", icon: "ChartColumn", screen: "usage" });
  berth.addCommand({ id: "usage", title: "Show agent usage", group: "Agents", run: () => berth.openScreen("usage") });
  berth.addCommand({
    id: "accounts",
    title: "Switch agent account",
    group: "Agents",
    run: () => {
      berth.storage.set("tab", "accounts");
      berth.openScreen("usage");
    },
  });
});

// Reports are kept per box between launches, so the screen opens on the
// last one while a fresh one is read.
const reports = new Map<string, Report>();

function UsageScreen({ berth }: ScreenProps) {
  const boxes = useBoxes().filter((b) => b.state === "online");
  const current = useCurrentWorktree();
  const [picked, setPicked] = useStorage<string>("box", "");
  const box = boxes.some((b) => b.name === picked) ? picked : (current?.box ?? boxes[0]?.name ?? "");
  const [tab, setTab] = useStorage<"usage" | "accounts">("tab", "usage");
  const [period, setPeriod] = useStorage<Period>("period", 7);
  const locations = useLocations(box) ?? [];

  const [report, setReport] = useState<Report | undefined>(() => reports.get(box) ?? berth.storage.get<Record<string, Report>>("reports", {})[box]);
  const [accounts, setAccounts] = useState<Accounts>();
  const [choices, setChoices] = useState<Choices>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  const loadAccounts = useCallback(async () => {
    if (!box) return;
    const loc = await where(berth, box, current?.box === box ? current.location : undefined);
    const [a, c] = await Promise.all([runScript<Accounts>(berth, box, loc, ["accounts"], "30s"), readChoices(berth, box)]);
    setAccounts(a);
    setChoices(c);
  }, [berth, box, current?.box, current?.location]);

  const load = useCallback(async () => {
    if (!box) return;
    const n = ++seq.current;
    setLoading(true);
    setError(undefined);
    try {
      const loc = await where(berth, box, current?.box === box ? current.location : undefined);
      const [r] = await Promise.all([runScript<Report>(berth, box, loc, ["report", "30"]), loadAccounts()]);
      if (n !== seq.current) return;
      reports.set(box, r);
      setReport(r);
      const saved = berth.storage.get<Record<string, Report>>("reports", {});
      berth.storage.set("reports", { ...saved, [box]: r });
    } catch (err) {
      if (n === seq.current) setError(String((err as Error).message ?? err));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [berth, box, current?.box, current?.location, loadAccounts]);

  useEffect(() => {
    setReport(reports.get(box) ?? berth.storage.get<Record<string, Report>>("reports", {})[box]);
    setAccounts(undefined);
    setChoices(undefined);
    void load();
    // Only when the box changes; refresh is a button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  // A report still being read finishes in the background on the box; ask
  // again shortly so the rest arrives without a click.
  useEffect(() => {
    if (!report?.partial || loading) return;
    const t = setTimeout(() => void load(), 20_000);
    return () => clearTimeout(t);
  }, [report, loading, load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-lg tracking-tight">Usage & accounts</h1>
          <p className="mt-0.5 text-muted-foreground text-sm">Tokens Claude Code and Codex used on a box, from the transcripts they keep there, and which account new sessions sign in with.</p>
        </div>
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="sm" disabled={!boxes.length} />}>
            <Icon name="Server" />
            {box || "No box online"}
            <Icon name="ChevronDown" className="opacity-60" />
          </MenuTrigger>
          <MenuPopup align="end">
            {boxes.map((b) => (
              <MenuItem key={b.name} onClick={() => setPicked(b.name)}>
                {b.name}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
        <Button variant="outline" size="icon-sm" aria-label="Refresh" disabled={!box} loading={loading} onClick={() => void load()}>
          <Icon name="RefreshCw" />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v: "usage" | "accounts") => setTab(v)}>
          <TabsList>
            <TabsTab value="usage">Usage</TabsTab>
            <TabsTab value="accounts">Accounts</TabsTab>
          </TabsList>
        </Tabs>
        {tab === "usage" && (
          <ToggleGroup className="ml-auto" size="sm" variant="outline" value={[String(period)]} onValueChange={(v: string[]) => v[0] && setPeriod(Number(v[0]) as Period)}>
            <ToggleGroupItem value="1">Today</ToggleGroupItem>
            <ToggleGroupItem value="7">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30">30 days</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {error && (
        <Alert variant="error">
          <Icon name="CircleAlert" />
          <AlertDescription>
            Couldn't read {tab === "usage" ? "usage" : "accounts"} on {box}: {error}
          </AlertDescription>
        </Alert>
      )}

      {!box ? (
        <p className="py-16 text-center text-muted-foreground text-sm">Connect a box to see its agents' usage.</p>
      ) : tab === "usage" ? (
        !(error && !report) && <UsageView berth={berth} box={box} period={period} report={report} accounts={accounts?.accounts} locations={locations} />
      ) : (
        <AccountsView berth={berth} box={box} data={accounts} choices={choices} locations={locations} reload={loadAccounts} />
      )}
    </div>
  );
}

// readChoices reads where accounts are chosen: the box env and every
// project's effective env, keeping only the account variables.
async function readChoices(berth: BerthPluginContext, box: string): Promise<Choices> {
  const pick = (env: Record<string, string> | undefined) => Object.fromEntries(Object.entries(env ?? {}).filter(([k]) => Object.values(ACCOUNT_VAR).includes(k)));
  const [env, locs] = await Promise.all([berth.api.request<{ env: Record<string, string> }>(box, "GET", "env").catch(() => ({ env: {} })), berth.api.locations(box)]);
  const projects: Record<string, Record<string, string>> = {};
  await Promise.all(
    locs.map(async (l) => {
      const c = await berth.api.request<{ effective?: { env?: Record<string, string> } }>(box, "GET", `locations/${encodeURIComponent(l.name)}/config`).catch(() => undefined);
      const e = pick(c?.effective?.env);
      if (Object.keys(e).length) projects[l.name] = e;
    }),
  );
  return { box: pick(env.env), projects };
}
