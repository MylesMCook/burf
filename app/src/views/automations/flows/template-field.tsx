import * as stylex from "@stylexjs/stylex";
import { BracesIcon } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Textarea } from "@/components/ui/textarea";
import type { Variable } from "@/views/automations/flows/model";

const paint = stylex.create({
  s0: {
    "marginBottom": "4px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s1: {
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "11px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
  s4: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// TemplateField is a step's text, with the {{…}} variables it can use one
// click away, inserted where the cursor is.
export function TemplateField({
  value,
  onChange,
  variables,
  placeholder,
  multiline,
  mono,
  readOnly,
  label,
}: {
  value: string;
  onChange(v: string): void;
  variables: Variable[];
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  readOnly?: boolean;
  label: string;
}) {
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const groups = [...new Set(variables.map((v) => v.group))];

  const insert = (token: string) => {
    const at = el.current?.selectionStart ?? value.length;
    const end = el.current?.selectionEnd ?? at;
    onChange(value.slice(0, at) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.current?.focus();
      el.current?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <div>
      <span className={sx(paint.s0)}>
        <span className={sx(paint.s1)}>{label}</span>
        {!readOnly && variables.length > 0 && (
          <Menu>
            <MenuTrigger render={<button type="button" className={sx(paint.s2)} />}>
              <BracesIcon className={sx(paint.s3)} />
              Insert
            </MenuTrigger>
            <MenuPopup align="end" width={menuWidths.w56}>
              {groups.map((g) => (
                <MenuGroup key={g}>
                  <MenuGroupLabel>{g}</MenuGroupLabel>
                  {variables
                    .filter((v) => v.group === g)
                    .map((v) => (
                      <MenuItem key={v.token} onClick={() => insert(v.token)}>
                        <span className={sx(paint.s4)}>{v.label}</span>
                        <code className={sx(paint.s5)}>{v.token}</code>
                      </MenuItem>
                    ))}
                </MenuGroup>
              ))}
            </MenuPopup>
          </Menu>
        )}
      </span>
      {multiline ? (
        <Textarea ref={el} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} mono={mono} text={mono ? "xs" : "default"} spellCheck={!mono} />
      ) : (
        <Input ref={el} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} mono={mono} text={mono ? "xs" : "default"} spellCheck={false} />
      )}
    </div>
  );
}
