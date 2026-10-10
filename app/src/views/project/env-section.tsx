import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderIcon, PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { boxApi, isSecretRef, type SecretTest } from "@/lib/api";
import type { RepoConfig } from "@/lib/flows";
import { plainError } from "@/lib/errors";
import { explainSecretError, refProblem } from "@/lib/secret-ref";
import { useStore } from "@/lib/store";
import { Section, SourceBadge } from "@/views/project/parts";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s1: {
    "width": "14px",
    "height": "14px",
  },
  s2: {
    "flexShrink": 0,
  },
  s3: {
    "color": {
      "default": "light-dark(var(--success-foreground), var(--success))",
    },
  },
  s4: {
    "color": "var(--destructive-foreground)",
  },
  s5: {
    "marginTop": "4px",
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "fontSize": "11px",
    "lineHeight": "16px",
  },
  s6: {
    "color": {
      "default": "light-dark(var(--success-foreground), var(--success))",
    },
  },
  s7: {
    "color": "var(--destructive-foreground)",
  },
  s8: {
    "color": "var(--warning-foreground)",
  },
  s9: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s10: {
    "color": "var(--destructive-foreground)",
  },
  s11: {
    "color": "var(--warning-foreground)",
  },
  s12: {
    "minWidth": "0px",
  },
  s13: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
  },
  s14: {
    "minWidth": "0px",
    "paddingLeft": "10px",
  },
  s15: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
  },
  s16: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "fontFamily": "var(--font-mono)",
  },
  s18: {
    "fontFamily": "var(--font-mono)",
  },
  s19: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s21: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,13rem) minmax(0,1fr) auto 3.5rem",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "display": "flex",
    "justifyContent": "flex-end",
  },
  s25: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,13rem) minmax(0,1fr) auto",
    "alignItems": "flex-start",
    "gap": "12px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 20%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s26: {
    "marginTop": "4px",
    "color": "var(--destructive-foreground)",
    "fontSize": "11px",
  },
  s27: {
    "minWidth": "0px",
  },
  s28: {
    "marginTop": "4px",
    "fontSize": "11px",
  },
  s29: {
    "color": "var(--destructive-foreground)",
  },
  s30: {
    "color": "var(--warning-foreground)",
  },
  s31: {
    "display": "flex",
    "gap": "4px",
  },
  s32: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s33: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s34: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s35: {
    "transform": "rotate(90deg)",
  },
  s36: {
    "display": "grid",
    "gridTemplateColumns": "auto 1fr",
    "columnGap": "24px",
    "rowGap": "4px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingBottom": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s37: {
    "display": "contents",
  },
  s38: {
    "fontFamily": "var(--font-mono)",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s39: {
    "color": "var(--muted-foreground)",
  },

  s40: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s41: {
    "@media (max-width: 1200px)": {
      gridTemplateColumns: "minmax(0,10rem) minmax(0,1fr) auto 3rem",
      gap: 8,
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const VARIABLES: [string, string][] = [
  ["BERTH_PORT", "The worktree's first port"],
  ["BERTH_PORT_1 …", "Its other ports, when it has more than one"],
  ["BERTH_WORKTREE_SLUG", "repo_worktree, safe for database names"],
  ["BERTH_WORKTREE_NAME", "The worktree's name"],
  ["BERTH_WORKTREE_PATH", "Its folder"],
  ["BERTH_BRANCH", "Its branch"],
  ["BERTH_ROOT_PATH", "The repository's main checkout"],
  ["BERTH_LOCATION", "The repo's name on this box"],
  ["BERTH_BOX", "This box's name"],
];

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECRET = /KEY|SECRET|TOKEN|PASSWORD|PASS\b|CREDENTIAL/i;

const REF_HELP = "A secret reference: the box reads it from 1Password (op://vault/item/field) or its own environment (env://NAME) when a worktree's environment is built. The value never leaves the box.";

// RefMark marks a value that names a secret rather than holding one.
function RefMark() {
  return (
    <Tip label={REF_HELP}>
      <span className={sx(paint.s0)} aria-label="Secret reference">
        <KeyRoundIcon className={sx(paint.s1)} />
      </span>
    </Tip>
  );
}

// useSecretTest asks the box to resolve a reference and keeps only whether
// it could, and how long the value is. A changed reference has not been
// tested.
function useSecretTest(box: string, value: string) {
  const client = useStore((s) => s.client);
  const [result, setResult] = useState<SecretTest | "testing">();
  useEffect(() => setResult(undefined), [value]);
  const test = async () => {
    if (!client) return;
    setResult("testing");
    try {
      setResult(await boxApi.testSecret(client, box, value));
    } catch (err) {
      setResult({ ok: false, error: plainError(err) });
    }
  };
  const done = result && result !== "testing" ? result : undefined;
  const chars = (n: number) => `${n} ${n === 1 ? "character" : "characters"}`;
  const said = !done ? undefined : done.ok ? (done.length ? `Resolved · ${chars(done.length)}` : "Resolved, but empty") : explainSecretError(done.error ?? "Could not read it");
  return { ready: !!client, testing: result === "testing", done, said, test };
}

type Tested = ReturnType<typeof useSecretTest>;

// SecretTestButton is "Test" until it has run; then just its mark, since
// the result reads in full under the field.
function SecretTestButton({ box, t }: { box: string; t: Tested }) {
  return (
    <Tip label={t.said ? `${t.said}. Test again` : `Ask ${box} to read it now`}>
      <span className={[sx(paint.s2), t.done?.ok && sx(paint.s3), t.done && !t.done.ok && sx(paint.s4)].filter(Boolean).join(" ")}><Button
        size={t.done ? "icon-xs" : "xs"}
        variant="ghost"
        aria-label={t.done ? `Test again: ${t.said}` : undefined}
        onClick={() => void t.test()}
        disabled={!t.ready || t.testing}>
        {t.testing ? <LoaderIcon className="burf-spin" /> : t.done?.ok ? <CheckIcon /> : t.done ? <CircleAlertIcon /> : null}
        {!t.done && "Test"}
      </Button></span>
    </Tip>
  );
}

// Note is the line under a value: a test's result, or why a reference
// won't work.
function Note({ tone, children }: { tone: "ok" | "error" | "warning"; children: string }) {
  return (
    <Tip label={children} align="start">
      <p
        aria-live="polite"
        className={[sx(paint.s5), tone === "ok" && sx(paint.s6), tone === "error" && sx(paint.s7), tone === "warning" && sx(paint.s8)].filter(Boolean).join(" ")}
      >
        {children}
      </p>
    </Tip>
  );
}

// RefNotes says what is wrong with a reference, or what its test found.
function RefNotes({ problem, broken, t }: { problem?: string; broken: boolean; t: Tested }) {
  if (problem) return <Note tone={broken ? "error" : "warning"}>{problem}</Note>;
  if (t.said) return <Note tone={t.done?.ok ? "ok" : "error"}>{t.said}</Note>;
  return null;
}

// ProblemMark stands where the key mark would for a reference that won't
// resolve as written.
function ProblemMark({ broken }: { broken: boolean }) {
  return <CircleAlertIcon aria-hidden className={[sx(paint.s9), broken ? sx(paint.s10) : sx(paint.s11)].filter(Boolean).join(" ")} />;
}

// SecretInput hides values whose names look like secrets until asked, so a
// screen share doesn't show them. A reference is not a secret, so it shows,
// marked, with a Test action and its result underneath; a malformed one
// says what's wrong instead.
function SecretInput({ name, value, onChange, box }: { name: string; value: string; onChange(v: string): void; box: string }) {
  const ref = isSecretRef(value);
  const problem = refProblem(value);
  // An op:// or env:// value the box would refuse, not just one that looks
  // like a reference.
  const broken = ref && !!problem;
  const secret = SECRET.test(name) && !ref && !problem;
  const [shown, setShown] = useState(!SECRET.test(name));
  const t = useSecretTest(box, value);
  return (
    <div className={sx(paint.s12)}>
      <div className={sx(paint.s13)}>
        {problem ? <ProblemMark broken={broken} /> : ref && <RefMark />}
        <Input
          value={value}
          type={shown || ref || problem ? "text" : "password"}
          onChange={(e) => onChange(e.target.value)}
          size="sm"
          mono text="xs"
          spellCheck={false}
          autoComplete="off"
          aria-label={`${name} value`}
          aria-invalid={broken || undefined}
        />
        {secret && (
          <Button size="icon-xs" variant="ghost" aria-label={shown ? `Hide ${name}` : `Show ${name}`} onClick={() => setShown(!shown)}>
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        )}
        {ref && !problem && <SecretTestButton box={box} t={t} />}
      </div>
      <RefNotes problem={problem} broken={broken} t={t} />
    </div>
  );
}

// CommittedRef is a reference the repository commits: read-only here, but
// testable on this box.
function CommittedRef({ value, box }: { value: string; box: string }) {
  const problem = refProblem(value);
  const t = useSecretTest(box, value);
  return (
    <div className={sx(paint.s14)}>
      <div className={sx(paint.s15)}>
        {problem ? <ProblemMark broken /> : <RefMark />}
        <Tip label={value} width="lg">
          <code className={sx(paint.s16)}>{value}</code>
        </Tip>
        {!problem && <SecretTestButton box={box} t={t} />}
      </div>
      <RefNotes problem={problem} broken t={t} />
    </div>
  );
}

// EnvSection is the environment every worktree gets: what the repository
// commits, with this box's values laid over it.
export function EnvSection({ repo, draft, setDraft, box }: { repo: RepoConfig | null; draft: RepoConfig; setDraft(c: RepoConfig): void; box: string }) {
  const committed = repo?.env ?? {};
  const own = draft.env ?? {};
  const keys = [...new Set([...Object.keys(committed), ...Object.keys(own)])].sort();
  const [showVars, setShowVars] = useState(false);
  const [adding, setAdding] = useState<{ key: string; value: string }>();

  const setOwn = (env: Record<string, string>) => setDraft({ ...draft, env });
  const put = (k: string, v: string) => setOwn({ ...own, [k]: v });
  const drop = (k: string) => {
    const { [k]: _, ...rest } = own;
    setOwn(rest);
  };

  const valueProblem = adding ? refProblem(adding.value) : undefined;
  // A reference the box would refuse can't be added; one that only looks
  // like a reference is a warning, since it may be meant as text.
  const valueBroken = !!adding && isSecretRef(adding.value) && !!valueProblem;
  const keyError = adding?.key && (!NAME.test(adding.key) ? "Letters, digits and _, not starting with a digit" : keys.includes(adding.key) ? "Already set; edit it above" : undefined);

  return (
    <Section
      id="env"
      title="Environment"
      description={
        <>
          Added to everything that runs in a worktree: setup, services, agents, flows. <code className={sx(paint.s17)}>$BERTH_*</code> values are filled in per worktree. A value can name a secret instead, like <code className={sx(paint.s18)}>op://vault/item/field</code>, which the box reads when it needs it.
        </>
      }
      actions={
        <Button size="xs" variant="ghost" onClick={() => setAdding({ key: "", value: "" })}>
          <PlusIcon />
          Add variable
        </Button>
      }
    >
      {keys.length === 0 && !adding && <p className={sx(paint.s19)}>No variables yet. A common one: DATABASE_URL with $BERTH_WORKTREE_SLUG, so each worktree has its own database.</p>}
      {keys.length > 0 && (
        <div className={[sx(paint.s20), sx(paint.s40)].filter(Boolean).join(" ")}>
          {keys.map((k) => {
            const inRepo = k in committed;
            const mine = k in own;
            const source = mine ? (inRepo ? "override" : "box") : "repo";
            return (
              <div key={k} className={[sx(paint.s21), [sx(paint.s41), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
                <Tip label={k} width="lg">
                  <code className={sx(paint.s22)}>{k}</code>
                </Tip>
                {mine ? (
                  <SecretInput name={k} value={own[k]} onChange={(v) => put(k, v)} box={box} />
                ) : isSecretRef(committed[k]) ? (
                  <CommittedRef value={committed[k]} box={box} />
                ) : (
                  <Tip label={committed[k]} width="lg">
                    <code className={sx(paint.s23)}>{committed[k]}</code>
                  </Tip>
                )}
                <SourceBadge source={source} box={box} />
                <span className={sx(paint.s24)}>
                  {!mine && (
                    <Tip label={`Override on ${box}`}>
                      <Button size="icon-xs" variant="ghost" aria-label={`Override ${k} on ${box}`} onClick={() => put(k, committed[k])}>
                        <PlusIcon />
                      </Button>
                    </Tip>
                  )}
                  {mine && inRepo && (
                    <Tip label="Use the repo's value">
                      <Button size="icon-xs" variant="ghost" aria-label={`Use the repo's ${k}`} onClick={() => drop(k)}>
                        <Undo2Icon />
                      </Button>
                    </Tip>
                  )}
                  {mine && !inRepo && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Remove ${k}`} onClick={() => drop(k)}>
                      <Trash2Icon />
                    </Button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {adding && (
        <form
          className={sx(paint.s25)}
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.key || keyError || valueBroken) return;
            put(adding.key, adding.value);
            setAdding(undefined);
          }}
        >
          <div>
            <Input autoFocus value={adding.key} onChange={(e) => setAdding({ ...adding, key: e.target.value.toUpperCase().replace(/\s/g, "_") })} placeholder="NAME" size="sm" mono text="xs" aria-label="Name" aria-invalid={!!keyError} />
            {keyError && <p className={sx(paint.s26)}>{keyError}</p>}
          </div>
          <div className={sx(paint.s27)}>
            <Input
              value={adding.value}
              onChange={(e) => setAdding({ ...adding, value: e.target.value })}
              placeholder="postgres://localhost/$BERTH_WORKTREE_SLUG, or a secret: op://vault/item/field"
              size="sm"
              mono text="xs"
              aria-label="Value"
              aria-invalid={valueBroken || undefined}
              spellCheck={false}
              autoComplete="off"
            />
            {valueProblem && <p className={[sx(paint.s28), valueBroken ? sx(paint.s29) : sx(paint.s30)].filter(Boolean).join(" ")}>{valueProblem}</p>}
          </div>
          <span className={sx(paint.s31)}>
            <Button size="sm" type="submit" disabled={!adding.key || !!keyError || valueBroken}>
              Add
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(undefined)}>
              Cancel
            </Button>
          </span>
        </form>
      )}
      <div className={sx(paint.s32)}>
        <button type="button" onClick={() => setShowVars(!showVars)} className={sx(paint.s33)}>
          <ChevronRightIcon className={[sx(paint.s34), showVars && sx(paint.s35)].filter(Boolean).join(" ")} />
          Variables you can use
        </button>
        {showVars && (
          <dl className={sx(paint.s36)}>
            {VARIABLES.map(([k, v]) => (
              <div key={k} className={sx(paint.s37)}>
                <dt>
                  <code className={sx(paint.s38)}>${k}</code>
                </dt>
                <dd className={sx(paint.s39)}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Section>
  );
}
