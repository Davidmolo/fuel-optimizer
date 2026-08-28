import Card from "@/components/common/card";
import FleetSummaryCards from "@/components/dashboard/fleet-summary-cards";
import { cn } from "@/lib/utils";
import type { FleetSummary } from "@/types/fleet";

type FleetOverviewProps = {
  summary: FleetSummary;
};

function percentOf(part: number, whole: number) {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 100);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function barFillGradient(color: string, angle: "90deg" | "180deg") {
  return `linear-gradient(${angle}, color-mix(in srgb, ${color} 42%, white) 0%, ${color} 52%, color-mix(in srgb, ${color} 78%, black) 100%)`;
}

function GradientProgressBar({
  percent,
  color,
  well,
}: {
  percent: number;
  color: string;
  well: string;
}) {
  const width = clampPercent(percent);

  return (
    <div className="progress-track">
      <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", well)} />
      {width > 0 ? (
        <div
          className="progress-fill overflow-hidden"
          style={{ width: `${width}%`, background: barFillGradient(color, "90deg") }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/5 to-black/15" />
        </div>
      ) : null}
    </div>
  );
}

function SemiGauge({ percent, label, value }: { percent: number; label: string; value: string }) {
  const radius = 90;
  const length = Math.PI * radius;
  const filled = (clampPercent(percent) / 100) * length;

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox="0 0 240 148" className="h-auto w-full" role="img" aria-label={`${label} ${value}`}>
        <path
          d="M 30 128 A 90 90 0 0 1 210 128"
          fill="none"
          stroke="var(--track)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {percent > 0 ? (
          <path
            d="M 30 128 A 90 90 0 0 1 210 128"
            fill="none"
            stroke="var(--info)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${length}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 top-[58%] -translate-y-1/2 text-center">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function DonutChart({
  liveCount,
  remainingCount,
  totalLabel,
}: {
  liveCount: number;
  remainingCount: number;
  totalLabel: string;
}) {
  const total = liveCount + remainingCount;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const liveLength = total > 0 ? (liveCount / total) * circumference : 0;
  const remainingLength = total > 0 ? (remainingCount / total) * circumference : 0;

  return (
    <div className="relative h-[148px] w-[148px] shrink-0">
      <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90" role="img" aria-label={`GPS status total ${totalLabel}`}>
        <defs>
          <linearGradient id="gps-donut-live" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--info) 42%, white)" />
            <stop offset="52%" stopColor="var(--info)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--info) 78%, black)" />
          </linearGradient>
          <linearGradient id="gps-donut-remaining" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--muted) 48%, white)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--muted) 72%, black)" />
          </linearGradient>
          <linearGradient id="gps-donut-track" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--track) 65%, white)" />
            <stop offset="100%" stopColor="var(--track)" />
          </linearGradient>
        </defs>
        <circle cx="74" cy="74" r={radius} fill="none" stroke="url(#gps-donut-track)" strokeWidth="18" />
        {remainingLength > 0 ? (
          <circle
            cx="74"
            cy="74"
            r={radius}
            fill="none"
            stroke="url(#gps-donut-remaining)"
            strokeWidth="18"
            strokeDasharray={`${remainingLength} ${circumference}`}
            strokeDashoffset={-liveLength}
          />
        ) : null}
        {liveLength > 0 ? (
          <circle
            cx="74"
            cy="74"
            r={radius}
            fill="none"
            stroke="url(#gps-donut-live)"
            strokeWidth="18"
            strokeDasharray={`${liveLength} ${circumference}`}
            strokeDashoffset={0}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-xs text-muted">Total</p>
        <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">{totalLabel}</p>
      </div>
    </div>
  );
}

