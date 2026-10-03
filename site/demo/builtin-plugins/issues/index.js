// ../plugins/issues/src/index.tsx
import { definePlugin, useCurrentWorktree, useProjects, useSessions, useStorage as useStorage2 } from "@berth/plugin";
import {
  Button as Button3,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterChip,
  Icon as Icon4,
  Input as Input2,
  Kbd as Kbd3,
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  PickOne as PickOne2,
  Skeleton as Skeleton3,
  Tip as Tip3,
  Tooltip as Tooltip2,
  TooltipPopup as TooltipPopup2,
  TooltipTrigger as TooltipTrigger2,
  ViewHeader,
  cn as cn4
} from "@berth/plugin/ui";
import { useCallback, useEffect as useEffect3, useMemo, useRef, useState as useState3 } from "react";

// ../plugins/issues/src/detail.tsx
import {
  AgentIcon,
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  Button,
  Icon as Icon2,
  Kbd,
  Skeleton,
  Spinner,
  Textarea,
  Tip as Tip2,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  cn as cn2
} from "@berth/plugin/ui";
import { useEffect, useState } from "react";

// ../plugins/issues/src/gh.ts
var quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;
var ISSUE_FIELDS = "number title createdAt updatedAt author{login} labels(first:12){nodes{name color}} assignees(first:6){nodes{login}}";
var LIST_QUERY = `query($owner:String!,$name:String!){viewer{login} repository(owner:$owner,name:$name){nameWithOwner hasIssuesEnabled issues(first:100,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){totalCount nodes{${ISSUE_FIELDS} comments{totalCount} closedByPullRequestsReferences(first:4,includeClosedPrs:true){nodes{number state isDraft}}}}}}`;
var LIST_JQ = `{viewer: .data.viewer.login, repo: .data.repository.nameWithOwner, enabled: .data.repository.hasIssuesEnabled, total: (.data.repository.issues.totalCount // 0), issues: [(.data.repository.issues.nodes // [])[] | {number, title, author: .author.login, createdAt, updatedAt, labels: [.labels.nodes[] | {name, color}], assignees: [.assignees.nodes[].login], comments: .comments.totalCount, prs: [.closedByPullRequestsReferences.nodes[] | {number, state, draft: .isDraft}]}]}`;
var DETAIL_QUERY = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){${ISSUE_FIELDS} url state body comments(last:50){totalCount nodes{author{login} body createdAt url}} closedByPullRequestsReferences(first:6,includeClosedPrs:true){nodes{number state isDraft title url}}}}}`;
var DETAIL_JQ = `.data.repository.issue | {number, title, url, state, createdAt, updatedAt, body: ((.body // "")[:24000]), author: .author.login, labels: [.labels.nodes[] | {name, color}], assignees: [.assignees.nodes[].login], totalComments: .comments.totalCount, comments: [.comments.nodes[] | {author: .author.login, body: ((.body // "")[:4000]), createdAt, url}], prs: [.closedByPullRequestsReferences.nodes[] | {number, state, draft: .isDraft, title, url}]}`;
function split(slug) {
  const [owner, name] = slug.split("/");
  return `-f owner=${quote(owner)} -f name=${quote(name)}`;
}
var listCommand = (slug) => `gh api graphql ${split(slug)} -f query=${quote(LIST_QUERY)} --jq ${quote(LIST_JQ)}`;
var detailCommand = (slug, n) => `gh api graphql ${split(slug)} -F number=${n} -f query=${quote(DETAIL_QUERY)} --jq ${quote(DETAIL_JQ)}`;
var commentCommand = (slug, n, body) => `printf %s ${quote(toBase64(body))} | base64 -d | gh issue comment ${n} --repo ${quote(slug)} --body-file -`;
function toBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function readProblem(exitCode, output, repo = "") {
  const text = output.toLowerCase();
  if (exitCode === 127 || text.includes("command not found")) return { kind: "no-gh" };
  if (text.includes("gh auth login") || text.includes("not logged in") || text.includes("bad credentials")) return { kind: "no-auth" };
  if (text.includes("has disabled issues")) return { kind: "disabled", repo };
  if (text.includes("none of the git remotes") || text.includes("no git remotes") || text.includes("not a git repository")) return { kind: "not-github" };
  return { kind: "error", message: output.trim().split("\n").slice(-3).join("\n") || `gh exited with ${exitCode}` };
}
function parse(exitCode, output, repo) {
  if (exitCode !== 0) return { problem: readProblem(exitCode, output, repo) };
  try {
    return { ok: JSON.parse(output) };
  } catch {
    return { problem: { kind: "error", message: output.trim().slice(-400) || "gh's answer was not JSON" } };
  }
}
function since(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1e3);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo ago`;
  return `${Math.floor(s / (86400 * 365))}y ago`;
}
var isGitHub = (remote) => !!remote && /github\.com[:/]/i.test(remote);
var issueUrl = (repo, n) => `https://github.com/${repo}/issues/${n}`;
var pullUrl = (repo, n) => `https://github.com/${repo}/pull/${n}`;
function issueNumberOf(branchOrName) {
  const m = /(?:^|\/)issue-(\d+)(?:-|$)/.exec(branchOrName ?? "");
  return m ? Number(m[1]) : void 0;
}
var DEFAULT_TEMPLATE = "Work on #{{number}}: {{title}}\n\n{{url}}\n\n{{body}}\n\nOpen a PR that closes #{{number}} when done.";
var BODY_LIMIT = 8e3;
function renderPrompt(template, repo, issue) {
  let body = stripComments(issue.body ?? "").trim();
  const url = issue.url ?? issueUrl(repo, issue.number);
  if (body.length > BODY_LIMIT) body = `${body.slice(0, BODY_LIMIT).trimEnd()}

(The issue goes on; read the rest at ${url}.)`;
  const vars = { number: String(issue.number), title: issue.title, body, url, repo };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, k) => vars[k] ?? whole).replace(/\n{3,}/g, "\n\n").trim();
}
var stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

// ../plugins/issues/src/markdown.tsx
import { Icon, Tip, cn } from "@berth/plugin/ui";
import { jsx, jsxs } from "react/jsx-runtime";
function Markdown({ source, repo, onLink, className }) {
  const ctx = { repo, onLink };
  return /* @__PURE__ */ jsx("div", { className: cn("flex flex-col gap-3 text-[13px] leading-relaxed [overflow-wrap:anywhere]", className), children: blocks(clean(source), ctx) });
}
function clean(s) {
  return stripComments(s.replace(/\r\n?/g, "\n")).replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(details|summary|p|div|span|sub|sup|kbd|picture|source|center)[^>]*>/gi, "").replace(/<img\b[^>]*?(?:alt="([^"]*)")?[^>]*?src="([^"]+)"[^>]*>/gi, (_, alt, src) => `![${alt ?? "image"}](${src})`).replace(/<\/?[a-z][^>]*>/gi, "");
}
var fence = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;
var heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
var rule = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
var item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
var quoteLine = /^\s{0,3}>\s?(.*)$/;
var tableSep = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
function blocks(src, ctx) {
  const lines = src.split("\n");
  const out = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const f = fence.exec(line);
    if (f) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(f[1])) code.push(lines[i++]);
      i++;
      out.push(
        /* @__PURE__ */ jsx("pre", { className: "overflow-x-auto rounded-md border bg-muted/50 px-3 py-2 font-mono text-[12px] leading-normal", children: /* @__PURE__ */ jsx("code", { children: code.join("\n") }) }, key++)
      );
      continue;
    }
    const h = heading.exec(line);
    if (h) {
      const size = h[1].length <= 2 ? "text-[15px]" : "text-[13px]";
      out.push(
        /* @__PURE__ */ jsx("p", { role: "heading", "aria-level": h[1].length, className: cn("font-semibold", size, h[1].length <= 2 && "border-b pb-1"), children: inline(h[2], ctx) }, key++)
      );
      i++;
      continue;
    }
    if (rule.test(line)) {
      out.push(/* @__PURE__ */ jsx("hr", { className: "border-border" }, key++));
      i++;
      continue;
    }
    if (quoteLine.test(line)) {
      const q = [];
      while (i < lines.length && lines[i].trim() && quoteLine.test(lines[i])) q.push(quoteLine.exec(lines[i++])[1]);
      out.push(
        /* @__PURE__ */ jsx("blockquote", { className: "flex flex-col gap-2 border-l-2 pl-3 text-muted-foreground", children: blocks(q.join("\n"), ctx) }, key++)
      );
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && tableSep.test(lines[i + 1])) {
      const rows = [cells(line)];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full border-collapse text-[12px]", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: rows[0].map((c, j) => /* @__PURE__ */ jsx("th", { className: "border px-2 py-1 text-left font-medium", children: inline(c, ctx) }, j)) }) }),
          /* @__PURE__ */ jsx("tbody", { children: rows.slice(1).map((r, ri) => /* @__PURE__ */ jsx("tr", { children: r.map((c, j) => /* @__PURE__ */ jsx("td", { className: "border px-2 py-1 align-top", children: inline(c, ctx) }, j)) }, ri)) })
        ] }) }, key++)
      );
      continue;
    }
    if (item.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = item.exec(lines[i]);
        if (m) {
          items.push({ depth: Math.floor(m[1].replace(/\t/g, "  ").length / 2), ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ` ${lines[i++].trim()}`;
        } else break;
      }
      out.push(list(items, ctx, key++));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !fence.test(lines[i]) && !heading.test(lines[i]) && !quoteLine.test(lines[i]) && !(para.length && item.test(lines[i]))) para.push(lines[i++]);
    out.push(
      /* @__PURE__ */ jsx("p", { className: "whitespace-pre-line", children: inline(para.join("\n"), ctx) }, key++)
    );
  }
  return out;
}
function cells(row) {
  return row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}
