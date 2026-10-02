// Parsing what git prints, shared by the app (review) and the built-in Git
// changes plugin, kept apart from any UI so it is easy to test.

export interface FileChange {
  path: string;
  // The path before a rename.
  from?: string;
  // Two-letter porcelain status: index then worktree, "??" for untracked.
  code: string;
  added?: number;
  removed?: number;
  binary?: boolean;
}

export interface BranchInfo {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
}

export interface GitStatus {
  branch: BranchInfo;
  files: FileChange[];
}

export const STATUS_MARK = "\n--berth-numstat--\n";

// The command that reads status and line counts in one round trip. A
// repository without commits has no HEAD to diff against; status still
// lists its files.
export const STATUS_COMMAND = "git status --porcelain=v1 -b -z && printf '\\n--berth-numstat--\\n' && { git diff --numstat HEAD 2>/dev/null; true; }";

export function parseStatus(output: string): GitStatus {
  const [statusPart, numstatPart = ""] = output.split(STATUS_MARK);
  const entries = statusPart.split("\0").filter(Boolean);
  const branch: BranchInfo = { branch: "", ahead: 0, behind: 0 };
  const files: FileChange[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.startsWith("## ")) {
      const m = /^## (?:No commits yet on )?([^.\s]+(?:\.(?!\.)[^.\s]+)*)(?:\.\.\.(\S+))?(?: \[(.+)\])?/.exec(e);
      if (m) {
        branch.branch = m[1];
        branch.upstream = m[2];
        branch.ahead = Number(/ahead (\d+)/.exec(m[3] ?? "")?.[1] ?? 0);
        branch.behind = Number(/behind (\d+)/.exec(m[3] ?? "")?.[1] ?? 0);
      }
      continue;
    }
    const code = e.slice(0, 2);
    const path = e.slice(3);
    const change: FileChange = { code, path };
    // A rename or copy is followed by the path it came from.
    if (code[0] === "R" || code[0] === "C") change.from = entries[++i];
    files.push(change);
  }
  for (const line of numstatPart.split("\n")) {
    const [a, r, ...rest] = line.split("\t");
    if (!rest.length) continue;
    const path = rest.join("\t");
    const f = files.find((x) => x.path === path || path.endsWith(`=> ${x.path}}`) || path.endsWith(`=> ${x.path}`));
    if (!f) continue;
    if (a === "-") f.binary = true;
    else {
      f.added = Number(a);
      f.removed = Number(r);
    }
  }
  return { branch, files };
}

export function describeCode(code: string): { label: string; tone: "add" | "del" | "mod" | "ren" | "new" } {
  if (code === "??") return { label: "New", tone: "new" };
  const c = code.trim()[0] ?? " ";
  if (c === "A") return { label: "Added", tone: "add" };
  if (c === "D") return { label: "Deleted", tone: "del" };
  if (c === "R") return { label: "Renamed", tone: "ren" };
  return { label: "Modified", tone: "mod" };
}

export interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk" | "meta";
  text: string;
  oldNo?: number;
  newNo?: number;
}

// parseDiff turns unified diff output into lines with their line numbers.
export function parseDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of diff.split("\n")) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (h) {
      oldNo = Number(h[1]);
      newNo = Number(h[2]);
      out.push({ kind: "hunk", text: line });
      continue;
    }
    if (/^(diff --git|index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode|Binary files)/.test(line)) {
      if (line.startsWith("Binary files")) out.push({ kind: "meta", text: "Binary file" });
      continue;
    }
    if (line.startsWith("+")) out.push({ kind: "add", text: line.slice(1), newNo: newNo++ });
    else if (line.startsWith("-")) out.push({ kind: "del", text: line.slice(1), oldNo: oldNo++ });
    else if (line.startsWith(" ")) out.push({ kind: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    else if (line.startsWith("\\")) out.push({ kind: "meta", text: line.slice(2) });
  }
  return out;
}

export interface SplitRow {
  left?: DiffLine;
  right?: DiffLine;
  hunk?: string;
}

// splitRows pairs removed and added lines side by side within each change.
export function splitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ left: dels[i], right: adds[i] });
    dels = [];
    adds = [];
  };
  for (const l of lines) {
    if (l.kind === "del") dels.push(l);
    else if (l.kind === "add") adds.push(l);
    else {
      flush();
      if (l.kind === "hunk") rows.push({ hunk: l.text });
      else if (l.kind === "ctx") rows.push({ left: l, right: l });
    }
  }
  flush();
  return rows;
}

export const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

export function diffCommand(f: FileChange): string {
  if (f.code === "??") return `git diff --no-color --no-index -- /dev/null ${quote(f.path)}; true`;
  return `git diff --no-color --find-renames HEAD -- ${f.from ? `${quote(f.from)} ` : ""}${quote(f.path)}`;
}

// committedDiffCommand shows what a branch's commits changed in a file,
// against the point where the branch left base.
export function committedDiffCommand(f: FileChange, base: string): string {
  return `git diff --no-color --find-renames ${quote(`${base}...HEAD`)} -- ${f.from ? `${quote(f.from)} ` : ""}${quote(f.path)}`;
}
