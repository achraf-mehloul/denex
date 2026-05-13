import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  accent?: boolean;
  hint?: string;
};

export function StatTile({ label, value, unit, icon: Icon, accent, hint }: Props) {
  return (
    <div className="rounded-xl glass p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl text-mono font-medium ${accent ? "text-primary" : ""}`}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground text-mono">{unit}</span>}
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
