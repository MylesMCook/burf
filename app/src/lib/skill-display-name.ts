// Installation and selection keep the legacy IDs. Only built-in display names change.
const builtinNames: Readonly<Record<string, string>> = {
  berth: "Burf",
  "berth-artifacts": "Burf artifacts",
  "berth-browser": "Burf browser",
  "berth-hooks": "Burf hooks",
  "berth-orchestrate": "Burf orchestration",
  "berth-preview": "Burf preview",
  "berth-visual-diff": "Burf visual diff",
};

export function skillDisplayName(name: string): string {
  return Object.hasOwn(builtinNames, name) ? builtinNames[name] : name;
}
