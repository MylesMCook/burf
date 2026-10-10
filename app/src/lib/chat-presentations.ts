export type PresentationCell = string | number | boolean | null;
export type PresentationColumn = { key: string; label: string; sortable?: boolean; priority?: "primary" | "secondary"; align?: "start" | "end"; format?: { kind: "text" | "number" | "boolean" } };
export type PresentationField = { name: string; label: string; kind: "text" | "choice" | "toggle"; options?: string[]; required?: boolean; value: string };
export type ChatPresentation =
  | { type: "chart"; id: string; label: string; value: string; points: number[]; variant?: "area" | "line" | "bars"; delta?: string; trend?: "up" | "down" | "flat"; upIsGood?: boolean }
  | { type: "table"; id: string; columns: PresentationColumn[]; rows: Record<string, PresentationCell>[]; caption?: string }
  | { type: "form"; id: string; server: string; message: string; fields: PresentationField[]; state: "request" | "accepted" | "declined" | "cancelled" };
export type PresentationAnswer = { action: "accept" | "decline"; values?: Record<string, string> };

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 4096;
const optionalText = (value: unknown) => value === undefined || text(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

// Tool data is content, never code or component props. Reconstruct the finite
// stock-element payload at the wire boundary; unknown payloads keep their text.
export function chatPresentation(value: unknown): ChatPresentation | undefined {
  if (!object(value) || !text(value.id) || !value.id || value.id.length > 128) return;
  try { if (new TextEncoder().encode(JSON.stringify(value)).length > 16 << 10) return; } catch { return; }
  if (value.type === "chart") {
    if (!text(value.label) || !text(value.value) || !optionalText(value.delta) || !optionalBoolean(value.upIsGood)) return;
    if (!Array.isArray(value.points) || !value.points.length || value.points.length > 256 || !value.points.every((point): point is number => typeof point === "number" && Number.isFinite(point))) return;
    if (value.variant !== undefined && value.variant !== "area" && value.variant !== "line" && value.variant !== "bars") return;
    if (value.trend !== undefined && value.trend !== "up" && value.trend !== "down" && value.trend !== "flat") return;
    return { type: "chart", id: value.id, label: value.label, value: value.value, points: [...value.points],
      ...(value.variant !== undefined ? { variant: value.variant } : {}), ...(value.trend !== undefined ? { trend: value.trend } : {}),
      ...(typeof value.delta === "string" ? { delta: value.delta } : {}), ...(typeof value.upIsGood === "boolean" ? { upIsGood: value.upIsGood } : {}) };
  }
  if (value.type === "table") {
    if (!Array.isArray(value.columns) || !value.columns.length || value.columns.length > 16 || !Array.isArray(value.rows) || value.rows.length > 100 || !optionalText(value.caption)) return;
    const columns: PresentationColumn[] = [];
    for (const column of value.columns) {
      if (!object(column) || !text(column.key) || !column.key || !text(column.label) || !optionalBoolean(column.sortable) || columns.some((item) => item.key === column.key)) return;
      if (column.priority !== undefined && column.priority !== "primary" && column.priority !== "secondary") return;
      if (column.align !== undefined && column.align !== "start" && column.align !== "end") return;
      let format: PresentationColumn["format"];
      if (column.format !== undefined) {
        if (!object(column.format) || (column.format.kind !== "text" && column.format.kind !== "number" && column.format.kind !== "boolean")) return;
        format = { kind: column.format.kind };
      }
      columns.push({ key: column.key, label: column.label, ...(format ? { format } : {}),
        ...(typeof column.sortable === "boolean" ? { sortable: column.sortable } : {}),
        ...(column.priority !== undefined ? { priority: column.priority } : {}), ...(column.align !== undefined ? { align: column.align } : {}) });
    }
    const rows: Record<string, PresentationCell>[] = [];
    for (const row of value.rows) {
      if (!object(row) || Object.keys(row).length > 16) return;
      const cells: [string, PresentationCell][] = [];
      for (const [key, cell] of Object.entries(row)) {
        if (!columns.some((column) => column.key === key)) return;
        if (cell !== null && typeof cell !== "boolean" && !(typeof cell === "number" && Number.isFinite(cell)) && !text(cell)) return;
        cells.push([key, cell]);
      }
      rows.push(Object.fromEntries(cells));
    }
    return { type: "table", id: value.id, columns, rows, ...(typeof value.caption === "string" ? { caption: value.caption } : {}) };
  }
  if (value.type === "form") {
    if (!text(value.server) || !text(value.message) || !Array.isArray(value.fields) || !value.fields.length || value.fields.length > 12) return;
    if (value.state !== "request" && value.state !== "accepted" && value.state !== "declined" && value.state !== "cancelled") return;
    const fields: PresentationField[] = [];
    for (const field of value.fields) {
      if (!object(field) || !text(field.name) || !field.name || !text(field.label) || !text(field.value) || !optionalBoolean(field.required) || fields.some((item) => item.name === field.name)) return;
      if (field.kind !== "text" && field.kind !== "choice" && field.kind !== "toggle") return;
      let options: string[] | undefined;
      if (field.kind === "choice") {
        if (!Array.isArray(field.options) || !field.options.length || field.options.length > 20 || !field.options.every(text)) return;
        options = [...field.options];
        if (field.value && !options.includes(field.value)) return;
      }
      if (field.kind === "toggle" && field.value !== "true" && field.value !== "false") return;
      fields.push({ name: field.name, label: field.label, kind: field.kind, value: field.value,
        ...(options ? { options } : {}), ...(typeof field.required === "boolean" ? { required: field.required } : {}) });
    }
    return { type: "form", id: value.id, server: value.server, message: value.message, fields, state: value.state };
  }
}
