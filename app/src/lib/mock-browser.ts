import { mockAgentDevtools } from "@/lib/mock-devtools";

// The demo's agent browser: the checkout-fix worktree on devl has one open,
// cast as a drawing of the shop's cart page, with two shots for Review.

const svg = (count: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
<rect width="1280" height="800" fill="#f8fafc"/><rect width="1280" height="64" fill="#0f172a"/>
<text x="40" y="41" font-family="system-ui" font-size="22" fill="#fff">acme shop</text>
<text x="40" y="140" font-family="system-ui" font-size="40" font-weight="700" fill="#0f172a">Cart</text>
<rect x="40" y="180" width="760" height="96" rx="12" fill="#fff" stroke="#e2e8f0"/>
<text x="64" y="236" font-family="system-ui" font-size="22" fill="#334155">Ceramic mug × ${count}</text>
<rect x="40" y="320" width="220" height="56" rx="10" fill="#6366f1"/><text x="76" y="356" font-family="system-ui" font-size="22" fill="#fff">Checkout</text>
<text x="40" y="440" font-family="system-ui" font-size="18" fill="#64748b">The agent's browser on devl</text></svg>`;

export const mockShotSvg = () => svg(2);

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export async function mockScreencast(onValue: (v: unknown) => void, signal?: AbortSignal) {
  for (let i = 1; !signal?.aborted; i++) {
    onValue({ data: b64(svg((i % 3) + 1)), mime: "image/svg+xml", w: 1280, h: 800, url: "http://checkout-fix.shop.devl.localhost:1377/cart" });
    await new Promise((r) => setTimeout(r, 1200));
  }
}

export function browserCall(box: string, method: string, path: string): unknown {
  if (box !== "devl" || !path.includes("/browser/")) return undefined;
  if (method === "GET" && path === "worktrees/shop/checkout-fix/browser/status")
    return { running: true, text: "open: http://checkout-fix.shop.devl.localhost:1377/cart (312 MB)", status: { url: "http://checkout-fix.shop.devl.localhost:1377/cart", rss_bytes: 312 << 20 } };
  if (method === "GET" && path.endsWith("/browser/status")) return { running: false, text: "no browser open" };
  if (method === "GET" && path === "worktrees/shop/checkout-fix/browser/devtools") return mockAgentDevtools;
  if (method === "GET" && path.endsWith("/browser/devtools")) return { running: false, console: [], failures: [] };
  return undefined;
}
