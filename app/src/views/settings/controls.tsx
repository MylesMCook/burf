import { PickOne } from "@/components/pick-one";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/ui/number-field";

// Segmented picks one of a few values, with the app's shared PickOne.
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; label?: string }) {
  return <PickOne value={value} options={options} onChange={onChange} label={label} />;
}

// Stepper is a small number field with − and + on either side.
export function Stepper({ value, onChange, min, max, step = 1, format }: { value: number; onChange(v: number): void; min: number; max: number; step?: number; format?: Intl.NumberFormatOptions }) {
  return (
    <NumberField size="sm" className="w-36" value={value} min={min} max={max} step={step} format={format} onValueChange={(v) => v != null && onChange(v)}>
      <NumberFieldGroup>
        <NumberFieldDecrement />
        <NumberFieldInput className="text-center tabular-nums" />
        <NumberFieldIncrement />
      </NumberFieldGroup>
    </NumberField>
  );
}
