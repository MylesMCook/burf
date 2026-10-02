// Fails when an interactive element carries the HTML title attribute.
//
// A title tooltip shows late, in the operating system's style, and never
// for keyboard users; the app's own tooltip (components/tip.tsx, or coss
// Tooltip in plugins) shows on hover and on focus alike. Buttons, links,
// inputs, menu items and anything clickable or focusable use that instead.
//
// A title on plain text (a truncated path in a <span> or <code>, say) is
// left alone: it is a fallback for reading the whole text, and nothing
// else on the page depends on it.
//
// Component props named title (<SettingsGroup title=…>, <DialogTitle>) are
// not attributes and are not checked: only lower-case elements and the UI
// kit's interactive components below are.
//
//   node scripts/check-titles.mjs     check app/src and the built-in plugins
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const app = resolve(import.meta.dirname, "..");
const roots = [join(app, "src"), resolve(app, "..", "plugins")];

// Elements that are interactive by themselves.
const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea", "summary", "details", "label", "option"]);
// The UI kit's components that render one of those, or take focus.
const INTERACTIVE_COMPONENTS = new Set([
  "Button",
  "Input",
  "InputGroupInput",
  "Textarea",
  "Toggle",
  "ToggleGroupItem",
  "TabsTab",
  "Checkbox",
  "Switch",
  "MenuItem",
  "MenuCheckboxItem",
  "MenuRadioItem",
  "MenuSubTrigger",
  "MenuTrigger",
  "ContextMenuItem",
  "SidebarMenuButton",
  "SidebarMenuSubButton",
  "SidebarMenuAction",
  "PopoverTrigger",
  "DialogTrigger",
  "SelectTrigger",
  "FilterChip",
]);
// Attributes that make any element interactive.
const INTERACTIVE_ATTRS = new Set(["onClick", "onDoubleClick", "onKeyDown", "href", "tabIndex"]);
const INTERACTIVE_ROLES = new Set(["button", "link", "tab", "menuitem", "option", "checkbox", "radio", "switch"]);

// Files that may still carry a title on an interactive element, with why.
// Keep it empty unless there is no way round it, and take a file out once
// it is fixed.
const ALLOW = new Map([]);

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.name.endsWith(".tsx")) yield p;
  }
}

const attrName = (a) => (ts.isJsxAttribute(a) ? a.name.getText() : undefined);

function interactive(node) {
  const tag = node.tagName.getText();
  if (INTERACTIVE_TAGS.has(tag) || INTERACTIVE_COMPONENTS.has(tag)) return true;
  // A component's other props are its own business: title may be a heading.
  if (!/^[a-z]/.test(tag)) return false;
  for (const a of node.attributes.properties) {
    const name = attrName(a);
    if (!name) continue;
    if (INTERACTIVE_ATTRS.has(name)) return true;
    if (name === "role" && a.initializer && ts.isStringLiteral(a.initializer) && INTERACTIVE_ROLES.has(a.initializer.text)) return true;
  }
  return false;
}

const problems = [];
for (const root of roots) {
  for await (const file of files(root)) {
    const rel = relative(app, file);
    if (ALLOW.has(rel)) continue;
    const text = await readFile(file, "utf8");
    const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.attributes.properties.some((a) => attrName(a) === "title") && interactive(node)) {
        const { line } = src.getLineAndCharacterOfPosition(node.getStart());
        problems.push(`${rel}:${line + 1}  <${node.tagName.getText()} title=…>`);
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
}

if (problems.length) {
  console.error(`title= on interactive elements; use <Tip label=…> (components/tip.tsx) or Tooltip instead:\n\n  ${problems.join("\n  ")}\n`);
  process.exit(1);
}
console.log("check-titles: no title= on interactive elements");
