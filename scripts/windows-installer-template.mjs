// A project-owned NSIS installer. No downloaded bundler template or helper DLL.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quote = (value) => {
  if (/[\r\n\0]/.test(value)) throw new Error("NSIS paths cannot contain control characters.");
  return value.replaceAll("$", () => "$$").replaceAll('"', () => '$\\"');
};
export function renderInstaller(template, { stage, output, version, architecture, icon, hooks }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Installer version must be X.Y.Z.");
  if (!["amd64", "arm64"].includes(architecture)) throw new Error("Installer architecture must be amd64 or arm64.");
  const values = { STAGE: stage, OUTPUT: output, VERSION: version, ARCH: architecture, ICON: icon, HOOKS: hooks };
  for (const [key, value] of Object.entries(values)) {
    const marker = `@${key}@`;
    if (!template.includes(marker)) throw new Error(`Installer template is missing ${marker}.`);
    template = template.replaceAll(marker, () => quote(value));
  }
  if (/@[A-Z]+@/.test(template)) throw new Error("Installer template has an unresolved field.");
  return template;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [stage, output, version, architecture, destination] = process.argv.slice(2);
  const template = await readFile(resolve(root, "scripts/windows/installer.nsi"), "utf8");
  await writeFile(destination, renderInstaller(template, {
    stage: resolve(stage), output: resolve(output), version, architecture,
    icon: resolve(root, "design/branding/exports/burf-app-icon.ico"),
    hooks: resolve(root, "scripts/windows/hooks.nsh"),
  }));
}
