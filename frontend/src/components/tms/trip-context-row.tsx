import FleetFuelBar from "@/components/fleet/fleet-fuel-bar";
import {
  formatLoadStatus,
  getLoadStatusTone,
  getTripLinkageIssues,
} from "@/lib/trip-linkage-status";
import { cn } from "@/lib/utils";
import type { TripContext } from "@/types/tms";

export function LoadStatusBadge({ status }: { status: string }) {
  const tone = getLoadStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex max-w-[11rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        tone === "warning" && "bg-amber-50 text-amber-800 ring-amber-100",
        tone === "danger" && "bg-red-50 text-red-700 ring-red-100",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-100",
        tone === "info" && "bg-sky-50 text-sky-800 ring-sky-100",
        tone === "neutral" && "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {formatLoadStatus(status)}
    </span>
  );
}

type TripContextRowProps = {
  trip: TripContext;
  onSelect: (trip: TripContext) => void;
  selected: boolean;
};

export default function TripContextRow({ trip, onSelect, selected }: TripContextRowProps) {
  const { load, driver, vehicle } = trip;
  const primaryIssue = getTripLinkageIssues(trip)[0];

  return (
    <button
      type="button"
      onClick={() => onSelect(trip)}
      className={cn(
        "w-full border-b border-border px-3 py-2.5 text-left transition last:border-b-0",
        selected
          ? "bg-primary-muted/50 shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-primary-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{load.routeLabel}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {load.hot ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100 ring-inset">
              Hot
            </span>
          ) : null}
          <LoadStatusBadge status={load.status} />
        </div>
      </div>

      <p className="mt-1 truncate text-xs text-muted">
        Load {load.companyLoad || load.openroadLoadId}
        {driver?.displayName ? ` · ${driver.displayName}` : " · Unassigned"}
        {load.truckUnit ? ` · Truck ${load.truckUnit}` : ""}
      </p>

      {vehicle?.fuel ? (
        <div className="mt-2">
          <FleetFuelBar percent={vehicle.fuel.percent} isLow={vehicle.fuel.isLow} />
        </div>
      ) : primaryIssue ? (
        <p className="mt-1.5 truncate text-[11px] text-amber-800">{primaryIssue.title}</p>
      ) : null}
    </button>
  );
}
