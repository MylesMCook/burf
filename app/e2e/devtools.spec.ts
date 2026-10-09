import { readFileSync } from "node:fs";

import { type App, expect, mockOnly, test } from "./fixtures";

// The Browser tab's Console and Network drawer. Mock mode has no laptop
// proxy: the stand-in dev server below puts the proxy's own console script
// into the page a Browser tab's frame asks for with ?__berth_devtools=1, as
// the proxy does (internal/proxy/devtools.go), and the mock agent answers
// the proxy's request log (lib/mock-devtools.ts): ten requests, a 500 and a
// 404 among them.

const SCRIPT = readFileSync(new URL("../../internal/proxy/devtools.js", import.meta.url), "utf8");
const PROXIED = /^https?:\/\/[^/]+\.localhost:1377(?:\/|$)/;

// The acme shop's cart. Its errors are dispatched rather than thrown, so the
// test's own check for uncaught errors stays quiet; the script can't tell.
const PAGE = (script: boolean) => `<!doctype html><html><head>${script ? `<script>${SCRIPT}</script>` : ""}<title>Cart · acme</title></head>
<body style="font:15px system-ui"><h1>Cart</h1><p>Ceramic mug × 2</p><button id="pay">Pay</button>
<script>
console.log("cart ready", { items: 2, currency: "EUR" });
console.warn("Image with src /images/mug-ceramic.png has no width or height");
function renderTotal(cart) { try { return cart.summary.total; } catch (e) { return e; } }
const err = renderTotal({});
dispatchEvent(new ErrorEvent("error", { error: err, message: err.message, filename: location.origin + "/src/cart/summary.tsx", lineno: 42, colno: 17 }));
dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { promise: Promise.resolve(), reason: new Error("payment provider timed out") }));
document.getElementById("pay").onclick = () => console.error("checkout failed: 500");
</script></body></html>`;

test.beforeEach(async ({ app }) => {
  await app.context.route(PROXIED, (route) => {
    const flagged = new URL(route.request().url()).searchParams.has("__berth_devtools");
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE(flagged) });
  });
  await app.open();
});

async function openCart(app: App) {
  await app.openWorktree("devl/checkout-fix");
  await app.page.getByRole("button", { name: "New tab" }).click();
  await app.page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = app.page.locator("[data-testid=browser-pane]:visible");
  const address = pane.getByRole("textbox", { name: "Address" });
  await address.fill("http://checkout-fix.shop.devl.localhost:1377/cart");
  await address.press("Enter");
  await expect(pane.frameLocator("iframe").getByRole("heading", { name: "Cart" })).toBeVisible();
  return pane;
}

test("a reload starts the console afresh, and a page outside the proxy has no request list", async ({ app }) => {
  mockOnly();
  const pane = await openCart(app);
  await expect(pane.getByTestId("devtools-badge")).toHaveText("4");
  await pane.getByTestId("devtools-toggle").click();
  const rows = pane.getByTestId("console-row");
  await expect(rows).toHaveCount(4);
  await pane.getByRole("button", { name: "Reload" }).click();
  await expect(pane.frameLocator("iframe").getByRole("heading", { name: "Cart" })).toBeVisible();
  // The same four, not eight: a new page's console.
  await expect(rows).toHaveCount(4);

  await app.context.route("http://localhost:4000/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>local</h1>" }));
  const address = pane.getByRole("textbox", { name: "Address" });
  await address.fill("http://localhost:4000/");
  await address.press("Enter");
  await expect(pane.locator("iframe")).toHaveAttribute("src", "http://localhost:4000/");
  await pane.getByTestId("devtools-drawer").getByRole("tab", { name: /Network/ }).click();
  await expect(pane.getByTestId("devtools-network")).toContainText("goes through Burf's proxy");
});

test("the agent's view has the agent's browser's console and failed requests", async ({ app }) => {
  mockOnly();
  const page = app.page;
  await app.openWorktree("devl/checkout-fix");
  await page.getByRole("button", { name: "New tab" }).click();
  await page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = page.locator("[data-testid=browser-pane]:visible");
  await pane.getByRole("button", { name: /Agent's view/ }).click();
  await pane.getByTestId("devtools-toggle").click();
  const drawer = pane.getByTestId("devtools-drawer");
  await expect(drawer).toContainText("The agent's browser, on its box");
  const rows = drawer.getByTestId("console-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("TypeError: Cannot read properties of undefined (reading 'total')");
  await expect(rows.nth(1)).toContainText("2");
  await drawer.getByRole("tab", { name: /Network/ }).click();
  await expect(drawer.locator("[data-testid=network-row][data-failed=true]")).toHaveCount(2);
  await expect(drawer.getByTestId("network-row").filter({ hasText: "/api/checkout" })).toContainText("500");
});
