// node --experimental-strip-types --test src/lib/screen.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import { choicesIn, questionFormIn, screenAt } from "./screen.ts";

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
