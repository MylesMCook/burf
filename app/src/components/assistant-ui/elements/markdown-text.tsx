"use client";

import * as stylex from "@stylexjs/stylex";
import "@assistant-ui/react-markdown/styles/dot.css";
import "katex/dist/katex.min.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
  normalizeMathDelimiters,
  escapeCurrencyDollars,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkDisplayMath } from "./markdown-math";
import { type FC, memo, useMemo, useRef } from "react";
import type { TextMessagePartProps } from "@assistant-ui/react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { fadeIn } from "./surfaces";

const paint = stylex.create({
  s0: {
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "borderTopLeftRadius": "var(--radius-xl)",
    "borderTopRightRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderBottomWidth": 0,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "color": "var(--muted-foreground)",
    "fontWeight": 500,
    "textTransform": "lowercase",
  },
  s2: {
    "transitionDuration": "150ms",
  },
  s3: {
    "transitionDuration": "200ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },
  s4: {
    "marginTop": {
      "default": "20px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "8px",
      ":last-child": "0px",
    },
    "fontSize": "20px",
    "lineHeight": "28px",
    "fontWeight": 600,
    "scrollMargin": "80px",
  },
  s5: {
    "marginTop": {
      "default": "20px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "8px",
      ":last-child": "0px",
    },
    "fontSize": "18px",
    "lineHeight": "28px",
    "fontWeight": 600,
    "scrollMargin": "80px",
  },
  s6: {
    "marginTop": {
      "default": "16px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "6px",
      ":last-child": "0px",
    },
    "fontSize": "16px",
    "lineHeight": "24px",
    "fontWeight": 600,
    "scrollMargin": "80px",
  },
  s7: {
    "marginTop": {
      "default": "14px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "4px",
      ":last-child": "0px",
    },
    "fontSize": "16px",
    "lineHeight": "24px",
    "fontWeight": 500,
  },
  s8: {
    "marginTop": {
      "default": "12px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "4px",
      ":last-child": "0px",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontWeight": 600,
  },
  s9: {
    "marginTop": {
      "default": "12px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "4px",
      ":last-child": "0px",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontWeight": 500,
    "scrollMargin": "80px",
  },
  s10: {
    "marginTop": {
      "default": "12px",
      ":first-child": "0px",
    },
    "marginBottom": {
      "default": "12px",
      ":last-child": "0px",
    },
    "lineHeight": "1.625",
  },
  s11: {
    "color": {
      "default": "var(--primary)",
      ":hover": "color-mix(in oklab, var(--primary) 80%, transparent)",
    },
    "textDecoration": "underline",
    "textUnderlineOffset": "2px",
  },
  s12: {
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
    "color": "var(--muted-foreground)",
    "marginTop": "12px",
    "marginBottom": "12px",
    "borderInlineStartWidth": 2,
    "borderInlineStartStyle": "solid",
    "borderInlineStartColor": "var(--border)",
    "paddingInlineStart": "16px",
  },
  s13: {
    "marginTop": "12px",
    "marginBottom": "12px",
    "marginInlineStart": "20px",
    "listStyleType": "disc",
    ":not(#\\#) > li": {
      "marginTop": "4px",
    },
    ":not(#\\#)::marker": {
      "color": "var(--muted-foreground)",
    },
  },
  s14: {
    "marginTop": "12px",
    "marginBottom": "12px",
    "marginInlineStart": "20px",
    "listStyleType": "decimal",
    ":not(#\\#) > li": {
      "marginTop": "4px",
    },
    ":not(#\\#)::marker": {
      "color": "var(--muted-foreground)",
    },
  },
  s15: {
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
    "marginTop": "12px",
    "marginBottom": "12px",
  },
  s16: {
    "marginTop": "12px",
    "marginBottom": "12px",
    "overflowX": "auto",
  },
  s17: {
    "width": "100%",
    "borderCollapse": "separate",
    "borderSpacing": 0,
  },
  s18: {
    "backgroundColor": "var(--muted)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontWeight": 500,
    "textAlign": "start",
    "borderStartStartRadius": {
      ":first-child": "var(--radius-lg)",
    },
    "borderStartEndRadius": {
      ":last-child": "var(--radius-lg)",
    },
    "[align=center]": {
      "textAlign": "center",
    },
    "[align=right]": {
      "textAlign": "right",
    },
  },
  s19: {
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
    "borderInlineStartWidth": 1,
    "borderInlineStartStyle": "solid",
    "borderInlineStartColor": "var(--border)",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "borderInlineEndWidth": {
      ":last-child": 1,
    },
    "borderInlineEndStyle": {
      ":last-child": "solid",
    },
    "borderInlineEndColor": {
      ":last-child": "var(--border)",
    },
    "textAlign": "start",
    "[align=center]": {
      "textAlign": "center",
    },
    "[align=right]": {
      "textAlign": "right",
    },
  },
  s20: {
    "margin": "0px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "padding": "0px",
    "borderTopWidth": {
      ":first-child": 1,
    },
    "borderTopStyle": {
      ":first-child": "solid",
    },
    "borderTopColor": {
      ":first-child": "var(--border)",
    },
    ":not(#\\#):last-child > td:first-child": {
      "borderEndStartRadius": "var(--radius-lg)",
    },
    ":not(#\\#):last-child > td:last-child": {
      "borderEndEndRadius": "var(--radius-lg)",
    },
  },
  s21: {
    "lineHeight": "1.625",
  },
  s22: {
    "fontWeight": 600,
  },
  s23: {
    ":not(#\\#) > a": {
      "fontSize": "12px",
      "lineHeight": "16px",
      "textDecoration": "none",
    },
  },
  s24: {
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "overflowX": "auto",
    "borderTopLeftRadius": "0px",
    "borderTopRightRadius": "0px",
    "borderBottomLeftRadius": "var(--radius-xl)",
    "borderBottomRightRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderTopWidth": 0,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "padding": "14px",
    "fontSize": "13px",
    "lineHeight": "1.625",
  },
  s25: {
    "backgroundColor": "var(--muted)",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.85em",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type MarkdownTextProps = Partial<TextMessagePartProps> & {
  components?: Parameters<typeof memoizeMarkdownComponents>[0];
  containerProps?: React.ComponentProps<typeof MarkdownTextPrimitive>["containerProps"] & { "data-status"?: string };
};

const useShallowStable = <T extends Record<string, unknown> | undefined>(
  value: T,
): T => {
  const ref = useRef(value);
  if (value !== ref.current) {
    const prev = ref.current;
    const stable =
      value !== undefined &&
      prev !== undefined &&
      Object.keys(prev).length === Object.keys(value).length &&
      Object.keys(value).every((key) => prev[key] === value[key]);
    if (!stable) ref.current = value;
  }
  return ref.current;
};

const MarkdownTextImpl: FC<MarkdownTextProps> = ({ components, containerProps }) => {
  const stableComponents = useShallowStable(components);
  const markdownComponents = useMemo(() => {
    if (!stableComponents) return defaultComponents;
    return {
      ...defaultComponents,
      ...memoizeMarkdownComponents(stableComponents),
    };
  }, [stableComponents]);

  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm, remarkMath, remarkDisplayMath]}
      rehypePlugins={[rehypeKatex]}
      preprocess={(text) => escapeCurrencyDollars(normalizeMathDelimiters(text))}
      className="aui-md"
      containerProps={containerProps}
      components={markdownComponents}
      defer
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className={[sx(paint.s0), "aui-code-header-root"].filter(Boolean).join(" ")}>
      <span className={[sx(paint.s1), "aui-code-header-language"].filter(Boolean).join(" ")}>
        {language}
      </span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {!isCopied && (
          <CopyIcon className={sx(paint.s2, fadeIn)} />
        )}
        {isCopied && (
          <CheckIcon className={sx(paint.s3, fadeIn)} />
        )}
      </TooltipIconButton>
    </div>
  );
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={["aui-md-h1", sx(paint.s4), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={["aui-md-h2", sx(paint.s5), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={["aui-md-h3", sx(paint.s6), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={["aui-md-h4", sx(paint.s7), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={[[sx(paint.s8), "aui-md-h5"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={[[sx(paint.s9), "aui-md-h6"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={[[sx(paint.s10), "aui-md-p"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={["aui-md-a", sx(paint.s11), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={[[sx(paint.s12), "aui-md-blockquote"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={["aui-md-ul", sx(paint.s13), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={["aui-md-ol", sx(paint.s14), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={[[sx(paint.s15), "aui-md-hr"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className={[sx(paint.s16), "aui-md-table-wrapper"].filter(Boolean).join(" ")}>
      <table
        className={["aui-md-table", sx(paint.s17), className].filter(Boolean).join(" ")}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={["aui-md-th", sx(paint.s18), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={["aui-md-td", sx(paint.s19), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={["aui-md-tr", sx(paint.s20), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={[[sx(paint.s21), "aui-md-li"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={[[sx(paint.s22), "aui-md-strong"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={[[sx(paint.s23), "aui-md-sup"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={[[sx(paint.s24), "aui-md-pre"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={[!isCodeBlock && [sx(paint.s25), "aui-md-inline-code"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
        {...props}
      />
    );
  },
  CodeHeader,
});
