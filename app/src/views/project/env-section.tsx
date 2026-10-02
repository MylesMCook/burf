import { ChevronRightIcon, EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepoConfig } from "@/lib/flows";
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

// SecretInput hides values whose names look like secrets until asked, so a
// screen share doesn't show them.
function SecretInput({ name, value, onChange }: { name: string; value: string; onChange(v: string): void }) {
  const secret = SECRET.test(name);
  const [shown, setShown] = useState(!secret);
  return (
    <div className="flex items-center gap-1">
      <Input value={value} type={shown ? "text" : "password"} onChange={(e) => onChange(e.target.value)} size="sm" className="font-mono text-xs [font-variant-ligatures:none]" spellCheck={false} autoComplete="off" />
      {secret && (
        <Button size="icon-xs" variant="ghost" aria-label={shown ? `Hide ${name}` : `Show ${name}`} onClick={() => setShown(!shown)}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      )}
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
          Added to everything that runs in a worktree: setup, services, agents, flows. <code className="font-mono">$BERTH_*</code> values are filled in per worktree.
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
                  <SecretInput name={k} value={own[k]} onChange={(v) => put(k, v)} />
                ) : (
                  <code className="truncate px-2.5 font-mono text-muted-foreground text-xs [font-variant-ligatures:none]" title={committed[k]}>
                    {committed[k]}
                  </code>
                )}
                <SourceBadge source={source} box={box} field="env" entry={k} />
                <span className="flex justify-end">
                  {!mine && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Override ${k} on ${box}`} title={`Override on ${box}`} onClick={() => put(k, committed[k])}>
                      <PlusIcon />
                    </Button>
                  )}
                  {mine && inRepo && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Use the repo's ${k}`} title="Use the repo's value" onClick={() => drop(k)}>
                      <Undo2Icon />
                    </Button>
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
          <Input value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} placeholder="value, e.g. postgres://localhost/$BERTH_WORKTREE_SLUG" size="sm" className="font-mono text-xs" />
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
