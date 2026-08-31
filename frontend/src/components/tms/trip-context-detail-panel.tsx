import FleetFreshnessBadge from "@/components/fleet/fleet-freshness-badge";
import FleetFuelBar from "@/components/fleet/fleet-fuel-bar";
import { LoadStatusBadge } from "@/components/tms/trip-context-row";
import { getTripLinkageIssues } from "@/lib/trip-linkage-status";
import { cn } from "@/lib/utils";
import type { TripContext } from "@/types/tms";

type TripContextDetailPanelProps = {
  trip: TripContext | null;
  compact?: boolean;
};

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="section-label">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="section-label">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function routeEnds(trip: TripContext) {
  const { load } = trip;
  const origin = [load.originCity, load.originStateCode].filter(Boolean).join(", ");
  const destination = [load.destinationCity, load.destinationStateCode].filter(Boolean).join(", ");

  if (origin && destination) {
    return { origin, destination };
  }

  const [from, to] = load.routeLabel.split("→").map((part) => part.trim());
  return {
    origin: origin || from || load.routeLabel,
    destination: destination || to || "",
  };
}

export function TripWorkspaceHeader({
  trip,
  compact = false,
}: {
  trip: TripContext | null;
  compact?: boolean;
}) {
  if (!trip) {
    return (
      <div className={cn("px-4 py-3", !compact && "border-b border-border")}>
        <p className="text-sm font-semibold text-foreground">Select a load</p>
        <p className="mt-1 text-xs text-muted">Pick a trip on the left to see its route and fuel plan.</p>
      </div>
    );
  }

  const { load, driver, vehicle } = trip;
  const primaryIssue = getTripLinkageIssues(trip)[0];
  const { origin, destination } = routeEnds(trip);

  if (compact) {
    return (
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="section-label">Trip</p>
            <h2 className="mt-1 text-[15px] leading-snug font-semibold text-foreground">{origin}</h2>
            {destination ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <span className="text-primary" aria-hidden="true">
                  →
                </span>
                <span className="truncate">{destination}</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {load.hot ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100 ring-inset">
                Hot
              </span>
            ) : null}
            <LoadStatusBadge status={load.status} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <MetaCell label="Load" value={String(load.companyLoad || load.openroadLoadId)} />
          <MetaCell label="Driver" value={driver?.displayName || "Unassigned"} />
          <MetaCell label="Truck" value={load.truckUnit ? String(load.truckUnit) : "No truck"} />
          {vehicle?.fuel ? (
            <div className="min-w-0">
              <p className="section-label">Fuel</p>
              <div className="mt-1">
                <FleetFuelBar percent={vehicle.fuel.percent} isLow={vehicle.fuel.isLow} />
              </div>
            </div>
          ) : (
            <MetaCell label="Fuel" value="Not reported" />
          )}
        </div>

        {load.destinations.length > 0 ? (
          <div className="mt-3 border-t border-border pt-3">
            <TripStopTimeline trip={trip} compact />
          </div>
        ) : null}

        {[load.customerName, load.commodity, load.equipment].some(Boolean) ? (
          <p className="mt-2.5 truncate text-[11px] text-muted">
            {[load.customerName, load.commodity, load.equipment].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{load.routeLabel}</h2>
          <p className="mt-1 truncate text-xs text-muted">
            Load {load.companyLoad || load.openroadLoadId}
            {driver?.displayName ? ` · ${driver.displayName}` : " · Unassigned"}
            {load.truckUnit ? ` · Truck ${load.truckUnit}` : ""}
            {vehicle?.fuel ? ` · ${vehicle.fuel.percent}% fuel` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {load.hot ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100 ring-inset">
              Hot
            </span>
          ) : null}
          <LoadStatusBadge status={load.status} />
        </div>
      </div>

      {primaryIssue ? (
        <p className="mt-2 text-xs text-amber-800">
          {primaryIssue.title}. {primaryIssue.action}
        </p>
      ) : null}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-primary">Trip details and stops</summary>
        <div className="mt-3">
          <TripContextDetailPanel trip={trip} />
        </div>
      </details>
    </div>
  );
}

function formatAppointment(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TripStopTimeline({ trip, compact = false }: { trip: TripContext; compact?: boolean }) {
  const stops = trip.load.destinations;
  if (stops.length === 0) {
    return null;
  }

  return (
    <div className={compact ? undefined : "mt-2"}>
      <p className="section-label">Stops</p>
      <div className={cn("mt-2", compact && stops.length > 4 && "max-h-40 overflow-y-auto pr-1")}>
        {stops.map((destination, index) => {
          const appointment = formatAppointment(destination.appointmentDate);
          const place = [destination.city, destination.stateCode].filter(Boolean).join(", ");

          return (
            <div key={`${trip.load.openroadLoadId}-${destination.position}`} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    destination.completed ? "bg-nav-icon" : "bg-primary",
                  )}
                >
                  {destination.position}
                </span>
                {index < stops.length - 1 ? <span className="my-1 w-px min-h-3 flex-1 bg-border" /> : null}
              </div>
              <div className={cn("min-w-0 flex-1", index < stops.length - 1 && "pb-2.5")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium capitalize text-foreground">
                    {destination.stopType.replaceAll("_", " ")}
                    {destination.companyName ? ` · ${destination.companyName}` : ""}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      destination.completed
                        ? "bg-slate-100 text-slate-600 ring-slate-200"
                        : "bg-primary-muted text-primary ring-primary/15",
                    )}
                  >
                    {destination.completed ? "Done" : "Next"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {place || "Location pending"}
                  {appointment ? ` · ${appointment}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TripContextDetailPanel({ trip, compact = false }: TripContextDetailPanelProps) {
  if (!trip) {
    return <p className="text-sm text-muted">Select an active load to inspect route stops.</p>;
  }

  const { load, driver, vehicle } = trip;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className={cn("grid gap-3", compact ? "grid-cols-2 gap-2" : "sm:grid-cols-2")}>
        <DetailField label="Company load" value={load.companyLoad} />
        <DetailField label="Customer load" value={load.customerLoad} />
        <DetailField label="Driver team" value={driver?.team} />
        <DetailField label="Equipment" value={load.equipment} />
        <DetailField label="Commodity" value={load.commodity} />
        <DetailField label="Customer" value={load.customerName} />
      </div>

      {vehicle ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-muted px-3 py-2.5">
            <p className="text-xs text-muted">Fuel</p>
            {vehicle.fuel ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{vehicle.fuel.percent}%</span>
                <FleetFreshnessBadge freshness={vehicle.fuel.freshness} />
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">Not reported</p>
            )}
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-muted px-3 py-2.5">
            <p className="text-xs text-muted">GPS</p>
            {vehicle.gps ? (
              <div className="mt-1 space-y-1">
                <FleetFreshnessBadge freshness={vehicle.gps.freshness} />
                <p className="text-xs text-muted">
                  {vehicle.gps.formattedLocation ||
                    `${vehicle.gps.latitude.toFixed(4)}, ${vehicle.gps.longitude.toFixed(4)}`}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">Not reported</p>
            )}
          </div>
        </div>
      ) : null}

      <TripStopTimeline trip={trip} />
    </div>
  );
}
