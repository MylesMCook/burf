import { useId, useMemo } from "react";

import type { ViewProps } from "@/components/art/kinds";
import SourceView from "@/components/art/views/source-view";
import { layoutFlowchart, parseFlowchart } from "@/lib/art/mermaid";
import { cn } from "@/lib/utils";

// A diagram: a Mermaid flowchart drawn by Berth in the theme (lib/art/
// mermaid.ts); any other Mermaid diagram as its source, said so.
export default function DiagramView(props: ViewProps) {
  const { body, size, height } = props;
  const g = useMemo(() => parseFlowchart(body), [body]);
  const layout = useMemo(() => (g ? layoutFlowchart(g) : undefined), [g]);
  const arrow = `art-arrow-${useId().replace(/:/g, "")}`;
  if (!g || !layout || !g.nodes.length)
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {size === "full" && <p className="text-muted-foreground text-xs">Berth draws Mermaid flowcharts (graph or flowchart); this one is shown as written.</p>}
        <SourceView {...props} />
      </div>
    );
  const thumb = size === "thumb";
  const { pos, W, H, NW, NH, lr } = layout;
  const pad = 14;
  return (
    <div className={cn("flex w-full items-center justify-center", thumb ? "pointer-events-none" : "h-full")} style={thumb ? { height: height ?? 120 } : undefined} data-art-diagram>
      <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} className="h-full max-h-full w-full max-w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Diagram: ${g.nodes.map((n) => n.label).join(", ")}`}>
        <defs>
          <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--chart-foreground-muted)" />
          </marker>
        </defs>
        {g.edges.map((e, i) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const [x0, y0, x1, y1] = lr ? [a.x + NW, a.y + NH / 2, b.x - 2, b.y + NH / 2] : [a.x + NW / 2, a.y + NH, b.x + NW / 2, b.y - 2];
          const back = lr ? x1 < x0 : y1 < y0;
          const d = back ? `M${x0},${y0} C${x0 + 60},${y0 + 70} ${x1 - 60},${y1 + 70} ${x1},${y1}` : lr ? `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}` : `M${x0},${y0} C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`;
          return (
            <g key={i} className="art-edge" style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}>
              <path d={d} fill="none" stroke="var(--chart-foreground-muted)" strokeOpacity={thumb ? 0.9 : 0.75} strokeWidth={(thumb ? 2.4 : 1.4) * (e.thick ? 1.7 : 1)} strokeDasharray={e.dotted ? "4 4" : undefined} markerEnd={e.arrow ? `url(#${arrow})` : undefined} />
              {e.label && !thumb && (
                <g transform={`translate(${(x0 + x1) / 2}, ${(y0 + y1) / 2})`}>
                  <rect x={-e.label.length * 3.3 - 6} y={-9} width={e.label.length * 6.6 + 12} height={18} rx={9} fill="var(--background)" stroke="var(--border)" />
                  <text textAnchor="middle" dy="0.32em" className="art-tick">
                    {e.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {g.nodes.map((n, i) => {
          const p = pos[n.id];
          const store = n.shape === "store";
          const tint = store ? "var(--chart-3)" : n.shape === "diamond" ? "var(--chart-4)" : i === 0 ? "var(--chart-1)" : undefined;
          const r = n.shape === "round" || n.shape === "circle" ? NH / 2 : n.shape === "diamond" ? 4 : 8;
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`} className="art-node-g" style={{ animationDelay: `${Math.min(i * 50, 600)}ms` }}>
              <rect width={NW} height={NH} rx={r} fill={tint ? `color-mix(in oklab, ${tint} ${thumb ? 30 : 16}%, var(--card))` : "var(--card)"} stroke={tint ? `color-mix(in oklab, ${tint} 60%, var(--border))` : "var(--border)"} strokeWidth={thumb ? 2 : 1.2} />
              {store && <path d={`M8,7 Q${NW / 2},15 ${NW - 8},7`} fill="none" stroke={`color-mix(in oklab, ${tint} 60%, var(--border))`} strokeWidth={1.1} />}
              <text x={NW / 2} y={NH / 2 + (store ? 3 : 0)} textAnchor="middle" dy="0.34em" className="art-node" fontWeight={500}>
                {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
