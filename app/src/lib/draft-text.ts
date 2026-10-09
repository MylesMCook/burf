// caretAfter puts the draft's caret after its last words, inside whatever
// holds them (a paragraph, a list item, a code block, a table cell),
// rather than on a line of its own.
export function caretAfter(html: string, caret: string): string {
  const tail = /(?:\s|<\/[a-z0-9]+>)*$/i.exec(html);
  const at = tail ? tail.index : html.length;
  return html.slice(0, at) + caret + html.slice(at);
}
