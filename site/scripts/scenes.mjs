// The chapters' line scenes, from the app's own drawings: the six SVGs as
// the brand board renders them from app/src/components/art/scenes.tsx
// (design/brand/index.html, built by design/brand/build-scenes.mjs) into
// assets/scenes.json, and the app's scenes.css into assets/scenes.css. The
// page fills its [data-scene] slots from the JSON after it has loaded
// (assets/clips.js), so the drawings add nothing to the hero's first paint.
//
//   node site/scripts/scenes.mjs     after the app's scenes change (and the board is rebuilt)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const site = join(root, "site");
const NAMES = ["setting-out", "signal", "rafted", "anchor", "lighthouse", "dawn"];
const board = readFileSync(join(root, "design/brand/index.html"), "utf8");
const out = {};
for (const name of NAMES) {
  const at = board.indexOf(`data-scene="${name}"`);
  if (at < 0) throw new Error(`${name}: not on the brand board`);
  let svg = board.slice(board.lastIndexOf("<svg", at), board.indexOf("</svg>", at) + 6);
  // Ids unique to this page, and the size left to CSS.
  const prefix = svg.match(/id="([^"-]+)-/)?.[1];
  if (prefix) svg = svg.split(`${prefix}-`).join(`sc-${name}-`);
  out[name] = svg.replace(/ width="[\d.]+" height="[\d.]+"/, "").replace(/ class="[^"]*"/, ' class="berth-art"');
}
writeFileSync(join(site, "assets/scenes.json"), `${JSON.stringify(out)}\n`);
const css = readFileSync(join(root, "app/src/components/art/scenes.css"), "utf8");
writeFileSync(
  join(site, "assets/scenes.css"),
  `/* Copied from app/src/components/art/scenes.css by site/scripts/scenes.mjs:
   the app's line scenes, for the chapters' markers. The page maps
   --muted-foreground and --warning to its own tokens (styles.css, .scene). */\n\n${css}`,
);
console.log(`assets/scenes.json  ${NAMES.length} scenes  ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