function list(items, ctx, key) {
  const ordered = items[0]?.ordered;
  const Tag = ordered ? "ol" : "ul";
  return /* @__PURE__ */ jsx(Tag, { className: cn("flex flex-col gap-1 pl-5", ordered ? "list-decimal" : "list-disc"), children: items.map((it, j) => {
    const task = /^\[([ xX])\]\s+(.*)$/.exec(it.text);
    return /* @__PURE__ */ jsx("li", { style: { marginLeft: `${it.depth * 1.1}rem` }, className: cn(task && "-ml-5 list-none"), children: task ? /* @__PURE__ */ jsxs("span", { className: "flex items-start gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: cn("mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-[4px] border", task[1] !== " " && "border-primary bg-primary text-primary-foreground"), children: task[1] !== " " && /* @__PURE__ */ jsx(Icon, { name: "Check", className: "size-2.5" }) }),
      /* @__PURE__ */ jsx("span", { className: cn(task[1] !== " " && "text-muted-foreground line-through decoration-muted-foreground/50"), children: inline(task[2], ctx) })
    ] }) : inline(it.text, ctx) }, j);
  }) }, key);
}
var INLINE = /(`+)([^`][\s\S]*?)\1|!\[([^\]]*)\]\(([^)\s]+)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)[^)]*\)|\*\*([^*][\s\S]*?)\*\*|__([^_][\s\S]*?)__|~~([\s\S]+?)~~|(?<![\w*])\*(?![\s*])([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?![\s_])([^_\n]+?)_(?![\w_])|(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])|(?<![\w/&#])#(\d+)\b|(?<![\w`/])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\b/g;
var safe = (url) => /^https?:\/\//i.test(url);
function inline(text, ctx) {
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    last = at + m[0].length;
    const k = key++;
    if (m[2] !== void 0) {
      out.push(
        /* @__PURE__ */ jsx("code", { className: "rounded bg-muted px-1 py-px font-mono text-[12px]", children: m[2].trim() }, k)
      );
    } else if (m[4] !== void 0) {
      const url = m[4];
      out.push(safe(url) ? /* @__PURE__ */ jsx(Link, { url, ctx, icon: "Image", children: m[3] || "image" }, k) : /* @__PURE__ */ jsx("span", { children: m[3] }, k));
    } else if (m[6] !== void 0) {
      out.push(safe(m[6]) ? /* @__PURE__ */ jsx(Link, { url: m[6], ctx, children: inline(m[5], ctx) }, k) : /* @__PURE__ */ jsx("span", { children: inline(m[5], ctx) }, k));
    } else if (m[7] !== void 0 || m[8] !== void 0) {
      out.push(
        /* @__PURE__ */ jsx("strong", { className: "font-semibold", children: inline(m[7] ?? m[8], ctx) }, k)
      );
    } else if (m[9] !== void 0) {
      out.push(/* @__PURE__ */ jsx("s", { children: inline(m[9], ctx) }, k));
    } else if (m[10] !== void 0 || m[11] !== void 0) {
      out.push(/* @__PURE__ */ jsx("em", { children: inline(m[10] ?? m[11], ctx) }, k));
    } else if (m[12] !== void 0) {
      out.push(
        /* @__PURE__ */ jsx(Link, { url: m[12], ctx, children: shortUrl(m[12]) }, k)
      );
    } else if (m[13] !== void 0) {
      out.push(
        /* @__PURE__ */ jsxs(Link, { url: `https://github.com/${ctx.repo}/issues/${m[13]}`, ctx, children: [
          "#",
          m[13]
        ] }, k)
      );
    } else if (m[14] !== void 0) {
      out.push(
        /* @__PURE__ */ jsxs("span", { className: "font-medium text-foreground", children: [
          "@",
          m[14]
        ] }, k)
      );
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function shortUrl(url) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)\/?$/.exec(url);
  return m ? `${m[1]}#${m[2]}` : url.replace(/^https?:\/\//, "");
}
function Link({ url, ctx, icon, children }) {
  return /* @__PURE__ */ jsx(Tip, { label: /* @__PURE__ */ jsx("span", { className: "break-all font-mono", children: url }), className: "max-w-md", children: /* @__PURE__ */ jsxs(
    "a",
    {
      href: url,
      onClick: (e) => {
        e.preventDefault();
        ctx.onLink(url);
      },
      className: "inline-flex items-baseline gap-1 text-info-foreground underline-offset-2 hover:underline",
      children: [
        icon && /* @__PURE__ */ jsx(Icon, { name: icon, className: "size-3 self-center" }),
        children
      ]
    }
  ) });
}

// ../plugins/issues/src/store.ts
import { useSyncExternalStore } from "react";
var lists = /* @__PURE__ */ new Map();
var details = /* @__PURE__ */ new Map();
var version = 0;
var refreshes = 0;
var listeners = /* @__PURE__ */ new Set();
function changed() {
  version++;
  for (const l of listeners) l();
}
var subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
var useIssuesStore = () => useSyncExternalStore(subscribe, () => version);
var listOf = (project) => lists.get(project);
var detailOf = (repo, n) => details.get(`${repo.toLowerCase()}#${n}`);
function askRefresh() {
  refreshes++;
  changed();
}
var refreshCount = () => refreshes;
var isGitHubProject = (p) => !!p.slug && (p.remote ? isGitHub(p.remote) : true);
function runnerOf(p) {
  const m = p.members.find((x) => x.box === p.defaultBox && x.online) ?? p.members.find((x) => x.online);
  return m && { box: m.box, location: m.location.name, member: m };
}
var FRESH = 2 * 6e4;
async function loadList(berth, p, force = false) {
  const cur = lists.get(p.id);
  if (cur?.status === "loading") return;
  if (!force && cur && Date.now() - cur.at < FRESH) return;
  const prev = cur?.status === "ok" ? cur.value : void 0;
  const run = runnerOf(p);
  if (!p.slug) return;
  if (!run) {
    lists.set(p.id, { status: "problem", problem: { kind: "offline" }, at: Date.now() });
    return changed();
  }
  lists.set(p.id, { status: "loading", prev });
  changed();
  try {
    const res = await berth.orchestrate.exec(run.box, run.location, listCommand(p.slug), "90s");
    const parsed = parse(res.exit_code, res.output, p.slug);
    if ("problem" in parsed) lists.set(p.id, { status: "problem", problem: parsed.problem, at: Date.now() });
    else if (!parsed.ok.enabled) lists.set(p.id, { status: "problem", problem: { kind: "disabled", repo: parsed.ok.repo || p.slug }, at: Date.now() });
    else lists.set(p.id, { status: "ok", value: parsed.ok, at: Date.now() });
  } catch (err) {
    lists.set(p.id, { status: "problem", problem: { kind: "error", message: err instanceof Error ? err.message : String(err) }, at: Date.now() });
  }
  changed();
}
async function loadDetail(berth, p, n, force = false) {
  const key = `${p.slug.toLowerCase()}#${n}`;
  const cur = details.get(key);
  if (cur?.status === "ok" && !force) return cur.value;
  if (cur?.status === "loading") return waitFor(key);
  const run = runnerOf(p);
  if (!run) {
    details.set(key, { status: "problem", problem: { kind: "offline" }, at: Date.now() });
    changed();
    return void 0;
  }
  details.set(key, { status: "loading", prev: cur?.status === "ok" ? cur.value : void 0 });
  changed();
  try {
    const res = await berth.orchestrate.exec(run.box, run.location, detailCommand(p.slug, n), "60s");
    const parsed = parse(res.exit_code, res.output, p.slug);
    details.set(key, "problem" in parsed ? { status: "problem", problem: parsed.problem, at: Date.now() } : { status: "ok", value: parsed.ok, at: Date.now() });
  } catch (err) {
    details.set(key, { status: "problem", problem: { kind: "error", message: err instanceof Error ? err.message : String(err) }, at: Date.now() });
  }
  changed();
  const done = details.get(key);
  return done?.status === "ok" ? done.value : void 0;
}
function waitFor(key) {
  return new Promise((resolve) => {
    const stop = subscribe(() => {
      const d = details.get(key);
      if (d?.status === "loading") return;
      stop();
      resolve(d?.status === "ok" ? d.value : void 0);
    });
  });
}
async function postComment(berth, p, n, body) {
  const run = runnerOf(p);
  if (!run) throw new Error(`None of ${p.name}'s boxes is online.`);
  const res = await berth.orchestrate.exec(run.box, run.location, commentCommand(p.slug, n, body), "60s");
  if (res.exit_code !== 0) {
    const problem = readProblem(res.exit_code, res.output, p.slug);
    throw new Error(problem.kind === "error" ? problem.message : describeProblem(problem, run.box).title);
  }
  await loadDetail(berth, p, n, true);
  const list2 = lists.get(p.id);
  if (list2?.status === "ok") {
    lists.set(p.id, { ...list2, at: Date.now(), value: { ...list2.value, issues: list2.value.issues.map((i) => i.number === n ? { ...i, comments: i.comments + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : i) } });
    changed();
  }
}
function describeProblem(p, box = "the box") {
  switch (p.kind) {
    case "no-gh":
      return { icon: "TerminalSquare", title: `gh isn't installed on ${box}`, body: "Issues come from GitHub's CLI on the box. Install gh there, then refresh." };
    case "no-auth":
      return { icon: "KeyRound", title: `gh isn't logged in on ${box}`, body: "Run gh auth login on the box, then refresh." };
    case "not-github":
      return { icon: "GitBranch", title: "Not a GitHub repository", body: "This project's origin isn't on GitHub, so it has no issues to show here." };
    case "disabled":
      return { icon: "CircleSlash", title: `Issues are turned off for ${p.repo}`, body: "The repository doesn't use GitHub issues. Turn them on in its settings to see them here." };
    case "offline":
      return { icon: "CloudOff", title: "No box with this project is online", body: "Issues are read with gh on a box that has the repository. Reconnect one to see them." };
    default:
      return { icon: "TriangleAlert", title: "gh couldn't list the issues", body: p.message };
  }
}
var RANK = { waiting: 0, running: 1, finished: 2, idle: 3 };
var rank = (r) => r.session ? RANK[r.session.agent_state ?? ""] ?? 4 : 5;
function runsByIssue(projects, sessions) {
  const out = /* @__PURE__ */ new Map();
  for (const p of projects) {
    if (!p.slug) continue;
    for (const m of p.members) {
      for (const wt of m.location.worktrees ?? []) {
        if (wt.main) continue;
        const n = issueNumberOf(wt.branch) ?? issueNumberOf(wt.name);
        if (!n) continue;
        const loc = `${m.location.name}/${wt.name}`;
        const session = (sessions[m.box] ?? []).filter((s) => s.agent && !s.exited && (s.location === loc || s.dir === wt.path)).sort((a, b) => b.created.localeCompare(a.created))[0];
        const key = `${p.slug.toLowerCase()}#${n}`;
        out.set(key, [...out.get(key) ?? [], { box: m.box, location: m.location.name, worktree: wt.name, path: wt.path, branch: wt.branch, session }]);
      }
    }
  }
  for (const runs of out.values()) runs.sort((a, b) => rank(a) - rank(b));
  return out;
}

// ../plugins/issues/src/detail.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Detail({ berth, row, runs, viewer, onStart }) {
  useIssuesStore();
  const load = detailOf(row.repo, row.number);
  useEffect(() => {
    void loadDetail(berth, row.project, row.number);
  }, [berth, row.project, row.number]);
  const detail = load?.status === "ok" ? load.value : load?.status === "loading" ? load.prev : void 0;
  const url = issueUrl(row.repo, row.number);
  const open = (u) => berth.openUrl(u);
  return /* @__PURE__ */ jsxs2("article", { className: "mx-auto flex max-w-3xl flex-col gap-4 px-6 py-5", children: [
    /* @__PURE__ */ jsxs2("header", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxs2("p", { className: "flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs", children: [
        /* @__PURE__ */ jsxs2("span", { className: "inline-flex items-center gap-1 rounded-full bg-success/12 px-1.5 py-px font-medium text-[11px] text-success-foreground", children: [
          /* @__PURE__ */ jsx2(Icon2, { name: "CircleDot", className: "size-3" }),
          "Open"
        ] }),
        /* @__PURE__ */ jsxs2("span", { className: "font-mono", children: [
          row.repo,
          "#",
          row.number
        ] }),
        /* @__PURE__ */ jsx2("span", { children: "\xB7" }),
        /* @__PURE__ */ jsxs2("span", { children: [
          "opened ",
          since(row.createdAt),
          " by ",
          /* @__PURE__ */ jsx2("b", { className: "font-medium text-foreground", children: row.author ?? "ghost" })
        ] })
      ] }),
      /* @__PURE__ */ jsx2("h2", { className: "font-semibold text-lg leading-snug tracking-tight", children: row.title }),
      (row.labels.length > 0 || row.assignees.length > 0) && /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap items-center gap-1.5", children: [
        row.labels.map((l) => /* @__PURE__ */ jsx2(LabelChip, { label: l }, l.name)),
        row.assignees.length > 0 && /* @__PURE__ */ jsxs2("span", { className: "ml-1 inline-flex items-center gap-1.5 text-muted-foreground text-xs", children: [
          /* @__PURE__ */ jsx2(Icon2, { name: "UserRound", className: "size-3" }),
          row.assignees.map((a) => a === viewer ? "you" : a).join(", ")
        ] })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsxs2(Button, { size: "sm", onClick: onStart, children: [
          /* @__PURE__ */ jsx2(Icon2, { name: "Bot", className: "size-3.5" }),
          "Start an agent",
          /* @__PURE__ */ jsx2(Kbd, { className: "ml-1 h-4.5 bg-primary-foreground/15 text-[10px] text-primary-foreground", children: "S" })
        ] }),
        /* @__PURE__ */ jsxs2(Button, { size: "sm", variant: "outline", onClick: () => open(url), children: [
          /* @__PURE__ */ jsx2(Icon2, { name: "ExternalLink", className: "size-3.5" }),
          "Open on GitHub"
        ] }),
        /* @__PURE__ */ jsxs2(Tooltip, { children: [
          /* @__PURE__ */ jsx2(TooltipTrigger, { render: /* @__PURE__ */ jsx2(Button, { size: "icon-sm", variant: "ghost", "aria-label": "Refresh this issue", onClick: () => void loadDetail(berth, row.project, row.number, true) }), children: /* @__PURE__ */ jsx2(Icon2, { name: "RefreshCw", className: cn2("size-3.5", load?.status === "loading" && "animate-spin") }) }),
          /* @__PURE__ */ jsx2(TooltipPopup, { children: "Refresh this issue" })
        ] })
      ] })
    ] }),
    runs.length > 0 && /* @__PURE__ */ jsx2(Runs, { berth, runs }),
    detail && detail.prs.length > 0 && /* @__PURE__ */ jsxs2("section", { className: "flex flex-col rounded-lg border", children: [
      /* @__PURE__ */ jsx2("h3", { className: "border-b px-3 py-1.5 font-medium text-[11px] text-muted-foreground", children: "Pull requests that close it" }),
      detail.prs.map((pr) => /* @__PURE__ */ jsxs2("button", { type: "button", onClick: () => open(pr.url ?? pullUrl(row.repo, pr.number)), className: "flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-accent/50", children: [
        /* @__PURE__ */ jsx2(PrIcon, { pr }),
        /* @__PURE__ */ jsxs2("span", { className: "font-mono text-muted-foreground text-xs", children: [
          "#",
          pr.number
        ] }),
        /* @__PURE__ */ jsx2("span", { className: "min-w-0 flex-1 truncate", children: pr.title }),
        /* @__PURE__ */ jsx2("span", { className: "text-muted-foreground text-xs", children: pr.draft ? "Draft" : pr.state === "OPEN" ? "Open" : pr.state === "MERGED" ? "Merged" : "Closed" })
      ] }, pr.number))
    ] }),
    load?.status === "problem" && !detail ? /* @__PURE__ */ jsx2(Problem, { problem: load.problem, box: runnerOf(row.project)?.box }) : !detail ? /* @__PURE__ */ jsxs2("div", { className: "flex flex-col gap-2 rounded-lg border p-4", children: [
      /* @__PURE__ */ jsx2(Skeleton, { className: "h-3.5 w-1/3" }),
      /* @__PURE__ */ jsx2(Skeleton, { className: "h-3.5 w-full" }),
      /* @__PURE__ */ jsx2(Skeleton, { className: "h-3.5 w-5/6" }),
      /* @__PURE__ */ jsx2(Skeleton, { className: "h-3.5 w-2/3" })
    ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsx2(Post, { author: detail.author, at: detail.createdAt, viewer, badge: "Author", children: detail.body.trim() ? /* @__PURE__ */ jsx2(Markdown, { source: detail.body, repo: row.repo, onLink: open }) : /* @__PURE__ */ jsx2("p", { className: "text-muted-foreground text-[13px] italic", children: "No description." }) }),
      detail.totalComments > detail.comments.length && /* @__PURE__ */ jsxs2("button", { type: "button", onClick: () => open(url), className: "self-center text-muted-foreground text-xs hover:text-foreground", children: [
        detail.totalComments - detail.comments.length,
        " earlier comments on GitHub"
      ] }),
      detail.comments.map((c, i) => /* @__PURE__ */ jsx2(Post, { author: c.author, at: c.createdAt, viewer, badge: c.author && c.author === detail.author ? "Author" : void 0, children: /* @__PURE__ */ jsx2(Markdown, { source: c.body, repo: row.repo, onLink: open }) }, c.url ?? i)),
      /* @__PURE__ */ jsx2(Composer, { berth, row, viewer })
    ] })
  ] });
}
function Runs({ berth, runs }) {
  return /* @__PURE__ */ jsxs2("section", { className: "flex flex-col rounded-lg border", children: [
    /* @__PURE__ */ jsx2("h3", { className: "border-b px-3 py-1.5 font-medium text-[11px] text-muted-foreground", children: "Agents on this issue" }),
    runs.map((r) => /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2.5 px-3 py-2 text-[13px]", children: [
      r.session ? /* @__PURE__ */ jsx2(AgentIcon, { agent: r.session.agent }) : /* @__PURE__ */ jsx2(Icon2, { name: "GitBranch", className: "size-3.5 text-muted-foreground" }),
      /* @__PURE__ */ jsxs2("span", { className: "min-w-0 flex-1 truncate", children: [
        /* @__PURE__ */ jsx2("span", { className: "font-medium", children: r.worktree }),
        /* @__PURE__ */ jsxs2("span", { className: "text-muted-foreground", children: [
          " \xB7 ",
          r.box
        ] })
      ] }),
      /* @__PURE__ */ jsx2(StatePill, { run: r }),
      /* @__PURE__ */ jsx2(Button, { size: "xs", variant: "outline", onClick: () => berth.openWorktree({ box: r.box, location: r.location, worktree: r.worktree, path: r.path }), children: "Open" })
    ] }, `${r.box}:${r.path}`))
  ] });
}
var STATES = {
  running: { label: "Running", dot: "bg-info animate-pulse", text: "text-info-foreground" },
  waiting: { label: "Needs you", dot: "bg-warning", text: "text-warning-foreground" },
  finished: { label: "Done", dot: "bg-success", text: "text-success-foreground" },
  idle: { label: "Idle", dot: "bg-muted-foreground/50", text: "text-muted-foreground" }
};
function StatePill({ run, compact }) {
  const s = run.session ? STATES[run.session.agent_state ?? ""] ?? STATES.idle : void 0;
  if (!s) {
    return /* @__PURE__ */ jsxs2("span", { className: "inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground", children: [
      /* @__PURE__ */ jsx2(Icon2, { name: "GitBranch", className: "size-3" }),
      compact ? "" : "No agent"
    ] });
  }
  return /* @__PURE__ */ jsxs2("span", { className: cn2("inline-flex shrink-0 items-center gap-1.5 font-medium text-[11px]", s.text), children: [
    /* @__PURE__ */ jsx2("span", { className: cn2("size-1.5 rounded-full", s.dot) }),
    s.label
  ] });
}
function Post({ author, at, viewer, badge, children }) {
  return /* @__PURE__ */ jsxs2("div", { className: "flex gap-3", children: [
    /* @__PURE__ */ jsx2(Avatar, { login: author, className: "mt-0.5 size-6 text-[10px]" }),
    /* @__PURE__ */ jsxs2("div", { className: "min-w-0 flex-1 rounded-lg border", children: [
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs", children: [
        /* @__PURE__ */ jsx2("b", { className: "font-medium", children: author ?? "ghost" }),
        author && author === viewer && /* @__PURE__ */ jsx2("span", { className: "text-muted-foreground", children: "(you)" }),
        /* @__PURE__ */ jsxs2("span", { className: "text-muted-foreground", children: [
          "\xB7 ",
          since(at)
        ] }),
        badge && /* @__PURE__ */ jsx2("span", { className: "ml-auto rounded-full border px-1.5 text-[10px] text-muted-foreground", children: badge })
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "px-3 py-2.5", children })
    ] })
  ] });
}
function Composer({ berth, row, viewer }) {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState();
  const box = runnerOf(row.project)?.box;
  async function post() {
    setPosting(true);
    setError(void 0);
    try {
      await postComment(berth, row.project, row.number, text.trim());
      setText("");
      setConfirming(false);
      berth.notify(`Commented on #${row.number}`, row.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(false);
    } finally {
      setPosting(false);
    }
  }
  return /* @__PURE__ */ jsxs2("div", { className: "flex gap-3", children: [
    /* @__PURE__ */ jsx2(Avatar, { login: viewer, className: "mt-0.5 size-6 text-[10px]" }),
    /* @__PURE__ */ jsxs2("div", { className: "flex min-w-0 flex-1 flex-col gap-2", children: [
      /* @__PURE__ */ jsx2(
        Textarea,
        {
          className: "min-h-20 text-[13px]",
          placeholder: "Leave a comment (Markdown)",
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
              e.preventDefault();
              setConfirming(true);
            }
          }
        }
      ),
      error && /* @__PURE__ */ jsx2("p", { className: "text-destructive text-xs", children: error }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-end gap-2", children: [
        /* @__PURE__ */ jsx2("span", { className: "mr-auto text-muted-foreground text-xs", children: viewer && box ? `Posts as @${viewer}, with gh on ${box}.` : null }),
        /* @__PURE__ */ jsxs2(Button, { size: "sm", variant: "outline", disabled: !text.trim() || posting, onClick: () => setConfirming(true), children: [
          posting ? /* @__PURE__ */ jsx2(Spinner, { className: "size-3.5" }) : /* @__PURE__ */ jsx2(Icon2, { name: "MessageSquare", className: "size-3.5" }),
          "Comment"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx2(AlertDialog, { open: confirming, onOpenChange: (o) => !posting && setConfirming(o), children: /* @__PURE__ */ jsxs2(AlertDialogPopup, { children: [
      /* @__PURE__ */ jsxs2(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsxs2(AlertDialogTitle, { children: [
          "Comment on ",
          row.repo,
          "#",
          row.number,
          "?"
        ] }),
        /* @__PURE__ */ jsxs2(AlertDialogDescription, { children: [
          "It's posted publicly",
          viewer ? ` as @${viewer}` : "",
          " and everyone watching the issue is notified."
        ] })
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "mx-6 mb-5 max-h-48 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2", children: /* @__PURE__ */ jsx2(Markdown, { source: text, repo: row.repo, onLink: () => void 0 }) }),
      /* @__PURE__ */ jsxs2(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx2(AlertDialogClose, { render: /* @__PURE__ */ jsx2(Button, { variant: "ghost", disabled: posting }), children: "Cancel" }),
        /* @__PURE__ */ jsxs2(Button, { onClick: () => void post(), disabled: posting, children: [
          posting && /* @__PURE__ */ jsx2(Spinner, { className: "size-3.5" }),
          "Post comment"
        ] })
      ] })
    ] }) })
  ] });
}
function Problem({ problem, box, className }) {
  const d = describeProblem(problem, box);
  return /* @__PURE__ */ jsxs2("div", { className: cn2("flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3", className), children: [
    /* @__PURE__ */ jsx2(Icon2, { name: d.icon, className: "mt-0.5 size-4 shrink-0 text-muted-foreground" }),
    /* @__PURE__ */ jsxs2("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx2("p", { className: "font-medium text-[13px]", children: d.title }),
      /* @__PURE__ */ jsx2("p", { className: "mt-0.5 whitespace-pre-wrap text-muted-foreground text-xs", children: d.body })
    ] })
  ] });
}
function LabelChip({ label }) {
  return /* @__PURE__ */ jsxs2("span", { className: "inline-flex max-w-44 shrink-0 items-center gap-1.5 rounded-full border px-2 py-px text-[11px] text-foreground/80 leading-[18px]", children: [
    /* @__PURE__ */ jsx2("span", { className: "size-2 shrink-0 rounded-full", style: { backgroundColor: `#${label.color}` } }),
    /* @__PURE__ */ jsx2("span", { className: "truncate", children: label.name })
  ] });
}
function PrIcon({ pr }) {
  if (pr.state === "MERGED") return /* @__PURE__ */ jsx2(Icon2, { name: "GitMerge", className: "size-3.5 shrink-0 text-[#8250df] dark:text-[#a371f7]" });
  if (pr.state === "CLOSED") return /* @__PURE__ */ jsx2(Icon2, { name: "GitPullRequestClosed", className: "size-3.5 shrink-0 text-destructive" });
  if (pr.draft) return /* @__PURE__ */ jsx2(Icon2, { name: "GitPullRequestDraft", className: "size-3.5 shrink-0 text-muted-foreground" });
  return /* @__PURE__ */ jsx2(Icon2, { name: "GitPullRequest", className: "size-3.5 shrink-0 text-success" });
}
function Avatar({ login, className }) {
  const name = login ?? "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return /* @__PURE__ */ jsx2(Tip2, { label: login, children: /* @__PURE__ */ jsx2(
    "span",
    {
      role: "img",
      "aria-label": login ?? "Unknown",
      className: cn2("grid size-5 shrink-0 place-items-center rounded-full font-semibold text-[9px] text-white uppercase", className),
      style: { backgroundColor: `hsl(${h} 45% 45%)` },
      children: name.replace(/^app\//, "").slice(0, 1)
    }
  ) });
}

