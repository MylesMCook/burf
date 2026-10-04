// Berth on a phone. Each box you pair serves this page on its tailnet
// address; one page reads every paired box, so the list covers all of them.
"use strict";

const STORE = "berth.phone.boxes";
const MOCK = new URLSearchParams(location.search).has("mock");
const main = document.getElementById("main");
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// --- paired boxes -----------------------------------------------------------

function loadBoxes() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(v) ? v.filter((b) => b && b.url && b.token) : [];
  } catch {
    return [];
  }
}
function saveBoxes(boxes) {
  try {
    localStorage.setItem(STORE, JSON.stringify(boxes));
  } catch {}
}
let boxes = MOCK ? mockBoxes() : loadBoxes();

// A pairing link carries boxes in the fragment, which never reaches a
// server: #pair=<base64url of [{name,url,token}]>. Keep them, then drop the
// fragment so the token is not left in history.
(function pairFromLink() {
  const m = location.hash.match(/^#pair=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const json = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    let list = JSON.parse(json);
    if (!Array.isArray(list)) list = [list];
    for (const b of list) {
      if (!b || !b.url || !b.token) continue;
      const url = new URL(b.url).origin;
      boxes = boxes.filter((x) => x.url !== url);
      boxes.push({ name: String(b.name || new URL(url).hostname), url, token: String(b.token) });
    }
    saveBoxes(boxes);
    toast(list.length === 1 ? "Paired with " + list[0].name : "Paired with " + list.length + " boxes");
  } catch {
    toast("That pairing link is damaged. Scan the code again.");
  }
  history.replaceState(null, "", location.pathname + location.search);
})();

// --- talking to boxes -------------------------------------------------------

