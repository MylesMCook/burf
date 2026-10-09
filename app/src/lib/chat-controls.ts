import type { TranscriptItem } from "@/lib/transcript";

export type NoticeItem = Extract<TranscriptItem, { kind: "notice" }>;

// mockNotice is a notice the demo shows in a finished conversation, so the
// cards can be seen: one session hits its usage limit.
export function mockNotice(session: string): NoticeItem | undefined {
  if (session !== "ci-flake-claude") return undefined;
  const resets = new Date();
  resets.setHours(resets.getHours() + 2, 0, 0, 0);
  return { kind: "notice", id: "mock-notice-limit", notice: "limit", level: "warning", text: "You've hit your usage limit.", resets: resets.getTime() };
}