// ../plugins/issues/src/start-sheet.tsx
import { useStorage } from "@berth/plugin";
import {
  AgentIcon as AgentIcon2,
  AgentPicker,
  Button as Button2,
  Icon as Icon3,
  Input,
  Kbd as Kbd2,
  PickOne,
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  Skeleton as Skeleton2,
  Spinner as Spinner2,
  Textarea as Textarea2,
  cn as cn3
} from "@berth/plugin/ui";
import { useEffect as useEffect2, useState as useState2 } from "react";
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var enc = encodeURIComponent;
var message = (err) => err instanceof Error ? err.message : String(err);
function StartSheet({ berth, targets, onClose, onStarted }) {
  const open = targets.length > 0;
  return /* @__PURE__ */ jsx3(Sheet, { open, onOpenChange: (o) => !o && onClose(), children: /* @__PURE__ */ jsx3(SheetPopup, { side: "right", className: "max-w-lg", children: open && /* @__PURE__ */ jsx3(StartForm, { berth, targets, onClose, onStarted }, targets.map((t) => `${t.repo}#${t.number}`).join(",")) }) });
}
function StartForm({ berth, targets, onClose, onStarted }) {
  const single = targets.length === 1 ? targets[0] : void 0;
  const project = targets.every((t) => t.project.id === targets[0].project.id) ? targets[0].project : void 0;
  const [template, setTemplate] = useStorage("template", DEFAULT_TEMPLATE);
  const [lastAgent, setLastAgent] = useStorage("agent", "claude");
  const online = project?.members.filter((m) => m.online) ?? [];
  const [box, setBox] = useState2(() => (project ? runnerOf(project)?.box : void 0) ?? "");
  const member = project?.members.find((m) => m.box === box);
  const infoBox = box || targets[0] && runnerOf(targets[0].project)?.box || "";
  const [presets, setPresets] = useState2();
  const repoAgents = JSON.stringify(member?.location.agents ?? []);
  useEffect2(() => {
    let live = true;
    setPresets(void 0);
    if (!infoBox) return;
    berth.api.info(infoBox).then(
      (info) => {
        if (!live) return;
        const repo = JSON.parse(repoAgents);
        const all = [...repo, ...(info.agents ?? []).filter((a) => !repo.some((r) => r.id === a.id))];
        setPresets(all.filter((a) => a.command && a.id !== "shell"));
      },
      () => live && setPresets([])
    );
    return () => {
      live = false;
    };
  }, [berth, infoBox, repoAgents]);
  const [agent, setAgent] = useState2(lastAgent);
  useEffect2(() => {
    if (presets?.length && !presets.some((p) => p.id === agent)) setAgent(presets[0].id);
  }, [presets, agent]);
  const [resolution, setResolution] = useState2();
  const [name, setName] = useState2("");
  const [nameEdited, setNameEdited] = useState2(false);
  useEffect2(() => {
    if (!single || !member) return;
    let live = true;
    setResolution(void 0);
    berth.api.request(box, "POST", `locations/${enc(member.location.name)}/resolve`, { input: issueUrl(single.repo, single.number), kind: "smart" }).catch(() => ({ name: `issue-${single.number}`, branch: `issue-${single.number}` })).then((r) => {
      if (!live) return;
      setResolution(r);
      if (!nameEdited) setName(unique(r.name, member.location.worktrees?.map((w) => w.name) ?? []));
    });
    return () => {
      live = false;
    };
  }, [berth, single?.repo, single?.number, box, member?.location.name]);
  const [prompt, setPrompt] = useState2();
  const [promptEdited, setPromptEdited] = useState2(false);
  useEffect2(() => {
    if (!single) return;
    let live = true;
    void loadDetail(berth, single.project, single.number).then((d) => {
      if (live && !promptEdited) setPrompt(renderPrompt(template, single.repo, { number: single.number, title: single.title, body: d?.body, url: d?.url }));
    });
    return () => {
      live = false;
    };
  }, [berth, single?.repo, single?.number]);
  const [steps, setSteps] = useState2();
  const [error, setError] = useState2();
  const busy = !!steps && steps.some((s) => s.state === "waiting" || s.state === "working");
  const finished = !!steps && !busy;
  const agentName = presets?.find((p) => p.id === agent)?.name ?? agent;
  const ready = !!agent && !busy && (single ? !!member && !!name.trim() && prompt !== void 0 : targets.length > 0);
  async function start() {
    if (!ready) return;
    setError(void 0);
    setLastAgent(agent);
    if (!single) setTemplate(template);
    const next = targets.map(() => ({ state: "waiting" }));
    const show = () => setSteps([...next]);
    show();
    for (const [i, t] of targets.entries()) {
      const where = project && member ? { box, member } : runnerOf(t.project);
      if (!where) {
        next[i] = { state: "failed", why: `None of ${t.project.name}'s boxes is online.` };
        show();
        continue;
      }
      if (!single && t.runs.length) {
        next[i] = { state: "skipped", why: `already has ${t.runs[0].worktree}` };
        show();
        continue;
      }
      const loc = where.member.location;
      try {
        let wt;
        if (single) {
          const n = name.trim();
          wt = { name: n, branch: nameEdited ? n : resolution?.branch ?? n, base: resolution?.base };
        } else {
          next[i] = { state: "working", what: "Naming the worktree" };
          show();
          const r = await berth.api.request(where.box, "POST", `locations/${enc(loc.name)}/resolve`, { input: issueUrl(t.repo, t.number), kind: "smart" }).catch(() => ({ name: `issue-${t.number}`, branch: `issue-${t.number}` }));
          const n = unique(r.name, loc.worktrees?.map((w) => w.name) ?? []);
          wt = { name: n, branch: n === r.name ? r.branch : n, base: r.base };
        }
        let text = prompt ?? "";
        if (!single) {
          next[i] = { state: "working", what: "Reading the issue" };
          show();
          const d = await loadDetail(berth, t.project, t.number);
          text = renderPrompt(template, t.repo, { number: t.number, title: t.title, body: d?.body, url: d?.url });
        }
        next[i] = { state: "working", what: `Starting ${agentName}` };
        show();
        await berth.api.createTask(where.box, {
          location: loc.name,
          name: wt.name,
          branch: wt.branch,
          base: wt.base || loc.default_branch,
          agent,
          prompt: text,
          // One agent comes to the front (or offers to); a batch would bury
          // the person in tabs, so it only reports.
          open: single ? "tab" : void 0
        });
        next[i] = { state: "started", worktree: wt.name, box: where.box };
      } catch (err) {
        next[i] = { state: "failed", why: message(err) };
      }
      show();
    }
    const started = next.filter((s) => s.state === "started").length;
    if (started) onStarted?.();
    const failed = next.filter((s) => s.state === "failed").length;
    if (single) {
      const s = next[0];
      if (s.state === "started") {
        berth.notify(`${agentName} is on #${single.number}`, `${s.worktree} on ${s.box}`);
        onClose();
      } else if (s.state === "failed") {
        setError(s.why);
        setSteps(void 0);
      }
      return;
    }
    berth.notify(
      started ? `Started ${started} agent${started === 1 ? "" : "s"}` : "No agents started",
      [failed && `${failed} failed`, next.length - started - failed && `${next.length - started - failed} skipped`].filter(Boolean).join(", ") || `${agentName} on each issue`
    );
  }
  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void start();
    }
  };
  return /* @__PURE__ */ jsxs3("div", { className: "flex min-h-0 flex-1 flex-col", onKeyDown, children: [
    /* @__PURE__ */ jsxs3(SheetHeader, { className: "gap-1.5 pb-3", children: [
      /* @__PURE__ */ jsxs3(SheetTitle, { className: "flex items-center gap-2 text-base", children: [
        /* @__PURE__ */ jsx3(Icon3, { name: "Bot", className: "size-4 text-muted-foreground" }),
        single ? `Start an agent on #${single.number}` : `Start ${targets.length} agents`
      ] }),
      /* @__PURE__ */ jsx3(SheetDescription, { className: "line-clamp-2 text-[13px]", children: single ? single.title : project ? `One worktree and agent per issue in ${project.name}, one after another.` : "One worktree and agent per issue, each on its project's default box." })
    ] }),
    /* @__PURE__ */ jsxs3(SheetPanel, { className: "flex flex-col gap-5", children: [
      single && single.runs.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-xs", children: [
        /* @__PURE__ */ jsx3(Icon3, { name: "TriangleAlert", className: "mt-px size-3.5 shrink-0 text-warning" }),
        /* @__PURE__ */ jsxs3("span", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx3("b", { className: "font-medium", children: single.runs[0].worktree }),
          " on ",
          single.runs[0].box,
          " is already for this issue. This makes another worktree beside it."
        ] })
      ] }),
      project && online.length > 0 && /* @__PURE__ */ jsx3(Field, { label: "Box", hint: box === project.defaultBox ? "The project's default box." : void 0, children: /* @__PURE__ */ jsx3(
        PickOne,
        {
          label: "Box",
          value: box,
          onChange: setBox,
          options: online.map((m) => ({ value: m.box, label: m.box, icon: /* @__PURE__ */ jsx3(Icon3, { name: "Server", className: "size-3.5" }) }))
        }
      ) }),
      /* @__PURE__ */ jsx3(Field, { label: "Agent", children: presets ? presets.length ? /* @__PURE__ */ jsx3(AgentPicker, { presets, value: agent, onChange: (id) => !steps && setAgent(id) }) : /* @__PURE__ */ jsxs3("p", { className: "text-muted-foreground text-xs", children: [
        infoBox,
        " has no agents installed."
      ] }) : /* @__PURE__ */ jsx3(Skeleton2, { className: "h-7 w-56 rounded-lg" }) }),
      single && /* @__PURE__ */ jsx3(
        Field,
        {
          label: "Worktree",
          hint: resolution ? /* @__PURE__ */ jsxs3(Fragment2, { children: [
            "Branch ",
            /* @__PURE__ */ jsx3("span", { className: "font-mono", children: nameEdited ? name.trim() : resolution.branch }),
            resolution.exists && !nameEdited ? ", which already exists: the worktree checks it out." : ` from ${resolution.base || member?.location.default_branch || "the default branch"}.`,
            resolution.note && /* @__PURE__ */ jsx3("span", { className: "block", children: resolution.note })
          ] }) : "Asking the box what to call it\u2026",
          children: /* @__PURE__ */ jsxs3("div", { className: "relative", children: [
            /* @__PURE__ */ jsx3(
              Input,
              {
                size: "sm",
                className: "font-mono",
                value: name,
                disabled: !resolution,
                onChange: (e) => {
                  setName(e.target.value);
                  setNameEdited(true);
                }
              }
            ),
            !resolution && /* @__PURE__ */ jsx3(Spinner2, { className: "absolute top-1/2 right-2 size-3.5 -translate-y-1/2" })
          ] })
        }
      ),
      /* @__PURE__ */ jsx3(
        Field,
        {
          label: single ? "First prompt" : "Prompt for each",
          hint: single ? void 0 : /* @__PURE__ */ jsxs3(Fragment2, { children: [
            /* @__PURE__ */ jsx3(Code, { children: "{{number}}" }),
            ", ",
            /* @__PURE__ */ jsx3(Code, { children: "{{title}}" }),
            ", ",
            /* @__PURE__ */ jsx3(Code, { children: "{{body}}" }),
            ", ",
            /* @__PURE__ */ jsx3(Code, { children: "{{url}}" }),
            " and ",
            /* @__PURE__ */ jsx3(Code, { children: "{{repo}}" }),
            " are filled in from each issue."
          ] }),
          children: single ? prompt === void 0 ? /* @__PURE__ */ jsx3(Skeleton2, { className: "h-40 w-full rounded-lg" }) : /* @__PURE__ */ jsx3(
            Textarea2,
            {
              className: "min-h-40 font-mono text-xs [&_textarea]:max-h-[45vh]",
              value: prompt,
              onChange: (e) => {
                setPrompt(e.target.value);
                setPromptEdited(true);
              }
            }
          ) : /* @__PURE__ */ jsx3(Textarea2, { className: "min-h-32 font-mono text-xs", disabled: !!steps, value: template, onChange: (e) => setTemplate(e.target.value) })
        }
      ),
      !single && /* @__PURE__ */ jsx3("ol", { className: "flex flex-col divide-y rounded-lg border text-[13px]", children: targets.map((t, i) => /* @__PURE__ */ jsxs3("li", { className: "flex items-center gap-2.5 px-3 py-2", children: [
        /* @__PURE__ */ jsx3(StepIcon, { step: steps?.[i] }),
        /* @__PURE__ */ jsxs3("span", { className: "w-12 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums", children: [
          "#",
          t.number
        ] }),
        /* @__PURE__ */ jsx3("span", { className: "min-w-0 flex-1 truncate", children: t.title }),
        /* @__PURE__ */ jsx3(StepNote, { step: steps?.[i], pending: !steps && t.runs.length ? `has ${t.runs[0].worktree}` : void 0 })
      ] }, `${t.repo}#${t.number}`)) }),
      error && /* @__PURE__ */ jsx3("pre", { className: "whitespace-pre-wrap rounded-md bg-destructive/8 p-2 font-mono text-[11px] text-destructive", children: error })
    ] }),
    /* @__PURE__ */ jsxs3(SheetFooter, { className: "items-center sm:justify-between", children: [
      /* @__PURE__ */ jsx3("span", { className: "hidden text-muted-foreground text-xs sm:flex sm:items-center sm:gap-1.5", children: finished ? summary(steps) : agent && /* @__PURE__ */ jsxs3(Fragment2, { children: [
        /* @__PURE__ */ jsx3(AgentIcon2, { agent }),
        " ",
        single ? `${agentName} opens in a new tab` : `${agentName} on each, one at a time`
      ] }) }),
      /* @__PURE__ */ jsxs3("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx3(Button2, { variant: "ghost", size: "sm", onClick: onClose, children: finished ? "Close" : "Cancel" }),
        !finished && /* @__PURE__ */ jsxs3(Button2, { size: "sm", onClick: () => void start(), disabled: !ready, children: [
          busy ? /* @__PURE__ */ jsx3(Spinner2, { className: "size-3.5" }) : /* @__PURE__ */ jsx3(Icon3, { name: "Play", className: "size-3.5" }),
          single ? "Start agent" : `Start ${targets.length}`,
          /* @__PURE__ */ jsx3(Kbd2, { className: "ml-1 h-4.5 bg-primary-foreground/15 text-[10px] text-primary-foreground", children: "\u2318\u21B5" })
        ] })
      ] })
    ] })
  ] });
}
function Field({ label, hint, children }) {
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ jsx3("span", { className: "font-medium text-xs", children: label }),
    children,
    hint && /* @__PURE__ */ jsx3("span", { className: "text-muted-foreground text-xs", children: hint })
  ] });
}
var Code = ({ children }) => /* @__PURE__ */ jsx3("code", { className: "rounded bg-muted px-1 font-mono text-[11px]", children });
function StepIcon({ step }) {
  if (!step || step.state === "waiting") return /* @__PURE__ */ jsx3(Icon3, { name: "Circle", className: "size-3.5 shrink-0 text-muted-foreground/50" });
  if (step.state === "working") return /* @__PURE__ */ jsx3(Spinner2, { className: "size-3.5 shrink-0" });
  if (step.state === "started") return /* @__PURE__ */ jsx3(Icon3, { name: "CircleCheck", className: "size-3.5 shrink-0 text-success" });
  if (step.state === "skipped") return /* @__PURE__ */ jsx3(Icon3, { name: "CircleMinus", className: "size-3.5 shrink-0 text-muted-foreground" });
  return /* @__PURE__ */ jsx3(Icon3, { name: "CircleX", className: "size-3.5 shrink-0 text-destructive" });
}
function StepNote({ step, pending }) {
  const text = !step ? pending : step.state === "working" ? step.what : step.state === "started" ? step.worktree : step.state === "skipped" || step.state === "failed" ? step.why : void 0;
  if (!text) return null;
  return /* @__PURE__ */ jsx3("span", { className: cn3("max-w-[45%] shrink-0 truncate text-[11px]", step?.state === "failed" ? "text-destructive" : "text-muted-foreground", step?.state === "started" && "font-mono"), title: text, children: text });
}
function summary(steps) {
  const n = (s) => steps.filter((x) => x.state === s).length;
  return [`${n("started")} started`, n("skipped") && `${n("skipped")} skipped`, n("failed") && `${n("failed")} failed`].filter(Boolean).join(" \xB7 ");
}
function unique(name, taken) {
  if (!taken.includes(name)) return name;
  for (let i = 2; ; i++) if (!taken.includes(`${name}-${i}`)) return `${name}-${i}`;
}

