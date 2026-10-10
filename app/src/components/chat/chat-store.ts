import { ExportedMessageRepository, type ThreadMessageLike } from "@assistant-ui/react";

export function chatStore(messages: readonly ThreadMessageLike[]) {
  // These transports publish one authoritative branch. The messages-array
  // adapter retains removed IDs as alternate branches, including a provisional
  // send after the provider confirms it under its own ID.
  return { messageRepository: ExportedMessageRepository.fromArray(messages) };
}
