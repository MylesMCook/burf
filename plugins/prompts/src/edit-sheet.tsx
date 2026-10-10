import * as stylex from "@stylexjs/stylex";
import { useProjects, type BerthPluginContext, type SavedPrompt, type SavedPromptVariable } from "@berth/plugin";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle, Button, Input, Kbd, Menu, MenuItem, MenuPopup, MenuTrigger, Icon, Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle, Switch, Textarea, Tip } from "@berth/plugin/ui";
import { useMemo, useRef, useState } from "react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s1: {
    "gap": "4px",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "20px",
    "paddingBottom": "12px",
  },
  s2: {
    "fontSize": "16px",
    "lineHeight": "24px",
  },
  s3: {
    "fontSize": "13px",
  },
  s4: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "16px",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingBottom": "20px",
  },
  s5: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s6: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s7: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s8: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s9: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
  },
  s10: {
    "marginRight": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "height": "24px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s12: {
    "height": "24px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s13: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s14: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s15: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s16: {
    "display": "grid",
    "gridTemplateColumns": "7rem 1fr 1fr auto",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s17: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
  },
  s18: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "grid",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "gap": "12px",
  },
  s20: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s21: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s22: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s23: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s24: {
    "justifyContent": "space-between",
    "fontWeight": 400,
  },
  s25: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s26: {
    "opacity": 0.6,
  },
  s27: {
    "maxHeight": "288px",
    "minWidth": "224px",
  },
  s28: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s29: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s30: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s31: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "borderRadius": "3px",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--info-foreground)",
  },
  s33: {
    "minHeight": "64px",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "13px",
    "lineHeight": "1.625",
  },
  s34: {
    "borderRadius": "3px",
    "paddingLeft": "2px",
    "paddingRight": "2px",
  },
  s35: {
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--info-foreground)",
  },
  s36: {
    "color": "var(--muted-foreground)",
  },
  s37: {
    "color": "var(--destructive)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s38: {
    "flexDirection": "row",
    "alignItems": "center",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s39: {
    "marginRight": "auto",
    "color": "var(--destructive-foreground)",
  },
  s40: {
    "marginLeft": "auto",
  },
  s41: {
    "marginInlineEnd": "calc(4px * -1)",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 16%, transparent)",
    "color": "color-mix(in oklab, var(--primary-foreground) 80%, transparent)",
  },
  n0: {
    "borderRadius": "3px",
    "paddingLeft": "2px",
    "paddingRight": "2px",
  },
  n1: {
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--info-foreground)",
  },
  n2: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--warning-foreground)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--primary) 10%, transparent)",
  },
  n4: {
    "marginLeft": "auto",
  },
  q42: {
    "marginLeft": "auto",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// EditSheet writes one prompt: its text with {{variables}}, labels and
// defaults for the ones you fill in, tags, where it is offered, and a live
// preview of what an agent will be sent.
export function EditSheet({
  berth,
  prompt,
  tags: known,
  onClose,
  onSave,
  onDelete,
}: {
  berth: BerthPluginContext;
  prompt?: SavedPrompt;
  tags: string[];
  onClose(): void;
  onSave(p: SavedPrompt): Promise<void>;
  onDelete?(): void;
}) {
  const projects = useProjects();
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState((prompt?.tags ?? []).join(", "));
  const [project, setProject] = useState(prompt?.project ?? "");
  const [meta, setMeta] = useState<Record<string, SavedPromptVariable>>(() => Object.fromEntries((prompt?.variables ?? []).map((v) => [v.name, v])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const area = useRef<HTMLTextAreaElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  // Esc or a click outside never throws away what was typed without asking;
  // Cancel, a deliberate press, still does.
  const [asking, setAsking] = useState(false);
  const dirty =
    title !== (prompt?.title ?? "") || body !== (prompt?.body ?? "") || tags !== (prompt?.tags ?? []).join(", ") || project !== (prompt?.project ?? "") || JSON.stringify(Object.values(meta)) !== JSON.stringify(prompt?.variables ?? []);

  const vars = useMemo(() => berth.prompts.variables({ body, variables: Object.values(meta) }), [berth, body, meta]);
  const defaults = Object.fromEntries(vars.map((v) => [v.name, v.default]));
  const segments = berth.prompts.segments(body, defaults);
  const builtin = new Set(berth.prompts.builtins.map((b) => b.name));
  const ready = !!title.trim() && !!body.trim();

  const insert = (token: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? at;
    const next = body.slice(0, at) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const setVar = (name: string, patch: Partial<SavedPromptVariable>) => setMeta((m) => ({ ...m, [name]: { ...m[name], ...patch, name } }));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      // Only variables the body still uses, and only what was set for them.
      const variables = vars
        .map((v) => ({ name: v.name, label: v.label?.trim() || undefined, default: v.default || undefined, multiline: v.multiline || undefined }))
        .filter((v) => v.label || v.default || v.multiline);
      await onSave({
        ...prompt,
        id: prompt?.id ?? berth.prompts.newId(),
        title: title.trim(),
        body: body.trim(),
        tags: [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
        project: project || undefined,
        variables: variables.length ? variables : undefined,
        updated: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const scopeLabel = project ? (projects.find((p) => p.id === project)?.name ?? project) : "Everywhere";

  return (
    <Sheet open onOpenChange={(o: boolean) => !o && (dirty ? setAsking(true) : onClose())}>
      <SheetPopup width="xl" showCloseButton={false}>
        <form
          className={sx(paint.s0)}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        >
          <SheetHeader className={sx(paint.s1)}>
            <SheetTitle className={sx(paint.s2)}>{prompt ? "Edit prompt" : "New prompt"}</SheetTitle>
            <SheetDescription className={sx(paint.s3)}>Use {"{{variables}}"} for what changes: built-ins fill in from the agent it goes to, the rest you fill in when sending.</SheetDescription>
          </SheetHeader>

          <SheetPanel className={sx(paint.s4)}>
            <label className={sx(paint.s5)}>
              <span className={sx(paint.s6)}>Title</span>
              <Input autoFocus={!prompt} value={title} placeholder="e.g. Review the diff" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
            </label>

            <div className={sx(paint.s7)}>
              <span className={sx(paint.s8)}>Prompt</span>
              <Textarea ref={area} rows={7} value={body} placeholder="What the agent is told. e.g. Review {{branch}} against {{base}} and list bugs first." onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} />
              <div className={sx(paint.s9)}>
                <span className={sx(paint.s10)}>Insert</span>
                {berth.prompts.builtins.map((b) => (
                  <Tip key={b.name} label={b.label}>
                    <button type="button" onClick={() => insert(`{{${b.name}}}`)} className={sx(paint.s11)}>
                      {b.name}
                    </button>
                  </Tip>
                ))}
                <Tip label="A variable you fill in when sending">
                  <button type="button" onClick={() => insert("{{focus}}")} className={sx(paint.s12)}>
                    + your own
                  </button>
                </Tip>
              </div>
            </div>

            {vars.length > 0 && (
              <div className={sx(paint.s13)}>
                <span className={sx(paint.s14)}>Your variables</span>
                <div className={sx(paint.s15)}>
                  {vars.map((v) => (
                    <div key={v.name} className={sx(paint.s16)}>
                      <span className={sx(paint.s17)}>{`{{${v.name}}}`}</span>
                      <Input size="sm" aria-label={`Label for ${v.name}`} placeholder="Label" value={meta[v.name]?.label ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVar(v.name, { label: e.target.value })} />
                      <Input size="sm" aria-label={`Default for ${v.name}`} placeholder="Default" value={meta[v.name]?.default ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVar(v.name, { default: e.target.value })} />
                      <Tip label="Ask for it in a text box">
                        <label className={sx(paint.s18)}>
                          <Switch checked={!!meta[v.name]?.multiline} onCheckedChange={(on: boolean) => setVar(v.name, { multiline: on })} />
                          Long
                        </label>
                      </Tip>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={sx(paint.s19)}>
              <label className={sx(paint.s20)}>
                <span className={sx(paint.s21)}>Tags</span>
                <Input value={tags} placeholder={known.length ? known.slice(0, 3).join(", ") : "review, tests"} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTags(e.target.value)} />
              </label>
              <div className={sx(paint.s22)}>
                <span className={sx(paint.s23)}>Offered</span>
                <Menu>
                  <MenuTrigger render={<Button type="button" variant="outline" className={sx(paint.s24)} />}>
                    <span className={sx(paint.s25)}>{scopeLabel}</span>
                    <Icon name="ChevronsUpDown" className={sx(paint.s26)} />
                  </MenuTrigger>
                  <MenuPopup align="start" className={sx(paint.s27)}>
                    <MenuItem onClick={() => setProject("")}>
                      <Icon name="Globe" />
                      Everywhere
                    </MenuItem>
                    {projects.map((p) => (
                      <MenuItem key={p.id} onClick={() => setProject(p.id)}>
                        <Icon name="FolderGit2" />
                        <span className={sx(paint.s28)}>{p.name}</span>
                      </MenuItem>
                    ))}
                  </MenuPopup>
                </Menu>
              </div>
            </div>

            <div className={sx(paint.s29)}>
              <span className={sx(paint.s30)}>
                Preview
                <span className={sx(paint.s31)}>
                  <span className={sx(paint.s32)}>built-ins</span> fill in per agent
                </span>
              </span>
              <div className={sx(paint.s33)}>
                {body.trim() ? (
                  segments.map((s, i) =>
                    !s.variable ? (
                      <span key={i}>{s.text}</span>
                    ) : (
                      <Tip key={i} label={builtin.has(s.variable) ? "Filled in from the agent it goes to" : s.missing ? "Asked for when sending" : "Its default"}>
                        <span
                          className={[sx(paint.n0), builtin.has(s.variable) ? sx(paint.n1) : s.missing ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}
                        >
                          {builtin.has(s.variable) || s.missing ? s.variable : s.text}
                        </span>
                      </Tip>
                    ),
                  )
                ) : (
                  <span className={sx(paint.s36)}>What you write shows here, as an agent will get it.</span>
                )}
              </div>
            </div>

            {error && <p className={sx(paint.s37)}>{error}</p>}
          </SheetPanel>

          <SheetFooter className={sx(paint.s38)}>
            {onDelete && (
              <Button type="button" variant="ghost" className={sx(paint.s39)} onClick={onDelete}>
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" className={onDelete ? undefined : sx(paint.q42)} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!ready}>
              Save
              <Kbd className={sx(paint.s41)}>⌘↵</Kbd>
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>
      <AlertDialog open={asking} onOpenChange={(o: boolean) => !o && setAsking(false)}>
        <AlertDialogPopup initialFocus={keep}>
          <AlertDialogHeader>
            <AlertDialogTitle>{prompt ? "Discard your changes?" : "Discard this prompt?"}</AlertDialogTitle>
            <AlertDialogDescription>{prompt ? `What you changed in “${prompt.title}” is lost.` : "What you wrote is lost. It isn't saved anywhere yet."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose ref={keep} render={<Button variant="ghost" />}>
              Keep editing
            </AlertDialogClose>
            <Button variant="destructive" onClick={onClose}>
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Sheet>
  );
}
