import { PanelRightIcon } from "lucide-react";
import { useContext } from "react";

import { kindWord } from "@/components/art/kinds";
import { ArtifactCard } from "@/components/assistant-ui/elements/artifact-card";
import { ArtifactCard as BurfArtifactCard } from "@/components/conversation/artifacts";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { latest, useArtifact } from "@/lib/art/model";
import { openArtifact } from "@/lib/art/open";
import type { ChatArtifact as Artifact } from "@/lib/chat-artifacts";
import { PaneContext } from "@/lib/pane-context";

export function ChatArtifact({ it }: { it: Artifact }) {
  const pane = useContext(PaneContext);
  const art = useArtifact(it.local, pane?.worktree);
  if (!art) return <BurfArtifactCard it={it} />;
  const from = pane ? { wsKey: pane.wsKey, tab: pane.tab, pane: pane.pane } : undefined;
  const open = (split = false) => openArtifact(art, { from, split });
  const version = it.updated ? it.version ?? latest(art).n : latest(art).n;
  const note = it.updated ? art.versions.find((v) => v.n === version)?.note : latest(art).note;
  return <>
    <ArtifactCard
      data-art-card={art.id}
      data-testid={it.updated ? "art-update" : "art-card"}
      title={art.title}
      meta={[`${kindWord(art)} · ${it.updated ? "Updated to " : ""}v${version}`, note, art.problem ? `Its latest rewrite wasn't taken: ${art.problem}` : undefined].filter(Boolean).join(" · ")}
      role="button"
      tabIndex={0}
      aria-label={`Open ${art.title}`}
      onClick={(event) => open(event.metaKey || event.ctrlKey)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event.metaKey || event.ctrlKey); } }}
    />
    {!it.updated && <Tip label="Open beside the chat"><Button size="icon-xs" variant="ghost" aria-label={`Open ${art.title} beside the chat`} onClick={() => open(true)}><PanelRightIcon /></Button></Tip>}
  </>;
}
