import * as stylex from "@stylexjs/stylex";
import { RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { laptopApi, type PluginInfo } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { openDocs } from "@/lib/open-url";
import { builtinOn, setBuiltinOn, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { askToAllow } from "@/plugins/consent";
import { builtinPlugins, loadPlugins } from "@/plugins/host";
import { useRegistry } from "@/plugins/registry";
import { Code, SettingsGroup, SettingsPage } from "@/views/settings/rows";
import { Tip } from "@/components/tip";

const paint = stylex.create({
  s0: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "gap": "6px",
  },
  s3: {
    "marginRight": "2px",
  },
  s4: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "textDecoration": "underline",
    "textUnderlineOffset": "2px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s7: {
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "marginTop": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
  },
  s13: {
    "marginTop": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "color": "var(--warning-foreground)",
  },
  s15: {
    "textDecoration": "underline",
    "textUnderlineOffset": "2px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s16: {
    "marginTop": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "color": "var(--destructive-foreground)",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s20: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s21: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s22: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "marginTop": "4px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
  },
  s28: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s29: {
    "backgroundColor": "var(--destructive)",
  },
  s30: {
    "backgroundColor": "var(--warning)",
  },
  s31: {
    "marginTop": "6px",
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "4px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export function PluginsSection() {
  const client = useStore((s) => s.client);
  const loaded = useRegistry((s) => s.plugins);
  const [installed, setInstalled] = useState<PluginInfo[]>();
  const [builtins, setBuiltins] = useState<PluginInfo[]>();
  const [reloading, setReloading] = useState(false);
  useEffect(() => void builtinPlugins().then(setBuiltins), []);

  const refresh = useCallback(async () => {
    if (client) setInstalled(await client.plugins().catch(() => []));
  }, [client]);
  useEffect(() => void refresh(), [refresh]);

  const reload = async () => {
    if (!client) return;
    setReloading(true);
    await loadPlugins(client);
    await refresh();
    setReloading(false);
  };

  return (
    <SettingsPage
      title="Plugins"
      description={
        <>
          Plugins live in <Code>~/.berth/plugins/&lt;id&gt;/</Code> beside a <Code>berth-plugin.json</Code>. They aren't sandboxed: a plugin runs with the app's access to every box, and its hooks run on this computer. Each stays off until you allow it, and Burf asks again whenever its code changes.
        </>
      }
    >
      <SettingsGroup title="Built in" description="Ship with Burf and use the same plugin API as yours. A plugin of yours with the same id replaces one.">
        {builtins === undefined ? (
          <div className={sx(paint.s0)}>Loading…</div>
        ) : builtins.length === 0 ? (
          <div className={sx(paint.s1)}>This build has no built-in plugins.</div>
        ) : (
          builtins.map((p) => (
            <BuiltinRow key={p.id} plugin={p} status={loaded.find((l) => l.id === p.id && l.builtin)} replaced={installed?.some((u) => u.id === p.id) ?? false} onChanged={() => void reload()} />
          ))
        )}
      </SettingsGroup>
      <SettingsGroup
        title="Installed"
        actions={
          <span className={sx(paint.s2)}><Button size="xs" variant="outline"  loading={reloading} onClick={() => void reload()}>
            <RefreshCwIcon className={sx(paint.s3)} /> Reload
          </Button></span>
        }
      >
        {installed === undefined ? (
          <div className={sx(paint.s4)}>Loading…</div>
        ) : installed.length === 0 ? (
          <div className={sx(paint.s5)}>
            No plugins yet.{" "}
            <button type="button" onClick={() => void openDocs("/guides/plugins")} className={sx(paint.s6)}>
              Write one
            </button>
            .
          </div>
        ) : (
          installed.map((p) => <PluginRow key={p.id} plugin={p} status={loaded.find((l) => l.id === p.id)} onChanged={() => void reload()} />)
        )}
      </SettingsGroup>
    </SettingsPage>
  );
}

function PluginRow({ plugin: p, status, onChanged }: { plugin: PluginInfo; status?: { state: string; error?: string }; onChanged(): void }) {
  // Never on until you allow it, and off again when it changes.
  const enabled = p.enabled === true;
  const review = !enabled && (p.changed || status?.state === "review");
  // The agent counts a plugin's hooks; older builds listed them.
  const hooks = Array.isArray(p.hooks) ? p.hooks.length : typeof p.hooks === "number" ? (p.hooks as number) : 0;
  const error = p.error ?? status?.error;
  const state = review ? "review" : !enabled ? "off" : error ? "failed" : (status?.state ?? "loading");

  return (
    <div className={sx(paint.s7)}>
      <StatusDot state={state} />
      <div className={sx(paint.s8)}>
        <div className={sx(paint.s9)}>
          <span>{p.name}</span>
          <span className={sx(paint.s10)}>{p.version}</span>
        </div>
        {p.description && <div className={sx(paint.s11)}>{p.description}</div>}
        <Contributions plugin={p.id} />
        <div className={sx(paint.s12)}>
          {p.id}
          {hooks > 0 && ` · ${hooks} hook${hooks === 1 ? "" : "s"}`}
        </div>
        {review && (
          <div className={sx(paint.s13)}>
            <span className={sx(paint.s14)}>Changed since you allowed it, so it's off.</span>{" "}
            <button type="button" onClick={() => void askToAllow(p).then((ok) => ok && onChanged())} className={sx(paint.s15)}>
              Review it
            </button>
          </div>
        )}
        {error && enabled && status?.state !== "review" && (
          <div className={sx(paint.s16)}>
            <span className={sx(paint.s17)}>{error}</span> <span className={sx(paint.s18)}>Fix it in ~/.berth/plugins/{p.id}, then Reload.</span>
          </div>
        )}
      </div>
      <Switch
        checked={enabled}
        aria-label={enabled ? `Turn off ${p.name}` : `Turn on ${p.name}`}
        onCheckedChange={async (on) => {
          const client = useStore.getState().client;
          if (!client) return;
          try {
            // Turning a plugin on asks first: see plugin-consent-dialog.
            if (on) {
              if (!(await askToAllow(p))) return;
            } else await laptopApi.disablePlugin(client, p.id);
            onChanged();
          } catch (err) {
            toastManager.add({ title: `Couldn't turn ${on ? "on" : "off"} ${p.name}`, description: errorMessage(err), type: "error" });
          }
        }}
      />
    </div>
  );
}

function BuiltinRow({ plugin: p, status, replaced, onChanged }: { plugin: PluginInfo; status?: { state: string; error?: string }; replaced: boolean; onChanged(): void }) {
  const off = usePrefs((s) => !builtinOn(p, s));
  const state = replaced || off ? "off" : status?.error ? "failed" : (status?.state ?? "loading");
  return (
    <div className={sx(paint.s19)}>
      <StatusDot state={state} />
      <div className={sx(paint.s20)}>
        <div className={sx(paint.s21)}>
          <span>{p.name}</span>
          <Badge variant="outline" size="sm">Built-in</Badge>
          <span className={sx(paint.s22)}>{p.version}</span>
        </div>
        {p.description && <div className={sx(paint.s23)}>{p.description}</div>}
        <Contributions plugin={p.id} />
        {p.defaultEnabled === false && off && !replaced && <div className={sx(paint.s24)}>Off until you turn it on.</div>}
        {replaced && <div className={sx(paint.s25)}>Replaced by your plugin with the same id.</div>}
        {status?.error && !off && <div className={sx(paint.s26)}>{status.error}</div>}
      </div>
      <Switch
        checked={!off}
        disabled={replaced}
        aria-label={off ? `Turn on ${p.name}` : `Turn off ${p.name}`}
        onCheckedChange={(on) => {
          setBuiltinOn(p, on);
          onChanged();
        }}
      />
    </div>
  );
}

// StatusDot marks only what needs attention: the switch already says on.
function StatusDot({ state }: { state: string }) {
  if (state === "active" || state === "off") return <span className={sx(paint.s27)} />;
  return (
    <Tip label={state}>
      <span role="img" aria-label={state} className={[sx(paint.s28), state === "failed" ? sx(paint.s29) : sx(paint.s30)].filter(Boolean).join(" ")} />
    </Tip>
  );
}

// Contributions lists what a loaded plugin adds to the app.
function Contributions({ plugin }: { plugin: string }) {
  const r = useRegistry();
  const mine = <T,>(list: { plugin: string; item: T }[]) => list.filter((c) => c.plugin === plugin).map((c) => c.item);
  const parts = [
    ...mine(r.sidebarItems).map((i) => `Sidebar: ${i.title}`),
    ...mine(r.worktreePanels).map((i) => `Panel: ${i.title}`),
    ...mine(r.worktreeSections).map((i) => `Worktree section${i.title ? `: ${i.title}` : ""}`),
    ...mine(r.homeWidgets).map((i) => `Home widget: ${i.title}`),
    ...(mine(r.statusBarItems).length ? ["Status bar"] : []),
    ...(mine(r.commands).length ? [`${mine(r.commands).length} command${mine(r.commands).length === 1 ? "" : "s"}`] : []),
    ...(mine(r.themes).length ? [`${mine(r.themes).length} theme${mine(r.themes).length === 1 ? "" : "s"}`] : []),
  ];
  if (!parts.length) return null;
  return (
    <div className={sx(paint.s31)}>
      {parts.map((p) => (
        <Badge key={p} variant="secondary" size="sm">
          {p}
        </Badge>
      ))}
    </div>
  );
}
