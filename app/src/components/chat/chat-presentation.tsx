import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Chart } from "@/components/assistant-ui/elements/chart";
import { DataTable } from "@/components/assistant-ui/elements/data-table";
import { ElicitationForm } from "@/components/assistant-ui/elements/elicitation-form";
import type { ChatPresentation as Presentation, PresentationAnswer } from "@/lib/chat-presentations";

// Leave room for the thread's floating scroll control below a form's actions.
const styles = stylex.create({ form: { paddingBottom: 32 } });

export function ChatPresentation({ presentation, disabled, onAnswer }: { presentation: Presentation; disabled: boolean; onAnswer?: (answer: PresentationAnswer) => Promise<boolean> }) {
  const [values, setValues] = useState(() => presentation.type === "form" ? Object.fromEntries(presentation.fields.map((field) => [field.name, field.value])) : {});
  switch (presentation.type) {
    case "chart": return <section aria-label={presentation.label} data-chat-presentation="chart"><Chart {...presentation} visibleCount={presentation.points.length} /></section>;
    case "table": return <section aria-label={presentation.caption ?? "Tool data"} data-chat-presentation="table"><DataTable {...presentation} /></section>;
    case "form": {
      const blocked = disabled || !onAnswer || presentation.state !== "request";
      const fields = presentation.state === "request" ? presentation.fields.map((field) => ({ ...field, value: values[field.name] ?? field.value })) : presentation.fields;
      return <section aria-label="Agent question" data-chat-presentation="form" {...stylex.props(styles.form)}>
        <fieldset disabled={blocked}>
          <ElicitationForm server={presentation.server} message={presentation.message} fields={fields} state={presentation.state}
            onFieldChange={presentation.state === "request" ? (name, value) => setValues((current) => ({ ...current, [name]: value })) : undefined}
            onAccept={() => { if (!blocked) void onAnswer?.({ action: "accept", values }); }}
            onDecline={() => { if (!blocked) void onAnswer?.({ action: "decline" }); }} />
        </fieldset>
        {!onAnswer && presentation.state === "request" && <p>This chat cannot answer forms.</p>}
      </section>;
    }
  }
}