async function api(box, method, path, body) {
  if (MOCK) return mockApi(box, method, path, body);
  const res = await fetch(box.url + path, {
    method,
    headers: { Authorization: "Bearer " + box.token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.status + " " + res.statusText);
  return data;
}

const ORDER = { waiting: 0, running: 1, finished: 2, idle: 3 };
const GROUPS = [
  ["waiting", "Needs you"],
  ["running", "Working"],
  ["finished", "Done"],
  ["idle", "Ready"],
];
const AGENTS = { claude: "C", codex: "X", opencode: "O", gemini: "G", cursor: "U" };
const AGENT_NAMES = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", gemini: "Gemini", cursor: "Cursor" };

function where(s) {
  const [loc, wt] = String(s.location || "").split("/");
  return { worktree: wt || loc || s.name, repo: loc || "" };
}
function ago(t) {
  if (!t) return "";
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return Math.floor(s) + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  return Math.floor(s / 86400) + "d";
}
// The last few lines that say something, without an agent's input box.
function lastLines(screen, n = 3) {
  const lines = String(screen || "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() && !/^[─━-]{6,}$/.test(l.trim()) && !/^\s*[>❯›]\s*$/.test(l) && !/shift\+tab|esc to interrupt|\? for shortcuts/i.test(l));
  return lines.slice(-n).join("\n");
}
// Answers an agent is offering: numbered options, or a yes/no.
function answers(screen) {
  const tail = String(screen || "").split("\n").slice(-30);
  const out = [];
  for (const l of tail) {
    const m = l.match(/^\s*[❯>›]?\s*(\d)[.)]\s+(.{1,60})/);
    if (m && !out.some((a) => a.key === m[1])) out.push({ key: m[1], label: m[2].trim() });
  }
  if (!out.length && /\(y\/n\)|\[y\/n\]|\[Y\/n\]|\[y\/N\]/.test(tail.join("\n"))) {
    out.push({ key: "y", label: "Yes" }, { key: "n", label: "No" });
  }
  return out.slice(0, 6);
}

// --- list -------------------------------------------------------------------

let timer = 0;
let showReady = false;

async function loadAll() {
  const results = await Promise.all(
    boxes.map(async (box) => {
      try {
        const sessions = await api(box, "GET", "/phone/v1/sessions");
        const agents = sessions.filter((s) => s.agent && !s.exited);
        const shells = sessions.length - agents.length;
        await Promise.all(
          agents
            .filter((s) => s.agent_state !== "idle")
            .slice(0, 12)
            .map(async (s) => {
              try {
                s.screen = (await api(box, "GET", "/phone/v1/sessions/" + encodeURIComponent(s.name) + "/screen")).screen;
              } catch {}
            })
        );
        return { box, agents, shells };
      } catch (e) {
        return { box, error: e.message || String(e) };
      }
    })
  );
  return results;
}

async function showList() {
  clearTimeout(timer);
  setBar("Berth", "", null);
  if (!boxes.length) return showPairing();
  const results = await loadAll();
  if (route().kind !== "list") return;
  const all = [];
  for (const r of results) for (const s of r.agents || []) all.push({ ...s, box: r.box });
  const offline = results.filter((r) => r.error);
  const waiting = all.filter((s) => s.agent_state === "waiting").length;
  setBar("Berth", waiting ? waiting + " need" + (waiting === 1 ? "s" : "") + " you" : all.length ? "Nothing needs you" : "", null);

  let html = "";
  for (const [state, label] of GROUPS) {
    let items = all.filter((s) => (s.agent_state || "running") === state).sort((a, b) => new Date(a.state_since || a.created) - new Date(b.state_since || b.created));
    if (!items.length) continue;
    if (state === "idle" && !showReady) {
      html += `<button class="more" type="button" data-act="ready">${items.length} ready for a first prompt ›</button>`;
      continue;
    }
    html += `<section class="group"><h2><span class="dot ${state}"></span>${label} <span class="n">${items.length}</span></h2>`;
    html += items.map(card).join("");
    html += `</section>`;
  }
  if (!all.length) html += `<div class="empty">No agents are running on your boxes.</div>`;
  for (const r of offline) html += `<p class="note bad">Can't reach ${esc(r.box.name)}: ${esc(r.error)}</p>`;
  html += `<p class="note">${boxes.length} box${boxes.length === 1 ? "" : "es"} · <button class="link" type="button" data-act="boxes">Manage</button></p>`;
  main.innerHTML = html;
  timer = setTimeout(() => route().kind === "list" && showList(), 4000);
}

function card(s) {
  const w = where(s);
  const state = s.agent_state || "running";
  const href = "#s=" + encodeURIComponent(s.box.name) + "/" + encodeURIComponent(s.name);
  return `<a class="card ${state}" href="${href}">
    <div class="card-top">
      <span class="glyph" aria-hidden="true">${esc(AGENTS[s.agent] || "•")}</span>
      <div class="who"><b>${esc(w.worktree)}</b><span>${esc([s.box.name, w.repo].filter(Boolean).join(" · "))}</span></div>
      <span class="since">${esc(ago(s.state_since || s.created))}</span>
    </div>
    ${s.screen ? `<pre class="lines">${esc(lastLines(s.screen))}</pre>` : ""}
  </a>`;
}

// --- session ----------------------------------------------------------------

let current = null;

async function showSession(boxName, name) {
  clearTimeout(timer);
  const box = boxes.find((b) => b.name === boxName) || (boxes.length === 1 ? boxes[0] : null);
  if (!box) {
    main.innerHTML = `<div class="empty">This phone isn't paired with ${esc(boxName)}.</div>`;
    return;
  }
  if (!current || current.box !== box || current.name !== name) {
    current = { box, name, draft: "" };
    main.innerHTML = `<pre class="screen" id="screen">Loading…</pre>
      <div class="chips" id="answers"></div>
      <div class="compose"><textarea id="prompt" rows="1" placeholder="Send a prompt" enterkeyhint="send"></textarea><button class="btn" id="send" type="button">Send</button></div>
      <div class="row" id="keys"></div>`;
    const ta = $("prompt");
    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    });
    $("send").addEventListener("click", sendPrompt);
  }
  try {
    const sessions = await api(box, "GET", "/phone/v1/sessions");
    const s = sessions.find((x) => x.name === name);
    if (!s) {
      setBar(name, box.name, null);
      main.innerHTML = `<div class="empty">This session has ended.</div>`;
      return;
    }
    const w = where(s);
    // An agent stops its turn on Esc; Ctrl-C twice would quit it, so only a
    // plain shell gets Ctrl-C.
    const keys = $("keys");
    if (keys && keys.dataset.kind !== (s.agent ? "agent" : "shell")) {
      keys.dataset.kind = s.agent ? "agent" : "shell";
      keys.innerHTML = s.agent
        ? `<button class="btn ghost" type="button" data-key="enter">Enter</button><button class="btn danger" type="button" data-key="escape">Stop</button>`
        : `<button class="btn ghost" type="button" data-key="enter">Enter</button><button class="btn danger" type="button" data-key="interrupt">Ctrl-C</button>`;
    }
    setBar(w.worktree, [AGENT_NAMES[s.agent] || "Shell", box.name, w.repo].filter(Boolean).join(" · "), s.exited ? "exited" : s.agent_state || "");
    const { screen } = await api(box, "GET", "/phone/v1/sessions/" + encodeURIComponent(name) + "/screen?history=300");
    const el = $("screen");
    if (el) {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      el.textContent = screen.replace(/\n+$/, "");
      if (atBottom || el.dataset.first !== "0") el.scrollTop = el.scrollHeight;
      el.dataset.first = "0";
    }
    const opts = s.agent_state === "waiting" || s.agent_state === "idle" ? answers(screen) : [];
    const ans = $("answers");
    if (ans) ans.innerHTML = opts.map((a) => `<button class="chip answer" type="button" data-key="${esc(a.key)}"><b>${esc(a.key)}</b><span>${esc(a.label)}</span></button>`).join("");
  } catch (e) {
    toast(e.message || String(e));
  }
  timer = setTimeout(() => {
    const r = route();
    if (r.kind === "session" && r.name === name) showSession(boxName, name);
  }, 2000);
}

