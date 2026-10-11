import type { Route } from "@playwright/test";
import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test as base, type App } from "./fixtures";

const nativeOrigin = "http://wails.localhost:1434";
const capability = "0123456789abcdef0123456789abcdef";
const overlayModule = /(?:\/src\/native-feedback\/FeedbackOverlay\.tsx|\/assets\/FeedbackOverlay-[^/]+\.js|\/node_modules\/\.vite\/deps\/agentation\.js)(?:\?|$)/;
type Command = "native_feedback_status" | "native_feedback_enable" | "native_feedback_disable";

interface NativeHarness {
  status: { available: boolean; enabled: boolean; endpoint?: string };
  calls: Command[];
  assets: string[];
  feedbackCalls: string[];
  runtimeCalls: number;
  hold?: Command;
  release?: () => void;
  failure?: { command: Command; message: string; enabledAfter?: boolean };
  olderShell: boolean;
  statusFailure?: string;
  marker: boolean;
  open(origin?: string): Promise<void>;
}

function nativeCommand(value: unknown): Command | undefined {
  if (!value || typeof value !== "object" || !("object" in value) || value.object !== 0 || !("args" in value)) return;
  const call = value.args;
  if (!call || typeof call !== "object" || !("methodName" in call) || call.methodName !== "github.com/MylesMCook/burf/app/native/desktop.Service.Invoke" || !("args" in call) || !Array.isArray(call.args)) return;
  const command: unknown = call.args[0];
  if (command === "native_feedback_status" || command === "native_feedback_enable" || command === "native_feedback_disable") return command;
}

