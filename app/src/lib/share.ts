// share returns next with prev's objects and arrays wherever they are equal
// to next's, so what a refresh didn't change keeps its identity: a box's
// locations fetched again are the same objects unless one changed, and a
// row drawn from one (React.memo) is left alone. When nothing changed it is
// prev itself. Plain JSON only: anything else is taken from next as it is.
export function share<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (typeof prev !== "object" || typeof next !== "object" || prev === null || next === null) return next;
  if (Array.isArray(next)) {
    if (!Array.isArray(prev)) return next;
    let same = prev.length === next.length;
    const out = next.map((v, i) => {
      const s = share(prev[i], v);
      if (s !== prev[i]) same = false;
      return s;
    });
    return (same ? prev : out) as T;
  }
  if (Array.isArray(prev) || !plain(prev) || !plain(next)) return next;
  const p = prev as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const keys = Object.keys(n);
  let same = keys.length === Object.keys(p).length;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const s = share(p[k], n[k]);
    out[k] = s;
    if (s !== p[k] || !(k in p)) same = false;
  }
  return (same ? p : out) as T;
}

const plain = (o: object) => {
  const proto = Object.getPrototypeOf(o);
  return proto === Object.prototype || proto === null;
};
