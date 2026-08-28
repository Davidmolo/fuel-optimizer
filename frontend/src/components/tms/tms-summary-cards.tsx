import { cn } from "@/lib/utils";
import type { TripContextListResponse } from "@/types/tms";

export type TmsLoadFilter = "all" | "truck" | "telemetry" | "ready" | "attention";

type TmsSummaryCardsProps = {
  summary: TripContextListResponse["summary"];
  activeFilter: TmsLoadFilter;
  onFilterChange: (filter: TmsLoadFilter) => void;
  className?: string;
};

export default function TmsSummaryCards({
  summary,
  activeFilter,
  onFilterChange,
  className,
}: TmsSummaryCardsProps) {
  const attentionCount = Math.max(summary.totalActiveLoads - summary.readyForRecommendationCount, 0);

  const chips: Array<{ id: TmsLoadFilter; label: string; value: number; hint: string }> = [
    { id: "all", label: "All loads", value: summary.totalActiveLoads, hint: "Every active Open Road load" },
    { id: "truck", label: "With truck", value: summary.loadsWithTruck, hint: "Driver assignment resolved" },
    { id: "telemetry", label: "Live telemetry", value: summary.withTelemetryCount, hint: "Samsara GPS or fuel is live" },
    { id: "ready", label: "Ready", value: summary.readyForRecommendationCount, hint: "Route + truck + telemetry" },
    { id: "attention", label: "Needs attention", value: attentionCount, hint: "Missing truck, GPS, or fuel" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter loads"
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1",
        className,
      )}
    >
      {chips.map((chip) => {
        const active = activeFilter === chip.id;

        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={chip.hint}
            onClick={() => onFilterChange(chip.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition",
              active
                ? chip.id === "attention"
                  ? "bg-amber-500 text-white shadow-sm"
                  : chip.id === "ready"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <span className="tabular-nums font-semibold">{chip.value}</span>
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
