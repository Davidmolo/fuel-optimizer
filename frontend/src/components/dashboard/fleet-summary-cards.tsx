import Card from "@/components/common/card";
import { cn } from "@/lib/utils";
import type { FleetSummary } from "@/types/fleet";

type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral";

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: BadgeTone;
};

function SummaryCard({ label, value, hint, tone = "neutral" }: SummaryCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl leading-none font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          <p className="stat-label mt-2.5">{label}</p>
        </div>
        {hint ? (
          <span
            className={cn(
              "kpi-badge",
              tone === "success" && "kpi-badge-success",
              tone === "danger" && "kpi-badge-danger",
              tone === "warning" && "kpi-badge-warning",
              tone === "info" && "kpi-badge-info",
              tone === "neutral" && "kpi-badge-neutral",
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

type FleetSummaryCardsProps = {
  summary: FleetSummary;
};

export default function FleetSummaryCards({ summary }: FleetSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
      <SummaryCard label="Total vehicles" value={summary.totalVehicles} />
      <SummaryCard
        label="Live GPS"
        value={summary.liveGpsCount}
        hint={`of ${summary.activeVehicles} active`}
        tone="info"
      />
      <SummaryCard
        label="Low fuel"
        value={summary.lowFuelCount}
        hint="≤ 25% tank"
        tone={summary.lowFuelCount > 0 ? "warning" : "success"}
      />
      <SummaryCard
        label="Needs attention"
        value={summary.staleTelemetryCount}
        hint="Stale or missing telemetry"
        tone={summary.staleTelemetryCount > 0 ? "danger" : "success"}
      />
    </div>
  );
}
