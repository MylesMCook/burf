import type { Client } from "./api";

const fallbackScopes = new WeakMap<Client, string>();

// Older clients have no durable account identity. Keep their draft scope
// specific to this authenticated client object rather than sharing a fallback.
export function localChatAccountScope(client: Client, accountScope?: string) {
  let account = accountScope ?? fallbackScopes.get(client);
  if (!account) { account = crypto.randomUUID(); fallbackScopes.set(client, account); }
  return account;
}
