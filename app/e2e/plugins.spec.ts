import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated plugin lifecycle and discovery"));

for (const failure of ["transient", "unsupported"] as const) {
  test(`built-in startup recovers from a ${failure} plugin catalog failure`, async ({ app }) => {
    const agent = await fakeAgent();
    let requests = 0;
    await app.context.route(`${agent.url}/v1/plugins`, (route) => {
      requests++;
      return route.fulfill(failure === "unsupported" ? { status: 404, json: { error: "Endpoint unsupported" } }
        : requests === 1 ? { status: 503, json: { error: "Temporary listing failure" } } : { json: [] });
    });
    await app.context.route("**/builtin-plugins/index.json", (route) => route.fulfill({ json: [{ id: "startup-fixture", name: "Startup fixture", version: "1.0.0", main: "index.js", builtin: true }] }));
    await app.context.route("**/builtin-plugins/startup-fixture/index.js", (route) => route.fulfill({ contentType: "text/javascript", body: "export default function(ctx) { ctx.addSidebarItem({id:'startup',title:'Startup fixture',screen:'startup'}); }" }));
    try {
      await app.open({ agent });
      await app.page.getByRole("button", { name: "More", exact: true }).click();
      await expect(app.page.getByRole("menuitem", { name: "Startup fixture", exact: true })).toBeVisible({ timeout: 2000 });
      expect(requests).toBe(failure === "transient" ? 2 : 1);
      if (failure === "unsupported") {
        await app.page.keyboard.press("Escape");
        const settings = await app.openSettings("plugins");
        await settings.getByRole("button", { name: "Reload", exact: true }).click();
        await expect(app.page.getByRole("alert", { name: "Plugin loading", exact: true })).toHaveCount(0);
        await app.page.getByRole("button", { name: "More", exact: true }).click();
        await expect(app.page.getByRole("menuitem", { name: "Startup fixture", exact: true })).toHaveCount(1);
      }
    } finally { await agent.close(); }
  });
}

test("built-in contributions register and GitHub Issues explains its machine prerequisites", async ({ app }) => {
  await app.open();
  const settings = await app.openSettings("plugins");
  for (const name of ["Computer monitor", "GitHub Issues", "Activity", "Notes", "Prompt library"]) await expect(settings.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(settings).not.toContainText("failed to load");
  await app.page.getByRole("button", { name: "More", exact: true }).click();
  await app.page.getByRole("menuitem", { name: "GitHub Issues", exact: true }).click();
  await expect(app.page.getByRole("heading", { name: "GitHub Issues", exact: true })).toBeVisible();
  await expect(app.page.getByText(/Requires a registered GitHub repository and gh signed in/)).toBeVisible();
  await expect(app.page.getByPlaceholder("Search issues")).toBeVisible();
});

test("plugin discovery failure is visible and Reload can recover", async ({ app }) => {
  const agent = await fakeAgent();
  let unavailable = true;
  await app.context.route(`${agent.url}/v1/plugins`, (route) => route.fulfill(unavailable
    ? { status: 503, json: { error: "Synthetic plugin listing unavailable" } }
    : { json: [] }));
  try {
    await app.open({ agent });
    const settings = await app.openSettings("plugins");
    await expect(settings.getByRole("alert")).toContainText("Synthetic plugin listing unavailable");
    await expect(settings).not.toContainText("No plugins yet");
    unavailable = false;
    await settings.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(settings.getByRole("alert")).toHaveCount(0);
    await expect(settings).toContainText("No plugins yet");
  } finally { await agent.close(); }
});

test("a failed plugin removes partial contributions and releases its module before reload", async ({ app }) => {
  const agent = await fakeAgent();
  let failing = true;
  await app.context.addInitScript(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    (window as Window & { revokedPluginModules?: number }).revokedPluginModules = 0;
    URL.revokeObjectURL = (url) => {
      const state = window as Window & { revokedPluginModules?: number };
      state.revokedPluginModules = (state.revokedPluginModules ?? 0) + 1;
      revoke(url);
    };
  });
  await app.context.route("**/builtin-plugins/index.json", (route) => route.fulfill({ json: [{ id: "fixture-plugin", name: "Fixture plugin", version: "1.0.0", main: "index.js", builtin: true }] }));
  await app.context.route("**/builtin-plugins/fixture-plugin/index.js", (route) => route.fulfill({ contentType: "text/javascript", body:
    `export default function(ctx) { ctx.addSidebarItem({id:'fixture',title:'Fixture contribution',screen:'fixture'}); ${failing ? "throw new Error('Synthetic registration failure');" : "return () => {};"} }`,
  }));
  try {
    await app.open({ agent });
    const settings = await app.openSettings("plugins");
    await expect(settings).toContainText("Synthetic registration failure");
    await expect(app.page.getByRole("button", { name: "Fixture contribution", exact: true })).toHaveCount(0);
    expect(await app.page.evaluate(() => (window as Window & { revokedPluginModules?: number }).revokedPluginModules ?? 0)).toBeGreaterThan(0);
    failing = false;
    await settings.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(settings).not.toContainText("Synthetic registration failure");
    await expect(settings.getByText("Sidebar: Fixture contribution", { exact: true })).toHaveCount(1);
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await expect(app.page.getByRole("menuitem", { name: "Fixture contribution", exact: true })).toHaveCount(1);
  } finally { await agent.close(); }
});

test("failed plugin discovery preserves active contributions and replacement ownership", async ({ app }) => {
  const agent = await fakeAgent();
  let unavailable = false;
  await app.context.route(`${agent.url}/v1/plugins`, (route) => route.fulfill(unavailable
    ? { status: 503, json: { error: "Synthetic listing lost" } }
    : { json: [{ id: "fixture-replaced", name: "User replacement", enabled: false, version: "1.0.0" }] }));
  await app.context.route("**/builtin-plugins/index.json", (route) => route.fulfill({ json: ["fixture-active", "fixture-replaced"].map((id) => ({ id, name: id, version: "1.0.0", main: "index.js", builtin: true })) }));
  await app.context.route("**/builtin-plugins/fixture-*/index.js", (route) => route.fulfill({ contentType: "text/javascript", body: `export default function(ctx) { ctx.addSidebarItem({id:'fixture',title:ctx.id,screen:'fixture'}); }` }));
  try {
    await app.open({ agent });
    const settings = await app.openSettings("plugins");
    await expect(settings.getByText("Sidebar: fixture-active", { exact: true })).toHaveCount(1);
    await expect(settings.getByText("Sidebar: fixture-replaced", { exact: true })).toHaveCount(0);
    unavailable = true;
    await settings.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(settings.getByRole("alert")).toContainText("Synthetic listing lost");
    await expect(settings.getByText("Sidebar: fixture-active", { exact: true })).toHaveCount(1);
    await expect(settings.getByText("Sidebar: fixture-replaced", { exact: true })).toHaveCount(0);
    unavailable = false;
    await settings.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(settings.getByRole("alert")).toHaveCount(0);
    await expect(settings.getByText("Sidebar: fixture-active", { exact: true })).toHaveCount(1);
  } finally { await agent.close(); }
});
