// node --experimental-strip-types --test src/lib/screen.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import { choicesIn, keysOnly, questionFormIn, screenAt } from "./screen.ts";

const RULE = "─".repeat(80);

// Claude Code 2.1's question form, as its screen shows it.
const threeQuestions = [
  "❯ Use the AskUserQuestion tool to ask me three questions at once",
  RULE,
  "←  ☐ Colour  ☐ Toppings  ☐ Pet name  ✔ Submit  →",
  "",
  "Pick a colour:",
  "",
  "❯ 1. Red",
  "     The colour red",
  "  2. Green",
  "     The colour green",
  "  3. Blue",
  "     The colour blue",
  "  4. Type something.",
  RULE,
  "  5. Chat about this",
  "",
  "Enter to select · Tab/Arrow keys to navigate · Esc to cancel",
  "",
].join("\n");

const oneQuestion = [
  "❯ Ask me tea or coffee",
  RULE,
  " ☐ Drink            ",
  "",
  "Tea or coffee?",
  "",
  "❯ 1. Tea",
  "     A cup of tea",
  "  2. Coffee",
  "     A cup of coffee",
  "  3. Type something.",
  RULE,
  "  4. Chat about this",
  "",
  "Enter to select · ↑/↓ to navigate · Esc to cancel",
].join("\n");

const severalPicks = [
  RULE,
  "←  ☐ Fruits  ✔ Submit  →",
  "",
  "Which fruits?",
  "",
  "❯ 1. [ ] Apple",
  "  2. [ ] Pear",
  "  3. [ ] Type something",
  "     Submit",
  RULE,
  "  4. Chat about this",
  "",
  "Enter to select · ↑/↓ to navigate · Esc to cancel",
].join("\n");

test("a form of several questions isn't one number's to answer", () => {
  assert.equal(questionFormIn(threeQuestions), true);
  assert.deepEqual(choicesIn(threeQuestions), []);
  assert.equal(questionFormIn(severalPicks), true);
  assert.deepEqual(choicesIn(severalPicks), []);
  // Still the agent's own screen: the live terminal can open on it.
  assert.equal(screenAt("claude", threeQuestions), "interactive");
});

test("one question with one pick still answers by number", () => {
  assert.equal(questionFormIn(oneQuestion), false);
  assert.deepEqual(
    choicesIn(oneQuestion)
      .slice(0, 3)
      .map((c) => `${c.key}. ${c.label}`),
    ["1. Tea", "2. Coffee", "3. Type something."],
  );
});

test("a permission prompt is a menu, not a form", () => {
  const perm = ["Bash command", "  rm -rf build", "Do you want to proceed?", "❯ 1. Yes", "  2. No, and tell Claude what to do differently (esc)", "", "Esc to cancel"].join("\n");
  assert.equal(questionFormIn(perm), false);
  assert.equal(choicesIn(perm).length, 2);
});

test("answers in the conversation above the prompt aren't a form", () => {
  const done = ["⏺ User answered Claude's questions:", "  ⎿  · Pick a colour: → Green", RULE, "❯ ", RULE, "  ⏵⏵ auto mode on"].join("\n");
  assert.equal(questionFormIn(done), false);
});

test("a trust question is answered with keys, never a word", () => {
  const trust = ["", " Accessing workspace:", "", " /w/shop-fix", "", " Quick safety check: Is this a project you created or one you trust?", "", " ❯ No, exit", "   Yes, I trust this folder", "", " Enter to confirm · Esc to cancel", ""].join("\n");
  assert.equal(keysOnly(trust), true);
  // Numbered, as older Claude Code asks it: its options answer it.
  const numbered = [" Do you trust the files in this folder?", "", " ❯ 1. Yes, proceed", "   2. No, exit", "", " Enter to confirm · Esc to exit"].join("\n");
  assert.equal(keysOnly(numbered), false);
  assert.equal(keysOnly("Overwrite the lockfile? (y/n)"), false);
});

test("Codex folder access is an interactive menu, not its message prompt", () => {
  const trust = ["Folder access", "/w/shop-fix", "Trust this folder? Codex can read, edit, and run files here.", "", "› 1. Trust and continue", "  2. Back to Agent Command Center", "", "  enter continue · esc back", ""].join("\n");
  assert.equal(screenAt("codex", trust), "interactive");
  assert.equal(screenAt("codex", trust.replace("  enter continue · esc back", "")), "interactive");
  assert.equal(screenAt("codex", "Pick a model\n› gpt-example\n  enter continue · esc back"), "interactive");
  assert.equal(screenAt("codex", "› explain enter continue in this sentence"), "prompt");
  assert.equal(screenAt("codex", "› \n  ? for shortcuts"), "prompt");
  assert.equal(screenAt("codex", "1. First result\n2. Second result\n› \n  ? for shortcuts"), "prompt");
  assert.equal(screenAt("codex", "› 1. First result\n  2. Second result\n› \n  ? for shortcuts"), "prompt");
});
