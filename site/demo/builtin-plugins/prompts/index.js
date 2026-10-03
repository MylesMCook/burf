// ../plugins/prompts/src/index.tsx
import { definePlugin, useProjects as useProjects2 } from "@berth/plugin";
import {
  AlertDialog as AlertDialog2,
  AlertDialogClose as AlertDialogClose2,
  AlertDialogDescription as AlertDialogDescription2,
  AlertDialogFooter as AlertDialogFooter2,
  AlertDialogHeader as AlertDialogHeader2,
  AlertDialogPopup as AlertDialogPopup2,
  AlertDialogTitle as AlertDialogTitle2,
  Badge,
  Button as Button2,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterChip,
  Icon as Icon2,
  Input as Input2,
  Menu as Menu2,
  MenuItem as MenuItem2,
  MenuPopup as MenuPopup2,
  MenuSeparator,
  MenuTrigger as MenuTrigger2,
  ViewHeader
} from "@berth/plugin/ui";
import { useEffect, useMemo as useMemo2, useRef as useRef2, useState as useState2, useSyncExternalStore } from "react";

// ../plugins/prompts/src/edit-sheet.tsx
import { useProjects } from "@berth/plugin";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle, Button, Input, Kbd, Menu, MenuItem, MenuPopup, MenuTrigger, Icon, Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle, Switch, Textarea, Tip, cn } from "@berth/plugin/ui";
import { useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function EditSheet({
  berth,
  prompt,
  tags: known,
  onClose,
  onSave,
  onDelete
}) {
  const projects = useProjects();
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState((prompt?.tags ?? []).join(", "));
  const [project, setProject] = useState(prompt?.project ?? "");
  const [meta, setMeta] = useState(() => Object.fromEntries((prompt?.variables ?? []).map((v) => [v.name, v])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState();
  const area = useRef(null);
  const keep = useRef(null);
  const [asking, setAsking] = useState(false);
  const dirty = title !== (prompt?.title ?? "") || body !== (prompt?.body ?? "") || tags !== (prompt?.tags ?? []).join(", ") || project !== (prompt?.project ?? "") || JSON.stringify(Object.values(meta)) !== JSON.stringify(prompt?.variables ?? []);
  const vars = useMemo(() => berth.prompts.variables({ body, variables: Object.values(meta) }), [berth, body, meta]);
  const defaults = Object.fromEntries(vars.map((v) => [v.name, v.default]));
  const segments = berth.prompts.segments(body, defaults);
  const builtin = new Set(berth.prompts.builtins.map((b) => b.name));
  const ready = !!title.trim() && !!body.trim();
  const insert = (token) => {
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
  const setVar = (name, patch) => setMeta((m) => ({ ...m, [name]: { ...m[name], ...patch, name } }));
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(void 0);
    try {
      const variables = vars.map((v) => ({ name: v.name, label: v.label?.trim() || void 0, default: v.default || void 0, multiline: v.multiline || void 0 })).filter((v) => v.label || v.default || v.multiline);
      await onSave({
        ...prompt,
        id: prompt?.id ?? berth.prompts.newId(),
        title: title.trim(),
        body: body.trim(),
        tags: [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
        project: project || void 0,
        variables: variables.length ? variables : void 0,
        updated: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  const scopeLabel = project ? projects.find((p) => p.id === project)?.name ?? project : "Everywhere";
  return /* @__PURE__ */ jsxs(Sheet, { open: true, onOpenChange: (o) => !o && (dirty ? setAsking(true) : onClose()), children: [
    /* @__PURE__ */ jsx(SheetPopup, { className: "sm:max-w-xl", showCloseButton: false, children: /* @__PURE__ */ jsxs(
      "form",
      {
        className: "flex min-h-0 flex-1 flex-col",
        onSubmit: (e) => {
          e.preventDefault();
          void submit();
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        },
        children: [
          /* @__PURE__ */ jsxs(SheetHeader, { className: "gap-1 px-5 pt-5 pb-3", children: [
            /* @__PURE__ */ jsx(SheetTitle, { className: "text-base", children: prompt ? "Edit prompt" : "New prompt" }),
            /* @__PURE__ */ jsxs(SheetDescription, { className: "text-[13px]", children: [
              "Use ",
              "{{variables}}",
              " for what changes: built-ins fill in from the agent it goes to, the rest you fill in when sending."
            ] })
          ] }),
          /* @__PURE__ */ jsxs(SheetPanel, { className: "flex flex-col gap-4 px-5 pb-5", children: [
            /* @__PURE__ */ jsxs("label", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { className: "font-medium text-[13px]", children: "Title" }),
              /* @__PURE__ */ jsx(Input, { autoFocus: !prompt, value: title, placeholder: "e.g. Review the diff", onChange: (e) => setTitle(e.target.value) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { className: "font-medium text-[13px]", children: "Prompt" }),
              /* @__PURE__ */ jsx(Textarea, { ref: area, rows: 7, value: body, placeholder: "What the agent is told. e.g. Review {{branch}} against {{base}} and list bugs first.", onChange: (e) => setBody(e.target.value) }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [
                /* @__PURE__ */ jsx("span", { className: "mr-1 text-muted-foreground text-xs", children: "Insert" }),
                berth.prompts.builtins.map((b) => /* @__PURE__ */ jsx(Tip, { label: b.label, children: /* @__PURE__ */ jsx("button", { type: "button", onClick: () => insert(`{{${b.name}}}`), className: "h-6 rounded-md bg-muted px-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground", children: b.name }) }, b.name)),
                /* @__PURE__ */ jsx(Tip, { label: "A variable you fill in when sending", children: /* @__PURE__ */ jsx("button", { type: "button", onClick: () => insert("{{focus}}"), className: "h-6 rounded-md border border-dashed px-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground", children: "+ your own" }) })
              ] })
            ] }),
            vars.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { className: "font-medium text-[13px]", children: "Your variables" }),
              /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-lg border", children: vars.map((v) => /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-2 border-b px-3 py-2 last:border-b-0", children: [
                /* @__PURE__ */ jsx("span", { className: "truncate font-mono text-[12px]", children: `{{${v.name}}}` }),
                /* @__PURE__ */ jsx(Input, { size: "sm", "aria-label": `Label for ${v.name}`, placeholder: "Label", value: meta[v.name]?.label ?? "", onChange: (e) => setVar(v.name, { label: e.target.value }) }),
                /* @__PURE__ */ jsx(Input, { size: "sm", "aria-label": `Default for ${v.name}`, placeholder: "Default", value: meta[v.name]?.default ?? "", onChange: (e) => setVar(v.name, { default: e.target.value }) }),
                /* @__PURE__ */ jsx(Tip, { label: "Ask for it in a text box", children: /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-center gap-1.5 text-muted-foreground text-xs", children: [
                  /* @__PURE__ */ jsx(Switch, { checked: !!meta[v.name]?.multiline, onCheckedChange: (on) => setVar(v.name, { multiline: on }) }),
                  "Long"
                ] }) })
              ] }, v.name)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
              /* @__PURE__ */ jsxs("label", { className: "flex min-w-0 flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("span", { className: "font-medium text-[13px]", children: "Tags" }),
                /* @__PURE__ */ jsx(Input, { value: tags, placeholder: known.length ? known.slice(0, 3).join(", ") : "review, tests", onChange: (e) => setTags(e.target.value) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col gap-1.5", children: [
                /* @__PURE__ */ jsx("span", { className: "font-medium text-[13px]", children: "Offered" }),
                /* @__PURE__ */ jsxs(Menu, { children: [
                  /* @__PURE__ */ jsxs(MenuTrigger, { render: /* @__PURE__ */ jsx(Button, { type: "button", variant: "outline", className: "justify-between font-normal" }), children: [
                    /* @__PURE__ */ jsx("span", { className: "truncate", children: scopeLabel }),
                    /* @__PURE__ */ jsx(Icon, { name: "ChevronsUpDown", className: "opacity-60" })
                  ] }),
                  /* @__PURE__ */ jsxs(MenuPopup, { align: "start", className: "max-h-72 min-w-56", children: [
                    /* @__PURE__ */ jsxs(MenuItem, { onClick: () => setProject(""), children: [
                      /* @__PURE__ */ jsx(Icon, { name: "Globe" }),
                      "Everywhere"
                    ] }),
                    projects.map((p) => /* @__PURE__ */ jsxs(MenuItem, { onClick: () => setProject(p.id), children: [
                      /* @__PURE__ */ jsx(Icon, { name: "FolderGit2" }),
                      /* @__PURE__ */ jsx("span", { className: "truncate", children: p.name })
                    ] }, p.id))
                  ] })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
              /* @__PURE__ */ jsxs("span", { className: "flex items-baseline gap-2 font-medium text-[13px]", children: [
                "Preview",
                /* @__PURE__ */ jsxs("span", { className: "font-normal text-muted-foreground text-xs", children: [
                  /* @__PURE__ */ jsx("span", { className: "rounded-[3px] bg-info/10 px-1 font-mono text-[11px] text-info-foreground", children: "built-ins" }),
                  " fill in per agent"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "min-h-16 whitespace-pre-wrap break-words rounded-lg border bg-muted/40 px-3 py-2.5 text-[13px] leading-relaxed", children: body.trim() ? segments.map(
                (s, i) => !s.variable ? /* @__PURE__ */ jsx("span", { children: s.text }, i) : /* @__PURE__ */ jsx(Tip, { label: builtin.has(s.variable) ? "Filled in from the agent it goes to" : s.missing ? "Asked for when sending" : "Its default", children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: cn(
                      "rounded-[3px] px-0.5",
                      builtin.has(s.variable) ? "bg-info/10 font-mono text-[12px] text-info-foreground" : s.missing ? "bg-warning/12 font-mono text-[12px] text-warning-foreground" : "bg-primary/10"
                    ),
                    children: builtin.has(s.variable) || s.missing ? s.variable : s.text
                  }
                ) }, i)
              ) : /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "What you write shows here, as an agent will get it." }) })
            ] }),
            error && /* @__PURE__ */ jsx("p", { className: "text-destructive text-sm", children: error })
          ] }),
          /* @__PURE__ */ jsxs(SheetFooter, { className: "flex-row items-center px-5 py-3", children: [
            onDelete && /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", className: "mr-auto text-destructive-foreground", onClick: onDelete, children: "Delete" }),
            /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", className: onDelete ? void 0 : "ml-auto", onClick: onClose, children: "Cancel" }),
            /* @__PURE__ */ jsxs(Button, { type: "submit", loading: busy, disabled: !ready, children: [
              "Save",
              /* @__PURE__ */ jsx(Kbd, { className: "-me-1 bg-primary-foreground/16 text-primary-foreground/80", children: "\u2318\u21B5" })
            ] })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(AlertDialog, { open: asking, onOpenChange: (o) => !o && setAsking(false), children: /* @__PURE__ */ jsxs(AlertDialogPopup, { initialFocus: keep, children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: prompt ? "Discard your changes?" : "Discard this prompt?" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { children: prompt ? `What you changed in \u201C${prompt.title}\u201D is lost.` : "What you wrote is lost. It isn't saved anywhere yet." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogClose, { ref: keep, render: /* @__PURE__ */ jsx(Button, { variant: "ghost" }), children: "Keep editing" }),
        /* @__PURE__ */ jsx(Button, { variant: "destructive", onClick: onClose, children: "Discard" })
      ] })
    ] }) })
  ] });
}

// ../plugins/prompts/src/index.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var SCREEN = "prompt-library";
var index_default = definePlugin((berth) => {
  berth.addScreen({ id: SCREEN, title: "Prompts", Component: Library });
  berth.addSidebarItem({ id: "prompts", title: "Prompts", icon: "BookMarked", screen: SCREEN });
  berth.addCommand({ id: "open", title: "Open the prompt library", group: "Prompts", run: () => berth.openScreen(SCREEN) });
  void berth.prompts.load();
});
function useLibrary(berth) {
  return useSyncExternalStore(berth.prompts.subscribe, berth.prompts.list);
}
function Marked({ text }) {
  const parts = text.split(/(\{\{\s*[a-zA-Z_][\w.-]*\s*\}\})/g);
  return /* @__PURE__ */ jsx2(Fragment, { children: parts.map(
    (p, i) => i % 2 ? /* @__PURE__ */ jsx2("span", { className: "rounded-[3px] bg-info/10 px-0.5 font-mono text-[0.95em] text-info-foreground", children: p }, i) : p
  ) });
}
function Library({ berth }) {
  const prompts = useLibrary(berth);
  const projects = useProjects2();
  const [query, setQuery] = useState2("");
  const [picked, setPicked] = useState2([]);
  const [editing, setEditingState] = useState2();
  const [deleting, setDeleting] = useState2();
  const opener = useRef2(null);
  const setEditing = (p) => {
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
  const tags = useMemo2(() => [...new Set(prompts.flatMap((p) => p.tags))].sort(), [prompts]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = prompts.filter((p) => picked.every((t) => p.tags.includes(t)) && words.every((w) => `${p.title} ${p.tags.join(" ")} ${p.body}`.toLowerCase().includes(w)));
  const projectName = (id) => projects.find((p) => p.id === id)?.name ?? id;
  const missingStarters = berth.prompts.starters.filter((s) => !prompts.some((p) => p.id === s.id));
  const save = (next) => berth.prompts.save(next).catch((err) => berth.notify("Couldn't save the prompt library", err instanceof Error ? err.message : String(err)));
  const duplicate = (p) => {
    const copy = { ...p, id: berth.prompts.newId(), title: `${p.title} (copy)`, uses: 0, last_used: void 0, updated: (/* @__PURE__ */ new Date()).toISOString() };
    const i = prompts.indexOf(p);
    void save([...prompts.slice(0, i + 1), copy, ...prompts.slice(i + 1)]);
  };
  return /* @__PURE__ */ jsxs2("div", { children: [
    /* @__PURE__ */ jsx2(
      ViewHeader,
      {
        title: "Prompts",
        description: /* @__PURE__ */ jsxs2(Fragment, { children: [
          "Prompts you send agents again and again. Send one from ",
          /* @__PURE__ */ jsx2("b", { className: "font-medium text-foreground", children: "\u2318K" }),
          " or a pane's menu, or to several agents at once."
        ] }),
        actions: /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsxs2(Button2, { size: "sm", variant: "outline", onClick: () => berth.prompts.openBroadcast(), children: [
            /* @__PURE__ */ jsx2(Icon2, { name: "Users" }),
            "Send to several\u2026"
          ] }),
          /* @__PURE__ */ jsxs2(Button2, { size: "sm", onClick: () => setEditing("new"), children: [
            /* @__PURE__ */ jsx2(Icon2, { name: "Plus" }),
            "New prompt"
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxs2("div", { children: [
      /* @__PURE__ */ jsxs2("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsx2(Input2, { className: "w-64", size: "sm", placeholder: "Search prompts\u2026", "aria-label": "Search prompts", value: query, onChange: (e) => setQuery(e.target.value) }),
        /* @__PURE__ */ jsx2("div", { className: "flex flex-wrap items-center gap-1", role: "group", "aria-label": "Tags", children: tags.map((t) => /* @__PURE__ */ jsx2(FilterChip, { pressed: picked.includes(t), onPressedChange: (on) => setPicked((ps) => on ? [...ps, t] : ps.filter((x) => x !== t)), children: t }, t)) }),
        missingStarters.length > 0 && !starters && /* @__PURE__ */ jsxs2(Button2, { size: "xs", variant: "ghost", className: "ml-auto text-muted-foreground", onClick: () => void save([...prompts, ...missingStarters]), children: [
          "Add the starter prompts back (",
          missingStarters.length,
          ")"
        ] })
      ] }),
      starters && /* @__PURE__ */ jsx2("p", { className: "mb-4 rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-xs", children: "These are starters to get going. Edit them, delete them, or add your own; the library is kept on this laptop, for every window." }),
      shown.length === 0 ? /* @__PURE__ */ jsx2(Empty, { className: "rounded-xl border py-16", children: /* @__PURE__ */ jsxs2(EmptyHeader, { children: [
        /* @__PURE__ */ jsx2(Icon2, { name: "BookMarked", className: "mx-auto mb-2 size-5 text-muted-foreground" }),
        /* @__PURE__ */ jsx2(EmptyTitle, { children: prompts.length ? "Nothing matches" : "No saved prompts" }),
        /* @__PURE__ */ jsx2(EmptyDescription, { children: prompts.length ? "Try another search or tag." : "Save the prompts you keep typing, with {{variables}} for what changes." })
      ] }) }) : /* @__PURE__ */ jsx2("div", { className: "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3", children: shown.map((p) => /* @__PURE__ */ jsxs2(
        "article",
        {
          role: "button",
          tabIndex: 0,
          onClick: () => setEditing(p),
          onKeyDown: (e) => e.key === "Enter" && e.target === e.currentTarget && setEditing(p),
          className: "group flex min-w-0 cursor-pointer flex-col rounded-xl border bg-card p-3.5 outline-none transition-colors hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring",
          children: [
            /* @__PURE__ */ jsxs2("div", { className: "flex min-w-0 items-start gap-2", children: [
              /* @__PURE__ */ jsx2("h3", { className: "min-w-0 flex-1 truncate font-medium text-sm", children: p.title }),
              /* @__PURE__ */ jsx2("span", { onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs2(Menu2, { children: [
                /* @__PURE__ */ jsx2(
                  MenuTrigger2,
                  {
                    render: /* @__PURE__ */ jsx2("button", { type: "button", "aria-label": `More for ${p.title}`, className: "-my-1 -me-1 inline-flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100" }),
                    children: /* @__PURE__ */ jsx2(Icon2, { name: "Ellipsis", className: "size-3.5" })
                  }
                ),
                /* @__PURE__ */ jsxs2(MenuPopup2, { align: "end", className: "min-w-44", children: [
                  /* @__PURE__ */ jsxs2(MenuItem2, { onClick: () => berth.prompts.openPicker({ promptId: p.id }), children: [
                    /* @__PURE__ */ jsx2(Icon2, { name: "Send" }),
                    "Send to an agent\u2026"
                  ] }),
                  /* @__PURE__ */ jsxs2(MenuItem2, { onClick: () => berth.prompts.openBroadcast({ promptId: p.id }), children: [
                    /* @__PURE__ */ jsx2(Icon2, { name: "Users" }),
                    "Send to several\u2026"
                  ] }),
                  /* @__PURE__ */ jsx2(MenuSeparator, {}),
                  /* @__PURE__ */ jsxs2(MenuItem2, { onClick: () => setEditing(p), children: [
                    /* @__PURE__ */ jsx2(Icon2, { name: "Pencil" }),
                    "Edit"
                  ] }),
                  /* @__PURE__ */ jsxs2(MenuItem2, { onClick: () => duplicate(p), children: [
                    /* @__PURE__ */ jsx2(Icon2, { name: "Copy" }),
                    "Duplicate"
                  ] }),
                  /* @__PURE__ */ jsxs2(MenuItem2, { variant: "destructive", onClick: () => setDeleting(p), children: [
                    /* @__PURE__ */ jsx2(Icon2, { name: "Trash2" }),
                    "Delete\u2026"
                  ] })
                ] })
              ] }) })
            ] }),
            /* @__PURE__ */ jsx2("p", { className: "mt-1.5 line-clamp-4 whitespace-pre-line break-words text-muted-foreground text-xs leading-relaxed", children: /* @__PURE__ */ jsx2(Marked, { text: p.body }) }),
            /* @__PURE__ */ jsxs2("footer", { className: "mt-auto flex min-w-0 items-center gap-1 pt-3", children: [
              p.project && /* @__PURE__ */ jsx2(Badge, { size: "sm", variant: "info", className: "max-w-32 truncate", title: `Only offered in ${projectName(p.project)}`, children: projectName(p.project) }),
              p.tags.map((t) => /* @__PURE__ */ jsx2(Badge, { size: "sm", variant: "secondary", children: t }, t)),
              !!p.uses && /* @__PURE__ */ jsx2("span", { className: "ml-1 text-[11px] text-muted-foreground tabular-nums", children: p.uses === 1 ? "used once" : `used ${p.uses}\xD7` }),
              /* @__PURE__ */ jsx2("span", { className: "ml-auto", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx2(Button2, { size: "xs", variant: "ghost", className: "h-6 text-[11px]", onClick: () => berth.prompts.openPicker({ promptId: p.id }), children: "Send\u2026" }) })
            ] })
          ]
        },
        p.id
      )) })
    ] }),
    editing && /* @__PURE__ */ jsx2(
      EditSheet,
      {
        berth,
        prompt: editing === "new" ? void 0 : editing,
        tags,
        onClose: () => setEditing(void 0),
        onSave: async (p) => {
          const has = prompts.some((x) => x.id === p.id);
          await berth.prompts.save(has ? prompts.map((x) => x.id === p.id ? p : x) : [p, ...prompts]);
          setEditing(void 0);
        },
        onDelete: editing === "new" ? void 0 : () => setDeleting(editing)
      }
    ),
    /* @__PURE__ */ jsx2(AlertDialog2, { open: !!deleting, onOpenChange: (o) => !o && setDeleting(void 0), children: /* @__PURE__ */ jsxs2(AlertDialogPopup2, { children: [
      /* @__PURE__ */ jsxs2(AlertDialogHeader2, { children: [
        /* @__PURE__ */ jsxs2(AlertDialogTitle2, { children: [
          "Delete \u201C",
          deleting?.title,
          "\u201D?"
        ] }),
        /* @__PURE__ */ jsx2(AlertDialogDescription2, { children: "It goes from the library on this laptop. Prompts already sent are not affected." })
      ] }),
      /* @__PURE__ */ jsxs2(AlertDialogFooter2, { children: [
        /* @__PURE__ */ jsx2(AlertDialogClose2, { render: /* @__PURE__ */ jsx2(Button2, { variant: "ghost" }), children: "Cancel" }),
        /* @__PURE__ */ jsx2(
          Button2,
          {
            variant: "destructive",
            onClick: () => {
              const id = deleting?.id;
              setDeleting(void 0);
              setEditing(void 0);
              void save(prompts.filter((p) => p.id !== id));
            },
            children: "Delete"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Marked,
  SCREEN,
  index_default as default,
  useLibrary
};
