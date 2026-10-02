import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option {
  value: string;
  label: string;
}

// SimpleSelect is a Select over plain string values.
export function SimpleSelect({ options, value, onChange, placeholder, disabled, size, className }: { options: Option[]; value: string; onChange(v: string): void; placeholder?: string; disabled?: boolean; size?: "sm" | "default" | "lg"; className?: string }) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <Select items={options} value={selected} onValueChange={(o: Option | null) => onChange(o?.value ?? "")} disabled={disabled}>
      <SelectTrigger size={size} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {options.map((o) => (
          <SelectItem key={o.value} value={o}>
            {o.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
