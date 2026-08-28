"use client";

import { useMemo, useState } from "react";
import { IconSearch } from "@/components/common/icons";
import Input from "@/components/common/input";
import Modal from "@/components/common/modal";
import { formatPricePerGallon } from "@/lib/station-utils";
import { cn } from "@/lib/utils";
import type { CorridorStation, FuelPlan, RecommendationCorridor } from "@/types/recommendation";

type CorridorStationsModalProps = {
  open: boolean;
  onClose: () => void;
  stations: CorridorStation[];
  corridor?: RecommendationCorridor;
  fuelPlan?: FuelPlan;
};

export default function CorridorStationsModal({
  open,
  onClose,
  stations,
  corridor,
  fuelPlan,
}: CorridorStationsModalProps) {
  const [query, setQuery] = useState("");
  const nowId = fuelPlan?.now?.relayLocationId;
  const thenId = fuelPlan?.then?.relayLocationId;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return stations;
    }

    return stations.filter((station) =>
      [station.merchantDisplayName, station.name, station.city, station.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, stations]);

  return (
    <Modal
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={`Stops on route (${stations.length})`}
      subtitle={
        corridor
          ? `Within ${corridor.bufferMiles} mi of the driving corridor · search to compare prices`
          : "Search to compare prices along the route"
      }
      toolbar={
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search station, city, or state"
            className="h-9 pl-8 text-sm"
            aria-label="Search corridor stops"
          />
        </div>
      }
    >
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No stops match that search.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-muted text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Station</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Miles</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((station, index) => {
              const isNow = station.relayLocationId === nowId;
              const isThen = station.relayLocationId === thenId;
              const isCheapest = stations[0]?.relayLocationId === station.relayLocationId;

              return (
                <tr
                  key={`${station.relayLocationId}-${index}`}
                  className={cn(
                    "border-t border-border",
                    isNow && "bg-emerald-50",
                    !isNow && isCheapest && "bg-emerald-50/40",
                    !station.withinCurrentFuelRange && "text-muted",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{station.merchantDisplayName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[station.city, station.state].filter(Boolean).join(", ") || "On route"}
                      {isNow ? " · Recommended" : isThen ? " · Next fill" : isCheapest ? " · Cheapest" : ""}
                      {!station.withinCurrentFuelRange ? " · Out of range" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums text-success">
                    {formatPricePerGallon(station.effectivePricePerGallon)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {station.distanceAlongRouteMiles.toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
