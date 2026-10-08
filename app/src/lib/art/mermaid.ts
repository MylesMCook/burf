// A small reader for the Mermaid flowcharts agents write most: graph or
// flowchart, LR/RL/TD/TB/BT, nodes in [ ], ( ), [( )], (( )), { }, edges
// -->, ---, -.->, ==>, with labels (-- x -->, -->|x|, -. x .->). Other
// diagram types (sequence, class, gantt…) are shown as their source.
// Mermaid itself isn't bundled: its renderer is large and has had XSS bugs;
// this draws text only.

export type Shape = "box" | "round" | "store" | "circle" | "diamond";

export interface MNode {
  id: string;
  label: string;
  shape: Shape;
}

export interface MEdge {
  from: string;
  to: string;
  label?: string;
  dotted?: boolean;
  thick?: boolean;
  arrow: boolean;
}

export interface Flowchart {
  dir: "LR" | "TD";
  nodes: MNode[];
  edges: MEdge[];
}

const NODE = /^([A-Za-z0-9_][\w-]*)\s*(\[\((.+?)\)\]|\(\((.+?)\)\)|\{(.+?)\}|\[(.+?)\]|\((.+?)\))?/;
const EDGE = /^(.+?)\s*(-\.\s*(.+?)\s*\.->|-\.->|-\.-|==>\|(.+?)\||==\s*([^=|]+?)\s*==>|==>|--\s*([^->|]+?)\s*-->|-->\|(.+?)\||-->|---)\s*(.+)$/;

const clean = (s: string) => s.replace(/^["']|["']$/g, "").trim();

export function parseFlowchart(src: string): Flowchart | undefined {
  const lines = src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));
  const head = lines.shift() ?? "";
  const hm = /^(graph|flowchart)\b\s*(LR|RL|TD|TB|BT)?/i.exec(head);
  if (!hm) return undefined;
  const dir = /^(TD|TB|BT)$/i.test(hm[2] ?? "") ? "TD" : "LR";
  const nodes = new Map<string, MNode>();
  const edges: MEdge[] = [];
  const node = (s: string): string | undefined => {
    const m = NODE.exec(s.trim());
    if (!m) return undefined;
    const id = m[1];
    const label = m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7];
    const shape: Shape = m[3] ? "store" : m[4] ? "circle" : m[5] ? "diamond" : m[7] ? "round" : "box";
    const had = nodes.get(id);
    if (!had || label) nodes.set(id, { id, label: clean(label ?? had?.label ?? id), shape: label ? shape : (had?.shape ?? "box") });
    return id;
  };
  for (const raw of lines) {
    const l = raw.replace(/;$/, "");
    if (/^(classDef|class|style|linkStyle|click|subgraph|end|direction)\b/.test(l)) continue;
    // A chain, a --> b --> c, is read edge by edge.
    let rest = l;
    let from: string | undefined;
    let guard = 0;
    while (rest && guard++ < 20) {
      const m = EDGE.exec(rest);
      if (!m) {
        const id = node(rest);
        if (from && id) break;
        break;
      }
      const left = from ?? node(m[1]);
      const op = m[2];
      const label = m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7];
      // The right side may go on: b --> c.
      const next = EDGE.exec(m[8]);
      const rightText = next ? next[1] : m[8];
      const to = node(rightText);
      if (left && to) edges.push({ from: left, to, label: label ? clean(label) : undefined, dotted: op.startsWith("-."), thick: op.startsWith("=="), arrow: op !== "---" && op !== "-.-" });
      if (!next) break;
      from = to;
      rest = m[8];
    }
  }
  return { dir, nodes: [...nodes.values()], edges };
}

export interface Layout {
  pos: Record<string, { x: number; y: number }>;
  W: number;
  H: number;
  NW: number;
  NH: number;
  lr: boolean;
}

// layout puts nodes in layers along the flow (longest path from a root),
// ordered within a layer by where their parents are.
export function layoutFlowchart(g: Flowchart): Layout {
  const layer: Record<string, number> = {};
  for (const n of g.nodes) layer[n.id] = 0;
  for (let i = 0; i < g.nodes.length; i++) for (const e of g.edges) if (layer[e.to] <= layer[e.from] && !(e.dotted && layer[e.to] > 0)) layer[e.to] = Math.min(layer[e.from] + 1, g.nodes.length);
  const n = Math.max(0, ...Object.values(layer)) + 1;
  const cols: MNode[][] = Array.from({ length: n }, () => []);
  for (const node of g.nodes) cols[layer[node.id]].push(node);
  const at: Record<string, number> = {};
  cols.forEach((c, ci) => {
    if (ci > 0) {
      const bary = (x: MNode) => {
        const ps = g.edges.filter((e) => e.to === x.id && at[e.from] !== undefined).map((e) => at[e.from]);
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
      };
      c.sort((a, b) => bary(a) - bary(b));
    }
    c.forEach((x, i) => (at[x.id] = i - (c.length - 1) / 2));
  });
  const longest = Math.max(8, ...g.nodes.map((x) => Math.min(x.label.length, 24)));
  const NW = Math.round(longest * 6.8 + 28);
  const NH = 38;
  const GX = 64;
  const GY = 22;
  const maxRows = Math.max(1, ...cols.map((c) => c.length));
  const lr = g.dir === "LR";
  const W = lr ? n * NW + (n - 1) * GX : maxRows * NW + (maxRows - 1) * GX;
  const H = lr ? maxRows * NH + (maxRows - 1) * GY : n * NH + (n - 1) * GY * 2.5;
  const pos: Record<string, { x: number; y: number }> = {};
  cols.forEach((c, ci) =>
    c.forEach((x) => {
      const k = at[x.id];
      pos[x.id] = lr ? { x: ci * (NW + GX), y: H / 2 - NH / 2 + k * (NH + GY) } : { x: W / 2 - NW / 2 + k * (NW + GX), y: ci * (NH + GY * 2.5) };
    }),
  );
  return { pos, W, H, NW, NH, lr };
}
