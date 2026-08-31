"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getMappableFuelStations } from "@/lib/station-utils";
import {
  buildCorridorStationMarkerHtml,
  buildStopMarkerHtml,
  buildTruckMarkerHtml,
  estimateCorridorLineWeight,
  getCorridorStationBadge,
  resolveCorridorStationMarkerKind,
  toInspectedMapStation,
  type InspectedMapStation,
} from "@/lib/trip-route-map-markers";
import { buildTripRouteMapData } from "@/lib/trip-route-points";
import { getTripRouteMapHint } from "@/lib/trip-linkage-status";
import type { CorridorStation, FuelPlan } from "@/types/recommendation";
import type { FuelStation, StationListResponse } from "@/types/station";
import type { TripContext, TripDrivingRoute } from "@/types/tms";

type TripRouteMapProps = {
  trip: TripContext | null;
  corridorStations?: CorridorStation[];
  highlightStationIds?: string[];
  demoMode?: boolean;
  corridorBufferMiles?: number;
  fuelPlan?: FuelPlan;
  primaryStationId?: string;
  fill?: boolean;
  selectedStationId?: string | null;
  onStationSelect?: (station: InspectedMapStation) => void;
};

type LeafletNamespace = typeof import("leaflet");

const ROUTE_COLOR = "#2563eb";
const CORRIDOR_COLOR = "#38bdf8";
const FUEL_STATION_COLOR = "#ea580c";

function formatRouteSummary(route: TripDrivingRoute) {
  return `${route.distanceMiles.toLocaleString()} mi · ${route.durationMinutes.toLocaleString()} min drive`;
}

function markerZIndex(kind: ReturnType<typeof resolveCorridorStationMarkerKind>) {
  switch (kind) {
    case "fill-now":
      return 1200;
    case "fill-then":
      return 1100;
    case "cheapest":
      return 1000;
    case "in-range":
      return 400;
    default:
      return 100;
  }
}

