"use client";

import { useEffect } from "react";
import Button from "@/components/common/button";
import FleetFreshnessBadge from "@/components/fleet/fleet-freshness-badge";
import FleetFuelBar from "@/components/fleet/fleet-fuel-bar";
import { formatFleetRelativeAge, formatFleetTimestamp } from "@/lib/fleet-utils";
import type { FleetVehicle } from "@/types/fleet";

type DetailFieldProps = {
  label: string;
  value: React.ReactNode;
};

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-muted/40 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

type FleetVehicleDetailPanelProps = {
  vehicle: FleetVehicle | null;
  onClose: () => void;
};

export default function FleetVehicleDetailPanel({ vehicle, onClose }: FleetVehicleDetailPanelProps) {
  useEffect(() => {
    if (!vehicle) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [vehicle, onClose]);

  if (!vehicle) {
    return null;
  }

  const location = vehicle.gps?.formattedLocation ?? vehicle.gps?.addressName ?? "—";
  const mapsHref =
    vehicle.gps && `https://www.google.com/maps?q=${vehicle.gps.latitude},${vehicle.gps.longitude}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 sm:p-8">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-detail-title"
        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Truck details</p>
            <h2 id="fleet-detail-title" className="mt-1 text-xl font-semibold text-foreground">
              Unit #{vehicle.unitNumber}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {vehicle.make ?? "Truck"}
              {vehicle.model ? ` · ${vehicle.model}` : ""}
              {vehicle.year ? ` · ${vehicle.year}` : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="fleet-table-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Vehicle</h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Samsara ID" value={vehicle.samsaraId} />
              <DetailField label="Status" value={vehicle.isActive ? "Active" : "Inactive"} />
              <DetailField label="VIN" value={vehicle.vin ?? "—"} />
              <DetailField label="License plate" value={vehicle.licensePlate ?? "—"} />
              <DetailField label="Make" value={vehicle.make ?? "—"} />
              <DetailField label="Model" value={vehicle.model ?? "—"} />
              <DetailField label="Year" value={vehicle.year ?? "—"} />
            </dl>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Fuel</h3>
            {vehicle.fuel ? (
              <div className="space-y-3">
                <FleetFuelBar percent={vehicle.fuel.percent} isLow={vehicle.fuel.isLow} />
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Freshness" value={<FleetFreshnessBadge freshness={vehicle.fuel.freshness} />} />
                  <DetailField label="Low fuel alert" value={vehicle.fuel.isLow ? "Yes" : "No"} />
                  <DetailField label="Recorded at" value={formatFleetTimestamp(vehicle.fuel.recordedAt)} />
                  <DetailField label="Age" value={formatFleetRelativeAge(vehicle.fuel.recordedAt)} />
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted">No fuel telemetry available.</p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">GPS & location</h3>
            {vehicle.gps ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Location" value={location} />
                <DetailField
                  label="Coordinates"
                  value={`${vehicle.gps.latitude.toFixed(5)}, ${vehicle.gps.longitude.toFixed(5)}`}
                />
                <DetailField
                  label="Speed"
                  value={vehicle.gps.speedMilesPerHour !== undefined ? `${Math.round(vehicle.gps.speedMilesPerHour)} mph` : "—"}
                />
                <DetailField
                  label="Heading"
                  value={vehicle.gps.headingDegrees !== undefined ? `${Math.round(vehicle.gps.headingDegrees)}°` : "—"}
                />
                <DetailField label="Freshness" value={<FleetFreshnessBadge freshness={vehicle.gps.freshness} />} />
                <DetailField label="Recorded at" value={formatFleetTimestamp(vehicle.gps.recordedAt)} />
                <DetailField label="Age" value={formatFleetRelativeAge(vehicle.gps.recordedAt)} />
                {mapsHref ? (
                  <DetailField
                    label="Map"
                    value={
                      <a href={mapsHref} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                        Open in Google Maps
                      </a>
                    }
                  />
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted">No GPS telemetry available.</p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Sync metadata</h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Registry synced at" value={formatFleetTimestamp(vehicle.registrySyncedAt)} />
              <DetailField label="Telemetry synced at" value={formatFleetTimestamp(vehicle.telemetrySyncedAt)} />
              <DetailField label="Record updated at" value={formatFleetTimestamp(vehicle.updatedAt)} />
              <DetailField label="Internal ID" value={vehicle.id} />
            </dl>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