const test = base.extend<{ native: NativeHarness }>({
  native: async ({ app, baseURL }, use) => {
    mockOnly("synthetic main-window commands and isolated feedback routes");
    if (!baseURL) throw new Error("Native feedback checks require the configured frontend URL.");
    const agent = await fakeAgent();
    const endpoint = `${agent.url}/${capability}`;
    // Chromium treats the synthetic Wails host as a network origin. Grant
    // this isolated context access to its ephemeral loopback fixtures only.
    await app.context.grantPermissions(["local-network-access"], { origin: nativeOrigin });
    await app.context.grantPermissions(["local-network-access"], { origin: "http://foreign.localhost:1434" });
    const native: NativeHarness = {
      status: { available: true, enabled: false }, calls: [], assets: [], feedbackCalls: [], runtimeCalls: 0, olderShell: false, marker: true,
      async open(origin = nativeOrigin) {
        const url = new URL(origin);
        url.search = new URLSearchParams({ agent: agent.url, token: agent.token }).toString();
        await app.page.goto(url.toString());
        await expect(app.page.getByTestId("nav-home")).toBeVisible();
        await expect(app.page.getByTestId("nav-settings")).toBeEnabled({ timeout: 2500 });
      },
    };
    app.page.on("request", (request) => native.assets.push(request.url()));
    await app.context.addInitScript(() => {
      localStorage.setItem("berth.prefs", JSON.stringify({ whatsNewSeen: "999.0.0" }));
      Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });
    });
    // The real frontend and Wails JS runtime execute unchanged. This route
    // substitutes only their Go RPC peer and main-window asset origin.
    const rpc = async (route: Route) => {
      native.runtimeCalls++;
      const payload: unknown = route.request().postDataJSON();
      const command = nativeCommand(payload);
      if (command) {
        native.calls.push(command);
        if (native.hold === command) await new Promise<void>((resolve) => { native.release = resolve; });
        if (command === "native_feedback_status" && native.statusFailure) return route.fulfill({ status: 500, json: { kind: "RuntimeError", message: native.statusFailure } });
        if (native.olderShell || native.failure?.command === command) {
          if (native.failure?.enabledAfter !== undefined) native.status = { available: true, enabled: native.failure.enabledAfter, ...(native.failure.enabledAfter ? { endpoint } : {}) };
          return route.fulfill({ status: 500, json: { kind: "RuntimeError", message: native.olderShell ? "unknown desktop command" : native.failure?.message } });
        }
        if (command === "native_feedback_enable") native.status = { available: true, enabled: true, endpoint };
        if (command === "native_feedback_disable") native.status = { available: true, enabled: false };
        return route.fulfill({ json: native.status });
      }
      if (payload && typeof payload === "object" && "args" in payload && payload.args && typeof payload.args === "object" && "args" in payload.args && Array.isArray(payload.args.args)) {
        const command: unknown = payload.args.args[0];
        if (command === "ui_state") return route.fulfill({ json: { version: 1, storage: {}, fonts: [], images: [] } });
        if (command === "ui_endpoint") return route.fulfill({ json: { url: agent.url, token: agent.token } });
        if (command === "get_version") return route.fulfill({ json: "0.3.12" });
        if (command === "is_maximized" || command === "notification_permission") return route.fulfill({ json: false });
      }
      return route.fulfill({ json: null });
    };
    await app.context.route("**/wails/runtime", rpc);
    await app.context.route(`${endpoint}/**`, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.slice(capability.length + 1);
      native.feedbackCalls.push(`${request.method()} ${path}`);
      const headers = { "Access-Control-Allow-Origin": nativeOrigin, "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (path === "/health") return route.fulfill({ headers, json: { status: "ok", mode: "local" } });
      const session = { id: "synthetic-feedback-session", url: nativeOrigin, status: "active", createdAt: "2026-10-11T00:00:00.000Z", annotations: [] };
      if (path.endsWith("/events")) return route.fulfill({ headers, contentType: "text/event-stream", body: ": connected\n\n" });
      return route.fulfill({ headers, json: session });
    });
    for (const origin of [nativeOrigin, "http://foreign.localhost:1434"]) {
      await app.context.route(`${origin}/**`, async (route) => {
        if (new URL(route.request().url()).pathname === "/wails/runtime") return route.fallback();
        const requested = new URL(route.request().url());
        const response = await route.fetch({ url: new URL(requested.pathname + requested.search, baseURL).toString() });
        if (!response.headers()["content-type"]?.includes("text/html")) return route.fulfill({ response });
        const marker = native.marker ? "<script>window.__BURF_WAILS__=true;</script>" : "";
        return route.fulfill({ response, body: (await response.text()).replace("<head>", `<head>${marker}`) });
      });
    }
    try { await use(native); }
    finally {
      native.release?.();
      // Finish asset proxy handlers before Playwright disposes their fetched
      // responses with the context. Assertions still run against every route.
      await app.context.unrouteAll({ behavior: "wait" });
      await agent.close();
    }
  },
});

const toolbar = (app: App) => app.page.locator("[data-agentation-toolbar]");
const feedbackCalls = (native: NativeHarness, command: Command) => native.calls.filter((call) => call === command);

test("normal launch stays off without loading the annotation overlay", async ({ app, native }) => {
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeEnabled();
  await expect(toolbar(app)).toHaveCount(0);
  expect(native.assets.filter((url) => overlayModule.test(url))).toEqual([]);
  expect(native.feedbackCalls).toEqual([]);
  expect(feedbackCalls(native, "native_feedback_enable")).toEqual([]);
  expect(feedbackCalls(native, "native_feedback_status").length).toBeGreaterThan(0);
});

