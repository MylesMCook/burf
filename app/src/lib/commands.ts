import { useEffect, useState } from "react";

import { isMock } from "@/hooks/use-burf-connection";
import type { Client } from "@/lib/api";
import { useStore } from "@/lib/store";

// What an agent takes after a "/" and an "@", for the chat's composer. A
// box with the "commands" capability lists them per session: GET
// sessions/{name}/commands (its own commands, the person's and the repo's
// custom commands, skills and plugins) and GET sessions/{name}/files?q= (the
// worktree's files). What is typed goes to the agent exactly as typed.

export type CommandKind = "builtin" | "custom" | "skill" | "plugin" | "mcp";

export interface AgentCommand {
  name: string;
  description?: string;
  kind: CommandKind;
  args?: string;
  aliases?: string[];
  // Handled by the agent's own program: no turn starts.
  local?: boolean;
  // Opens the agent's own picker or dialog.
  screen?: boolean;
  source?: string;
}

export interface CommandCatalog {
  agent: string;
  version?: string;
  commands: AgentCommand[];
  // "!" and "#": what each does at the start of a prompt.
  prefixes?: Record<string, string>;
  notes?: string[];
  truncated?: boolean;
}

export const hasCommands = (box: string) => !!useStore.getState().boxes[box]?.info?.capabilities?.includes("commands");

export const commandsApi = {
  list: (c: Client, box: string, session: string) => c.box<CommandCatalog>(box, "GET", `sessions/${encodeURIComponent(session)}/commands`),
  files: (c: Client, box: string, session: string, q: string) => c.box<{ files: string[]; truncated?: boolean }>(box, "GET", `sessions/${encodeURIComponent(session)}/files?q=${encodeURIComponent(q)}&limit=30`),
};

// Read once a minute at most per session, shared by every composer on it.
const cache = new Map<string, { at: number; p: Promise<CommandCatalog | undefined> }>();

export function useCommandCatalog(box: string | undefined, session: string | undefined): CommandCatalog | undefined {
  const client = useStore((s) => s.client);
  const supported = useStore((s) => !!box && !!s.boxes[box]?.info?.capabilities?.includes("commands"));
  const mock = isMock();
  const [cat, setCat] = useState<CommandCatalog>();
  useEffect(() => {
    if (!box || !session) return;
    if (mock) {
      setCat(MOCK_CATALOG);
      return;
    }
    if (!client || !supported) {
      setCat(undefined);
      return;
    }
    const key = `${box}/${session}`;
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > 60_000) {
      hit = { at: Date.now(), p: commandsApi.list(client, box, session).catch(() => undefined) };
      cache.set(key, hit);
    }
    let alive = true;
    void hit.p.then((c) => alive && setCat(c));
    return () => {
      alive = false;
    };
  }, [client, supported, mock, box, session]);
  return cat;
}

export async function searchFiles(client: Client | undefined, box: string, session: string, q: string): Promise<string[]> {
  if (isMock()) return MOCK_FILES.filter((f) => !q || f.toLowerCase().includes(q.toLowerCase()) || subsequence(f.toLowerCase(), q.toLowerCase())).slice(0, 30);
  if (!client) return [];
  return (await commandsApi.files(client, box, session, q)).files ?? [];
}

const KIND_ORDER: Record<CommandKind, number> = { custom: 0, builtin: 1, skill: 2, plugin: 3, mcp: 4 };

