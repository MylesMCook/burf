// Reading agents' screens: the lines that say what they are doing, and the
// numbered options they ask about. Pure, so anything can use them.

// Agents draw chrome under their output: an input box, a prompt, hints.
// None of it says what the agent is doing, so the tail skips it.
const RULE = /^[\s─━│┃╭╮╰╯═┌┐└┘├┤┬┴┼▔▁-]+$/;
const CHROME = [
  /^[❯>›$#%]\s*$/,
  /^[❯>›]\s+(Try "|$)/,
  /^\s*(⏵⏵|⏸|\? for shortcuts|esc to interrupt|bypass permissions|auto mode|accept edits|plan mode)/i,
  /·\s*\/effort\s*$/,
  /^\s*[●◐◑]\s*(low|medium|high|max)\s*·/i,
];

export function meaningfulTail(screen: string, count: number): string[] {
  const lines = screen
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() && !RULE.test(l) && !CHROME.some((re) => re.test(l.trim())));
  const tail = lines.slice(-count);
  // Drop the indentation the lines share, so narrow cards show words.
  const indent = Math.min(...tail.map((l) => l.length - l.trimStart().length));
  return tail.map((l) => l.slice(indent));
}

export interface Choice {
  key: string;
  label: string;
}

// choicesIn reads the numbered options an agent is asking about, such as
// Claude Code's "❯ 1. Yes / 2. No, and tell Claude what to do differently".
export function choicesIn(screen: string): Choice[] {
  const lines = screen.split("\n").slice(-14);
  const out: Choice[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*(?:[❯›>]\s*)?(\d)[.)]\s+(\S.*)$/);
    if (m && !out.some((c) => c.key === m[1])) out.push({ key: m[1], label: m[2].trim() });
  }
  // A real menu counts up from 1.
  return out.length >= 2 && out[0].key === "1" ? out.slice(0, 4) : [];
}
