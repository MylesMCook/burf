// greet makes the page's greeting: "Hello, world!" without a name.
export function greet(name) {
  const who = String(name ?? "").trim() || "world";
  return `Hello, ${who}!`;
}
