import { useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { SimpleSelect } from "@/components/simple-select";
import { color } from "@/styles/tokens.stylex";
import { Button } from "@/components/ui/button";
import { addCustomFont, GEIST_PIXEL_FONT_ID, removeCustomFont, useCustomFonts } from "@/lib/custom-fonts";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { SettingsGroup, SettingsRow } from "@/views/settings/rows";

const styles = stylex.create({
  file: { display: "none" },
  status: { paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: color.mutedForeground },
});

export function CustomFontSettings() {
  const fonts = usePrefs((p) => p.customFonts);
  const interfaceFont = usePrefs((p) => p.interfaceFont);
  const readingFont = usePrefs((p) => p.readingFont);
  const codeFont = usePrefs((p) => p.codeFont);
  const status = useCustomFonts((s) => s.status);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const addedOptions = fonts.filter((f) => status[f.id] === "loaded").map((f) => ({ value: f.id, label: f.name }));
  const options = [{ value: "default", label: "Default" }, ...addedOptions];
  const interfaceOptions = [{ value: "default", label: "Default" }, { value: GEIST_PIXEL_FONT_ID, label: "Geist Pixel" }, ...addedOptions];
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The font could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsGroup
      title="Fonts"
      description="Add a WOFF or WOFF2 file, up to 5 MB. Fonts stay on this computer."
      actions={<Button size="sm" variant="outline" disabled={busy} onClick={() => file.current?.click()}>Add a font</Button>}
    >
      <input
        ref={file}
        type="file"
        accept=".woff,.woff2"
        aria-label="Font file"
        {...stylex.props(styles.file)}
        disabled={busy}
        onChange={(e) => {
          const picked = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (picked) void run(() => addCustomFont(picked));
        }}
      />
      <SettingsRow label="Interface font">
        <SimpleSelect measure="56" options={interfaceOptions} value={interfaceFont ?? "default"} onChange={(id) => setPrefs({ interfaceFont: id === "default" ? null : id })} />
      </SettingsRow>
      <SettingsRow label="Reading font" description="Messages and headings. Independent of the interface and code fonts.">
        <SimpleSelect measure="56" options={options} value={readingFont ?? "default"} onChange={(id) => setPrefs({ readingFont: id === "default" ? null : id })} />
      </SettingsRow>
      <SettingsRow label="Code font" description="Code blocks and terminals using the default font.">
        <SimpleSelect measure="56" options={options} value={codeFont ?? "default"} onChange={(id) => setPrefs({ codeFont: id === "default" ? null : id })} />
      </SettingsRow>
      {fonts.length > 0 && (
        <ul aria-label="Added fonts">
          {fonts.map((font) => (
            <li key={font.id}>
              <SettingsRow label={font.name} description={status[font.id] === "failed" ? `“${font.name}” could not be loaded. Uses of this font returned to the default. Remove it and add the file again to try it again.` : status[font.id] !== "loaded" ? "Loading font…" : undefined}>
                <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${font.name}`} onClick={() => void run(() => removeCustomFont(font.id))}>Remove</Button>
              </SettingsRow>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status" {...stylex.props(styles.status)}>{message}</p>}
    </SettingsGroup>
  );
}
