import { fakeAgent, type FakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

// A box on a slow link, relayed through a Tailscale server far away, stays
// online: the agent marks it slow (docs: concepts/laptop-agent#slow-and-dropping-networks),
// and the app says so quietly, never as offline, while requests to it go
// through. Settings › Boxes says why, and that Tailscale relays it.

let agent: FakeAgent;

test.beforeEach(async () => {
  mockOnly("runs on a stand-in agent");
  agent = await fakeAgent();
});

test.afterEach(async () => {
  await agent?.close();
});

const relayed = { via: "relay", relay: "nyc", relay_name: "New York", nearest: "London" };
const slow = { latency_ms: 1900, link: { slow: true, reason: "health check took 1.9s", max_ms: 1900, jitter_ms: 420, path: relayed } };

test("Settings › Boxes shows the latency, why the link is slow, and that Tailscale relays it", async ({ app }) => {
  agent.online = slow;
  await app.open({ agent });
  const boxes = await app.openSettings("boxes");
  await expect(boxes.getByText("Slow", { exact: true })).toBeVisible();
  const link = boxes.getByTestId("box-link");
  await expect(link).toContainText("Slow: health check took 1.9s. Burf stays connected, and requests still go through.");
  await expect(link).toContainText("Latency 1,900 ms.");
  const relay = boxes.getByTestId("box-relayed");
  await expect(relay).toContainText("Relayed through Tailscale's New York server: no direct connection (this computer's nearest is London).");
  await expect(relay.getByRole("button", { name: "Learn more" })).toBeVisible();
  // Online, so no Retry: it isn't reconnecting. (Burf's own "Retry build
  // check" is another button, for a box whose build could not be compared.)
  await expect(boxes.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);

  // Steady but still relayed: the latency, how high it went, and the relay.
  agent.online = { latency_ms: 80, link: { max_ms: 1900, path: relayed } };
  agent.event({ type: "box.link", data: { slow: false } });
  await expect(boxes.getByText("80 ms · up to 1,900 ms")).toBeVisible();
  await expect(boxes.getByTestId("box-link")).not.toContainText("Slow:");
  await expect(boxes.getByTestId("box-relayed")).toBeVisible();
});
