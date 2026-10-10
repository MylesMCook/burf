import * as stylex from "@stylexjs/stylex";
import { BoxProcessesCard } from "@/components/box-processes";
import { ArrowUpCircleIcon, BotIcon, CopyIcon, EllipsisIcon, PlusIcon, RefreshCwIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { StatusDot, useBoxState } from "@/components/agent-glyph";
import { BrowserSandboxCard } from "@/components/browser-sandbox";
import { EditorsSettings } from "@/components/editors/editors-settings";
import { ErrorDetails } from "@/components/error-note";
import { GuardDialog } from "@/components/guard-dialog";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { OutdatedNotice, UpgradeBox } from "@/components/upgrade-box";
import { type AgentPath, type BoxStatus, laptopApi } from "@/lib/api";
import { explain } from "@/lib/errors";
import { errorMessage } from "@/lib/format";
import { latencyText, RELAYED_DOCS, relayNote, slowNote } from "@/lib/link";
import { openDocs } from "@/lib/open-url";
import { refreshOutdated, updateBoxes, useOutdated } from "@/lib/outdated";
import { usePrefs } from "@/lib/prefs";
import { BOX_WORDS, boxWhy } from "@/lib/state-model";
import { NONE, useStore } from "@/lib/store";
import { openAddBox } from "@/views/onboarding/add-box-dialog";
import { AddAgents } from "@/views/onboarding/guided-install";
import { BoxRouteList, BoxRoutes } from "@/views/settings/box-routes";
import { activeRoute, viaRoute } from "@/lib/box-routes";
import { CommandLog } from "@/views/settings/command-log";
import { ConfirmDialog } from "@/views/settings/confirm";
import { RemoveLocalBoxDialog } from "@/views/settings/local-box-remove";
import { Code, SettingsGroup, SettingsPage, SettingsRow } from "@/views/settings/rows";
import { thisComputer } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "marginTop": "calc(8px * -1)",
  },
  s1: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
  },
  s2: {
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s5: {
    "width": "8px",
    "height": "8px",
  },
  s6: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s7: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s8: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
    "textTransform": "uppercase",
    "letterSpacing": "0.025em",
  },
  s9: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  info: {
    "color": "var(--info-foreground)",
  },
  bad: {
    "color": "var(--destructive-foreground)",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "marginTop": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s13: {
    "fontSize": "11px",
  },
  s14: {
    "marginTop": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "flex-start",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s16: {
    "marginTop": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "fontFamily": "var(--font-mono)",
  },
  s18: {
    "marginTop": "12px",
  },
  s19: {
    "marginTop": "12px",
  },
  s20: {
    "marginTop": "12px",
  },
  s21: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "marginTop": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  s23: {
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "textDecoration": "underline",
    "textUnderlineOffset": "2px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s25: {
    "marginTop": "8px",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s26: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontSize": "11px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  s27: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "baseline",
    "gap": "6px",
  },
  s28: {
    "flexShrink": 0,
  },
  s29: {
    "color": "var(--muted-foreground)",
  },
  s30: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
  },
  s31: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s32: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

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
      <OutdatedNotice className={sx(paint.s0)} />
      <SettingsGroup
        title={boxes.length === 1 ? "1 paired" : `${boxes.length} paired`}
        actions={
          <Button size="xs" variant="outline" onClick={openAddBox}>
            <PlusIcon /> Add a box
          </Button>
        }
      >
        {boxes.length === 0 ? (
          <div className={sx(paint.s1)}>
            <p className={sx(paint.s2)}>No boxes yet. Agents run on a box: any VPS or dev machine you can SSH into.</p>
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
  const [routesOpen, setRoutesOpen] = useState(false);
  const online = box.state === "online";
  const state = useBoxState(box.name);
  const upgrading = update?.state === "queued" || update?.state === "running";
  // What went wrong reaching it, in plain words, with the raw text behind Details.
  const problem = box.error && !online ? explain(box.error, { box: box.name }) : undefined;

  const build = info?.build && `agent ${info.build}`;
  const details = [box.address, box.network && `via ${box.network}`, build, info?.os && info.arch && `${info.os}/${info.arch}`].filter(Boolean);

  return (
    <div className={sx(paint.s3)}>
      <div className={sx(paint.s4)}>
        <Tip label={boxWhy(box.name, box, state)}>
          <StatusDot state={state} className={sx(paint.s5)} />
        </Tip>
        <div className={sx(paint.s6)}>
          <div className={sx(paint.s7)}>
            <span>{box.name}</span>
            {box.local && <span className={sx(paint.s8)}>This Mac</span>}
            <span className={[sx(paint.s9), state === "outdated" ? sx(paint.info) : state === "unreachable" ? sx(paint.bad) : sx(paint.s10)].filter(Boolean).join(" ")}>
              {state === "online" && box.latency_ms != null ? latencyText(box.latency_ms, box.link) : BOX_WORDS[state].word}
            </span>
          </div>
          <div className={sx(paint.s11)}>{details.join(" · ")}</div>
          <BoxRoutes box={box} open={routesOpen} onOpenChange={setRoutesOpen} />
          {online && <LinkNotes box={box} />}
          {problem && (
            <div className={sx(paint.s12)}>
              {problem.message}
              <ErrorDetails text={problem.details} className={sx(paint.s13)} />
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
          <MenuPopup align="end" width={menuWidths.w48}>
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
                {thisComputer("Stop using this Mac…")}
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
        <div className={sx(paint.s14)}>
          <div className={sx(paint.s15)}>
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
      {online && check?.outdated && check.available && !check.error && <p className={sx(paint.s16)}>Bundled agent: <span className={sx(paint.s17)}>{check.available}</span>. Installing replaces this box's agent with Burf's bundled build.</p>}
      {routesOpen && !box.local && <BoxRouteList box={box} />}
      {/* The agent's browser can't start here (Chromium's sandbox), or runs without it. */}
      {online && <BrowserSandboxCard box={box.name} full className={sx(paint.s18)} />}
      {online && <BoxProcessesCard box={box.name} className={sx(paint.s19)} />}
      {online && <BoxAgents box={box.name} />}
      {update && update.state !== "queued" && <CommandLog lines={update.lines ?? []} done={update.state === "done"} error={update.error} />}
      {update?.state === "queued" && <p className={sx(paint.s21)}>Waiting for the box before it to finish updating…</p>}
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

// LinkNotes say, quietly, why a box's link is slow and whether Tailscale
// relays it: still connected, so no banner, only what to do about it.
function LinkNotes({ box }: { box: BoxStatus }) {
  const slow = slowNote(box.link);
  const relay = relayNote(box.link?.path);
  if (!slow && !relay) return null;
  const latency = box.link?.slow ? latencyText(box.latency_ms, box.link) : undefined;
  return (
    <div className={sx(paint.s22)} data-testid="box-link">
      {slow && (
        <div>
          {slow}
          {latency && <span className={sx(paint.s23)}> Latency {latency}.</span>}
        </div>
      )}
      {relay && (
        <div data-testid="box-relayed">
          {relay}
          {box.route && box.route !== "paired" && activeRoute(box) ? `; Burf goes ${viaRoute(box)} instead` : ""}.{" "}
          <button type="button" onClick={() => void openDocs(RELAYED_DOCS)} className={sx(paint.s24)}>
            Learn more
          </button>
        </div>
      )}
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
    <div className={sx(paint.s25)} data-testid="box-agents">
      <div className={sx(paint.s26)}>
        {paths.length ? (
          paths.map((a) => (
            <div key={a.id} className={sx(paint.s27)}>
              <span className={sx(paint.s28)}>{agentVersion(a)}</span>
              <span className={sx(paint.s29)}>·</span>
              <Tip label={a.path}>
                <span className={sx(paint.s30)}>{shortPath(a.path, info.home)}</span>
              </Tip>
              {a.install && <span className={sx(paint.s31)}>({a.install})</span>}
            </div>
          ))
        ) : (
          <div className={sx(paint.s32)}>No agent CLIs found on {box}.</div>
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
