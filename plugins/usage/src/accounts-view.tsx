import * as stylex from "@stylexjs/stylex";
import { sessionName, useCurrentWorktree, useSessions, worktreeLocation, type BerthPluginContext, type Location } from "@berth/plugin";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
  Icon,
  Input,
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from "@berth/plugin/ui";
import { useState } from "react";

import { ACCOUNT_VAR, runScript, type Account, type Accounts, type Agent } from "./box";
import { SERIES } from "./chart";
import { AGENT_NAME, plan } from "./data";

const paint = stylex.create({
  s0: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s1: {
    "height": "160px",
    "width": "100%",
  },
  s2: {
    "height": "160px",
    "width": "100%",
  },
  s3: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "16px",
    },
  },
  s4: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "3px",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "fontFamily": "var(--font-mono)",
  },
  s7: {
    "marginLeft": "auto",
  },
  s8: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s9: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s10: {
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "width": "16px",
    "height": "16px",
  },
  s12: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s13: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
  },
  s14: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s18: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "2px",
  },
  s21: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s24: {
    "minWidth": "192px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s25: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "color": "var(--destructive-foreground)",
  },
  s27: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Where each agent's account is chosen: the box's env.json, and each
// project's box-local config. Both only reach sessions started afterwards.
export interface Choices {
  box: Record<string, string>;
  projects: Record<string, Record<string, string>>;
}

const AGENTS: Agent[] = ["claude", "codex"];
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

// The account a value of CLAUDE_CONFIG_DIR or CODEX_HOME points at.
function accountFor(list: Account[], agent: Agent, value: string | undefined, home: string): Account | undefined {
  if (!value) return list.find((a) => a.agent === agent && a.id === "default");
  const dir = value.replace(/^(~|\$HOME|\$\{HOME\})(?=\/|$)/, home).replace(/\/+$/, "");
  return list.find((a) => a.agent === agent && a.dir.replace(/\/+$/, "") === dir);
}

function loginCommand(agent: Agent, dir: string) {
  return agent === "claude" ? `CLAUDE_CONFIG_DIR='${dir}' claude` : `CODEX_HOME='${dir}' codex login --device-auth`;
}