async function sendPrompt() {
  const ta = $("prompt");
  const text = ta.value.trim();
  if (!text || !current) return;
  $("send").disabled = true;
  try {
    await api(current.box, "POST", "/phone/v1/sessions/" + encodeURIComponent(current.name) + "/send", { text, enter: true });
    ta.value = "";
    ta.style.height = "";
    toast("Sent");
  } catch (e) {
    toast(e.message || String(e));
  }
  $("send").disabled = false;
}

async function pressKey(key) {
  if (!current) return;
  try {
    await api(current.box, "POST", "/phone/v1/sessions/" + encodeURIComponent(current.name) + "/keys", { key });
    if (navigator.vibrate) navigator.vibrate(10);
    clearTimeout(timer);
    setTimeout(() => showSession(current.box.name, current.name), 400);
  } catch (e) {
    toast(e.message || String(e));
  }
}

// --- pairing and boxes --------------------------------------------------------

function showPairing() {
  setBar("Berth", "", null);
  main.innerHTML = `<div class="hero">
    <h1>Pair this phone</h1>
    <p class="note">See which agents need you and answer them from here, across all your boxes.</p>
    <ol>
      <li>On your laptop, open Berth → Settings → Phone.</li>
      <li>Turn on phone access for your boxes.</li>
      <li>Scan the code with this phone's camera.</li>
    </ol>
    <p class="note">This phone needs to be on the same tailnet as your boxes (the Tailscale app).</p>
  </div>`;
}

function showBoxes() {
  clearTimeout(timer);
  setBar("Boxes", "Paired with this phone", null);
  main.innerHTML = `<div class="boxes">${boxes
    .map((b, i) => `<div class="boxrow"><div><b>${esc(b.name)}</b><br><span>${esc(b.url)}</span></div><button class="btn ghost" type="button" data-forget="${i}">Forget</button></div>`)
    .join("")}</div>
    <p class="note">To add a box, scan its code from Berth → Settings → Phone. Forgetting a box only removes it from this phone; turn phone access off in Berth to stop it answering.</p>`;
}

// --- routing and chrome ---------------------------------------------------------