export default function TripRouteMap({
  trip,
  corridorStations,
  highlightStationIds = [],
  demoMode = false,
  corridorBufferMiles = 15,
  fuelPlan,
  primaryStationId,
  fill = false,
  selectedStationId = null,
  onStationSelect,
}: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const routeLayersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const stationLayersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const fuelStationsRef = useRef<FuelStation[]>([]);
  const corridorStationsRef = useRef<CorridorStation[] | undefined>(undefined);
  const highlightStationIdsRef = useRef<string[]>([]);
  const fuelPlanRef = useRef<FuelPlan | undefined>(undefined);
  const primaryStationIdRef = useRef<string | undefined>(undefined);
  const selectedStationIdRef = useRef<string | null>(null);
  const onStationSelectRef = useRef<TripRouteMapProps["onStationSelect"]>(onStationSelect);

  const mapData = useMemo(() => buildTripRouteMapData(trip), [trip]);
  const [drivingRoute, setDrivingRoute] = useState<TripDrivingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [fuelStations, setFuelStations] = useState<FuelStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const useCorridorStations = corridorStations !== undefined;
  const mappableCorridorStations = useMemo(
    () =>
      corridorStations?.filter(
        (station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude),
      ) ?? [],
    [corridorStations],
  );
  const mappableStations = useMemo(() => getMappableFuelStations(fuelStations), [fuelStations]);
  const stationCount = useCorridorStations ? mappableCorridorStations.length : mappableStations.length;
  const routeHint = getTripRouteMapHint(trip, {
    hasMapData: Boolean(mapData),
    hasDrivingRoute: Boolean(drivingRoute),
    routeLoading,
    routeError,
  });

  const renderStationMarkers = useCallback(
    (
      stations: FuelStation[],
      corridor: CorridorStation[] | undefined,
      highlightedIds: string[],
      plan?: FuelPlan,
      primaryId?: string,
    ) => {
      const stationLayers = stationLayersRef.current;
      const leafletModule = leafletRef.current;

      if (!stationLayers || !leafletModule) {
        return;
      }

      const L = leafletModule;
      stationLayers.clearLayers();

      if (corridor) {
        const cheapestId = corridor[0]?.relayLocationId;
        const fillNowId = plan?.now?.relayLocationId;
        const fillThenId = plan?.then?.relayLocationId;
        const selectedId = selectedStationIdRef.current;

        for (const station of corridor) {
          const kind = resolveCorridorStationMarkerKind(station, {
            cheapestId,
            fillNowId,
            fillThenId,
          });
          const badge = getCorridorStationBadge(kind, plan);
          const selected = selectedId === station.relayLocationId;
          const marker = L.marker([station.latitude, station.longitude], {
            icon: L.divIcon({
              className: "",
              html: buildCorridorStationMarkerHtml(station, kind, badge, selected),
              iconSize: [104, 52],
              iconAnchor: [52, 26],
            }),
            zIndexOffset:
              markerZIndex(kind) +
              (selected ? 200 : 0) +
              (highlightedIds.includes(station.relayLocationId) ? 150 : 0) +
              (primaryId && station.relayLocationId === primaryId && kind === "in-range" ? 80 : 0),
          }).addTo(stationLayers);

          marker.on("click", () => {
            onStationSelectRef.current?.(toInspectedMapStation(station, kind, badge));
          });
        }

        return;
      }

      for (const station of getMappableFuelStations(stations)) {
        const marker = L.circleMarker([station.latitude, station.longitude], {
          radius: 4,
          color: "#ffffff",
          weight: 1,
          fillColor: FUEL_STATION_COLOR,
          fillOpacity: 0.85,
        }).addTo(stationLayers);

        marker.on("click", () => {
          onStationSelectRef.current?.({
            relayLocationId: station.relayLocationId,
            merchantDisplayName: station.merchantName || station.name || "Fuel stop",
            name: station.name,
            city: station.city,
            state: station.state,
            effectivePricePerGallon:
              station.discountedPricePerUnit ?? station.retailPricePerUnit ?? 0,
          });
        });
      }
    },
    [],
  );

  useEffect(() => {
    const loadId = trip?.load.id;

    if (!loadId) {
      setDrivingRoute(null);
      setRouteError(null);
      setRouteLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDrivingRoute() {
      setRouteLoading(true);
      setRouteError(null);

      try {
        const response = await apiRequest<TripDrivingRoute>(`/api/v1/tms/trip-context/${loadId}/route`);

        if (cancelled) {
          return;
        }

        if (!response.success || !response.data) {
          setDrivingRoute(null);
          setRouteError(response.message || "Failed to load driving route");
          return;
        }

        setDrivingRoute(response.data);
      } catch {
        if (!cancelled) {
          setDrivingRoute(null);
          setRouteError("Failed to load driving route");
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    }

    void loadDrivingRoute();

    return () => {
      cancelled = true;
    };
  }, [trip?.load.id]);

  useEffect(() => {
    if (useCorridorStations) {
      setStationsLoading(false);
      setStationsError(null);
      return;
    }

    let cancelled = false;

    async function loadFuelStations() {
      setStationsLoading(true);
      setStationsError(null);

      try {
        const response = await apiRequest<StationListResponse>("/api/v1/stations?activeOnly=true");

        if (cancelled) {
          return;
        }

        if (!response.success || !response.data) {
          setFuelStations([]);
          setStationsError(response.message || "Failed to load Relay fuel stations");
          return;
        }

        setFuelStations(response.data.items);
      } catch {
        if (!cancelled) {
          setFuelStations([]);
          setStationsError("Failed to load Relay fuel stations");
        }
      } finally {
        if (!cancelled) {
          setStationsLoading(false);
        }
      }
    }

    void loadFuelStations();

    return () => {
      cancelled = true;
    };
  }, [useCorridorStations]);

  useEffect(() => {
    let cancelled = false;

    async function ensureMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      const L = await import("leaflet");

      if (cancelled || !containerRef.current) {
        return;
      }

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([39.8283, -98.5795], 4);

      L.control.zoom({ position: "topright" }).addTo(map);

      map.whenReady(() => {
        if (mapRef.current === map) {
          map.invalidateSize();
        }
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const routeLayers = L.layerGroup().addTo(map);
      const stationLayers = L.layerGroup().addTo(map);
      mapRef.current = map;
      routeLayersRef.current = routeLayers;
      stationLayersRef.current = stationLayers;
      resizeObserverRef.current?.disconnect();
      const observer = new ResizeObserver(() => {
        if (mapRef.current === map) {
          map.invalidateSize();
        }
      });
      observer.observe(containerRef.current);
      resizeObserverRef.current = observer;
      renderStationMarkers(
        fuelStationsRef.current,
        corridorStationsRef.current,
        highlightStationIdsRef.current,
        fuelPlanRef.current,
        primaryStationIdRef.current,
      );
    }

    void ensureMap();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      routeLayersRef.current = null;
      stationLayersRef.current = null;
      leafletRef.current = null;
    };
  }, [renderStationMarkers]);

  useEffect(() => {
    fuelStationsRef.current = fuelStations;
    corridorStationsRef.current = corridorStations;
    highlightStationIdsRef.current = highlightStationIds;
    fuelPlanRef.current = fuelPlan;
    primaryStationIdRef.current = primaryStationId;
    selectedStationIdRef.current = selectedStationId;
    onStationSelectRef.current = onStationSelect;
    renderStationMarkers(fuelStations, corridorStations, highlightStationIds, fuelPlan, primaryStationId);
  }, [
    corridorStations,
    fuelPlan,
    fuelStations,
    highlightStationIds,
    onStationSelect,
    primaryStationId,
    renderStationMarkers,
    selectedStationId,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayers = routeLayersRef.current;
    const leafletModule = leafletRef.current;

    if (!map || !routeLayers || !leafletModule) {
      return;
    }

    const L = leafletModule;
    routeLayers.clearLayers();

    if (!mapData) {
      map.setView([39.8283, -98.5795], 4);
      return;
    }

    const routeLine = drivingRoute?.polyline ?? mapData.routeLine;
    const routeCoords = routeLine.map((point) => [point.lat, point.lng] as [number, number]);

    if (useCorridorStations && routeCoords.length >= 2) {
      L.polyline(routeCoords, {
        color: CORRIDOR_COLOR,
        weight: estimateCorridorLineWeight(corridorBufferMiles),
        opacity: 0.22,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeLayers);
    }

    if (routeCoords.length >= 2) {
      L.polyline(routeCoords, {
        color: ROUTE_COLOR,
        weight: 5,
        opacity: drivingRoute ? 0.95 : 0.6,
        dashArray: drivingRoute ? undefined : "8 6",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeLayers);
    }

    for (const point of mapData.points) {
      const isTruck = point.kind === "truck";

      if (isTruck) {
        L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: buildTruckMarkerHtml(demoMode ? "Demo truck" : "Your truck"),
            iconSize: [88, 58],
            iconAnchor: [44, 29],
          }),
          zIndexOffset: 1500,
        })
          .addTo(routeLayers)
          .bindTooltip(point.label, { direction: "top", offset: [0, -18], opacity: 0.92 });
        continue;
      }

      const stopNumber = point.position ? String(point.position) : "•";
      L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "",
          html: buildStopMarkerHtml(stopNumber, Boolean(point.completed)),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
        zIndexOffset: 800,
      })
        .addTo(routeLayers)
        .bindTooltip(point.label, { direction: "top", offset: [0, -14], opacity: 0.92 });
    }

    const currentTripPoints = mapData.points.filter((point) => point.kind === "truck" || !point.completed);
    const boundsPoints =
      drivingRoute && routeCoords.length >= 2
        ? routeCoords
        : (currentTripPoints.length > 0 ? currentTripPoints : mapData.points).map(
            (point) => [point.lat, point.lng] as [number, number],
          );

    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, {
        paddingTopLeft: [28, 72],
        paddingBottomRight: [72, 72],
        maxZoom: 14,
      });
    }
  }, [
    corridorBufferMiles,
    demoMode,
    drivingRoute,
    mapData,
    mappableCorridorStations,
    useCorridorStations,
  ]);

  const mapHint = trip
    ? useCorridorStations
      ? `Fuel stops within ${corridorBufferMiles} mi of driving route`
      : demoMode
        ? "Demo truck position along the Open Road route"
        : "Driving route from truck to remaining Open Road stops"
    : "Select a load to preview its route";

  return (
    <div className={fill ? "relative isolate z-0 h-full min-h-[28rem] lg:min-h-0" : "relative isolate z-0"}>
      <div
        ref={containerRef}
        className={
          fill
            ? "absolute inset-0 bg-slate-100"
            : "h-[420px] w-full overflow-hidden bg-slate-100 sm:h-[520px]"
        }
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex flex-wrap items-start justify-between gap-2 p-2 pr-12">
        <div className="pointer-events-auto max-w-[min(100%,28rem)] rounded-xl border border-border/80 bg-white/92 px-3 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-foreground">Route map</h2>
          <p className="mt-0.5 truncate text-xs text-muted">{mapHint}</p>
        </div>

        {trip ? (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            {routeLoading ? (
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-xs text-muted shadow-sm ring-1 ring-border">
                Calculating route...
              </span>
            ) : null}
            {drivingRoute ? (
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-border">
                {formatRouteSummary(drivingRoute)}
              </span>
            ) : null}
            {!stationsLoading && stationCount > 0 ? (
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-border">
                {stationCount.toLocaleString()} stops
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {routeHint || stationsError ? (
        <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-[400] px-2">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-warning-muted/95 px-3 py-1.5 shadow-sm">
            {routeHint ? <p className="text-xs text-amber-800">{routeHint}</p> : null}
            {stationsError ? <p className="text-xs text-amber-800">{stationsError}</p> : null}
          </div>
        </div>
      ) : null}

      {!mapData && trip ? (
        <div className="absolute inset-0 z-[350] flex items-center justify-center bg-slate-100/90">
          <p className="max-w-sm px-4 text-center text-sm text-muted">
            No coordinates on this load yet. Sync from Open Road TMS once stop lat/lng is available.
          </p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 z-[400] max-w-[calc(100%-4.5rem)]">
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-border/80 bg-white/92 px-2.5 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          {mapData ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="text-sm">🚛</span>
                Truck
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
                  1
                </span>
                Stop
              </span>
            </>
          ) : null}
          {useCorridorStations ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-1.5 w-6 rounded-full bg-[#38bdf8]/50" />
                Corridor
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="rounded-full bg-[#ca8a04] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Cheapest
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="rounded-full bg-[#7c3aed] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Now
                </span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-2 w-2 rounded-full bg-[#ea580c]" />
              Relay station
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
