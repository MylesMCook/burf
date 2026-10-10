import * as stylex from "@stylexjs/stylex";
import { CheckCircle2Icon, CodeXmlIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { type Editor, editorsApi, installedEditors, pickEditor, setPreferredEditor, type SSHPlan, usePreferredEditor } from "@/lib/editors";
import { errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { isMac } from "@/lib/platform";
import { useStore } from "@/lib/store";
import { Code, SettingsGroup, SettingsRow } from "@/views/settings/rows";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
  },
  s3: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s5: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s6: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s7: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s8: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s9: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--success-foreground)",
  },
  s10: {
    "width": "14px",
    "height": "14px",
  },
  s11: {
    "marginTop": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s12: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s13: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s14: {
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "textTransform": "uppercase",
    "letterSpacing": "0.025em",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s16: {
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s18: {
    "overflowX": "auto",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "lineHeight": "1.625",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s19: {
    "color": "var(--success-foreground)",
  },
  s20: {
    "color": "var(--destructive-foreground)",
  },
  s21: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// EditorsSettings is Settings → Boxes' editor part: which editor opens
// worktrees, and the SSH hosts editors use to reach boxes. Burf shows the
// exact lines it would write, and writes them only when asked.
export function EditorsSettings() {
  const client = useStore((s) => s.client);
  const preferred = usePreferredEditor();
  const [editors, setEditors] = useState<Editor[]>();
  const [plan, setPlan] = useState<SSHPlan>();
  const [error, setError] = useState<string>();
  const [writing, setWriting] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setError(undefined);
    try {
      const [eds, p] = await Promise.all([installedEditors(client, true), editorsApi.sshPlan(client)]);
      setEditors(eds);
      setPlan(p);
    } catch (err) {
      setError(plainError(err));
    }
  }, [client]);
  useEffect(() => void load(), [load]);

  const installed = editors?.filter((e) => e.installed) ?? [];
  const chosen = editors ? pickEditor(editors, preferred) : undefined;
  const remote = plan?.hosts.filter((h) => !h.local) ?? [];
  const ready = plan && plan.changes.length === 0;

  async function write() {
    if (!client) return;
    setWriting(true);
    try {
      setPlan(await editorsApi.sshWrite(client));
      toastManager.add({ title: "SSH configuration saved", description: "Editor host entries are ready. SSH authentication is checked when you connect.", type: "success" });
    } catch (err) {
      toastManager.add({ title: "Could not write the SSH config", description: errorMessage(err), type: "error" });
    } finally {
      setWriting(false);
    }
  }

  return (
    <SettingsGroup
      title="Editors"
      description={
        <>
          Optional: open remote projects in an external editor. Chats and agents in Burf do not need SSH editor setup. <Kbd>⌘⇧O</Kbd> opens the current worktree; {isMac() ? "⌘" : "Ctrl"}-click a path in a terminal.
        </>
      }
      actions={
        <Button size="icon-xs" variant="ghost" aria-label="Check again" onClick={() => void load()}>
          <RefreshCwIcon />
        </Button>
      }
    >
      {error && <ErrorText className={sx(paint.s0)} text={error} />}
      {!editors && !error && (
        <div className={sx(paint.s1)}>
          <Spinner  size="md"/> Looking for editors…
        </div>
      )}
      {editors && (
        <SettingsRow label="Open in" description={installed.length ? "Picking another in any Open in menu changes this too." : "Install Cursor, VS Code, Windsurf or Zed to open worktrees from Burf."}>
          {installed.length > 0 && (
            <PickOne
              label="Preferred editor"
              value={chosen?.id ?? ""}
              onChange={setPreferredEditor}
              options={installed.map((e) => ({ value: e.id, label: e.name, icon: <CodeXmlIcon className={sx(paint.s2)} /> }))}
            />
          )}
        </SettingsRow>
      )}
      {chosen && !chosen.lines && (
        <p className={sx(paint.s3)}>
          {chosen.cli ? `${chosen.name} opens files without their line over SSH links.` : `${chosen.name}'s command line tool isn't installed, so files open as their folder. Install it from ${chosen.name}'s command palette.`}
        </p>
      )}
      {plan && remote.length > 0 && (
        <div className={sx(paint.s4)}>
          <div className={sx(paint.s5)}>
            <div className={sx(paint.s6)}>
              <div className={sx(paint.s7)}>SSH hosts for editors</div>
              <div className={sx(paint.s8)}>
                {ready ? (
                  <span className={sx(paint.s9)}>
                    <CheckCircle2Icon className={sx(paint.s10)} /> Configuration saved for {remote.map((h) => h.host).join(", ")}. SSH authentication is checked when you connect.
                  </span>
                ) : (
                  <>
                    Review the SSH entries below for your external editor. Existing <Code>berth-&lt;box&gt;</Code> names are kept for compatibility. This writes the listed files and an Include line in <Code>~/.ssh/config</Code>, with a backup before changing it. It does not install an editor, grant SSH access or change the remote machine.
                  </>
                )}
              </div>
            </div>
            {!ready && (
              <Button size="sm" onClick={() => void write()} disabled={writing}>
                {writing && <Spinner  size="md"/>} Write SSH configuration
              </Button>
            )}
          </div>
          {!ready && (
            <div className={sx(paint.s11)}>
              {plan.changes.map((c) => (
                <div key={c.path} className={sx(paint.s12)}>
                  <div className={sx(paint.s13)}>
                    <span className={[sx(paint.s14), c.action === "remove" ? sx(paint.s15) : sx(paint.s16)].filter(Boolean).join(" ")}>{c.action}</span>
                    <span className={sx(paint.s17)}>{c.path}</span>
                  </div>
                  <pre tabIndex={0} className={sx(paint.s18)}>
                    {c.diff.trimEnd().split("\n").map((l, i) => (
                      <div key={i} className={[l.startsWith("+ ") && sx(paint.s19), l.startsWith("- ") && sx(paint.s20), l.startsWith("  ") && sx(paint.s21)].filter(Boolean).join(" ")}>
                        {l || " "}
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SettingsGroup>
  );
}
