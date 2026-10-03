// ../plugins/notes/src/index.tsx
import { definePlugin, worktreeLocation } from "@berth/plugin";
import { Button, Icon, Spinner, Textarea, Tooltip, TooltipPopup, TooltipTrigger, cn } from "@berth/plugin/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var FILE = ".berth/notes.md";
var LIMIT = 4e4;
var index_default = definePlugin((berth) => {
  berth.addWorktreePanel({ id: "notes", title: "Notes", icon: "NotebookPen", Component: NotesPanel });
  berth.addCommand({ id: "open", title: "Open this worktree's notes", group: "Notes", run: () => berth.openPanel("notes") });
});
function toBase64(text) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function saveCommand(text) {
  return [
    "mkdir -p .berth",
    `printf %s '${toBase64(text)}' | base64 -d > ${FILE}.tmp && mv ${FILE}.tmp ${FILE}`,
    `x="$(git rev-parse --git-common-dir 2>/dev/null)/info/exclude"; [ -d "$(dirname "$x")" ] && { grep -qxF '${FILE}' "$x" 2>/dev/null || echo '${FILE}' >> "$x"; }; true`
  ].join(" && ");
}
function NotesPanel({ berth, box, location, worktree, main }) {
  const where = worktreeLocation({ location, worktree, main });
  const [text, setText] = useState("");
  const [state, setState] = useState("loading");
  const [error, setError] = useState();
  const timer = useRef(void 0);
  const latest = useRef("");
  const exec = useCallback((command) => berth.orchestrate.exec(box, where, command, "30s"), [berth, box, where]);
  useEffect(() => {
    let live = true;
    exec(`cat ${FILE} 2>/dev/null; true`).then((r) => {
      if (!live) return;
      setText(r.output);
      latest.current = r.output;
      setState("saved");
    }).catch((err) => {
      if (!live) return;
      setError(String(err?.message ?? err));
      setState("error");
    });
    return () => {
      live = false;
    };
  }, [exec]);
  const save = useCallback(async () => {
    const value = latest.current;
    setState("saving");
    try {
      const r = await exec(saveCommand(value));
      if (r.exit_code !== 0) throw new Error(r.output.trim() || `exit ${r.exit_code}`);
      setError(void 0);
      setState(latest.current === value ? "saved" : "unsaved");
      if (latest.current !== value) timer.current = setTimeout(() => void save(), 800);
    } catch (err) {
      setError(String(err.message ?? err));
      setState("error");
    }
  }, [exec]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onChange = (value) => {
    if (value.length > LIMIT) return;
    setText(value);
    latest.current = value;
    setState("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  };
  if (state === "loading") {
    return /* @__PURE__ */ jsxs("div", { className: "flex h-full items-center justify-center gap-2 text-muted-foreground text-sm", children: [
      /* @__PURE__ */ jsx(Spinner, { className: "size-4" }),
      " Opening notes\u2026"
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full min-h-0 flex-col", children: [
    /* @__PURE__ */ jsxs("header", { className: "flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs", children: [
      /* @__PURE__ */ jsx(Icon, { name: "NotebookPen", className: "size-3.5 text-muted-foreground" }),
      /* @__PURE__ */ jsx("span", { className: "font-medium text-sm", children: "Notes" }),
      /* @__PURE__ */ jsxs(Tooltip, { children: [
        /* @__PURE__ */ jsx(TooltipTrigger, { render: /* @__PURE__ */ jsx("span", { className: "cursor-help font-mono text-muted-foreground" }), children: FILE }),
        /* @__PURE__ */ jsxs(TooltipPopup, { className: "max-w-72", children: [
          "Kept in this worktree on ",
          box,
          " and never committed. Agents here can read it: ask them to check ",
          FILE,
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: cn("ml-auto", state === "error" ? "text-destructive" : "text-muted-foreground"), children: state === "saving" ? "Saving\u2026" : state === "unsaved" ? "Edited" : state === "error" ? "Not saved" : "Saved" }),
      state === "error" && /* @__PURE__ */ jsx(Button, { size: "xs", variant: "outline", onClick: () => void save(), children: "Retry" })
    ] }),
    error && /* @__PURE__ */ jsx("p", { className: "border-b bg-destructive/6 px-3 py-1.5 font-mono text-destructive text-xs", children: error }),
    /* @__PURE__ */ jsx(
      Textarea,
      {
        unstyled: true,
        spellCheck: false,
        value: text,
        onChange: (e) => onChange(e.target.value),
        onKeyDown: (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            clearTimeout(timer.current);
            void save();
          }
        },
        placeholder: `Plans, links, things to remember about ${worktree}\u2026

Agents working here can read this file too.`,
        className: "flex min-h-0 flex-1 font-mono text-[13px] leading-6 [&_textarea]:h-full [&_textarea]:resize-none [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:[field-sizing:fixed]"
      }
    )
  ] });
}
export {
  FILE,
  index_default as default,
  saveCommand
};
