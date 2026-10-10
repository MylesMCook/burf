import * as stylex from "@stylexjs/stylex";
import { CircleSlashIcon } from "lucide-react";

import { AgentIcon } from "@/components/agent-glyph";
import { PickOne } from "@/components/pick-one";
import type { AgentPreset } from "@/lib/api";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
  },
  s1: {
    "width": "14px",
    "height": "14px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// AgentPicker chooses one agent with PickOne, the one pick-one control the
// app shares. "No agent" is offered when allowNone is set.
export function AgentPicker({
  presets,
  value,
  onChange,
  allowNone = false,
}: {
  presets: Pick<AgentPreset, "id" | "name">[];
  value: string;
  onChange(id: string): void;
  allowNone?: boolean;
}) {
  const options = allowNone ? [{ id: "", name: "No agent" }, ...presets] : presets;
  return (
    <PickOne
      label="Agent"
      value={value}
      onChange={onChange}
      options={options.map((p) => ({
        value: p.id,
        label: p.name,
        icon: p.id ? <AgentIcon agent={p.id} className={sx(paint.s0)} /> : <CircleSlashIcon className={sx(paint.s1)} />,
      }))}
    />
  );
}
