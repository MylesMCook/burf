import * as stylex from "@stylexjs/stylex";
import { CloudOffIcon, FoldHorizontalIcon, PaletteIcon, PencilIcon, UnfoldHorizontalIcon, XIcon } from "lucide-react";

import { openRenameWorktree } from "@/components/sidebar/rename-worktree";
import { Tip } from "@/components/tip";
import { ContextMenu, ContextMenuItem, ContextMenuPopup, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubPopup, ContextMenuSubTrigger, ContextMenuTrigger, menuWidths } from "@/components/ui/context-menu";
import { MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { armDrag } from "@/components/workspace/tab-drag";
import { TabButton } from "@/components/workspace/tab-strip";
import { useLabel, useTone } from "@/components/workspace/worktree-tone";
import { closeTab } from "@/lib/actions";
import { TONES, toneVar } from "@/lib/groups";
import { removalLabel, useRemoval } from "@/lib/removing";
import { useStore } from "@/lib/store";
import { findWorktree } from "@/lib/worktree-names";
import { activateTab, closeGroup, focusGroup, foldGroup, setTone, tabBeside, unsplitTab, useWorkspaces } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "stretch",
  },
  s1: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "stretch",
  },
  s2: {
    "display": "flex",
    "flexDirection": "column",
  },
  s3: {
    "color": "var(--muted-foreground)",
  },
  s4: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "outline": "none",
  },
  s5: {
    "display": "inline-flex",
    "height": "20px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontWeight": 500,
    "fontSize": "11px",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group\\/label:focus-visible &)": {
      "boxShadow": "0 0 0 2px var(--ring)",
    },
  },
  s6: {
    "maxWidth": "112px",
  },
  s7: {
    "maxWidth": "160px",
  },
  s8: {
    "opacity": 0.55,
  },
  s9: {
    "width": "12px",
    "height": "12px",
  },
  s10: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s12: {
    "fontVariantNumeric": "tabular-nums",
    "opacity": 0.75,
  },
  s13: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s14: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s15: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s16: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "999px",
  },
  s17: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s18: {
    "maxWidth": "208px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s20: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "999px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// TabGroup (Labs) is one worktree's run of tabs in a strip shared with
// others: its name in its colour, then its tabs, underlined in that colour.
// The group in front has the solid label; any tab of another brings that
// one forward, and with it the breadcrumb, Run, ⌘T and the palette. The
// label folds the group to its name and tab count; its menu folds, colours
// and closes it (the worktree and its agents carry on).
// compact: a narrow window's chip for a group not in front, its dot and
// name only.
export function TabGroup({ wsKey, front, folded, many, compact }: { wsKey: string; front: boolean; folded: boolean; many: boolean; compact?: boolean }) {
  const ws = useWorkspaces((s) => s.spaces[wsKey]);
  const tone = useTone(wsKey);
  if (!ws || !tone) return null;
  const go = (tab: string) => {
    if (!front) focusGroup(wsKey);
    activateTab(wsKey, tab);
  };
  return (
    // Not positioned: the strip measures its tabs' offsets from itself.
    <div data-group={wsKey} className={sx(paint.s0)} style={{ boxShadow: `inset 0 -2px 0 color-mix(in oklab, ${tone} ${front ? 100 : 40}%, transparent)` }}>
      <GroupLabel wsKey={wsKey} front={front} folded={folded} count={ws.tabs.length} tone={tone} many={many} compact={compact} />
      {!folded &&
        ws.tabs.map((t) => (
          <TabButton
            key={t.id}
            tab={t}
            wsKey={wsKey}
            tone={tone}
            active={front && t.id === ws.active}
            onActivate={() => go(t.id)}
            onClose={() => void closeTab(wsKey, t.id)}
            onDrag={(e, label, icon) => armDrag(e, { kind: "tab", key: wsKey, tab: t.id }, label, icon)}
            onSplit={ws.tabs.length > 1 ? (dir) => tabBeside(wsKey, t.id, dir) : undefined}
            onUnsplit={() => unsplitTab(wsKey, t.id)}
          />
        ))}
    </div>
  );
}

function GroupLabel({ wsKey, front, folded, count, tone, many, compact }: { wsKey: string; front: boolean; folded: boolean; count: number; tone: string; many: boolean; compact?: boolean }) {
  const { label, ref } = useLabel(wsKey);
  const away = useStore((s) => !!ref && !!s.status && s.status.boxes.find((b) => b.name === ref.box)?.state !== "online");
  const leaving = useRemoval(ref?.box ?? "", ref?.path);
  const picked = useWorkspaces((s) => s.tones?.[wsKey]);
  // A renamed worktree's own name follows its title.
  const own = ref && !ref.main && label !== ref.worktree && !label.startsWith(`${ref.worktree} `) ? ` (${ref.worktree})` : "";
  const where = ref ? `${label}${own} on ${ref.box}` : label;
  const tip = leaving ? `${where} · ${removalLabel(leaving)}` : away ? `${where} · ${ref?.box} is offline` : folded ? `${where} · ${count} ${count === 1 ? "tab" : "tabs"}, folded` : where;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className={sx(paint.s1)} />}>
        <Tip label={<span className={sx(paint.s2)}>{tip}<span className={sx(paint.s3)}>Click to {folded ? "unfold" : "fold"}, right-click for more</span></span>} side="bottom" align="start">
          <button
            type="button"
            data-group-label={wsKey}
            aria-label={`${label} tab group, ${count} ${count === 1 ? "tab" : "tabs"}${front ? ", in front" : ""}${folded ? ", folded" : ""}${leaving ? `, ${removalLabel(leaving)}` : away ? `, ${ref?.box} is offline` : ""}`}
            aria-expanded={!folded}
            onClick={() => {
              if (folded) {
                foldGroup(wsKey, false);
                focusGroup(wsKey);
              } else foldGroup(wsKey, true);
            }}
            className={[sx(paint.s4), "group/label"].filter(Boolean).join(" ")}
          >
            <span
              className={[sx(paint.s5), compact ? sx(paint.s6) : sx(paint.s7), (away || leaving) && sx(paint.s8)].filter(Boolean).join(" ")}
              style={front ? { background: tone, color: "var(--background)" } : { background: `color-mix(in oklab, ${tone} 15%, transparent)`, color: tone }}
            >
              {leaving ? <Spinner  size="sm"/> : away ? <CloudOffIcon className={sx(paint.s9)} aria-hidden /> : <span aria-hidden className={sx(paint.s10)} style={{ background: front ? "var(--background)" : tone }} />}
              <span className={sx(paint.s11)}>{label}</span>
              {folded && !compact && <span className={sx(paint.s12)}>{count}</span>}
            </span>
          </button>
        </Tip>
      </ContextMenuTrigger>
      <ContextMenuPopup width={menuWidths.w52}>
        <ContextMenuItem onClick={() => foldGroup(wsKey, !folded)}>
          {folded ? <UnfoldHorizontalIcon /> : <FoldHorizontalIcon />}
          <span className={sx(paint.s13)}>{folded ? "Unfold" : "Fold to its name"}</span>
        </ContextMenuItem>
        {ref && !ref.main && (
          <ContextMenuItem
            onClick={() => {
              const at = findWorktree(ref.box, ref.path);
              if (at) openRenameWorktree(ref.box, at.loc, at.wt, { inPlace: false });
            }}
          >
            <PencilIcon />
            <span className={sx(paint.s14)}>Rename worktree…</span>
          </ContextMenuItem>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <PaletteIcon />
            Colour
          </ContextMenuSubTrigger>
          <ContextMenuSubPopup width={menuWidths.w40}>
            <ContextMenuRadioGroup value={picked ?? "auto"} onValueChange={(v) => setTone(wsKey, v === "auto" ? undefined : String(v))}>
              <ContextMenuRadioItem value="auto">Automatic</ContextMenuRadioItem>
              {TONES.map((t) => (
                <ContextMenuRadioItem key={t} value={t}>
                  <span className={sx(paint.s15)}>
                    <span aria-hidden className={sx(paint.s16)} style={{ background: toneVar(t) }} />
                    {t[0].toUpperCase() + t.slice(1)}
                  </span>
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubPopup>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!many} onClick={() => closeGroup(wsKey)}>
          <XIcon />
          <span className={sx(paint.s17)}>Close group</span>
          {front && <ContextMenuShortcut>⌘⇧W</ContextMenuShortcut>}
        </ContextMenuItem>
        <p className={sx(paint.s18)}>Its tabs leave the strip; the worktree and its agents carry on.</p>
      </ContextMenuPopup>
    </ContextMenu>
  );
}

// ToneItems picks a worktree's colour, for the sidebar's worktree menu.
export function ToneItems({ wsKey }: { wsKey: string }) {
  const picked = useWorkspaces((s) => s.tones?.[wsKey]);
  return (
    <MenuRadioGroup value={picked ?? "auto"} onValueChange={(v) => setTone(wsKey, v === "auto" ? undefined : String(v))}>
      <MenuRadioItem value="auto">Automatic</MenuRadioItem>
      {TONES.map((t) => (
        <MenuRadioItem key={t} value={t}>
          <span className={sx(paint.s19)}>
            <span aria-hidden className={sx(paint.s20)} style={{ background: toneVar(t) }} />
            {t[0].toUpperCase() + t.slice(1)}
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}
