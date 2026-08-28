import { cn } from "@/lib/utils";

export default function FleetFuelBar({ percent, isLow }: { percent: number; isLow: boolean }) {
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", isLow ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <span className={cn("w-10 text-right text-sm font-medium tabular-nums", isLow ? "text-amber-700" : "text-foreground")}>
        {percent}%
      </span>
    </div>
  );
}
