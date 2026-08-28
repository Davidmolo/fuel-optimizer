import Button from "@/components/common/button";
import { IconEye } from "@/components/common/icons";
import FleetFreshnessBadge from "@/components/fleet/fleet-freshness-badge";
import FleetFuelBar from "@/components/fleet/fleet-fuel-bar";
import { formatFleetRelativeAge, formatFleetTimestamp } from "@/lib/fleet-utils";
import { cn } from "@/lib/utils";
import type { FleetVehicle } from "@/types/fleet";

type FleetVehicleRowProps = {
  vehicle: FleetVehicle;
  rowIndex: number;
  onView: (vehicle: FleetVehicle) => void;
};

const cellClass = "px-4 py-3.5 align-middle text-sm";

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function FleetVehicleRow({ vehicle, rowIndex, onView }: FleetVehicleRowProps) {
  const location = vehicle.gps?.formattedLocation ?? vehicle.gps?.addressName ?? "—";
  const mapsHref =
    vehicle.gps && `https://www.google.com/maps?q=${vehicle.gps.latitude},${vehicle.gps.longitude}`;

  return (
    <tr
      className={cn(
        "group border-b border-border-subtle transition-colors last:border-0 hover:bg-primary-muted/30",
        rowIndex % 2 === 0 ? "bg-surface" : "bg-surface-muted/50",
      )}
    >
      <td className={cellClass}>
        <div className="min-w-[7.5rem] font-semibold text-foreground">#{vehicle.unitNumber}</div>
        <div className="mt-0.5 text-xs text-muted">
          {vehicle.make ?? "Truck"}
          {vehicle.model ? ` · ${vehicle.model}` : ""}
        </div>
      </td>

      <td className={cn(cellClass, "whitespace-nowrap")}>
        <StatusBadge isActive={vehicle.isActive} />
      </td>

      <td className={cn(cellClass, "min-w-[9.5rem] break-all font-mono text-xs text-muted")}>
        {vehicle.vin ?? "—"}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap tabular-nums text-muted")}>
        {vehicle.year ?? "—"}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap text-muted")}>
        {vehicle.licensePlate ?? "—"}
      </td>

      <td className={cn(cellClass, "min-w-[10rem]")}>
        {vehicle.fuel ? (
          <div className="space-y-1.5">
            <FleetFuelBar percent={vehicle.fuel.percent} isLow={vehicle.fuel.isLow} />
            <div className="flex flex-wrap items-center gap-1.5">
              <FleetFreshnessBadge freshness={vehicle.fuel.freshness} />
              <span className="text-xs text-muted">{formatFleetRelativeAge(vehicle.fuel.recordedAt)}</span>
            </div>
          </div>
        ) : (
          <FleetFreshnessBadge freshness="missing" />
        )}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap")}>
        {vehicle.gps ? <FleetFreshnessBadge freshness={vehicle.gps.freshness} /> : <FleetFreshnessBadge freshness="missing" />}
      </td>

      <td className={cn(cellClass, "min-w-[14rem]")}>
        <p className="text-sm leading-snug text-foreground">{location}</p>
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
          >
            Open map
          </a>
        ) : null}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap font-mono text-xs text-muted")}>
        {vehicle.gps ? (
          <>
            {vehicle.gps.latitude.toFixed(5)}
            <br />
            {vehicle.gps.longitude.toFixed(5)}
          </>
        ) : (
          "—"
        )}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap tabular-nums text-muted")}>
        {vehicle.gps?.speedMilesPerHour !== undefined ? `${Math.round(vehicle.gps.speedMilesPerHour)} mph` : "—"}
      </td>

      <td className={cn(cellClass, "whitespace-nowrap text-xs text-muted")}>
        <div>{formatFleetTimestamp(vehicle.gps?.recordedAt)}</div>
        <div className="mt-0.5">{formatFleetRelativeAge(vehicle.gps?.recordedAt)}</div>
      </td>

      <td className={cn(cellClass, "whitespace-nowrap text-xs text-muted")}>
        {formatFleetTimestamp(vehicle.telemetrySyncedAt)}
      </td>

      <td className={cellClass}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`View details for unit ${vehicle.unitNumber}`}
          onClick={() => onView(vehicle)}
        >
          <IconEye />
        </Button>
      </td>
    </tr>
  );
}
