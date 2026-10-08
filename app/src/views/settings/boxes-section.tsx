import { ArrowUpCircleIcon, BotIcon, CopyIcon, EllipsisIcon, PlusIcon, RefreshCwIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { StatusDot, useBoxState } from "@/components/agent-glyph";
import { BrowserSandboxCard } from "@/components/browser-sandbox";
import { EditorsSettings } from "@/components/editors/editors-settings";
import { ErrorDetails } from "@/components/error-note";
import { GuardDialog } from "@/components/guard-dialog";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { OutdatedNotice, UpgradeBox } from "@/components/upgrade-box";
import { type AgentPath, type BoxStatus, laptopApi } from "@/lib/api";
import { explain } from "@/lib/errors";
import { errorMessage } from "@/lib/format";
import { refreshOutdated, updateBoxes, useOutdated } from "@/lib/outdated";
import { usePrefs } from "@/lib/prefs";
import { BOX_WORDS, boxWhy } from "@/lib/state-model";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { AddAgents } from "@/views/onboarding/guided-install";
import { BoxOnePasswordNote } from "@/views/team/team-keys-note";
import { CommandLog } from "@/views/settings/command-log";
import { ConfirmDialog } from "@/views/settings/confirm";
import { RemoveLocalBoxDialog } from "@/views/settings/local-box-remove";
import { Code, SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";

export function BoxesSection() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const auto = usePrefs((p) => p.autoUpdateBoxes);
  return (
    <SettingsPage
      title="Boxes"
      description={
        <>
          Paired machines running a box agent. Local agents and chats are under This computer. <Code>burf boxes</Code> lists these connections.
        </>
      }
    >
      <OutdatedNotice className="-mt-2" />
      <SettingsGroup
        title={boxes.length === 1 ? "1 paired" : `${boxes.length} paired`}
        actions={
          <Button size="xs" variant="outline" onClick={openAddBox}>
            <PlusIcon /> Add a box
          </Button>
        }
      >
        {boxes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-muted-foreground text-sm">No boxes yet. Agents run on a box: any VPS or dev machine you can SSH into.</p>
            <Button size="sm" onClick={openAddBox}>
              Add your first box
            </Button>
          </div>
        ) : (
          boxes.map((b) => <BoxRow key={b.name} box={b} />)
        )}
      </SettingsGroup>
      {boxes.length > 0 && (
        <SettingsGroup>
          <SettingsRow label="Install bundled agents automatically" description="When a connected box has a different build, replace its box agent with the one bundled with this Burf. This is not a check for the latest upstream release.">
            <Switch checked={auto} onCheckedChange={(autoUpdateBoxes) => usePrefs.setState({ autoUpdateBoxes })} aria-label="Install bundled agents automatically" />
          </SettingsRow>
        </SettingsGroup>
      )}
      {boxes.length > 0 && <EditorsSettings />}
    </SettingsPage>
  );
}

// retry asks the agent to check every box now rather than at its next poll.
async function retry() {
  const st = useStore.getState();
  if (!st.client) return;
  try {
    await st.client.laptop("POST", "/v1/refresh");
  } catch {
    // The status refresh below reports what the agent knows either way.
  }
  await st.refreshAll();
}

