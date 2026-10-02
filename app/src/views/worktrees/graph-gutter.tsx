import type { GraphRow } from "@/views/worktrees/commit-graph";

// Rows have one height, so each row's slice of the graph meets the next.
export const ROW_H = 46;
const LANE_W = 14;
const PAD = 8;
// The dot sits on the subject line.
const DOT_Y = 15;

// Lane colours from the theme: the worktree's branch in the accent, the base
// muted, anything else from a small palette.
const PALETTE = ["var(--color-info)", "var(--color-muted-foreground)", "var(--color-success)", "var(--color-warning)", "var(--color-primary)", "var(--color-ring)"];
export const laneColor = (i: number) => PALETTE[i < 2 ? i : 2 + ((i - 2) % (PALETTE.length - 2))];

export const gutterWidth = (lanes: number) => PAD * 2 + lanes * LANE_W;

const x = (lane: number) => PAD + lane * LANE_W + LANE_W / 2;

// GraphGutter draws one row of the commit graph: lines passing through,
// lines into and out of this row's commit, and its dot.
export function GraphGutter({ row, lanes, highlight }: { row: GraphRow; lanes: number; highlight?: boolean }) {
  const cx = x(row.lane);
  const color = laneColor(row.color);
  return (
    <svg width={gutterWidth(lanes)} height={ROW_H} className="shrink-0 overflow-visible" aria-hidden>
      {row.edges.map((e, i) => {
        const y1 = e.start === "top" ? 0 : DOT_Y;
        const y2 = e.end === "bottom" ? ROW_H : DOT_Y;
        const [x1, x2] = [x(e.from), x(e.to)];
        const d = x1 === x2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;
        return <path key={i} d={d} fill="none" stroke={laneColor(e.color)} strokeWidth={1.75} strokeLinecap="round" opacity={e.color === 1 ? 0.55 : 0.9} />;
      })}
      {highlight && <circle cx={cx} cy={DOT_Y} r={8} fill={color} opacity={0.18} />}
      {row.merge ? (
        <circle cx={cx} cy={DOT_Y} r={4} fill="var(--color-popover)" stroke={color} strokeWidth={2} />
      ) : (
        <circle cx={cx} cy={DOT_Y} r={3.5} fill={color} stroke="var(--color-popover)" strokeWidth={1.5} />
      )}
    </svg>
  );
}
