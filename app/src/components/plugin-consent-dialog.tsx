import * as stylex from "@stylexjs/stylex";
import { PuzzleIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { laptopApi } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { answerConsent, PLUGIN_POWERS, type PluginFiles, readPluginFiles, usePluginConsent } from "@/plugins/consent";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "width": "16px",
    "height": "16px",
  },
  s1: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s4: {
    "marginTop": "6px",
    "display": "flex",
    "listStyleType": "disc",
    "flexDirection": "column",
    "gap": "4px",
    "paddingLeft": "36px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "display": "grid",
    "gridTemplateColumns": "auto 1fr",
    "columnGap": "16px",
    "rowGap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "fontFamily": "var(--font-mono)",
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s12: {
    "color": "var(--muted-foreground)",
  },
  s13: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s14: {
    "marginBottom": "6px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "wordBreak": "break-all",
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  s18: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// PluginConsentDialog asks before a plugin from ~/.berth/plugins first runs,
// and again whenever its code changes. Plugins are not sandboxed, so it says
// plainly what one can do, and allows exactly the files it showed.
export function PluginConsentDialog() {
  const request = usePluginConsent((s) => s.request);
  const plugin = request?.plugin;
  const [files, setFiles] = useState<PluginFiles>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFiles(undefined);
    setError(undefined);
    const client = useStore.getState().client;
    if (!plugin || !client) return;
    let live = true;
    readPluginFiles(client, plugin)
      .then((f) => live && setFiles(f))
      .catch((err) => live && setError(plainError(err)));
    return () => {
      live = false;
    };
  }, [plugin]);

  const allow = async () => {
    const client = useStore.getState().client;
    if (!client || !plugin || !files) return;
    setSaving(true);
    try {
      await laptopApi.allowPlugin(client, plugin.id, files.hash);
      answerConsent(true);
    } catch (err) {
      setError(plainError(err));
    } finally {
      setSaving(false);
    }
  };

  const again = !!plugin?.allowed || !!plugin?.changed;
  const name = plugin?.name ?? plugin?.id ?? "";

  return (
    <Dialog open={!!plugin} onOpenChange={(open) => !open && answerConsent(false)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle row>
            <PuzzleIcon className={sx(paint.s0)} />
            {again ? `${name} has changed` : `Allow ${name}?`}
          </DialogTitle>
          <DialogDescription>
            {again ? `Its code is different from the version you allowed, so it's off until you review it again.` : `This plugin isn't part of Burf.`} Plugins aren't sandboxed: once on, it runs inside Burf with the
            app's own access.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel inset="body" stack={4}>
          <div className={sx(paint.s1)}>
            <div className={sx(paint.s2)}>
              <TriangleAlertIcon className={sx(paint.s3)} />
              It will be able to
            </div>
            <ul className={sx(paint.s4)}>
              {PLUGIN_POWERS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <dl className={sx(paint.s5)}>
            <dt className={sx(paint.s6)}>Plugin</dt>
            <dd className={sx(paint.s7)}>
              {plugin?.id}
              {plugin?.version ? ` ${plugin.version}` : ""}
            </dd>
            <dt className={sx(paint.s8)}>Folder</dt>
            <dd className={sx(paint.s9)}>~/.berth/plugins/{plugin?.id}</dd>
            <dt className={sx(paint.s10)}>Code</dt>
            <dd className={sx(paint.s11)}>{files ? (files.mainPath ? `${files.mainPath} · ${(files.main.length / 1024).toFixed(1)} KB` : "none (hooks or themes only)") : "Reading…"}</dd>
            <dt className={sx(paint.s12)}>Hash</dt>
            <dd className={sx(paint.s13)}>{files ? files.hash.slice(0, 7 + 16) : "…"}</dd>
          </dl>
          {files && files.hooks.length > 0 && (
            <div>
              <h4 className={sx(paint.s14)}>Hooks it runs on this computer</h4>
              <ul className={sx(paint.s15)}>
                {files.hooks.map((h, i) => (
                  <li key={`${i}-${h.on}`} className={sx(paint.s16)}>
                    <span className={sx(paint.s17)}>{h.on}</span> {h.run}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={sx(paint.s18)}>Allow only plugins you trust. Burf asks again whenever the plugin's code changes, and you can turn it off in Settings → Plugins.</p>
          {error && <ErrorText className={sx(paint.s19)} text={error} />}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => answerConsent(false)}>
            Not now
          </Button>
          <Button onClick={() => void allow()} loading={saving} disabled={!files}>
            Allow and turn on
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