function BoxRow({ box }: { box: BoxStatus }) {
  const info = useStore((s) => s.boxes[box.name]?.info);
  const update = useOutdated((s) => s.updating[box.name]);
  const check = useOutdated((s) => s.boxes[box.name]);
  const unsupported = useOutdated((s) => s.unsupported);
  const [checking, setChecking] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [removingLocal, setRemovingLocal] = useState(false);
  const [guarding, setGuarding] = useState(false);
  const [addingAgents, setAddingAgents] = useState(false);
  const canAddAgents = !!info?.capabilities?.includes("agents.install");
  const [retrying, setRetrying] = useState(false);
  const online = box.state === "online";
  const state = useBoxState(box.name);
  const upgrading = update?.state === "queued" || update?.state === "running";
  // What went wrong reaching it, in plain words, with the raw text behind Details.
  const problem = box.error && !online ? explain(box.error, { box: box.name }) : undefined;

  const build = info?.build && `agent ${info.build}`;
  const details = [box.address, box.network && `via ${box.network}`, build, info?.os && info.arch && `${info.os}/${info.arch}`].filter(Boolean);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Tip label={boxWhy(box.name, box, state)}>
          <StatusDot state={state} className="size-2" />
        </Tip>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span>{box.name}</span>
            {box.local && <span className="rounded border px-1 text-[10px] text-muted-foreground uppercase tracking-wide">This Mac</span>}
            <span className={cn("text-xs", state === "online" ? "text-muted-foreground" : state === "outdated" ? "text-info-foreground" : state === "unreachable" ? "text-destructive-foreground" : "text-muted-foreground")}>
              {state === "online" && box.latency_ms != null ? `${box.latency_ms} ms` : BOX_WORDS[state].word}
            </span>
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{details.join(" · ")}</div>
          {problem && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {problem.message}
              <ErrorDetails text={problem.details} className="text-[11px]" />
            </div>
          )}
        </div>
        {state === "outdated" && !check?.error && <UpgradeBox box={box.name} size="xs" variant="outline" label="Install bundled" />}
        {!online && (
          <Button
            size="xs"
            variant="outline"
            loading={retrying}
            onClick={async () => {
              setRetrying(true);
              await retry();
              setRetrying(false);
            }}
          >
            <RefreshCwIcon /> Retry
          </Button>
        )}
        <Menu>
          <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label={`${box.name} actions`} />}>
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end" className="min-w-48">
            <MenuItem disabled={!online || upgrading || !!check?.error || !!unsupported} onClick={() => void updateBoxes([box.name])}>
              <ArrowUpCircleIcon />
              {online ? "Install bundled box agent" : "Install bundled box agent (offline)"}
            </MenuItem>
            <MenuItem
              onClick={() =>
                navigator.clipboard.writeText(box.address).then(
                  () => toastManager.add({ title: "Copied the address", type: "success" }),
                  () => {},
                )
              }
            >
              <CopyIcon />
              Copy address
            </MenuItem>
            {canAddAgents && (
              <MenuItem disabled={!online} onClick={() => setAddingAgents(true)} data-testid="box-add-agents">
                <BotIcon />
                Add agents…
              </MenuItem>
            )}
            <MenuItem disabled={!online} onClick={() => setGuarding(true)}>
              <ShieldIcon />
              Resource guard…
            </MenuItem>
            <MenuSeparator />
            {box.local && (
              <MenuItem variant="destructive" onClick={() => setRemovingLocal(true)}>
                <Trash2Icon />
                Stop using this Mac…
              </MenuItem>
            )}
            <MenuItem variant="destructive" onClick={() => setForgetting(true)}>
              <Trash2Icon />
              Forget…
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      {online && (check?.error || unsupported) && (
        <div className="mt-2 flex flex-wrap items-start gap-2 text-xs text-muted-foreground">
          <div className="min-w-0 flex-1">
            <p>Build comparison unavailable</p>
            <p>The connection is online, but Burf could not compare its agent with a bundled build.</p>
            <ErrorDetails text={check?.error ?? "This client backend does not support build comparisons."} />
          </div>
          <Button size="xs" variant="ghost" loading={checking} onClick={async () => {
            setChecking(true);
            try { await refreshOutdated(true); } finally { setChecking(false); }
          }}><RefreshCwIcon /> Retry build check</Button>
        </div>
      )}
      {online && check?.outdated && check.available && !check.error && <p className="mt-1 text-xs text-muted-foreground">Bundled agent: <span className="font-mono">{check.available}</span>. Installing replaces this box's agent with Burf's bundled build.</p>}
      {/* The agent's browser can't start here (Chromium's sandbox), or runs without it. */}
      {online && <BrowserSandboxCard box={box.name} full className="mt-3" />}
      {online && <BoxAgents box={box.name} />}
      {online && <BoxOnePasswordNote box={box.name} />}
      {update && update.state !== "queued" && <CommandLog className="mt-3" lines={update.lines ?? []} done={update.state === "done"} error={update.error} />}
      {update?.state === "queued" && <p className="mt-2 text-muted-foreground text-xs">Waiting for the box before it to finish updating…</p>}
      <GuardDialog box={box.name} open={guarding} onOpenChange={setGuarding} />
      {canAddAgents && <AddAgents box={box.name} open={addingAgents} onClose={() => setAddingAgents(false)} />}
      {box.local && <RemoveLocalBoxDialog box={box.name} open={removingLocal} onOpenChange={setRemovingLocal} />}
      <ConfirmDialog
        open={forgetting}
        onOpenChange={setForgetting}
        destructive
        title={`Forget ${box.name}?`}
        description={
          <>
            This computer stops connecting to {box.name}. Nothing on the box changes: its agents, worktrees and box agent keep running, and you can pair again with <Code>berthd pair</Code>.
          </>
        }
        confirm="Forget"
        onConfirm={async () => {
          const client = useStore.getState().client;
          if (!client) return;
          try {
            await laptopApi.forget(client, box.name);
            await useStore.getState().refreshStatus();
            toastManager.add({ title: `Forgot ${box.name}`, type: "success" });
          } catch (err) {
            toastManager.add({ title: `Couldn't forget ${box.name}`, description: errorMessage(err), type: "error" });
          }
        }}
      />
    </div>
  );
}

