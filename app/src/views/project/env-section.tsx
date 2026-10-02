import { CheckIcon, ChevronRightIcon, CircleAlertIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderIcon, PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { boxApi, isSecretRef, type SecretTest } from "@/lib/api";
import type { RepoConfig } from "@/lib/flows";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Section, SourceBadge } from "@/views/project/parts";

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
      <span className="inline-flex shrink-0 text-muted-foreground" aria-label="Secret reference">
        <KeyRoundIcon className="size-3.5" />
      </span>
    </Tip>
  );
}

// SecretTestButton asks the box to resolve a reference and says only
// whether it could, and how long the value is.
function SecretTestButton({ box, value }: { box: string; value: string }) {
  const client = useStore((s) => s.client);
  const [result, setResult] = useState<SecretTest | "testing">();
  // A changed reference has not been tested.
  useEffect(() => setResult(undefined), [value]);
  const test = async () => {
    if (!client) return;
    setResult("testing");
    try {
      setResult(await boxApi.testSecret(client, box, value));
    } catch (err) {
      setResult({ ok: false, error: errorMessage(err) });
    }
  };
  // The result lives in the button, so the reference beside it keeps its
  // width; the tooltip has the whole of it.
  const done = result && result !== "testing" ? result : undefined;
  const chars = (n: number) => `${n} ${n === 1 ? "character" : "characters"}`;
  const said = !done ? undefined : done.ok ? (done.length ? `Resolved · ${chars(done.length ?? 0)}` : "Resolved, but empty") : (done.error ?? "Could not read it");
  return (
    <span className="flex shrink-0 items-center">
      <Tip label={said ? `${said}. Test again` : `Ask ${box} to read it now`}>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => void test()}
          disabled={!client || result === "testing"}
          className={cn(done?.ok && "text-success-foreground dark:text-success", done && !done.ok && "text-destructive-foreground")}
        >
          {result === "testing" ? <LoaderIcon className="animate-spin" /> : done?.ok ? <CheckIcon /> : done ? <CircleAlertIcon /> : null}
          {!done ? "Test" : done.ok ? (done.length ? `${done.length} chars` : "Empty") : "Failed"}
        </Button>
      </Tip>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </span>
  );
}

// SecretInput hides values whose names look like secrets until asked, so a
// screen share doesn't show them. A reference is not a secret, so it shows,
// marked, with a Test action.
function SecretInput({ name, value, onChange, box }: { name: string; value: string; onChange(v: string): void; box: string }) {
  const ref = isSecretRef(value);
  const secret = SECRET.test(name) && !ref;
  const [shown, setShown] = useState(!SECRET.test(name));
  return (
    <div className="flex min-w-0 items-center gap-1">
      {ref && <RefMark />}
      <Input value={value} type={shown || ref ? "text" : "password"} onChange={(e) => onChange(e.target.value)} size="sm" className="font-mono text-xs" spellCheck={false} autoComplete="off" />
      {secret && (
        <Button size="icon-xs" variant="ghost" aria-label={shown ? `Hide ${name}` : `Show ${name}`} onClick={() => setShown(!shown)}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      )}
      {ref && <SecretTestButton box={box} value={value} />}
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

  const keyError = adding?.key && (!NAME.test(adding.key) ? "Letters, digits and _, not starting with a digit" : keys.includes(adding.key) ? "Already set; edit it above" : undefined);

  return (
    <Section
      id="env"
      title="Environment"
      description={
        <>
          Added to everything that runs in a worktree: setup, services, agents, flows. <code className="font-mono">$BERTH_*</code> values are filled in per worktree. A value can name a secret instead, like <code className="font-mono">op://vault/item/field</code>, which the box reads when it needs it.
        </>
      }
      actions={
        <Button size="xs" variant="ghost" onClick={() => setAdding({ key: "", value: "" })}>
          <PlusIcon />
          Add variable
        </Button>
      }
    >
      {keys.length === 0 && !adding && <p className="px-4 py-3 text-muted-foreground text-sm">No variables yet. A common one: DATABASE_URL with $BERTH_WORKTREE_SLUG, so each worktree has its own database.</p>}
      {keys.length > 0 && (
        <div className="divide-y divide-border/70">
          {keys.map((k) => {
            const inRepo = k in committed;
            const mine = k in own;
            const source = mine ? (inRepo ? "override" : "box") : "repo";
            return (
              <div key={k} className="group grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto_3.5rem] items-center gap-3 px-4 py-2">
                <code className="truncate font-mono text-xs" title={k}>
                  {k}
                </code>
                {mine ? (
                  <SecretInput name={k} value={own[k]} onChange={(v) => put(k, v)} box={box} />
                ) : isSecretRef(committed[k]) ? (
                  <div className="flex min-w-0 items-center gap-1 pl-2.5">
                    <RefMark />
                    <code className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs" title={committed[k]}>
                      {committed[k]}
                    </code>
                    <SecretTestButton box={box} value={committed[k]} />
                  </div>
                ) : (
                  <code className="truncate px-2.5 font-mono text-muted-foreground text-xs" title={committed[k]}>
                    {committed[k]}
                  </code>
                )}
                <SourceBadge source={source} box={box} field="env" entry={k} />
                <span className="flex justify-end">
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
          className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] items-start gap-3 border-t bg-muted/20 px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.key || keyError) return;
            put(adding.key, adding.value);
            setAdding(undefined);
          }}
        >
          <div>
            <Input autoFocus value={adding.key} onChange={(e) => setAdding({ ...adding, key: e.target.value.toUpperCase().replace(/\s/g, "_") })} placeholder="NAME" size="sm" className="font-mono text-xs" aria-invalid={!!keyError} />
            {keyError && <p className="mt-1 text-destructive-foreground text-[11px]">{keyError}</p>}
          </div>
          <Input value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} placeholder="postgres://localhost/$BERTH_WORKTREE_SLUG, or a secret: op://vault/item/field" size="sm" className="font-mono text-xs" />
          <span className="flex gap-1">
            <Button size="sm" type="submit" disabled={!adding.key || !!keyError}>
              Add
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setAdding(undefined)}>
              Cancel
            </Button>
          </span>
        </form>
      )}
      <div className="border-t">
        <button type="button" onClick={() => setShowVars(!showVars)} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-muted-foreground text-xs hover:text-foreground">
          <ChevronRightIcon className={cn("size-3 transition-transform", showVars && "rotate-90")} />
          Variables you can use
        </button>
        {showVars && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 px-4 pb-3 text-xs">
            {VARIABLES.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <code className="font-mono text-foreground/90">${k}</code>
                </dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Section>
  );
}
