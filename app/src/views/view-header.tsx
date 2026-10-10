import * as stylex from "@stylexjs/stylex";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";


const paint = stylex.create({
  s0: {
    "display": "flex",
    "minHeight": "48px",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "16px",
    "rowGap": "4px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--sidebar) 40%, transparent)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "baseline",
    "gap": "12px",
  },
  s2: {
    "flexShrink": 0,
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "display": {
      "default": "none",
      "@media (min-width: 768px)": {
        "default": "block",
      },
    },
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
  },
  s5: {
    "display": "contents",
  },
  s6: {
    "width": "100%",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "20px",
    "paddingBottom": "64px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "20px",
    },
  },

  s7: {
    maxWidth: "64rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

interface ViewHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

// ViewHeader is a full-page view's top strip: its title, a short line of
// context, and its actions, in the window's drag region, so the view's name
// appears once. Every full-page view has one: Dashboard, Review, Settings,
// Project settings and plugin screens alike.
//
// Inside a ViewHeaderHost (Settings, plugin screens), a ViewHeader rendered
// anywhere below takes the host's strip, so a section or a plugin can name
// itself and add its actions without the page growing a second header.
export function ViewHeader(props: ViewHeaderProps) {
  const host = useContext(HostContext);
  const claim = host?.claim;
  useLayoutEffect(() => claim?.(), [claim]);
  if (!host) return <Strip {...props} />;
  return host.el ? createPortal(<Strip {...props} />, host.el) : null;
}

function Strip({ title, description, actions, children }: ViewHeaderProps) {
  return (
    <header data-tauri-drag-region className={sx(paint.s0)}>
      <div data-tauri-drag-region className={sx(paint.s1)}>
        <h1 className={sx(paint.s2)}>{title}</h1>
        {description && <p className={sx(paint.s3)}>{description}</p>}
      </div>
      {children}
      {actions && <div className={sx(paint.s4)}>{actions}</div>}
    </header>
  );
}

const HostContext = createContext<{ el: HTMLElement | null; claim(): () => void } | null>(null);

// ViewHeaderHost keeps a strip at the top of its view: fallback until a
// ViewHeader below claims it.
export function ViewHeaderHost({ fallback, children }: { fallback: ViewHeaderProps; children: ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((c) => c + 1);
    return () => setClaims((c) => c - 1);
  }, []);
  const value = useMemo(() => ({ el, claim }), [el, claim]);
  return (
    <HostContext.Provider value={value}>
      <div ref={setEl} className={sx(paint.s5)} />
      {claims === 0 && <Strip {...fallback} />}
      {children}
    </HostContext.Provider>
  );
}

// PluginPage is the body of a plugin screen: one width for every plugin,
// left aligned under the strip like the app's own pages.
export function PluginPage({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={[[sx(paint.s6), sx(paint.s7)].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}>{children}</div>;
}