function SnapshotBarChart({ summary }: { summary: FleetSummary }) {
  const wellHeight = 128;
  const bars = [
    {
      label: "Vehicles",
      value: summary.totalVehicles,
      well: "from-primary/25",
      fill: "linear-gradient(180deg, var(--primary-soft) 0%, var(--primary) 52%, var(--primary-hover) 100%)",
    },
    {
      label: "Live GPS",
      value: summary.liveGpsCount,
      well: "from-info/25",
      fill: barFillGradient("var(--info)", "180deg"),
    },
    {
      label: "Low fuel",
      value: summary.lowFuelCount,
      well: "from-warning/25",
      fill: barFillGradient("var(--warning)", "180deg"),
    },
    {
      label: "Attention",
      value: summary.staleTelemetryCount,
      well: "from-danger/25",
      fill: barFillGradient("var(--danger)", "180deg"),
    },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div
      className="mt-8 flex items-end justify-between gap-3 border-t border-border pt-6 sm:gap-6"
      role="img"
      aria-label="Fleet snapshot counts"
    >
      {bars.map((bar) => {
        const px = bar.value <= 0 ? 0 : Math.max(8, Math.round((bar.value / max) * wellHeight));

        return (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <p className="text-xs font-semibold text-foreground tabular-nums">{bar.value.toLocaleString()}</p>
            <div className="relative h-32 w-10 overflow-hidden rounded-lg bg-track sm:w-12">
              <div className={cn("absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent", bar.well)} />
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-md"
                style={{ height: `${px}px`, background: bar.fill }}
                title={`${bar.label}: ${bar.value}`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/5 to-black/15" />
                <div className="absolute inset-x-[20%] top-1 h-1 rounded-full bg-white/50" />
              </div>
            </div>
            <p className="truncate text-xs font-medium text-muted">{bar.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function FleetOverview({ summary }: FleetOverviewProps) {
  const liveCoverage = percentOf(summary.liveGpsCount, summary.activeVehicles);
  const lowFuelShare = percentOf(summary.lowFuelCount, summary.totalVehicles);
  const attentionShare = percentOf(summary.staleTelemetryCount, summary.totalVehicles);
  const remainingGps = Math.max(summary.activeVehicles - summary.liveGpsCount, 0);
  const liveShare = percentOf(summary.liveGpsCount, summary.activeVehicles);
  const remainingShare = percentOf(remainingGps, summary.activeVehicles);

  return (
    <div className="space-y-4 xl:space-y-6">
      <FleetSummaryCards summary={summary} />

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Fleet snapshot</h2>
              <p className="mt-1 text-sm text-muted">Current counts from the latest Samsara sync</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-8">
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {summary.liveGpsCount.toLocaleString()}
                <span className="ml-2 text-sm font-medium text-info">{liveCoverage}%</span>
              </p>
              <p className="mt-1 text-sm text-muted">Live GPS of {summary.activeVehicles} active</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {summary.staleTelemetryCount.toLocaleString()}
                <span className={`ml-2 text-sm font-medium ${summary.staleTelemetryCount > 0 ? "text-danger" : "text-success"}`}>
                  {attentionShare}%
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">Needs attention of {summary.totalVehicles} vehicles</p>
            </div>
          </div>

          <SnapshotBarChart summary={summary} />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-foreground">Live coverage</h2>
          <p className="mt-1 text-sm text-muted">Share of active trucks with live GPS</p>

          <div className="mt-2">
            <SemiGauge percent={liveCoverage} label="Live GPS" value={`${liveCoverage}%`} />
          </div>

          <div className="mt-2 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Low fuel</p>
                <p className="text-sm text-muted tabular-nums">
                  {summary.lowFuelCount.toLocaleString()} · {lowFuelShare}%
                </p>
              </div>
              <GradientProgressBar percent={lowFuelShare} color="var(--warning)" well="from-warning/25" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Needs attention</p>
                <p className="text-sm text-muted tabular-nums">
                  {summary.staleTelemetryCount.toLocaleString()} · {attentionShare}%
                </p>
              </div>
              <GradientProgressBar percent={attentionShare} color="var(--danger)" well="from-danger/25" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-foreground">GPS status</h2>
          <p className="mt-1 text-sm text-muted">Live coverage among active vehicles</p>

          <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <DonutChart
              liveCount={summary.liveGpsCount}
              remainingCount={remainingGps}
              totalLabel={String(summary.activeVehicles)}
            />

            <ul className="w-full space-y-5">
              <li className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-info" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Live GPS</p>
                    <p className="text-sm text-muted tabular-nums">{summary.liveGpsCount.toLocaleString()} vehicles</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground tabular-nums">{liveShare}%</p>
              </li>
              <li className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No live GPS</p>
                    <p className="text-sm text-muted tabular-nums">{remainingGps.toLocaleString()} vehicles</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground tabular-nums">{remainingShare}%</p>
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-foreground">Attention</h2>
          <p className="mt-1 text-sm text-muted">Vehicles that may need a follow-up</p>

          <ul className="mt-6 divide-y divide-border">
            <li className="flex items-start gap-3 py-5 first:pt-0">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">≤ 25% tank</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">Low fuel</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">{summary.lowFuelCount.toLocaleString()} vehicles</p>
              </div>
            </li>
            <li className="flex items-start gap-3 py-5 last:pb-0">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Stale or missing telemetry</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">Needs attention</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">
                  {summary.staleTelemetryCount.toLocaleString()} vehicles
                </p>
              </div>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
