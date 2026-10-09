import { AppWindowIcon, ExternalLinkIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { openUrl } from "@/lib/open-url";
import type { TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";

const host = (url?: string) => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
};

// ArtifactCard is a publish where it happened in the chat: the page's
// title, and Open once it has a link.
// An artifact kept on the box (components/art), loaded the first time a
// chat shows one.
const LocalArtifactCard = lazy(() => import("@/components/art/art-card").then((m) => ({ default: m.LocalArtifactCard })));

export function ArtifactCard({ it }: { it: Extract<TranscriptItem, { kind: "artifact" }> }) {
  // One kept on the box (berthd artifact add), not a page on claude.ai.
  if (it.local)
    return (
      <Suspense fallback={<div className="cv-in h-[6.5rem] w-[min(100%,40rem)] animate-pulse self-start rounded-lg border bg-card" />}>
        <LocalArtifactCard it={it} />
      </Suspense>
    );
  const publishing = !it.done && !it.url;
  const status = it.error ? "Didn't publish" : publishing ? "Publishing" : it.updated ? "Updated" : "Published";
  const sub = it.error ? undefined : it.description;
  return (
    <div className={cn("cv-in flex w-[min(100%,40rem)] min-w-0 items-center gap-2 self-start rounded-lg border bg-card py-1 pl-2.5 text-[0.8125rem] shadow-xs/5", it.url ? "pr-1" : "pr-3")}>
      <AppWindowIcon className={cn("size-3.5 shrink-0", it.error ? "text-destructive-foreground" : "text-muted-foreground")} />
      <span className={cn("shrink-0", publishing ? "cv-shimmer" : it.error ? "text-destructive-foreground" : "text-muted-foreground")}>{status}</span>
      <span className="min-w-0 shrink truncate font-medium">{it.text}</span>
      {sub && <span className="hidden min-w-0 max-w-[22rem] flex-1 truncate text-muted-foreground @[640px]:block">· {sub}</span>}
      {it.url && (
        <Tip label={host(it.url) ? `Open on ${host(it.url)}` : "Open in your browser"}>
          <Button size="xs" variant="ghost" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" onClick={() => void openUrl(it.url!)}>
            Open
            <ExternalLinkIcon />
          </Button>
        </Tip>
      )}
    </div>
  );
}
