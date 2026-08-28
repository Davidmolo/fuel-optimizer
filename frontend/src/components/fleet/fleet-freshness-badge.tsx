import { cn } from "@/lib/utils";
import type { TelemetryFreshness } from "@/types/fleet";

const styles: Record<TelemetryFreshness, string> = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  stale: "bg-amber-50 text-amber-700 ring-amber-100",
  missing: "bg-slate-100 text-slate-600 ring-slate-200",
};

const labels: Record<TelemetryFreshness, string> = {
  live: "Live",
  stale: "Stale",
  missing: "Missing",
};

export default function FleetFreshnessBadge({ freshness }: { freshness: TelemetryFreshness }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", styles[freshness])}>
      {labels[freshness]}
    </span>
  );
}
