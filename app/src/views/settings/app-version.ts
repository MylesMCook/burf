import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

import { isTauri } from "@/lib/api";

// appVersion is the app's version from the Tauri shell, or "dev" in a browser.
export async function appVersion(): Promise<string> {
  if (!isTauri()) return "dev";
  try {
    return await getVersion();
  } catch {
    return "unknown";
  }
}

export function useAppVersion(): string {
  const [v, setV] = useState("…");
  useEffect(() => void appVersion().then(setV), []);
  return v;
}

export function useInterfaceVersion(): string {
  const [version, setVersion] = useState("…");
  useEffect(() => {
    if (!isTauri()) { setVersion("dev · browser"); return; }
    void invoke<{ version: string; source: "built-in" | "folder" }>("ui_interface")
      .then((info) => setVersion(`${info.version} · ${info.source === "folder" ? "interface folder" : "built into app"}`))
      .catch(() => setVersion("unknown"));
  }, []);
  return version;
}
