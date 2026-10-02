import { definePlugin, useBoxes, useCurrentWorktree, useLocations, useStorage, type BerthPluginContext, type Location, type ScreenProps, type Session } from "@berth/plugin";
import { Alert, AlertDescription, Button, Icon, Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, Tabs, TabsList, TabsTab, ToggleGroup, ToggleGroupItem } from "@berth/plugin/ui";
import { useCallback, useEffect, useState } from "react";

import { AccountsView, type Choices } from "./accounts-view";
import { ACCOUNT_VAR, runScript, where, type Account, type Accounts, type Report } from "./box";
import type { Period, Source } from "./data";
import { BoxStatus, UsageView, type BoxState } from "./usage-view";

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
// last ones while fresh ones are read.
const reports = new Map<string, Report>();

const ALL = "*";
const EMPTY: BoxData = { locations: [], sessions: [], loading: false };

interface BoxData {
  report?: Report;
  accounts?: Account[];
  locations: Location[];
  sessions: Session[];
  loading: boolean;
  error?: string;
}

function UsageScreen({ berth }: ScreenProps) {
  const paired = useBoxes();
  const online = paired.filter((b) => b.state === "online").map((b) => b.name);
  const allBoxes = paired.map((b) => b.name);
  const current = useCurrentWorktree();
  const [tab, setTab] = useStorage<"usage" | "accounts">("tab", "usage");
  const [period, setPeriod] = useStorage<Period>("period", 7);
  // Usage covers every box unless one is picked; accounts are always one box's.
  const [picked, setPicked] = useStorage<string>("box", ALL);
  const usageBox = picked !== ALL && allBoxes.includes(picked) ? picked : ALL;
  const [pickedAccounts, setPickedAccounts] = useStorage<string>("accountsBox", "");
  const accountsBox = online.includes(pickedAccounts) ? pickedAccounts : current && online.includes(current.box) ? current.box : (online[0] ?? "");

  const [data, setData] = useState<Record<string, BoxData>>({});
  const patch = useCallback((box: string, p: Partial<BoxData>) => setData((d) => ({ ...d, [box]: { ...(d[box] ?? EMPTY), ...p } })), []);

  const loadBox = useCallback(
    async (box: string) => {
      patch(box, { loading: true, error: undefined });
      try {
        const loc = await where(berth, box, current?.box === box ? current.location : undefined);
        const [report, acc, locations, sessions] = await Promise.all([
          runScript<Report>(berth, box, loc, ["report", "30"]),
          runScript<Accounts>(berth, box, loc, ["accounts"], "30s").catch(() => undefined),
          berth.api.locations(box).catch(() => [] as Location[]),
          berth.api.sessions(box).catch(() => [] as Session[]),
        ]);
        reports.set(box, report);
        const saved = berth.storage.get<Record<string, Report>>("reports", {});
        berth.storage.set("reports", { ...saved, [box]: report });
        patch(box, { report, accounts: acc?.accounts, locations, sessions, loading: false });
      } catch (err) {
        patch(box, { loading: false, error: String((err as Error).message ?? err) });
      }
    },
    [berth, current?.box, current?.location, patch],
  );

  const targets = usageBox === ALL ? online : online.includes(usageBox) ? [usageBox] : [];
  const targetKey = targets.join(",");
  const loadUsage = useCallback(() => Promise.all(targets.map((b) => loadBox(b))), [targetKey, loadBox]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Start from the last reports while fresh ones are read.
    const saved = berth.storage.get<Record<string, Report>>("reports", {});
    for (const b of targets) if (!data[b]?.report && (reports.get(b) ?? saved[b])) patch(b, { report: reports.get(b) ?? saved[b] });
    void loadUsage();
    // Only when the boxes change; refresh is a button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // A box still reading its transcripts finishes in the background; ask it
  // again shortly so the rest arrives without a click.
  useEffect(() => {
    const slow = targets.filter((b) => data[b]?.report?.partial && !data[b]?.loading);
    if (!slow.length) return;
    const t = setTimeout(() => slow.forEach((b) => void loadBox(b)), 20_000);
    return () => clearTimeout(t);
  }, [data, targetKey, loadBox]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Accounts tab: one box's logins and where each is chosen.
  const [accounts, setAccounts] = useState<Accounts>();
  const [choices, setChoices] = useState<Choices>();
  const [accountsError, setAccountsError] = useState<string>();
  const [accountsLoading, setAccountsLoading] = useState(false);
  const accountsLocations = useLocations(accountsBox) ?? [];
  const loadAccounts = useCallback(async () => {
    if (!accountsBox) return;
    setAccountsLoading(true);
    setAccountsError(undefined);
    try {
      const loc = await where(berth, accountsBox, current?.box === accountsBox ? current.location : undefined);
      const [a, c] = await Promise.all([runScript<Accounts>(berth, accountsBox, loc, ["accounts"], "30s"), readChoices(berth, accountsBox)]);
      setAccounts(a);
      setChoices(c);
    } catch (err) {
      setAccountsError(String((err as Error).message ?? err));
    } finally {
      setAccountsLoading(false);
    }
  }, [berth, accountsBox, current?.box, current?.location]);
  useEffect(() => {
    if (tab !== "accounts") return;
    setAccounts(undefined);
    setChoices(undefined);
    void loadAccounts();
  }, [tab, accountsBox]); // eslint-disable-line react-hooks/exhaustive-deps

  const covered = usageBox === ALL ? allBoxes : [usageBox];
  const states: BoxState[] = covered.map((b) => ({ box: b, online: online.includes(b), loading: Boolean(data[b]?.loading), error: data[b]?.error }));
  const sources: Source[] = targets.flatMap((b) => (data[b]?.report ? [{ box: b, report: data[b].report!, locations: data[b].locations }] : []));
  const loading = tab === "usage" ? states.some((s) => s.loading) : accountsLoading;
  const single = usageBox !== ALL ? data[usageBox] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-lg tracking-tight">Usage & accounts</h1>
          <p className="mt-0.5 text-muted-foreground text-sm">Tokens Claude Code and Codex used on your boxes, from the transcripts they keep there, and which account new sessions sign in with.</p>
        </div>
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="sm" disabled={!paired.length} />}>
            <Icon name={tab === "usage" && usageBox === ALL ? "Layers" : "Server"} />
            {tab === "usage" ? (usageBox === ALL ? "All boxes" : usageBox) : accountsBox || "No box online"}
            <Icon name="ChevronDown" className="opacity-60" />
          </MenuTrigger>
          <MenuPopup align="end">
            {tab === "usage" && (
              <>
                <MenuItem onClick={() => setPicked(ALL)}>
                  <Icon name="Layers" />
                  All boxes
                </MenuItem>
                <MenuSeparator />
              </>
            )}
            {paired.map((b) => (
              <MenuItem key={b.name} disabled={b.state !== "online"} onClick={() => (tab === "usage" ? setPicked(b.name) : setPickedAccounts(b.name))}>
                <Icon name="Server" />
                {b.name}
                {b.state !== "online" && <span className="ml-auto pl-3 text-muted-foreground text-xs">offline</span>}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
        <Button variant="outline" size="icon-sm" aria-label="Refresh" disabled={!online.length} loading={loading} onClick={() => void (tab === "usage" ? loadUsage() : loadAccounts())}>
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

      {tab === "usage" && usageBox === ALL && states.length > 0 && <BoxStatus states={states} files={Object.fromEntries(targets.map((b) => [b, data[b]?.report?.files]))} allBoxes={allBoxes} />}

      {((tab === "usage" && single?.error) || (tab === "accounts" && accountsError)) && (
        <Alert variant="error">
          <Icon name="CircleAlert" />
          <AlertDescription>
            Couldn't read {tab === "usage" ? `usage on ${usageBox}: ${single?.error}` : `accounts on ${accountsBox}: ${accountsError}`}
          </AlertDescription>
        </Alert>
      )}

      {!online.length ? (
        <p className="py-16 text-center text-muted-foreground text-sm">Connect a box to see its agents' usage.</p>
      ) : tab === "usage" ? (
        usageBox !== ALL && !online.includes(usageBox) ? (
          <p className="py-16 text-center text-muted-foreground text-sm">{usageBox} is offline; its usage shows once it's back.</p>
        ) : (
          <UsageView
            berth={berth}
            period={period}
            sources={sources}
            states={states.filter((s) => s.online)}
            accounts={Object.fromEntries(targets.map((b) => [b, data[b]?.accounts]))}
            running={Object.fromEntries(targets.map((b) => [b, data[b]?.sessions]))}
            allBoxes={allBoxes}
            multi={usageBox === ALL}
          />
        )
      ) : (
        <AccountsView berth={berth} box={accountsBox} data={accounts} choices={choices} locations={accountsLocations} reload={loadAccounts} />
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