// The agent CLIs a box found, each with its version and where it is, as the
// person's own terminal there finds it (an npm install under nvm too), and
// Look again for one installed since.
function BoxAgents({ box }: { box: string }) {
  const info = useStore((s) => s.boxes[box]?.info);
  const [looking, setLooking] = useState(false);
  if (!info?.capabilities?.includes("agents.paths")) return null;
  const paths = info.agent_paths ?? [];
  const lookAgain = async () => {
    const st = useStore.getState();
    if (!st.client) return;
    setLooking(true);
    try {
      await st.client.box(box, "POST", "agents/refresh");
      await st.refreshBox(box, ["info"]);
    } catch (err) {
      toastManager.add({ title: `Couldn't look for agents on ${box}`, description: errorMessage(err), type: "error" });
    } finally {
      setLooking(false);
    }
  };
  return (
    <div className="mt-2 flex items-start gap-3" data-testid="box-agents">
      <div className="min-w-0 flex-1 space-y-0.5 text-[11px]">
        {paths.length ? (
          paths.map((a) => (
            <div key={a.id} className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0">{agentVersion(a)}</span>
              <span className="text-muted-foreground">·</span>
              <Tip label={a.path}>
                <span className="truncate font-mono text-muted-foreground">{shortPath(a.path, info.home)}</span>
              </Tip>
              {a.install && <span className="shrink-0 text-muted-foreground">({a.install})</span>}
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">No agent CLIs found on {box}.</div>
        )}
      </div>
      <Button size="xs" variant="ghost" loading={looking} onClick={() => void lookAgain()} data-testid="box-agents-refresh">
        <RefreshCwIcon /> Look again
      </Button>
    </div>
  );
}

// agentVersion is "Claude Code 2.1.3": the agent's name and the version
// number its --version printed.
export function agentVersion(a: AgentPath): string {
  const v = a.version?.match(/\d+\.\d+[\w.+-]*/)?.[0];
  return v ? `${a.name} ${v}` : a.name;
}

// shortPath is a path with home as ~ and the middle of a long one as …:
// ~/.nvm/…/bin/claude.
export function shortPath(path: string, home?: string): string {
  let p = path;
  if (home && (p === home || p.startsWith(`${home}/`))) p = `~${p.slice(home.length)}`;
  const parts = p.split("/");
  // ~, .nvm, versions, node, v22, bin, claude: keep the first two and the last two.
  return parts.length > 5 ? [...parts.slice(0, 2), "…", ...parts.slice(-2)].join("/") : p;
}
