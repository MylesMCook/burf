import assert from "node:assert/strict";
import test from "node:test";
import { chatPresentation } from "./chat-presentations.ts";

test("typed chart and table data are copied without arbitrary props", () => {
  const points = [1, 2, 3];
  const chart = chatPresentation({ type: "chart", id: "p1", label: "Builds", value: "3", points, dangerouslySetInnerHTML: { __html: "bad" } });
  assert.deepEqual(chart, { type: "chart", id: "p1", label: "Builds", value: "3", points });
  points.push(4);
  assert.equal(chart?.type === "chart" && chart.points.length, 3);
  assert.deepEqual(chatPresentation({ type: "table", id: "p2", columns: [{ key: "time", label: "Time", format: { kind: "number" } }], rows: [{ time: 4 }] })?.type, "table");
});

test("malformed and oversized tool payloads fall back to text", () => {
  for (const value of [null, { type: "html", id: "x" }, { type: "chart", id: "x", label: "x", value: "x", points: [Infinity] }, { type: "chart", id: "x", label: "x", value: "x", points: [] }, { type: "table", id: "x", columns: [{ key: "x", label: "x" }], rows: [{ x: { html: "bad" } }] }, { type: "form", id: "x", server: "Burf", message: "x", state: "request", fields: [{ name: "x", label: "x", kind: "password", value: "" }] }]) assert.equal(chatPresentation(value), undefined);
  assert.equal(chatPresentation({ type: "chart", id: "x", label: "x", value: "x", points: Array(257).fill(1) }), undefined);
});

test("form schema preserves only finite input kinds and authoritative settlement", () => {
  const form = { type: "form", id: "p3", server: "Burf", message: "Choose", state: "cancelled", fields: [{ name: "choice", label: "Choice", kind: "choice", options: ["One", "Two"], value: "One", required: true }] };
  assert.deepEqual(chatPresentation(form), form);
  assert.equal(chatPresentation({ ...form, fields: [...form.fields, ...form.fields] }), undefined);
  assert.equal(chatPresentation({ ...form, fields: [{ ...form.fields[0], value: "Other" }] }), undefined);
});
