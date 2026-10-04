import { ArrowUpCircleIcon, CopyIcon, EllipsisIcon, PlusIcon, RefreshCwIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { EditorsSettings } from "@/components/editors/editors-settings";
import { GuardDialog } from "@/components/guard-dialog";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import { type BoxStatus, laptopApi } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { CommandLog } from "@/views/settings/command-log";
import { ConfirmDialog } from "@/views/settings/confirm";
import { RemoveLocalBoxDialog } from "@/views/settings/local-box-remove";
import { Code, SettingsGroup, SettingsPage } from "@/views/settings/rows";
import { Tip } from "@/components/tip";

export function BoxesSection() {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  return (
    <SettingsPage
      title="Boxes"
      description={
        <>
          The machines your agents run on. Each runs berthd; this computer only connects to them. <Code>berth boxes</Code> shows the same.
        </>
      }
    >
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
      {boxes.length > 0 && <EditorsSettings />}
    </SettingsPage>
  );
}

const dot: Record<string, string> = { online: "bg-success", connecting: "bg-warning", offline: "bg-muted-foreground/40", untrusted: "bg-destructive" };

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
  const [log, setLog] = useState<{ lines: string[]; done?: boolean; error?: string }>();
  const [forgetting, setForgetting] = useState(false);
  const [removingLocal, setRemovingLocal] = useState(false);
  const [guarding, setGuarding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const online = box.state === "online";
  const upgrading = !!log && !log.done && !log.error;

  const upgrade = async () => {
    const client = useStore.getState().client;
    if (!client) return;
    setLog({ lines: [] });
    try {
      await laptopApi.upgrade(client, box.name, (l) => setLog((p) => ({ lines: [...(p?.lines ?? []), l] })));
      setLog((p) => ({ lines: p?.lines ?? [], done: true }));
      void useStore.getState().refreshBox(box.name, ["info"]);
    } catch (err) {
      setLog((p) => ({ lines: p?.lines ?? [], error: errorMessage(err) }));
    }
  };

  const details = [box.address, box.network && `via ${box.network}`, info?.build && `berthd ${info.build}`, info?.os && info.arch && `${info.os}/${info.arch}`].filter(Boolean);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Tip label={box.state}>
          <span role="img" aria-label={box.state} className={cn("size-2 shrink-0 rounded-full", dot[box.state] ?? "bg-muted-foreground/40")} />
        </Tip>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span>{box.name}</span>
            {box.local && <span className="rounded border px-1 text-[10px] text-muted-foreground uppercase tracking-wide">This Mac</span>}
            <span className={cn("text-xs", online ? "text-muted-foreground" : "text-warning-foreground")}>{online ? (box.latency_ms != null ? `${box.latency_ms} ms` : "online") : box.state}</span>
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{details.join(" · ")}</div>
          {box.error && !online && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{box.error}</div>}
        </div>
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
            <MenuItem disabled={!online || upgrading} onClick={() => void upgrade()}>
              <ArrowUpCircleIcon />
              {online ? "Upgrade berthd" : "Upgrade berthd (offline)"}
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
      {log && <CommandLog className="mt-3" lines={log.lines} done={log.done} error={log.error} />}
      <GuardDialog box={box.name} open={guarding} onOpenChange={setGuarding} />
      {box.local && <RemoveLocalBoxDialog box={box.name} open={removingLocal} onOpenChange={setRemovingLocal} />}
      <ConfirmDialog
        open={forgetting}
        onOpenChange={setForgetting}
        destructive
        title={`Forget ${box.name}?`}
        description={
          <>
            This computer stops connecting to {box.name}. Nothing on the box changes: its agents, worktrees and berthd keep running, and you can pair again with <Code>berthd pair</Code>.
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