export function AccountsView({
  berth,
  box,
  data,
  choices,
  locations,
  reload,
}: {
  berth: BerthPluginContext;
  box: string;
  data?: Accounts;
  choices?: Choices;
  locations: Location[];
  reload: () => Promise<void>;
}) {
  const current = useCurrentWorktree();
  const here = current?.box === box ? current : undefined;
  const all = useSessions(box) ?? [];
  const sessions = all.filter((s) => !s.exited && (s.agent === "claude" || s.agent === "codex"));
  const [adding, setAdding] = useState<Agent>();
  const [busy, setBusy] = useState<string>();

  if (!data || !choices) {
    return (
      <div className={sx(paint.s0)}>
        <Skeleton className={sx(paint.s1)} />
        <Skeleton className={sx(paint.s2)} />
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      await reload();
      if (done) berth.notify(done);
    } catch (err) {
      berth.notify("That didn't work", String((err as Error).message ?? err));
    } finally {
      setBusy(undefined);
    }
  };

  // Sets or clears one variable for the whole box.
  const useOnBox = (a: Account) =>
    run(`box:${a.agent}:${a.id}`, async () => {
      const doc = await berth.api.request<{ env: Record<string, string> }>(box, "GET", "env");
      const env = { ...(doc.env ?? {}) };
      if (a.id === "default") delete env[ACCOUNT_VAR[a.agent]];
      else env[ACCOUNT_VAR[a.agent]] = a.dir;
      await berth.api.request(box, "PUT", "env", { env });
    }, `New ${AGENT_NAME[a.agent]} sessions on ${box} use ${a.id === "default" ? "the default account" : a.id}`);

  // Sets one project's variable in its box-local config; null clears it so
  // the project follows the box again.
  const useOnProject = (a: Account | null, agent: Agent, location: string) =>
    run(`project:${agent}:${a?.id ?? ""}`, async () => {
      const cfg = await berth.api.request<{ local?: { env?: Record<string, string> } }>(box, "GET", `locations/${encodeURIComponent(location)}/config`);
      const local = { ...(cfg.local ?? {}) };
      const env = { ...(local.env ?? {}) };
      if (a) env[ACCOUNT_VAR[agent]] = a.dir;
      else delete env[ACCOUNT_VAR[agent]];
      await berth.api.request(box, "PUT", `locations/${encodeURIComponent(location)}/config`, { local: { ...local, env } });
    }, a ? `New ${AGENT_NAME[agent]} sessions in ${location} use ${a.id}` : `${location} follows the box's ${AGENT_NAME[agent]} account again`);

  // Opens a terminal in the current worktree that runs the agent's own
  // sign-in with that account's folder. Burf never sees the credentials.
  const signIn = async (a: Pick<Account, "agent" | "dir">) => {
    const location = here ? worktreeLocation(here) : locations[0]?.name;
    if (!location) throw new Error(`${box} has no projects to open a terminal in`);
    const s = await berth.api.request<{ name: string }>(box, "POST", "sessions", { location, command: loginCommand(a.agent, a.dir) });
    berth.openTerminal(box, s.name);
  };

  // Burf's hooks and skills go in the new folder before the agent first
  // runs there, when the box has them for this agent at all. A box whose
  // berthd predates accounts installs them when a session starts on it.
  const addIntegrations = async (agent: Agent, dir: string) => {
    try {
      const rep = await berth.api.request<{ tools?: { id: string; hooked: boolean }[] }>(box, "GET", "integrations");
      if (rep?.tools?.find((t) => t.id === agent)?.hooked) await berth.api.request(box, "POST", "integrations/install", { tool: agent, account: dir });
    } catch {
      // Not worth failing the sign-in over.
    }
  };

  const add = (agent: Agent, name: string) =>
    run(`add:${agent}`, async () => {
      const location = here ? worktreeLocation(here) : locations[0]?.name;
      if (!location) throw new Error(`${box} has no projects yet`);
      const made = await runScript<{ dir: string }>(berth, box, location, ["mkaccount", agent, name], "30s");
      await addIntegrations(agent, made.dir);
      setAdding(undefined);
      await signIn({ agent, dir: made.dir });
    });

  // Projects to offer, the one in front first.
  const projectOrder = locations.map((l) => l.name).sort((x, y) => Number(y === here?.location) - Number(x === here?.location));
  const boxAccount = (agent: Agent) => accountFor(data.accounts, agent, choices.box[ACCOUNT_VAR[agent]], data.home);
  const projectAccounts = (agent: Agent, a: Account) =>
    Object.entries(choices.projects)
      .filter(([, env]) => env[ACCOUNT_VAR[agent]] && accountFor(data.accounts, agent, env[ACCOUNT_VAR[agent]], data.home)?.id === a.id)
      .map(([loc]) => loc);

  return (
    <div className={sx(paint.s3)}>
      <Alert>
        <Icon name="Info" />
        <AlertDescription>
          Choosing an account changes the sessions you start next. Sessions that are already running keep the account they started with. Sign-in happens in the agent's own login, in a terminal on {box}; Burf never sees your credentials.
        </AlertDescription>
      </Alert>

      {AGENTS.map((agent) => {
        const list = data.accounts.filter((a) => a.agent === agent);
        const onBox = boxAccount(agent);
        return (
          <Frame key={agent} variant="card">
            <FrameHeader row gap={2} pad="tight">
              <span className={[sx(paint.s4), SERIES[agent].dot].filter(Boolean).join(" ")} />
              <FrameTitle>{AGENT_NAME[agent]}</FrameTitle>
              <span className={sx(paint.s5)}>
                picked with <code className={sx(paint.s6)}>{ACCOUNT_VAR[agent]}</code>
              </span>
              <Button size="sm" variant="outline" className={sx(paint.s7)} onClick={() => setAdding(adding === agent ? undefined : agent)}>
                <Icon name="Plus" />
                Add account…
              </Button>
            </FrameHeader>
            <FramePanel pad="none">
              {adding === agent && <AddAccount agent={agent} taken={list.map((a) => a.id)} busy={busy === `add:${agent}`} where={here ? `${here.location}/${here.worktree}` : locations[0]?.name} onCancel={() => setAdding(undefined)} onAdd={(name) => void add(agent, name)} />}
              <ul className={sx(paint.s8)}>
                {list.map((a) => {
                  const p = plan(a);
                  const projects = projectAccounts(agent, a);
                  const isBox = onBox?.id === a.id;
                  return (
                    <li key={a.id} className={sx(paint.s9)}>
                      <div className={sx(paint.s10)}>
                        <Icon name={a.signed_in ? "UserRound" : "UserRoundX"} className={sx(paint.s11)} />
                      </div>
                      <div className={sx(paint.s12)}>
                        <div className={sx(paint.s13)}>
                          <span className={sx(paint.s14)}>{a.id === "default" ? "Default" : a.id}</span>
                          {a.signed_in ? (a.email || !p) && <span className={sx(paint.s15)}>{a.email ?? "Signed in"}</span> : <Badge variant="warning" size="sm">Not signed in</Badge>}
                          {p && (
                            <Badge variant="outline" size="sm">
                              {p.label}
                            </Badge>
                          )}
                          {isBox && (
                            <Badge variant="info" size="sm">
                              Box default
                            </Badge>
                          )}
                          {projects.map((l) => (
                            <Badge key={l} variant="secondary" size="sm">
                              {l}
                            </Badge>
                          ))}
                        </div>
                        <div className={sx(paint.s16)}>{a.dir.replace(data.home, "~")}</div>
                      </div>
                      {!a.signed_in && (
                        <Button size="sm" variant="outline" onClick={() => void run(`sign:${agent}:${a.id}`, () => signIn(a))}>
                          Sign in…
                        </Button>
                      )}
                      <Menu>
                        <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Use ${a.id} for…`} loading={busy?.endsWith(`:${agent}:${a.id}`)} />}>
                          <Icon name="Ellipsis" />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuGroup>
                            <MenuGroupLabel>Use for new sessions</MenuGroupLabel>
                            <MenuItem disabled={isBox} onClick={() => void useOnBox(a)}>
                              Everywhere on {box}
                            </MenuItem>
                            {projectOrder.map((loc) => (
                              <MenuItem key={loc} disabled={projects.includes(loc)} onClick={() => void useOnProject(a, agent, loc)}>
                                In {loc} only
                              </MenuItem>
                            ))}
                          </MenuGroup>
                          {projects.length > 0 && (
                            <>
                              <MenuSeparator />
                              {projects.map((loc) => (
                                <MenuItem key={loc} onClick={() => void useOnProject(null, agent, loc)}>
                                  Let {loc} follow the box
                                </MenuItem>
                              ))}
                            </>
                          )}
                          {a.signed_in && (
                            <>
                              <MenuSeparator />
                              <MenuItem onClick={() => void run(`sign:${agent}:${a.id}`, () => signIn(a))}>Sign in again…</MenuItem>
                            </>
                          )}
                        </MenuPopup>
                      </Menu>
                    </li>
                  );
                })}
              </ul>
            </FramePanel>
          </Frame>
        );
      })}

      <Frame variant="card">
        <FrameHeader pad="tight">
          <FrameTitle>Running sessions</FrameTitle>
        </FrameHeader>
        <FramePanel pad="none">
          {sessions.length === 0 ? (
            <p className={sx(paint.s17)}>No Claude Code or Codex sessions are running on {box}.</p>
          ) : (
            <ul className={sx(paint.s18)}>
              {sessions.map((s) => {
                const agent = s.agent as Agent;
                const env = data.sessions[s.name];
                const a = accountFor(data.accounts, agent, env?.[ACCOUNT_VAR[agent] as keyof typeof env], data.home);
                return (
                  <li key={s.name} className={sx(paint.s19)}>
                    <span className={[sx(paint.s20), SERIES[agent].dot].filter(Boolean).join(" ")} aria-label={AGENT_NAME[agent]} />
                    <span className={sx(paint.s21)}>
                      {sessionName(s, { sessions: all, locations, place: true })}
                    </span>
                    <span className={sx(paint.s22)}>{env ? (a ? `${a.id === "default" ? "Default" : a.id}${a.email ? ` · ${a.email}` : ""}` : (env[ACCOUNT_VAR[agent] as keyof typeof env] ?? "")) : "unknown"}</span>
                    <Button size="xs" variant="ghost" onClick={() => berth.openTerminal(box, s.name)}>
                      Open
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}

function AddAccount({ agent, taken, busy, where, onCancel, onAdd }: { agent: Agent; taken: string[]; busy: boolean; where?: string; onCancel: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const problem = !name ? undefined : !NAME.test(name) ? "Lowercase letters, digits and dashes" : taken.includes(name) ? "There's already an account with that name" : undefined;
  return (
    <form
      className={sx(paint.s23)}
      onSubmit={(e) => {
        e.preventDefault();
        if (name && !problem) onAdd(name);
      }}
    >
      <div className={sx(paint.s24)}>
        <Input autoFocus size="sm" placeholder="work, personal…" value={name} onChange={(e: { target: { value: string } }) => setName(e.target.value.trim().toLowerCase())} aria-label="Account name" aria-invalid={Boolean(problem)} />
        <p className={[sx(paint.s25), problem ? sx(paint.s26) : sx(paint.s27)].filter(Boolean).join(" ")}>
          {problem ?? `Makes ~/.berth/accounts/${agent}/${name || "<name>"} and opens ${agent === "claude" ? "Claude Code" : "codex login"} with it${where ? ` in ${where}` : ""}, so you can sign in.`}
        </p>
      </div>
      <Button size="sm" type="submit" disabled={!name || Boolean(problem)} loading={busy}>
        Create and sign in
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
