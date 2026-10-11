import assert from "node:assert/strict";
import test from "node:test";
import { skillDisplayName } from "./skill-display-name.ts";

test("only the seven built-in skill IDs receive Burf labels", () => {
  for (const [id, label] of [
    ["berth", "Burf"], ["berth-artifacts", "Burf artifacts"],
    ["berth-browser", "Burf browser"], ["berth-hooks", "Burf hooks"],
    ["berth-orchestrate", "Burf orchestration"], ["berth-preview", "Burf preview"],
    ["berth-visual-diff", "Burf visual diff"],
  ]) assert.equal(skillDisplayName(id), label);
  for (const custom of ["berth-custom", "My review skill", "toString", "__proto__", "constructor"])
    assert.equal(skillDisplayName(custom), custom);
});