test("explicit enable waits once, mounts the real toolbar, and disable removes it", async ({ app, native }) => {
  await native.open();
  const settings = await app.openSettings("developer");
  const enable = settings.getByRole("button", { name: "Enable feedback", exact: true });
  native.hold = "native_feedback_enable";
  await enable.click();
  await expect.poll(() => feedbackCalls(native, "native_feedback_enable").length).toBe(1);
  await expect(enable).toBeDisabled();
  await expect(enable).toHaveAttribute("data-loading", "");
  await expect(toolbar(app)).toHaveCount(0);
  native.release?.();
  native.hold = undefined;
  await expect(toolbar(app)).toBeVisible();
  expect(native.assets.some((url) => overlayModule.test(url))).toBe(true);
  const disable = settings.getByRole("button", { name: "Disable feedback", exact: true });
  await expect(disable).toBeEnabled();
  native.hold = "native_feedback_disable";
  await disable.click();
  await expect.poll(() => feedbackCalls(native, "native_feedback_disable").length).toBe(1);
  await expect(disable).toBeDisabled();
  await expect(disable).toHaveAttribute("data-loading", "");
  native.release?.();
  await expect(toolbar(app)).toHaveCount(0);
  await expect(enable).toBeEnabled();
  expect(feedbackCalls(native, "native_feedback_enable")).toHaveLength(1);
  expect(native.status.enabled).toBe(false);
});

test("an enable failure remains visible and can be retried without losing the off state", async ({ app, native }) => {
  await native.open();
  const settings = await app.openSettings("developer");
  native.failure = { command: "native_feedback_enable", message: "The private feedback directory could not be opened." };
  await settings.getByRole("button", { name: "Enable feedback", exact: true }).click();
  await expect(settings.getByRole("alert")).toHaveText(native.failure.message);
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeEnabled();
  await expect(toolbar(app)).toHaveCount(0);
  native.failure = undefined;
  await settings.getByRole("button", { name: "Enable feedback", exact: true }).click();
  await expect(toolbar(app)).toBeVisible();
  await expect(settings.getByRole("alert")).toHaveCount(0);
});

test("an interrupted enable restores the actual enabled state before offering disable", async ({ app, native }) => {
  await native.open();
  const settings = await app.openSettings("developer");
  native.failure = { command: "native_feedback_enable", message: "The command response was interrupted.", enabledAfter: true };
  await settings.getByRole("button", { name: "Enable feedback", exact: true }).click();
  await expect(settings.getByRole("alert")).toHaveText(native.failure.message);
  await expect(settings.getByRole("button", { name: "Disable feedback", exact: true })).toBeEnabled();
  await expect(toolbar(app)).toBeVisible();
  expect(feedbackCalls(native, "native_feedback_enable")).toHaveLength(1);
});

for (const enabledAfter of [false, true]) {
  test(`a disable error restores the actual ${enabledAfter ? "enabled" : "disabled"} state`, async ({ app, native }) => {
    await native.open();
    const settings = await app.openSettings("developer");
    await settings.getByRole("button", { name: "Enable feedback", exact: true }).click();
    await expect(toolbar(app)).toBeVisible();
    native.failure = { command: "native_feedback_disable", message: "The disable response was interrupted.", enabledAfter };
    await settings.getByRole("button", { name: "Disable feedback", exact: true }).click();
    await expect(settings.getByRole("alert")).toHaveText(native.failure.message);
    await expect(settings.getByRole("button", { name: enabledAfter ? "Disable feedback" : "Enable feedback", exact: true })).toBeEnabled();
    if (enabledAfter) await expect(toolbar(app)).toBeVisible();
    else await expect(toolbar(app)).toHaveCount(0);
    expect(feedbackCalls(native, "native_feedback_disable")).toHaveLength(1);
  });
}

test("a foreign browser origin cannot query native feedback or load its overlay", async ({ app, native }) => {
  // A copied marker does not make a foreign origin a feedback main window.
  await native.open("http://foreign.localhost:1434");
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(settings).toContainText("Open Burf's desktop app to enable native feedback.");
  await expect(toolbar(app)).toHaveCount(0);
  expect(native.calls).toEqual([]);
  expect(native.assets.filter((url) => overlayModule.test(url))).toEqual([]);
  expect(native.feedbackCalls).toEqual([]);
});

test("a native-looking browser without the trusted marker has no feedback commands", async ({ app, native }) => {
  native.marker = false;
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(toolbar(app)).toHaveCount(0);
  expect(native.calls).toEqual([]);
  expect(native.feedbackCalls).toEqual([]);
  expect(native.runtimeCalls).toBe(0);
});

