// Quiet code themes in the brand's cool neutrals: comments recede, strings
// and values take a slate tint, everything else is the page's ink. No amber
// (it is kept for "needs you") and no rainbow.
type Rule = { scope: string[]; settings: { foreground?: string; fontStyle?: string } };

function theme(name: string, type: 'light' | 'dark', c: { bg: string; fg: string; muted: string; faint: string; value: string; key: string }) {
  const rules: Rule[] = [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.faint } },
    { scope: ['string', 'string.quoted', 'string.template', 'constant.other.symbol'], settings: { foreground: c.value } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: c.value } },
    { scope: ['support.type.property-name', 'meta.object-literal.key', 'entity.name.tag', 'variable.other.property'], settings: { foreground: c.key } },
    { scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new'], settings: { foreground: c.key } },
    { scope: ['entity.name.function', 'support.function', 'entity.name.command'], settings: { foreground: c.fg } },
    { scope: ['variable.parameter', 'variable.other.readwrite', 'variable'], settings: { foreground: c.fg } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: c.muted } },
  ];
  return {
    name,
    type,
    colors: { 'editor.background': c.bg, 'editor.foreground': c.fg },
    fg: c.fg,
    bg: c.bg,
    settings: [{ settings: { foreground: c.fg, background: c.bg } }, ...rules],
    tokenColors: rules,
  };
}

export const berthLight = theme('berth-light', 'light', {
  bg: '#f6f6f8',
  fg: '#26272b',
  muted: '#686a73',
  faint: '#8d8f98',
  value: '#3e5874',
  key: '#45474e',
});

export const berthDark = theme('berth-dark', 'dark', {
  bg: '#141518',
  fg: '#d7d8dd',
  muted: '#8d8f98',
  faint: '#6b6d76',
  value: '#a7b8cc',
  key: '#c3c5cc',
});
