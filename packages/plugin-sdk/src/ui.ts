// The app's UI kit, shared with plugins so they look like the rest of Berth.
// Components take the same props as in the app (coss ui, built on Base UI);
// they are typed loosely here so the SDK does not depend on the app's source.
import type { ComponentType, ReactNode } from "react";

// biome-ignore lint/suspicious/noExplicitAny: see above.
type Loose = ComponentType<any>;

export declare const Badge: Loose;
export declare const Button: Loose;
export declare const Card: Loose;
export declare const CardHeader: Loose;
export declare const CardTitle: Loose;
export declare const CardDescription: Loose;
export declare const CardPanel: Loose;
export declare const CardFooter: Loose;
export declare const Empty: Loose;
export declare const EmptyHeader: Loose;
export declare const EmptyTitle: Loose;
export declare const EmptyDescription: Loose;
export declare const Input: Loose;
export declare const Kbd: Loose;
export declare const ScrollArea: Loose;
export declare const Separator: Loose;
export declare const Spinner: Loose;
export declare const Switch: Loose;
export declare const Table: Loose;
export declare const TableHeader: Loose;
export declare const TableBody: Loose;
export declare const TableRow: Loose;
export declare const TableHead: Loose;
export declare const TableCell: Loose;
export declare const Tooltip: Loose;
export declare const TooltipTrigger: Loose;
export declare const TooltipPopup: Loose;
export declare const Frame: Loose;
export declare const FramePanel: Loose;
export declare const FrameHeader: Loose;
export declare const FrameTitle: Loose;
export declare const FrameDescription: Loose;
export declare const FrameFooter: Loose;
export declare const Tabs: Loose;
export declare const TabsList: Loose;
export declare const TabsTab: Loose;
export declare const TabsPanel: Loose;
export declare const Textarea: Loose;
export declare const AlertDialog: Loose;
export declare const AlertDialogTrigger: Loose;
export declare const AlertDialogPopup: Loose;
export declare const AlertDialogHeader: Loose;
export declare const AlertDialogFooter: Loose;
export declare const AlertDialogTitle: Loose;
export declare const AlertDialogDescription: Loose;
export declare const AlertDialogClose: Loose;
export declare const ToggleGroup: Loose;
export declare const ToggleGroupItem: Loose;
export declare const Meter: Loose;
export declare const MeterLabel: Loose;
export declare const MeterTrack: Loose;
export declare const MeterIndicator: Loose;
export declare const MeterValue: Loose;
export declare const Alert: Loose;
export declare const AlertTitle: Loose;
export declare const AlertDescription: Loose;
export declare const Skeleton: Loose;
export declare const Menu: Loose;
export declare const MenuTrigger: Loose;
export declare const MenuPopup: Loose;
export declare const MenuItem: Loose;
export declare const MenuGroup: Loose;
export declare const MenuGroupLabel: Loose;
export declare const MenuSeparator: Loose;
// A panel that slides in from an edge: <Sheet open onOpenChange><SheetPopup
// side="right">…</SheetPopup></Sheet>, with SheetHeader, SheetPanel (the
// scrolling middle) and SheetFooter inside.
export declare const Sheet: Loose;
export declare const SheetPopup: Loose;
export declare const SheetHeader: Loose;
export declare const SheetTitle: Loose;
export declare const SheetDescription: Loose;
export declare const SheetPanel: Loose;
export declare const SheetFooter: Loose;
export declare const SheetClose: Loose;
export declare const Checkbox: Loose;
// The app's own pickers, so a plugin's choices look like the app's.
// PickOne: one of a few values, as a segmented control.
export declare const PickOne: ComponentType<{
  value: string;
  options: { value: string; label: ReactNode; icon?: ReactNode }[];
  onChange(value: string): void;
  label?: string;
  className?: string;
}>;
// AgentPicker: one of a box's agents (BoxInfo.agents), with their icons.
export declare const AgentPicker: ComponentType<{ presets: { id: string; name: string }[]; value: string; onChange(id: string): void; allowNone?: boolean; className?: string }>;
// AgentIcon: an agent's mark, by preset id ("claude", "codex", …).
export declare const AgentIcon: ComponentType<{ agent?: string; className?: string }>;
// Any lucide icon by name: <Icon name="Server" />.
export declare const Icon: ComponentType<{ name: string; className?: string }>;
export declare function cn(...classes: unknown[]): string;
