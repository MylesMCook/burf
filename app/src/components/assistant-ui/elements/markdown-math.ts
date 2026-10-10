interface MathNode {
  type: string;
  children?: MathNode[];
  position?: { start: { offset?: number } };
  data?: { hProperties?: { className?: string[] } };
}

// remark-math treats single-line $$ equations as inline math. Preserve the
// display intent after assistant-ui normalizes LaTeX bracket delimiters.
export function remarkDisplayMath() {
  return (tree: MathNode, file: { value?: unknown }) => {
    const source = file.value;
    if (typeof source !== "string") return;
    const visit = (node: MathNode) => {
      const offset = node.position?.start.offset;
      if (node.type === "inlineMath" && offset !== undefined && source.slice(offset, offset + 2) === "$$") {
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, className: ["language-math", "math-display"] } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