// rankCommands is the commands matching what follows the "/", best first: a
// name that is it, starts with it, has a word starting with it, contains it,
// has its words' initials ("fcc" for figma-code-connect) or its letters close
// together; an alias counts as the name. Without a query, the person's own
// commands come first, then the agent's, its skills and plugins.
export function rankCommands(list: AgentCommand[], query: string, limit = 60): AgentCommand[] {
  const q = query.toLowerCase().replace(/^\//, "");
  const scored: { c: AgentCommand; s: number }[] = [];
  for (const c of list) {
    const names = [c.name, ...(c.aliases ?? [])].map((n) => n.slice(1).toLowerCase());
    let s = 0;
    if (!q) s = 1;
    else
      for (const n of names) {
        const v = n === q ? 100 : n.startsWith(q) ? 80 - Math.min(n.length, 30) / 2 : n.split(/[:\-_]/).some((w) => w.startsWith(q)) ? 55 : n.includes(q) ? 40 : initials(n).startsWith(q) ? 30 : close(n, q) ? 15 : 0;
        s = Math.max(s, v);
      }
    if (!s && q.length > 3 && c.description?.toLowerCase().includes(q)) s = 5;
    if (s) scored.push({ c, s });
  }
  scored.sort((a, b) => b.s - a.s || KIND_ORDER[a.c.kind] - KIND_ORDER[b.c.kind] || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}

// initials is a name's words' first letters: "figma:figma-code-connect" is
// "ffcc".
const initials = (n: string) =>
  n
    .split(/[:\-_]/)
    .map((w) => w[0] ?? "")
    .join("");

// close says q's letters are in n in order, not spread over all of it.
function close(n: string, q: string): boolean {
  if (q.length < 2) return false;
  for (let start = n.indexOf(q[0]); start >= 0; start = n.indexOf(q[0], start + 1)) {
    let i = 1;
    let j = start + 1;
    for (; j < n.length && i < q.length; j++) if (n[j] === q[i]) i++;
    if (i === q.length && j - start <= q.length + 2) return true;
  }
  return false;
}

function subsequence(s: string, q: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
  return i === q.length;
}

// commandIn is the catalogue's command a prompt starts with ("/model opus"
// is /model), by name or alias.
export function commandIn(cat: CommandCatalog | undefined, text: string): AgentCommand | undefined {
  const m = text.trim().match(/^\/([^\s/]+)(?:\s|$)/);
  if (!m || !cat) return undefined;
  const name = `/${m[1]}`;
  return cat.commands.find((c) => c.name === name || c.aliases?.includes(name));
}

export const KIND_LABEL: Record<CommandKind, string> = { builtin: "Built-in", custom: "Custom", skill: "Skill", plugin: "Plugin", mcp: "MCP" };

// The demo's agent, with a few of each kind.
export const MOCK_CATALOG: CommandCatalog = {
  agent: "claude",
  version: "2.1.289",
  prefixes: { "!": "Runs in the shell", "#": "Sent as a prompt: Claude Code 2.1 has no # memory (use /memory)" },
  commands: [
    { name: "/compact", description: "Free up context by summarizing the conversation so far", kind: "builtin", args: "[instructions]", local: true },
    { name: "/context", description: "Visualize current context usage", kind: "builtin", local: true },
    { name: "/usage", description: "Show session cost, plan usage, and activity stats", kind: "builtin", aliases: ["/cost", "/stats"], local: true, screen: true },
    { name: "/model", description: "Set the AI model for Claude Code", kind: "builtin", args: "[model]", local: true, screen: true },
    { name: "/config", description: "Open settings", kind: "builtin", aliases: ["/settings"], local: true, screen: true },
    { name: "/clear", description: "Start a new session with empty context; the previous one stays resumable", kind: "builtin", aliases: ["/reset", "/new"], local: true },
    { name: "/resume", description: "Resume a previous conversation", kind: "builtin", local: true, screen: true },
    { name: "/permissions", description: "Manage allow and deny tool permission rules", kind: "builtin", local: true, screen: true },
    { name: "/init", description: "Initialize a new CLAUDE.md file with codebase documentation", kind: "builtin" },
    { name: "/simplify", description: "Review the changed code for reuse, simplification and efficiency, then fix it", kind: "builtin" },
    { name: "/ship", description: "Run the checks, write the changelog line and open a PR", kind: "custom", args: "[branch]", source: "project" },
    { name: "/front:test", description: "Run the storefront's tests and fix what fails", kind: "custom", source: "user" },
    { name: "/seed-data", description: "Fill the local database with demo orders and customers", kind: "skill", source: "project" },
    { name: "/tidy", description: "Tidy the files you touched without changing behaviour", kind: "skill", source: "user" },
    { name: "/vercel:deploy", description: "Deploy the current project to Vercel", kind: "plugin", args: "[prod]", source: "vercel" },
  ],
};

const MOCK_FILES = ["README.md", "package.json", "apps/web/src/checkout/webhook.ts", "apps/web/src/checkout/order.ts", "apps/web/src/checkout/retry.test.ts", "apps/web/src/lib/stripe.ts", "packages/db/schema.prisma", "docs/payments.md"];