function route() {
  const h = location.hash;
  let m = h.match(/^#s=([^/]+)\/(.+)$/);
  if (m) return { kind: "session", box: decodeURIComponent(m[1]), name: decodeURIComponent(m[2]) };
  // A notification links to the box that sent it, by session name alone.
  m = h.match(/^#s=(.+)$/);
  if (m) {
    const own = boxes.find((b) => b.url === location.origin);
    return { kind: "session", box: own ? own.name : "", name: decodeURIComponent(m[1]) };
  }
  if (h === "#boxes") return { kind: "boxes" };
  return { kind: "list" };
}

function render() {
  const r = route();
  main.classList.toggle("session", r.kind === "session");
  $("back").hidden = r.kind === "list";
  if (r.kind !== "session") current = null;
  if (r.kind === "session") showSession(r.box, r.name);
  else if (r.kind === "boxes") showBoxes();
  else showList();
}

function setBar(title, sub, state) {
  $("title").textContent = title;
  $("subtitle").textContent = sub || "";
  const st = $("state");
  st.hidden = !state;
  if (state) {
    st.textContent = { waiting: "needs you", running: "working", finished: "done", idle: "ready" }[state] || state;
    st.className = "state " + state;
  }
}

let toastTimer = 0;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2400);
}

$("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.hash = "";
});
main.addEventListener("click", (e) => {
  const k = e.target.closest("[data-key]");
  if (k) return pressKey(k.dataset.key);
  const a = e.target.closest("[data-act]");
  if (a && a.dataset.act === "ready") {
    showReady = true;
    return showList();
  }
  if (a && a.dataset.act === "boxes") return (location.hash = "boxes");
  const f = e.target.closest("[data-forget]");
  if (f) {
    boxes.splice(Number(f.dataset.forget), 1);
    saveBoxes(boxes);
    return showBoxes();
  }
});
main.addEventListener("keydown", (e) => {
  if (e.target.id === "prompt" && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendPrompt();
  }
});
window.addEventListener("hashchange", render);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && render());
render();

// --- demo data (?mock=1) ------------------------------------------------------

function mockBoxes() {
  return [
    { name: "devl", url: "http://devl.mock", token: "x" },
    { name: "build", url: "http://build.mock", token: "x" },
  ];
}
function mockApi(box, method, path, body) {
  const now = Date.now();
  const at = (min) => new Date(now - min * 60000).toISOString();
  const sessions = {
    devl: [
      { name: "shop-checkout-fix-claude-1a", location: "shop/checkout-fix", agent: "claude", agent_state: "waiting", state_since: at(3), created: at(40) },
      { name: "shop-qa-deck-codex-1b", location: "shop/qa-deck", agent: "codex", agent_state: "running", state_since: at(1), created: at(22) },
      { name: "demo-hello-claude-1c", location: "demo/hello", agent: "claude", agent_state: "finished", state_since: at(12), created: at(50) },
      { name: "demo-shell-1d", location: "demo", command: "", created: at(80) },
    ],
    build: [{ name: "shop-pr-claude-2a", location: "shop/pr", agent: "claude", agent_state: "idle", state_since: at(30), created: at(30) }],
  }[box.name] || [];
  const screens = {
    "shop-checkout-fix-claude-1a":
      "● I need to change the payment webhook handler, which touches checkout.\n\n Do you want to make this edit to webhook.ts?\n ❯ 1. Yes\n   2. Yes, and don't ask again this session\n   3. No, and tell Claude what to do differently\n",
    "shop-qa-deck-codex-1b": "• Running pnpm test --filter=@shop/web\n  PASS apps/web/test/cart.test.ts\n  PASS apps/web/test/orders.test.ts\n",
    "demo-hello-claude-1c": "❯ Reply with just the word: ready\n● ready\n✻ Brewed for 1s · done 7:14 PM\n",
  };
  if (path === "/phone/v1/sessions") return Promise.resolve(sessions);
  const m = path.match(/^\/phone\/v1\/sessions\/([^/]+)\/(screen|send|keys)/);
  if (m && m[2] === "screen") return Promise.resolve({ screen: screens[decodeURIComponent(m[1])] || "$ " });
  return Promise.resolve({ sent: true });
}
