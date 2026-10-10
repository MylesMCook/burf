import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { createChatSpeech } from "./chat-speech.ts";

function speechAPI(t: TestContext) {
  class Utterance extends EventTarget {
    text: string;
    constructor(text: string) { super(); this.text = text; }
  }
  const utterances: Utterance[] = [];
  let cancellations = 0;
  let playing: Utterance | undefined;
  let throwSpeak = false;
  let throwCancel = false;
  let immediateError = false;
  const synthesis = {
    speak(utterance: Utterance) {
      if (throwSpeak) throw new Error("audio unavailable");
      utterances.push(utterance);
      playing = utterance;
      if (immediateError) utterance.dispatchEvent(Object.assign(new Event("error"), { error: "synthesis-failed" }));
    },
    cancel() {
      cancellations++;
      if (throwCancel) throw new Error("cancel failed");
      playing = undefined;
    },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, "SpeechSynthesisUtterance");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance } });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalUtterance) Object.defineProperty(globalThis, "SpeechSynthesisUtterance", originalUtterance);
    else Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  });
  return {
    utterances,
    get playing() { return playing; },
    get cancellations() { return cancellations; },
    failSpeak() { throwSpeak = true; },
    failCancel() { throwCancel = true; },
    failImmediately() { immediateError = true; },
  };
}

test("new chat playback cancels the previous owner, and stale cleanup leaves the new owner playing", (t) => {
  const api = speechAPI(t);
  const first = createChatSpeech(() => assert.fail("unexpected error"))?.speak("first");
  assert.ok(first);
  let changes = 0;
  first.subscribe(() => changes++);
  const second = createChatSpeech(() => assert.fail("unexpected error"))?.speak("second");
  assert.ok(second);
  assert.deepEqual(first.status, { type: "ended", reason: "cancelled", error: undefined });
  assert.equal(changes, 1);
  assert.equal(api.cancellations, 1);
  first.cancel();
  first.cancel();
  assert.equal(api.cancellations, 1);
  assert.equal(api.playing?.text, "second");
  assert.equal(second.status.type, "running");
  second.cancel();
  second.cancel();
  assert.equal(api.cancellations, 2);
  assert.equal(api.playing, undefined);
  assert.equal(second.status.type, "ended");
});

test("finished utterance cleanup and late end events cannot cancel newer playback", (t) => {
  const api = speechAPI(t);
  const first = createChatSpeech(() => assert.fail("unexpected error"))?.speak("first");
  assert.ok(first);
  api.utterances[0]?.dispatchEvent(new Event("end"));
  const second = createChatSpeech(() => assert.fail("unexpected error"))?.speak("second");
  assert.ok(second);
  first.cancel();
  api.utterances[0]?.dispatchEvent(new Event("end"));
  assert.equal(api.cancellations, 0);
  assert.equal(api.playing?.text, "second");
  second.cancel();
});

test("async speech errors surface once and unsubscribe prevents later callbacks", (t) => {
  const api = speechAPI(t);
  let failures = 0;
  const first = createChatSpeech(() => failures++)?.speak("first");
  assert.ok(first);
  let notifications = 0;
  const unsubscribe = first.subscribe(() => notifications++);
  unsubscribe();
  const event = Object.assign(new Event("error"), { error: "synthesis-failed" });
  api.utterances[0]?.dispatchEvent(event);
  api.utterances[0]?.dispatchEvent(event);
  assert.equal(failures, 1);
  assert.equal(notifications, 0);
  assert.equal(first.status.type, "ended");
  first.cancel();
  assert.equal(api.cancellations, 0);
});

test("synchronous speak failure returns an ended handle without throwing", (t) => {
  const api = speechAPI(t);
  api.failSpeak();
  let failures = 0;
  const result = createChatSpeech(() => failures++)?.speak("first");
  assert.ok(result);
  assert.equal(result.status.type, "ended");
  assert.equal(failures, 1);
  assert.doesNotThrow(() => result.cancel());
});

test("error emitted inside native speak is surfaced immediately once", async (t) => {
  const api = speechAPI(t);
  api.failImmediately();
  let failures = 0;
  const result = createChatSpeech(() => failures++)?.speak("first");
  assert.ok(result);
  assert.equal(result.status.type, "ended");
  assert.equal(failures, 1);
  await Promise.resolve();
  assert.equal(failures, 1);
});

test("native cancellation failure is an ended error without a thrown page error", (t) => {
  const api = speechAPI(t);
  let failures = 0;
  const result = createChatSpeech(() => failures++)?.speak("first");
  assert.ok(result);
  api.failCancel();
  assert.doesNotThrow(() => result.cancel());
  assert.equal(result.status.type, "ended");
  assert.equal(failures, 1);
});

test("missing Web Speech APIs do not create an adapter", (t) => {
  speechAPI(t);
  Reflect.deleteProperty(globalThis, "window");
  assert.equal(createChatSpeech(() => assert.fail("unexpected error")), undefined);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  assert.equal(createChatSpeech(() => assert.fail("unexpected error")), undefined);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { speechSynthesis: {} } });
  assert.equal(createChatSpeech(() => assert.fail("unexpected error")), undefined);
});


test("a removed late subscription never runs after settlement", async (t) => {
  const api = speechAPI(t);
  const result = createChatSpeech(() => assert.fail("unexpected error"))?.speak("first");
  assert.ok(result);
  api.utterances[0]?.dispatchEvent(new Event("end"));
  let notifications = 0;
  const remove = result.subscribe(() => notifications++);
  remove();
  await Promise.resolve();
  assert.equal(notifications, 0);
  result.cancel();
  assert.equal(api.cancellations, 0);
});
