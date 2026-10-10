import * as stylex from "@stylexjs/stylex";
import { definePlugin, useProjects, type BerthPluginContext, type SavedPrompt, type ScreenProps } from "@berth/plugin";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterChip,
  Icon,
  Input,
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  ViewHeader,
} from "@berth/plugin/ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { EditSheet } from "./edit-sheet";

const paint = stylex.create({
  s0: {
    "borderRadius": "3px",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.95em",
    "color": "var(--info-foreground)",
  },
  s1: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s2: {
    "marginBottom": "16px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },
  s3: {
    "width": "256px",
  },
  s4: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
  },
  s5: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "marginBottom": "16px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "display": "grid",
    "gridTemplateColumns": "repeat(auto-fill,minmax(280px,1fr))",
    "gap": "12px",
  },
  s9: {
    "display": "flex",
    "minWidth": "0px",
    "cursor": "pointer",
    "flexDirection": "column",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "backgroundColor": "var(--card)",
    "padding": "14px",
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s10: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "flex-start",
    "gap": "8px",
  },
  s11: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "marginTop": "calc(4px * -1)",
    "marginBottom": "calc(4px * -1)",
    "marginInlineEnd": "calc(4px * -1)",
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s13: {
    "width": "14px",
    "height": "14px",
  },
  s14: {
    "minWidth": "176px",
  },
  s15: {
    "marginTop": "6px",
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 4,
    "WebkitBoxOrient": "vertical",
    "whiteSpace": "pre-line",
    "overflowWrap": "break-word",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s16: {
    "marginTop": "auto",
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "paddingTop": "12px",
  },
  s17: {
    "maxWidth": "128px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s18: {
    "marginLeft": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s19: {
    "marginLeft": "auto",
  },
  s20: {
    "height": "24px",
    "fontSize": "11px",
  },
  q21: {
    "opacity": {
      "[data-popup-open]": 1,
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The prompt library: saved prompts for agents, kept on this laptop. The
// app owns sending (its picker, ⌘K, panes' menus, broadcast); this is where
// you write, find and tidy them.

export const SCREEN = "prompt-library";

export default definePlugin((berth) => {
  berth.addScreen({ id: SCREEN, title: "Prompts", Component: Library });
  berth.addSidebarItem({ id: "prompts", title: "Prompts", icon: "BookMarked", screen: SCREEN });
  berth.addCommand({ id: "open", title: "Open the prompt library", group: "Prompts", run: () => berth.openScreen(SCREEN) });
  void berth.prompts.load();
});

export function useLibrary(berth: BerthPluginContext) {
  return useSyncExternalStore(berth.prompts.subscribe, berth.prompts.list);
}

// Tokens in a body, marked so variables stand out in a card.
export function Marked({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*[a-zA-Z_][\w.-]*\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} className={sx(paint.s0)}>
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

function Library({ berth }: ScreenProps) {
  const prompts = useLibrary(berth);
  const projects = useProjects();
  const [query, setQuery] = useState("");
  // Tags to narrow to; a prompt shows when it has every one.
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditingState] = useState<SavedPrompt | "new">();
  const [deleting, setDeleting] = useState<SavedPrompt>();
  // The sheet is mounted only while open, so it can't hand the keyboard back
  // itself: what opened it gets it again when it closes (New prompt, a card).
  const opener = useRef<HTMLElement | null>(null);
  const setEditing = (p: SavedPrompt | "new" | undefined) => {
    if (p && !editing) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingState(p);
    if (!p)
      window.setTimeout(() => {
        const el = opener.current;
        if (el?.isConnected && (document.activeElement === document.body || !document.activeElement)) el.focus();
      }, 0);
  };
  const starters = prompts === berth.prompts.starters;

  useEffect(() => {
    void berth.prompts.load();
  }, [berth]);

  const tags = useMemo(() => [...new Set(prompts.flatMap((p) => p.tags))].sort(), [prompts]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = prompts.filter((p) => picked.every((t) => p.tags.includes(t)) && words.every((w) => `${p.title} ${p.tags.join(" ")} ${p.body}`.toLowerCase().includes(w)));
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name ?? id;
  const missingStarters = berth.prompts.starters.filter((s) => !prompts.some((p) => p.id === s.id));

  const save = (next: SavedPrompt[]) =>
    berth.prompts.save(next).catch((err: unknown) => berth.notify("Couldn't save the prompt library", err instanceof Error ? err.message : String(err)));

  const duplicate = (p: SavedPrompt) => {
    const copy = { ...p, id: berth.prompts.newId(), title: `${p.title} (copy)`, uses: 0, last_used: undefined, updated: new Date().toISOString() };
    const i = prompts.indexOf(p);
    void save([...prompts.slice(0, i + 1), copy, ...prompts.slice(i + 1)]);
  };

  return (
    <div>
      <ViewHeader
        title="Prompts"
        description={<>Prompts you send agents again and again. Send one from <b className={sx(paint.s1)}>⌘K</b> or a pane's menu, or to several agents at once.</>}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => berth.prompts.openBroadcast()}>
              <Icon name="Users" />
              Send to several…
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Icon name="Plus" />
              New prompt
            </Button>
          </>
        }
      />
      <div>
        <div className={sx(paint.s2)}>
          <Input className={sx(paint.s3)} size="sm" placeholder="Search prompts…" aria-label="Search prompts" value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} />
          <div className={sx(paint.s4)} role="group" aria-label="Tags">
            {tags.map((t) => (
              <FilterChip key={t} pressed={picked.includes(t)} onPressedChange={(on: boolean) => setPicked((ps) => (on ? [...ps, t] : ps.filter((x) => x !== t)))}>
                {t}
              </FilterChip>
            ))}
          </div>
          {missingStarters.length > 0 && !starters && (
            <Button size="xs" variant="ghost" className={sx(paint.s5)} onClick={() => void save([...prompts, ...missingStarters])}>
              Add the starter prompts back ({missingStarters.length})
            </Button>
          )}
        </div>

        {starters && (
          <p className={sx(paint.s6)}>
            These are starters to get going. Edit them, delete them, or add your own; the library is kept on this laptop, for every window.
          </p>
        )}

        {shown.length === 0 ? (
          <Empty frame="panel" pad="room">
            <EmptyHeader>
              <Icon name="BookMarked" className={sx(paint.s7)} />
              <EmptyTitle>{prompts.length ? "Nothing matches" : "No saved prompts"}</EmptyTitle>
              <EmptyDescription>{prompts.length ? "Try another search or tag." : "Save the prompts you keep typing, with {{variables}} for what changes."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className={sx(paint.s8)}>
            {shown.map((p) => (
              <article
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(p)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && e.target === e.currentTarget && setEditing(p)}
                className={[sx(paint.s9), "group"].filter(Boolean).join(" ")}
              >
                <div className={sx(paint.s10)}>
                  <h3 className={sx(paint.s11)}>{p.title}</h3>
                  <span onClick={(e: React.MouseEvent) => e.stopPropagation()} onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}>
                    <Menu>
                      <MenuTrigger
                        render={<button type="button" aria-label={`More for ${p.title}`} className={[sx(paint.s12), sx(paint.q21)].filter(Boolean).join(" ")} />}
                      >
                        <Icon name="Ellipsis" className={sx(paint.s13)} />
                      </MenuTrigger>
                      <MenuPopup align="end" className={sx(paint.s14)}>
                        <MenuItem onClick={() => berth.prompts.openPicker({ promptId: p.id })}>
                          <Icon name="Send" />
                          Send to an agent…
                        </MenuItem>
                        <MenuItem onClick={() => berth.prompts.openBroadcast({ promptId: p.id })}>
                          <Icon name="Users" />
                          Send to several…
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem onClick={() => setEditing(p)}>
                          <Icon name="Pencil" />
                          Edit
                        </MenuItem>
                        <MenuItem onClick={() => duplicate(p)}>
                          <Icon name="Copy" />
                          Duplicate
                        </MenuItem>
                        <MenuItem variant="destructive" onClick={() => setDeleting(p)}>
                          <Icon name="Trash2" />
                          Delete…
                        </MenuItem>
                      </MenuPopup>
                    </Menu>
                  </span>
                </div>
                <p className={sx(paint.s15)}>
                  <Marked text={p.body} />
                </p>
                <footer className={sx(paint.s16)}>
                  {p.project && (
                    <Badge size="sm" variant="info" className={sx(paint.s17)} title={`Only offered in ${projectName(p.project)}`}>
                      {projectName(p.project)}
                    </Badge>
                  )}
                  {p.tags.map((t) => (
                    <Badge key={t} size="sm" variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {!!p.uses && <span className={sx(paint.s18)}>{p.uses === 1 ? "used once" : `used ${p.uses}×`}</span>}
                  <span className={sx(paint.s19)} onClick={(e: React.MouseEvent) => e.stopPropagation()} onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}>
                    <Button size="xs" variant="ghost" className={sx(paint.s20)} onClick={() => berth.prompts.openPicker({ promptId: p.id })}>
                      Send…
                    </Button>
                  </span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditSheet
          berth={berth}
          prompt={editing === "new" ? undefined : editing}
          tags={tags}
          onClose={() => setEditing(undefined)}
          onSave={async (p) => {
            const has = prompts.some((x) => x.id === p.id);
            await berth.prompts.save(has ? prompts.map((x) => (x.id === p.id ? p : x)) : [p, ...prompts]);
            setEditing(undefined);
          }}
          onDelete={editing === "new" ? undefined : () => setDeleting(editing)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o: boolean) => !o && setDeleting(undefined)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>It goes from the library on this laptop. Prompts already sent are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                const id = deleting?.id;
                setDeleting(undefined);
                setEditing(undefined);
                void save(prompts.filter((p) => p.id !== id));
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