test("an embedded native-looking page cannot access the runtime or annotation overlay", async ({ app, native }) => {
  const parent = "http://foreign.localhost:1434/feedback-frame";
  const child = new URL(nativeOrigin);
  // The fake agent URL is already represented by the ui_endpoint fixture;
  // use the regular mock app here because this child must never call Invoke.
  child.search = "mock=1";
  await app.context.route(parent, (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><iframe title="Foreign browser pane" src="${child.toString()}"></iframe>` }));
  await app.page.goto(parent);
  const frame = app.page.frameLocator("iframe");
  await expect(frame.getByTestId("nav-home")).toBeVisible();
  await frame.getByTestId("nav-settings").click();
  await frame.getByTestId("settings-nav-developer").click();
  const settings = frame.getByTestId("settings-developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(frame.locator("[data-agentation-toolbar]")).toHaveCount(0);
  expect(native.runtimeCalls).toBe(0);
  expect(native.calls).toEqual([]);
  expect(native.feedbackCalls).toEqual([]);
  expect(native.assets.filter((url) => overlayModule.test(url))).toEqual([]);
});

test("an older desktop shell explains why native feedback is unavailable", async ({ app, native }) => {
  native.olderShell = true;
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("alert")).toHaveText("Update the Burf desktop shell to use native feedback.");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(toolbar(app)).toHaveCount(0);
  expect(feedbackCalls(native, "native_feedback_enable")).toEqual([]);
});

test("an unavailable native build gives a reason beside its disabled control", async ({ app, native }) => {
  native.status = { available: false, enabled: false };
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(settings).toContainText(/(?:unavailable|unsupported|Update the Burf desktop shell)/i);
  await expect(toolbar(app)).toHaveCount(0);
});

test("a transient status failure offers a guarded retry rather than requiring a shell update", async ({ app, native }) => {
  native.statusFailure = "The desktop connection was interrupted.";
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("alert")).toContainText("Could not check native feedback status.");
  await expect(settings).not.toContainText("Update the Burf desktop shell");
  const enable = settings.getByRole("button", { name: "Enable feedback", exact: true });
  await expect(enable).toBeDisabled();
  const retry = settings.getByRole("button", { name: "Retry status", exact: true });
  await expect(retry).toBeEnabled();
  native.statusFailure = undefined;
  native.hold = "native_feedback_status";
  const before = feedbackCalls(native, "native_feedback_status").length;
  await retry.click();
  await expect.poll(() => feedbackCalls(native, "native_feedback_status").length).toBe(before + 1);
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute("data-loading", "");
  await expect(enable).toBeDisabled();
  native.release?.();
  await expect(enable).toBeEnabled();
  await expect(settings.getByRole("alert")).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  expect(feedbackCalls(native, "native_feedback_enable")).toEqual([]);
  await expect(toolbar(app)).toHaveCount(0);
});

test("uncertain change and status responses block further mutations until actual status is restored", async ({ app, native }) => {
  await native.open();
  const settings = await app.openSettings("developer");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeEnabled();
  native.failure = { command: "native_feedback_enable", message: "The enable response was interrupted.", enabledAfter: true };
  native.statusFailure = "Status response was interrupted.";
  await settings.getByRole("button", { name: "Enable feedback", exact: true }).click();
  await expect(settings.getByRole("alert")).toContainText("Current feedback status could not be checked.");
  await expect(settings.getByRole("button", { name: "Enable feedback", exact: true })).toBeDisabled();
  await expect(toolbar(app)).toHaveCount(0);
  native.failure = undefined;
  native.statusFailure = undefined;
  await settings.getByRole("button", { name: "Retry status", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Disable feedback", exact: true })).toBeEnabled();
  await expect(toolbar(app)).toBeVisible();
  expect(feedbackCalls(native, "native_feedback_enable")).toHaveLength(1);
});
