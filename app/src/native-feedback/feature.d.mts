import type { ConfigEnv, UserConfigExport } from "vite";
export function feedbackEnabled(environment: Pick<ConfigEnv, "mode" | "command">, requested?: string): boolean;
export function withNativeFeedback(configuration: UserConfigExport, startupEntries?: string[]): UserConfigExport;