// ../plugins/issues/src/index.tsx
import { Fragment as Fragment3, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var index_default = definePlugin((berth) => {
  berth.addScreen({ id: "issues", title: "Issues", layout: "fill", Component: IssuesScreen });
  berth.addSidebarItem({ id: "issues", title: "Issues", icon: "CircleDot", screen: "issues" });
  berth.addCommand({ id: "issues", title: "Show issues", group: "Issues", run: () => berth.openScreen("issues") });
  berth.addCommand({
    id: "issues-refresh",
    title: "Refresh issues",
    group: "Issues",
    run: () => {
      askRefresh();
      berth.openScreen("issues");
    }
  });
});
var ALL = "all";
function IssuesScreen({ berth }) {
  useIssuesStore();
  const allProjects = useProjects();
  const projects = useMemo(() => allProjects.filter(isGitHubProject), [allProjects]);
  const current = useCurrentWorktree();
  const [stored, setStored] = useStorage2("project", "");
  const fromCurrent = current && projects.find((p) => p.members.some((m) => m.box === current.box && m.location.name === current.location))?.id;
  const scope = stored === ALL || projects.some((p) => p.id === stored) ? stored : fromCurrent ?? (projects.length === 1 ? projects[0].id : ALL);
  const shown = useMemo(() => scope === ALL ? projects : projects.filter((p) => p.id === scope), [projects, scope]);
  const scoped = scope !== ALL ? shown[0] : void 0;
  const [who, setWho] = useStorage2("who", "all");
  const [sort, setSort] = useStorage2("sort", "updated");
  const [labels, setLabels] = useState3([]);
  const [query, setQuery] = useState3("");
  const search = useRef(null);
  const tick = refreshCount();
  const lastTick = useRef(tick);
  const shownKey = shown.map((p) => `${p.id}@${runnerOf(p)?.box ?? ""}`).join(",");
  useEffect3(() => {
    const force = lastTick.current !== tick;
    lastTick.current = tick;
    for (const p of shown) void loadList(berth, p, force);
  }, [berth, shownKey, tick]);
  const refresh = () => {
    for (const p of shown) void loadList(berth, p, true);
  };
  const loads = shown.map((p) => ({ project: p, load: listOf(p.id) }));
  const loading = loads.some((l) => !l.load || l.load.status === "loading");
  const problems = loads.filter((l) => l.load?.status === "problem");
  const viewers = new Set(loads.map((l) => l.load?.status === "ok" ? l.load.value.viewer : l.load?.status === "loading" ? l.load.prev?.viewer : void 0).filter(Boolean));
  const viewer = [...viewers][0];
  const rows = useMemo(
    () => loads.flatMap(({ project, load }) => {
      const list2 = load?.status === "ok" ? load.value : load?.status === "loading" ? load.prev : void 0;
      const repo = list2?.repo || project.slug;
      return (list2?.issues ?? []).map((i) => ({ ...i, key: `${repo.toLowerCase()}#${i.number}`, repo, project }));
    }),
    // loads is rebuilt every render; the store version drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loads.map((l) => l.load?.status === "ok" ? l.load.at : l.load?.status).join(","), shownKey]
  );
  const total = loads.reduce((n, l) => n + (l.load?.status === "ok" ? l.load.value.total : 0), 0);
  const boxes = useMemo(() => [...new Set(shown.flatMap((p) => p.members.map((m) => m.box)))].sort(), [shown]);
  const [sessions, setSessions] = useState3({});
  const onSessions = useCallback((box, s) => setSessions((prev) => prev[box] === s ? prev : { ...prev, [box]: s }), []);
  const runs = useMemo(() => runsByIssue(shown, sessions), [shown, sessions]);
  const labelCounts = useMemo(() => {
    const m = /* @__PURE__ */ new Map();
    for (const r of rows) for (const l of r.labels) m.set(l.name, { ...l, n: (m.get(l.name)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [rows]);
  useEffect3(() => setLabels((ls) => ls.filter((l) => labelCounts.some((c) => c.name === l))), [labelCounts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    const out = rows.filter(
      (r) => (who === "all" || (who === "mine" ? !!viewer && r.assignees.includes(viewer) : r.assignees.length === 0)) && labels.every((l) => r.labels.some((x) => x.name === l)) && (!q || String(r.number).startsWith(q) || `${r.title} ${r.author ?? ""} ${r.labels.map((l) => l.name).join(" ")} ${r.assignees.join(" ")}`.toLowerCase().includes(q))
    );
    const by = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      discussed: (a, b) => b.comments - a.comments || b.updatedAt.localeCompare(a.updatedAt)
    };
    return out.sort(by[sort]);
  }, [rows, who, viewer, labels, query, sort]);
  const [selectedKey, setSelectedKey] = useState3();
  const selected = filtered.find((r) => r.key === selectedKey) ?? filtered[0];
  const [checked, setChecked] = useState3(/* @__PURE__ */ new Set());
  const checkedRows = filtered.filter((r) => checked.has(r.key));
  const toggle = (key) => setChecked((s) => {
    const n = new Set(s);
    if (!n.delete(key)) n.add(key);
    return n;
  });
  const [targets, setTargets] = useState3([]);
  const targetOf = (r) => ({ project: r.project, repo: r.repo, number: r.number, title: r.title, runs: runs.get(r.key) ?? [] });
  const startOn = (rs) => rs.length && setTargets(rs.map(targetOf));
  const keys = useRef({ filtered, selected, checkedRows, targets });
  keys.current = { filtered, selected, checkedRows, targets };
  useEffect3(() => {
    const onKey = (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey || keys.current.targets.length) return;
      if (t && (t.closest("input, textarea, [contenteditable=true], [role=dialog], [role=menu]") || t.isContentEditable)) {
        if (e.key === "Escape" && t === search.current) search.current?.blur();
        return;
      }
      const { filtered: list2, selected: sel, checkedRows: ticked } = keys.current;
      const i = sel ? list2.indexOf(sel) : -1;
      const move = (d) => {
        const next = list2[Math.min(list2.length - 1, Math.max(0, i + d))];
        if (!next) return;
        setSelectedKey(next.key);
        document.getElementById(`issue-${next.key}`)?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "j" || e.key === "ArrowDown") move(1);
      else if (e.key === "k" || e.key === "ArrowUp") move(-1);
      else if (e.key === "x" && sel) toggle(sel.key);
      else if (e.key === "s") startOn(ticked.length ? ticked : sel ? [sel] : []);
      else if (e.key === "o" && sel) berth.openUrl(issueUrl(sel.repo, sel.number));
      else if (e.key === "/") search.current?.focus();
      else if (e.key === "Escape") setChecked(/* @__PURE__ */ new Set());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [berth]);
  const busyRuns = useMemo(() => [...runs.values()].filter((rs) => rs[0]?.session && rs[0].session.agent_state !== "finished").length, [runs]);
  return /* @__PURE__ */ jsxs4("div", { className: "flex min-h-0 flex-1 flex-col", children: [
    boxes.map((b) => /* @__PURE__ */ jsx4(SessionFeed, { box: b, onSessions }, b)),
    /* @__PURE__ */ jsx4(
      ViewHeader,
      {
        title: "Issues",
        description: busyRuns > 0 ? `${busyRuns} agent${busyRuns === 1 ? " is" : "s are"} on issues right now.` : "Open GitHub issues, and an agent on any of them in one step.",
        actions: /* @__PURE__ */ jsxs4(Fragment3, { children: [
          /* @__PURE__ */ jsx4(ProjectPicker, { projects, scope, onChange: (id) => (setStored(id), setChecked(/* @__PURE__ */ new Set())) }),
          /* @__PURE__ */ jsxs4(Tooltip2, { children: [
            /* @__PURE__ */ jsx4(TooltipTrigger2, { render: /* @__PURE__ */ jsx4(Button3, { size: "icon-sm", variant: "ghost", "aria-label": "Refresh", onClick: refresh, disabled: !shown.length }), children: /* @__PURE__ */ jsx4(Icon4, { name: "RefreshCw", className: cn4("size-3.5", loading && shown.length > 0 && "animate-spin") }) }),
            /* @__PURE__ */ jsx4(TooltipPopup2, { children: "Refresh" })
          ] })
        ] })
      }
    ),
    projects.length === 0 ? /* @__PURE__ */ jsx4(Empty, { className: "flex-1", children: /* @__PURE__ */ jsxs4(EmptyHeader, { children: [
      /* @__PURE__ */ jsx4(Icon4, { name: "CircleDot", className: "mb-2 size-6 text-muted-foreground" }),
      /* @__PURE__ */ jsx4(EmptyTitle, { children: "No GitHub projects yet" }),
      /* @__PURE__ */ jsx4(EmptyDescription, { children: "Add a repository whose origin is on GitHub to a box, and its open issues show up here." })
    ] }) }) : /* @__PURE__ */ jsxs4(Fragment3, { children: [
      /* @__PURE__ */ jsxs4("div", { className: "flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2", children: [
        /* @__PURE__ */ jsxs4("div", { className: "relative", children: [
          /* @__PURE__ */ jsx4(Icon4, { name: "Search", className: "pointer-events-none absolute top-1/2 left-2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" }),
          /* @__PURE__ */ jsx4(
            Input2,
            {
              ref: search,
              size: "sm",
              className: "w-52 [&_input]:pl-7",
              placeholder: "Search issues",
              value: query,
              onChange: (e) => setQuery(e.target.value)
            }
          ),
          !query && /* @__PURE__ */ jsx4(Kbd3, { className: "pointer-events-none absolute top-1/2 right-1.5 h-4.5 -translate-y-1/2 text-[10px]", children: "/" })
        ] }),
        /* @__PURE__ */ jsx4(
          PickOne2,
          {
            label: "Assignee",
            value: who,
            onChange: (v) => setWho(v),
            options: [
              { value: "all", label: "All" },
              { value: "mine", label: "Mine" },
              { value: "unassigned", label: "Unassigned" }
            ]
          }
        ),
        /* @__PURE__ */ jsx4(SortMenu, { sort, onChange: setSort }),
        /* @__PURE__ */ jsx4("div", { className: "flex min-w-0 flex-1 flex-wrap items-center gap-1", children: labelCounts.slice(0, 10).map((l) => /* @__PURE__ */ jsxs4(FilterChip, { className: "text-[11px]", pressed: labels.includes(l.name), onPressedChange: (on) => setLabels((ls) => on ? [...ls, l.name] : ls.filter((x) => x !== l.name)), children: [
          /* @__PURE__ */ jsx4("span", { className: "size-2 shrink-0 rounded-full", style: { backgroundColor: `#${l.color}` } }),
          /* @__PURE__ */ jsx4("span", { className: "truncate", children: l.name })
        ] }, l.name)) })
      ] }),
      problems.length > 0 && scope === ALL && rows.length > 0 && /* @__PURE__ */ jsx4("div", { className: "flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-1.5 text-muted-foreground text-xs", children: problems.map(({ project, load }) => /* @__PURE__ */ jsxs4("span", { className: "inline-flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx4(Icon4, { name: "Info", className: "size-3" }),
        /* @__PURE__ */ jsx4("b", { className: "font-medium text-foreground", children: project.name }),
        " ",
        problemShort(load.problem)
      ] }, project.id)) }),
      /* @__PURE__ */ jsxs4("div", { className: "flex min-h-0 flex-1", children: [
        /* @__PURE__ */ jsxs4("aside", { className: "flex w-[25rem] shrink-0 flex-col border-r max-xl:w-[21rem]", children: [
          /* @__PURE__ */ jsx4("ul", { className: "min-h-0 flex-1 overflow-y-auto p-2", "aria-label": "Open issues", children: rows.length === 0 && loading ? Array.from({ length: 7 }, (_, i) => /* @__PURE__ */ jsx4(RowSkeleton, {}, i)) : rows.length === 0 && problems.length > 0 ? /* @__PURE__ */ jsx4("div", { className: "flex flex-col gap-2 p-1", children: problems.map(({ project, load }) => /* @__PURE__ */ jsxs4("div", { className: "flex flex-col gap-1", children: [
            scope === ALL && /* @__PURE__ */ jsx4("span", { className: "px-1 font-medium text-[11px] text-muted-foreground", children: project.name }),
            /* @__PURE__ */ jsx4(Problem, { problem: load.problem, box: runnerOf(project)?.box })
          ] }, project.id)) }) : filtered.length === 0 ? /* @__PURE__ */ jsxs4("p", { className: "px-3 py-8 text-center text-muted-foreground text-xs", children: [
            rows.length === 0 ? "No open issues. Nice." : "No issues match.",
            rows.length > 0 && /* @__PURE__ */ jsx4(
              "button",
              {
                type: "button",
                className: "ml-1 font-medium text-foreground hover:underline",
                onClick: () => {
                  setQuery("");
                  setLabels([]);
                  setWho("all");
                },
                children: "Clear filters"
              }
            )
          ] }) : filtered.map((r) => /* @__PURE__ */ jsx4(
            IssueRow,
            {
              row: r,
              showRepo: scope === ALL && shown.length > 1,
              viewer,
              run: runs.get(r.key)?.[0],
              active: r.key === selected?.key,
              checked: checked.has(r.key),
              selecting: checked.size > 0,
              onSelect: () => setSelectedKey(r.key),
              onCheck: () => toggle(r.key),
              onOpenRun: (run) => berth.openWorktree({ box: run.box, location: run.location, worktree: run.worktree, path: run.path })
            },
            r.key
          )) }),
          checkedRows.length > 0 ? /* @__PURE__ */ jsxs4("footer", { className: "flex shrink-0 items-center gap-2 border-t bg-muted/40 px-3 py-2 text-xs", children: [
            /* @__PURE__ */ jsxs4("span", { className: "font-medium", children: [
              checkedRows.length,
              " selected"
            ] }),
            /* @__PURE__ */ jsx4("button", { type: "button", className: "text-muted-foreground hover:text-foreground", onClick: () => setChecked(/* @__PURE__ */ new Set()), children: "Clear" }),
            /* @__PURE__ */ jsxs4(Button3, { size: "xs", className: "ml-auto", onClick: () => startOn(checkedRows), children: [
              /* @__PURE__ */ jsx4(Icon4, { name: "Bot", className: "size-3.5" }),
              "Start ",
              checkedRows.length,
              " agent",
              checkedRows.length === 1 ? "" : "s"
            ] })
          ] }) : /* @__PURE__ */ jsxs4("footer", { className: "flex shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap border-t px-3 py-2 text-[11px] text-muted-foreground", children: [
            [
              ["J K", "move"],
              ["X", "select"],
              ["S", "start agent"],
              ["O", "GitHub"]
            ].map(([k, label]) => /* @__PURE__ */ jsxs4("span", { className: "inline-flex items-center gap-1", children: [
              k.split(" ").map((x) => /* @__PURE__ */ jsx4(Kbd3, { className: "h-4 min-w-4 px-1 text-[10px]", children: x }, x)),
              label
            ] }, label)),
            /* @__PURE__ */ jsxs4("span", { className: "ml-auto tabular-nums", children: [
              filtered.length === rows.length ? `${rows.length}` : `${filtered.length} of ${rows.length}`,
              total > rows.length ? ` \xB7 ${total} open` : ""
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx4("section", { className: "min-w-0 flex-1 overflow-y-auto", children: selected ? /* @__PURE__ */ jsx4(Detail, { berth, row: selected, runs: runs.get(selected.key) ?? [], viewer, onStart: () => startOn([selected]) }, selected.key) : /* @__PURE__ */ jsx4("div", { className: "grid h-full place-items-center text-muted-foreground text-xs", children: loading ? "" : "Pick an issue to read it." }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx4(StartSheet, { berth, targets, onClose: () => setTargets([]), onStarted: () => setChecked(/* @__PURE__ */ new Set()) })
  ] });
}
function SessionFeed({ box, onSessions }) {
  const s = useSessions(box);
  useEffect3(() => onSessions(box, s), [box, s, onSessions]);
  return null;
}
function IssueRow({
  row,
  showRepo,
  viewer,
  run,
  active,
  checked,
  selecting,
  onSelect,
  onCheck,
  onOpenRun
}) {
  const openPR = row.prs.find((p) => p.state === "OPEN") ?? row.prs.find((p) => p.state === "MERGED") ?? row.prs[0];
  return /* @__PURE__ */ jsx4("li", { id: `issue-${row.key}`, children: /* @__PURE__ */ jsxs4(
    "div",
    {
      role: "button",
      tabIndex: -1,
      onClick: onSelect,
      onKeyDown: void 0,
      "aria-current": active || void 0,
      className: cn4(
        "group flex w-full cursor-default gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-accent/50",
        active && "bg-accent hover:bg-accent"
      ),
      children: [
        /* @__PURE__ */ jsxs4("span", { className: "relative mt-[3px] grid size-4 shrink-0 place-items-center", children: [
          /* @__PURE__ */ jsx4(Icon4, { name: "CircleDot", className: cn4("size-3.5 text-success", (selecting || checked) && "hidden", "group-hover:hidden") }),
          /* @__PURE__ */ jsx4("span", { className: cn4("hidden", (selecting || checked) && "flex", "group-hover:flex"), onClick: (e) => e.stopPropagation(), onKeyDown: void 0, children: /* @__PURE__ */ jsx4(Checkbox, { checked, onCheckedChange: onCheck, "aria-label": `Select #${row.number}` }) })
        ] }),
        /* @__PURE__ */ jsxs4("span", { className: "flex min-w-0 flex-1 flex-col gap-1", children: [
          /* @__PURE__ */ jsx4("span", { className: "line-clamp-2 font-medium text-[13px] leading-snug", children: row.title }),
          /* @__PURE__ */ jsxs4("span", { className: "flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground", children: [
            /* @__PURE__ */ jsx4("span", { className: "shrink-0 font-mono tabular-nums", children: showRepo ? `${row.repo.split("/")[1]}#${row.number}` : `#${row.number}` }),
            /* @__PURE__ */ jsxs4("span", { className: "truncate", children: [
              "\xB7 ",
              since(row.updatedAt),
              " \xB7 ",
              row.author ?? "ghost"
            ] })
          ] }),
          (row.labels.length > 0 || run) && /* @__PURE__ */ jsxs4("span", { className: "flex min-w-0 items-center gap-1 overflow-hidden", children: [
            run && // biome-ignore lint/a11y/useKeyWithClickEvents: the issue's own keys reach it.
            /* @__PURE__ */ jsx4(Tip3, { label: `${run.worktree} on ${run.box}: open it`, children: /* @__PURE__ */ jsxs4(
              "span",
              {
                className: "inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-1.5 py-px hover:bg-accent",
                onClick: (e) => {
                  e.stopPropagation();
                  onOpenRun(run);
                },
                children: [
                  /* @__PURE__ */ jsx4(StatePill, { run, compact: true }),
                  /* @__PURE__ */ jsx4("span", { className: "max-w-28 truncate text-[11px] text-muted-foreground", children: run.session ? run.box : run.worktree })
                ]
              }
            ) }),
            row.labels.slice(0, 3).map((l) => /* @__PURE__ */ jsx4(LabelChip, { label: l }, l.name)),
            row.labels.length > 3 && /* @__PURE__ */ jsxs4("span", { className: "shrink-0 text-[10px] text-muted-foreground", children: [
              "+",
              row.labels.length - 3
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("span", { className: "flex shrink-0 flex-col items-end gap-1.5 pt-px text-[11px] text-muted-foreground", children: [
          /* @__PURE__ */ jsx4("span", { className: "flex -space-x-1", children: row.assignees.slice(0, 2).map((a) => /* @__PURE__ */ jsx4(Avatar, { login: a, className: cn4("size-4 text-[8px] ring-2 ring-background", a === viewer && "ring-primary/60") }, a)) }),
          /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-2", children: [
            openPR && /* @__PURE__ */ jsx4(Tip3, { label: `#${openPR.number} ${openPR.state.toLowerCase()}`, children: /* @__PURE__ */ jsx4("span", { role: "img", "aria-label": `Pull request #${openPR.number} ${openPR.state.toLowerCase()}`, className: "inline-flex items-center gap-0.5", children: /* @__PURE__ */ jsx4(PrIcon, { pr: openPR }) }) }),
            row.comments > 0 && /* @__PURE__ */ jsxs4("span", { className: "inline-flex items-center gap-0.5 tabular-nums", children: [
              /* @__PURE__ */ jsx4(Icon4, { name: "MessageSquare", className: "size-3" }),
              row.comments
            ] })
          ] })
        ] })
      ]
    }
  ) });
}
function RowSkeleton() {
  return /* @__PURE__ */ jsxs4("li", { className: "flex gap-2.5 px-2.5 py-2.5", children: [
    /* @__PURE__ */ jsx4(Skeleton3, { className: "mt-0.5 size-3.5 rounded-full" }),
    /* @__PURE__ */ jsxs4("div", { className: "flex flex-1 flex-col gap-1.5", children: [
      /* @__PURE__ */ jsx4(Skeleton3, { className: "h-3.5 w-4/5" }),
      /* @__PURE__ */ jsx4(Skeleton3, { className: "h-3 w-2/5" })
    ] })
  ] });
}
function ProjectPicker({ projects, scope, onChange }) {
  const current = projects.find((p) => p.id === scope);
  if (projects.length === 0) return null;
  return /* @__PURE__ */ jsxs4(Menu, { children: [
    /* @__PURE__ */ jsxs4(MenuTrigger, { render: /* @__PURE__ */ jsx4(Button3, { size: "sm", variant: "outline", className: "max-w-56" }), children: [
      /* @__PURE__ */ jsx4(Icon4, { name: current ? "FolderGit2" : "Layers", className: "size-3.5" }),
      /* @__PURE__ */ jsx4("span", { className: "truncate", children: current ? current.name : "All projects" }),
      /* @__PURE__ */ jsx4(Icon4, { name: "ChevronsUpDown", className: "size-3 opacity-60" })
    ] }),
    /* @__PURE__ */ jsxs4(MenuPopup, { align: "end", className: "min-w-56", children: [
      /* @__PURE__ */ jsxs4(MenuItem, { onClick: () => onChange(ALL), children: [
        /* @__PURE__ */ jsx4(Icon4, { name: "Layers", className: "size-3.5" }),
        "All projects",
        scope === ALL && /* @__PURE__ */ jsx4(Icon4, { name: "Check", className: "ml-auto size-3.5" })
      ] }),
      /* @__PURE__ */ jsx4(MenuSeparator, {}),
      /* @__PURE__ */ jsxs4(MenuGroup, { children: [
        /* @__PURE__ */ jsx4(MenuGroupLabel, { children: "Projects on GitHub" }),
        projects.map((p) => /* @__PURE__ */ jsxs4(MenuItem, { onClick: () => onChange(p.id), children: [
          /* @__PURE__ */ jsx4(Icon4, { name: "FolderGit2", className: "size-3.5" }),
          /* @__PURE__ */ jsxs4("span", { className: "flex min-w-0 flex-col", children: [
            /* @__PURE__ */ jsx4("span", { className: "truncate", children: p.name }),
            /* @__PURE__ */ jsx4("span", { className: "truncate text-[11px] text-muted-foreground", children: p.slug })
          ] }),
          scope === p.id && /* @__PURE__ */ jsx4(Icon4, { name: "Check", className: "ml-auto size-3.5" })
        ] }, p.id))
      ] })
    ] })
  ] });
}
var SORTS = { updated: "Recently updated", newest: "Newest", discussed: "Most discussed" };
function SortMenu({ sort, onChange }) {
  return /* @__PURE__ */ jsxs4(Menu, { children: [
    /* @__PURE__ */ jsxs4(MenuTrigger, { render: /* @__PURE__ */ jsx4(Button3, { size: "sm", variant: "ghost", className: "text-muted-foreground" }), children: [
      /* @__PURE__ */ jsx4(Icon4, { name: "ArrowDownWideNarrow", className: "size-3.5" }),
      SORTS[sort]
    ] }),
    /* @__PURE__ */ jsx4(MenuPopup, { align: "start", children: Object.keys(SORTS).map((s) => /* @__PURE__ */ jsxs4(MenuItem, { onClick: () => onChange(s), children: [
      SORTS[s],
      s === sort && /* @__PURE__ */ jsx4(Icon4, { name: "Check", className: "ml-auto size-3.5" })
    ] }, s)) })
  ] });
}
function problemShort(p) {
  switch (p.kind) {
    case "disabled":
      return "has issues turned off";
    case "no-gh":
      return "needs gh on its box";
    case "no-auth":
      return "needs gh auth login on its box";
    case "offline":
      return "has no box online";
    case "not-github":
      return "isn't on GitHub";
    default:
      return "couldn't be read";
  }
}
export {
  index_default as default
};
