import type { CorridorStation, FuelPlan } from "@/types/recommendation";

export type CorridorStationMarkerKind =
  | "fill-now"
  | "fill-then"
  | "cheapest"
  | "in-range"
  | "out-of-range";

const MARKER_STYLES: Record<
  CorridorStationMarkerKind,
  { background: string; border: string; scale: number; showPrice: boolean }
> = {
  "fill-now": { background: "#7c3aed", border: "#5b21b6", scale: 1.15, showPrice: true },
  "fill-then": { background: "#059669", border: "#047857", scale: 1.15, showPrice: true },
  cheapest: { background: "#ca8a04", border: "#a16207", scale: 1.1, showPrice: true },
  "in-range": { background: "#ea580c", border: "#c2410c", scale: 0.9, showPrice: false },
  "out-of-range": { background: "#94a3b8", border: "#64748b", scale: 0.75, showPrice: false },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveCorridorStationMarkerKind(
  station: CorridorStation,
  options: {
    cheapestId?: string;
    fillNowId?: string;
    fillThenId?: string;
  },
): CorridorStationMarkerKind {
  if (options.fillNowId && station.relayLocationId === options.fillNowId) {
    return "fill-now";
  }

  if (options.fillThenId && station.relayLocationId === options.fillThenId) {
    return "fill-then";
  }

  if (options.cheapestId && station.relayLocationId === options.cheapestId) {
    return "cheapest";
  }

  return station.withinCurrentFuelRange ? "in-range" : "out-of-range";
}

export type InspectedMapStation = {
  relayLocationId: string;
  merchantDisplayName: string;
  name?: string;
  city?: string;
  state?: string;
  effectivePricePerGallon: number;
  distanceAlongRouteMiles?: number;
  kind?: CorridorStationMarkerKind;
  badge?: string;
};

export function toInspectedMapStation(
  station: CorridorStation,
  kind: CorridorStationMarkerKind,
  badge?: string,
): InspectedMapStation {
  return {
    relayLocationId: station.relayLocationId,
    merchantDisplayName: station.merchantDisplayName,
    name: station.name,
    city: station.city,
    state: station.state,
    effectivePricePerGallon: station.effectivePricePerGallon,
    distanceAlongRouteMiles: station.distanceAlongRouteMiles,
    kind,
    badge,
  };
}

export function buildCorridorStationMarkerHtml(
  station: CorridorStation,
  kind: CorridorStationMarkerKind,
  badge?: string,
  selected = false,
) {
  const style = MARKER_STYLES[kind];
  const price = `$${station.effectivePricePerGallon.toFixed(2)}`;
  const title = escapeHtml(station.merchantDisplayName);
  const badgeHtml = badge
    ? `<span style="display:block;margin-top:2px;font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fef3c7;">${escapeHtml(badge)}</span>`
    : "";
  const ring = selected ? "0 0 0 3px #fff, 0 0 0 5px #3c50e0, 0 2px 8px rgba(15,23,42,0.28)" : "0 2px 8px rgba(15,23,42,0.28)";

  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:scale(${style.scale});cursor:pointer;">
      <div style="
        display:flex;align-items:center;gap:4px;
        padding:3px 7px 3px 5px;
        border-radius:999px;
        background:${style.background};
        border:2px solid ${style.border};
        color:#fff;
        font:600 11px/1.2 system-ui,-apple-system,sans-serif;
        box-shadow:${ring};
        white-space:nowrap;
      ">
        <span style="font-size:12px;line-height:1;">⛽</span>
        ${style.showPrice ? `<span>${price}</span>` : ""}
      </div>
      ${badgeHtml}
      <span style="
        margin-top:3px;
        max-width:96px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        padding:1px 6px;
        border-radius:6px;
        background:rgba(255,255,255,0.94);
        border:1px solid #e2e8f0;
        color:#0f172a;
        font:500 10px/1.3 system-ui,-apple-system,sans-serif;
        box-shadow:0 1px 4px rgba(15,23,42,0.12);
      ">${title}</span>
    </div>
  `;
}

export function buildCorridorStationPopupHtml(
  station: CorridorStation,
  kind: CorridorStationMarkerKind,
  options: { milesAhead: number; badge?: string },
) {
  const location = escapeHtml([station.name, station.city, station.state].filter(Boolean).join(", "));
  const badge = options.badge ? `<div style="margin-top:6px;font-weight:700;color:#7c3aed;">${escapeHtml(options.badge)}</div>` : "";

  const kindLabel =
    kind === "fill-now"
      ? "Step 1 — add fuel here"
      : kind === "fill-then"
        ? "Step 2 — fill at cheapest stop"
        : kind === "cheapest"
          ? "Cheapest contracted stop on route"
          : station.withinCurrentFuelRange
            ? "Within current fuel range"
            : "Ahead on route, outside current range";

  return `
    <div style="min-width:180px;font:13px/1.45 system-ui,-apple-system,sans-serif;color:#0f172a;">
      <strong style="font-size:14px;">${escapeHtml(station.merchantDisplayName)}</strong>
      <div style="margin-top:4px;color:#475569;">${location || "Fuel stop"}</div>
      <div style="margin-top:8px;font-size:15px;font-weight:700;color:#15803d;">$${station.effectivePricePerGallon.toFixed(3)}/gal</div>
      <div style="margin-top:4px;color:#475569;">${options.milesAhead.toFixed(0)} mi ahead on route</div>
      <div style="margin-top:6px;font-size:12px;color:#334155;">${kindLabel}</div>
      ${badge}
    </div>
  `;
}

export function buildTruckMarkerHtml(label: string) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:34px;height:34px;
        display:flex;align-items:center;justify-content:center;
        border-radius:999px;
        background:#16a34a;
        border:3px solid #fff;
        box-shadow:0 2px 10px rgba(15,23,42,0.3);
        font-size:17px;
      ">🚛</div>
      <span style="
        margin-top:4px;
        padding:2px 8px;
        border-radius:999px;
        background:#14532d;
        color:#fff;
        font:700 10px/1.3 system-ui,-apple-system,sans-serif;
        white-space:nowrap;
      ">${escapeHtml(label)}</span>
    </div>
  `;
}

export function buildStopMarkerHtml(label: string, completed: boolean) {
  const background = completed ? "#64748b" : "#2563eb";
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:28px;height:28px;
        display:flex;align-items:center;justify-content:center;
        border-radius:999px;
        background:${background};
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(15,23,42,0.22);
        color:#fff;
        font:700 11px/1 system-ui,-apple-system,sans-serif;
      ">${escapeHtml(label)}</div>
    </div>
  `;
}

export function getCorridorStationBadge(
  kind: CorridorStationMarkerKind,
  fuelPlan?: FuelPlan,
): string | undefined {
  if (kind === "fill-now") {
    return "Now";
  }

  if (kind === "fill-then") {
    return fuelPlan?.then ? "Next" : "Cheapest";
  }

  if (kind === "cheapest") {
    return "Cheapest";
  }

  return undefined;
}

export function estimateCorridorLineWeight(bufferMiles: number) {
  return Math.min(48, Math.max(18, Math.round(bufferMiles * 1.6)));
}
