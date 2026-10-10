import * as stylex from "@stylexjs/stylex";
import { ArrowRightIcon, ChevronRightIcon, FolderGit2Icon, FolderOpenIcon, FolderPlusIcon, GitForkIcon, SparklesIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { CloneForm } from "@/components/add-project/clone-form";
import { CreateForm } from "@/components/add-project/create-form";
import { FolderBrowser } from "@/components/add-project/folder-browser";
import { StepHeader } from "@/components/step-header";
import { Button } from "@/components/ui/button";
import type { Location } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { useIsLocalBox } from "@/lib/local-box";
import { NONE, useStore } from "@/lib/store";
import { thisComputer } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "marginTop": "24px",
  },
  s1: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-2xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingTop": "4px",
  },
  s2: {
    "marginTop": "24px",
  },
  s3: {
    "marginBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s5: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s6: {
    "width": "16px",
    "height": "16px",
    "color": "var(--muted-foreground)",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s8: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "marginTop": "24px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--foreground) 20%, transparent)",
    "backgroundColor": "var(--card)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "14px",
    "paddingBottom": "14px",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
  },
  s12: {
    "display": "flex",
    "width": "36px",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": "var(--muted-foreground)",
  },
  s13: {
    "width": "16px",
    "height": "16px",
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s15: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s17: {
    "fontFamily": "var(--font-mono)",
  },
  s18: {
    "flexShrink": 0,
  },
  s19: {
    "marginTop": "8px",
    "paddingInlineStart": "52px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "marginTop": "24px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "16px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--foreground) 20%, transparent)",
    },
    "backgroundColor": {
      "default": "color-mix(in oklab, var(--card) 40%, transparent)",
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "textAlign": "left",
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s23: {
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s24: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s25: {
    "display": "block",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s26: {
    "marginTop": "2px",
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "width": "16px",
    "height": "16px",
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },

  s28: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s29: {
    translate: { ":is(.group:hover *)": "2px" },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Way = "browse" | "clone" | "create";

const wayTitles: Record<Way, string> = { browse: "Browse folders", clone: "Clone from URL", create: "Create a new project" };
// On this Mac's own box (Use this Mac) the folders are this Mac's.
const wayDetails = (box: string, local: boolean): Record<Way, string> => ({
  browse: local ? thisComputer("A repository already on this Mac, from your own folders") : `A repository already cloned on ${box}`,
  clone: local ? thisComputer("GitHub, GitLab or any git remote, cloned onto this Mac") : "GitHub, GitLab or any git remote, cloned by the box",
  create: "An empty repository, ready for worktrees",
});

// The sample project boxes make (examples/hello), and what it is.
export const SAMPLE = "hello";

// RepoStep adds the first project on the new box: the sample project, the
// quickest way to a first agent, then the same three ways the Add a
// project dialog offers: a repository already there, a clone, or a new
// empty one. A box that already has projects can go straight on. Skipping
// is the page's "Skip setup", beside the progress.
export function RepoStep({ box, onDone }: { box: string; onDone(location: string, sample?: boolean): void }) {
  const existing = useStore((s) => s.boxes[box]?.locations ?? NONE);
  const local = useIsLocalBox(box);
  const where = local ? thisComputer("this Mac") : box;
  const [way, setWay] = useState<Way>();
  // A box just paired may not have said what it can do yet.
  const caps = useStore((s) => s.boxes[box]?.info?.capabilities);
  useEffect(() => {
    void useStore.getState().refreshBox(box, ["info", "locations"]);
  }, [box]);
  const canSample = caps ? caps.includes("sample") : undefined;
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string>();
  const sample = async () => {
    if (existing.some((l) => l.name === SAMPLE)) return onDone(SAMPLE, true);
    const client = useStore.getState().client;
    if (!client) return;
    setMaking(true);
    setError(undefined);
    try {
      const loc = await client.box<Location>(box, "POST", "locations/new", { sample: SAMPLE });
      await useStore.getState().refreshBox(box, ["locations"]);
      onDone(loc.name, true);
    } catch (err) {
      setError(plainError(err, { box }));
      setMaking(false);
    }
  };

  const added = async (loc: Location) => {
    await useStore.getState().refreshBox(box, ["locations"]);
    onDone(loc.name);
  };

  return (
    <div>
      <StepHeader
        variant="page"
        title={way ? wayTitles[way] : `Add a project on ${where}`}
        description={
          way ? wayDetails(box, local)[way] : `A git repository on ${local ? thisComputer("this Mac") : "the box"}. Each piece of work gets its own worktree beside it, so agents never trip over each other.`
        }
        onBack={way ? () => setWay(undefined) : undefined}
      />

      {way ? (
        <div className={sx(paint.s0)}>
          {/* The Add a project forms, in a frame shaped like their dialog. */}
          <div data-slot="dialog-popup" className={sx(paint.s1)}>
            {way === "browse" && <FolderBrowser box={box} onAdded={added} />}
            {way === "clone" && <CloneForm box={box} onAdded={added} onCancel={() => setWay(undefined)} />}
            {way === "create" && <CreateForm box={box} onAdded={added} onCancel={() => setWay(undefined)} />}
          </div>
        </div>
      ) : (
        <>
          {existing.length > 0 && (
            <div className={sx(paint.s2)}>
              <div className={sx(paint.s3)}>Already on {where}</div>
              <ul className={[sx(paint.s4), sx(paint.s28)].filter(Boolean).join(" ")}>
                {existing.map((l) => (
                  <li key={l.name} className={sx(paint.s5)}>
                    <FolderGit2Icon className={sx(paint.s6)} />
                    <div className={sx(paint.s7)}>
                      <div className={sx(paint.s8)}>{l.name}</div>
                      <div className={sx(paint.s9)}>{l.path}</div>
                    </div>
                    <Button size="xs" variant="outline" onClick={() => onDone(l.name)}>
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canSample !== false && (
            <section aria-labelledby="sample-heading" className={sx(paint.s10)}>
              <div className={sx(paint.s11)}>
                <span aria-hidden className={sx(paint.s12)}>
                  <SparklesIcon className={sx(paint.s13)} />
                </span>
                <div className={sx(paint.s14)}>
                  <h2 id="sample-heading" className={sx(paint.s15)}>
                    Try the sample project
                  </h2>
                  <p className={sx(paint.s16)}>
                    <span className={sx(paint.s17)}>hello</span>: a tiny Node web server and its test, made in ~/work/hello on {where}. A good size for a first task.
                  </p>
                </div>
                <span className={sx(paint.s18)}><Button autoFocus={existing.length === 0}  disabled={canSample === undefined} loading={making} onClick={() => void sample()}>
                  Use the sample <ArrowRightIcon />
                </Button></span>
              </div>
              {error && <p className={sx(paint.s19)}>{error}</p>}
            </section>
          )}
          <div className={sx(paint.s20)}>
            <div className={sx(paint.s21)}>{existing.length > 0 ? "Or add another" : canSample !== false ? "Or one of your own" : "Add one"}</div>
            <WayButton icon={<FolderOpenIcon />} title={wayTitles.browse} detail={wayDetails(box, local).browse} onClick={() => setWay("browse")} />
            <WayButton icon={<GitForkIcon />} title={wayTitles.clone} detail={wayDetails(box, local).clone} onClick={() => setWay("clone")} />
            <WayButton icon={<FolderPlusIcon />} title={wayTitles.create} detail={wayDetails(box, local).create} onClick={() => setWay("create")} />
          </div>
        </>
      )}
    </div>
  );
}

function WayButton({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[sx(paint.s22), "group"].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s23)}>{icon}</span>
      <span className={sx(paint.s24)}>
        <span className={sx(paint.s25)}>{title}</span>
        <span className={sx(paint.s26)}>{detail}</span>
      </span>
      <ChevronRightIcon className={[sx(paint.s27), sx(paint.s29)].filter(Boolean).join(" ")} />
    </button>
  );
}
