import assert from "node:assert/strict";
import test from "node:test";

import { toolAsk } from "./chat-tools.ts";

test("a command is asked about as a command, with the command shown as it is", () => {
  assert.deepEqual(toolAsk("berth_exec\nlocation: shop/fix\n$ make deploy"), { tool: "berth_exec", question: "Run this command outside the sandbox?", what: "location: shop/fix\n$ make deploy" });
});

test("a tool this app has no words for is still named", () => {
  assert.deepEqual(toolAsk("berth_new_thing"), { tool: "berth_new_thing", question: "Allow Burf to use berth_new_thing?", what: "" });
});
