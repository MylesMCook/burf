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
import { cn } from "@/lib/utils";
import { Code, SettingsGroup, SettingsRow } from "@/views/settings/rows";
import { ErrorText } from "@/components/error-note";

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
      {error && <ErrorText className="px-4 py-3 text-destructive-foreground text-sm" text={error} />}
      {!editors && !error && (
        <div className="flex items-center gap-2 px-4 py-3 text-muted-foreground text-sm">
          <Spinner className="size-3.5" /> Looking for editors…
        </div>
      )}
      {editors && (
        <SettingsRow label="Open in" description={installed.length ? "Picking another in any Open in menu changes this too." : "Install Cursor, VS Code, Windsurf or Zed to open worktrees from Burf."}>
          {installed.length > 0 && (
            <PickOne
              label="Preferred editor"
              value={chosen?.id ?? ""}
              onChange={setPreferredEditor}
              options={installed.map((e) => ({ value: e.id, label: e.name, icon: <CodeXmlIcon className="size-3.5" /> }))}
            />
          )}
        </SettingsRow>
      )}
      {chosen && !chosen.lines && (
        <p className="px-4 py-2 text-muted-foreground text-xs">
          {chosen.cli ? `${chosen.name} opens files without their line over SSH links.` : `${chosen.name}'s command line tool isn't installed, so files open as their folder. Install it from ${chosen.name}'s command palette.`}
        </p>
      )}
      {plan && remote.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm">SSH hosts for editors</div>
              <div className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                {ready ? (
                  <span className="inline-flex items-center gap-1 text-success-foreground">
                    <CheckCircle2Icon className="size-3.5" /> Configuration saved for {remote.map((h) => h.host).join(", ")}. SSH authentication is checked when you connect.
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
                {writing && <Spinner className="size-3.5" />} Write SSH configuration
              </Button>
            )}
          </div>
          {!ready && (
            <div className="mt-3 space-y-2">
              {plan.changes.map((c) => (
                <div key={c.path} className="overflow-hidden rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 font-mono text-[11px]">
                    <span className={cn("rounded px-1.5 py-px uppercase tracking-wide", c.action === "remove" ? "bg-destructive/10 text-destructive-foreground" : "bg-muted text-muted-foreground")}>{c.action}</span>
                    <span className="min-w-0 truncate">{c.path}</span>
                  </div>
                  <pre tabIndex={0} className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                    {c.diff.trimEnd().split("\n").map((l, i) => (
                      <div key={i} className={cn(l.startsWith("+ ") && "text-success-foreground", l.startsWith("- ") && "text-destructive-foreground", l.startsWith("  ") && "text-muted-foreground")}>
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
