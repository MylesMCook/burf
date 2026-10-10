import * as stylex from "@stylexjs/stylex";
import { useAnnouncer } from "@/lib/announce";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Announcer is the window's live regions (lib/announce.ts), off screen.
export function Announcer() {
  const { polite, assertive } = useAnnouncer();
  return (
    <div className={sx(paint.s0)} data-testid="announcer">
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="announce-polite">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="announce-assertive">
        {assertive}
      </div>
    </div>
  );
}
