import type { FuelStation, RelayAccount } from "@/types/station";

const ACCOUNT_LABELS: Record<RelayAccount, string> = {
  blue_stallion: "Blue Stallion",
  azfs: "AZFS",
};

export function formatRelayAccount(account: RelayAccount) {
  return ACCOUNT_LABELS[account] ?? account;
}

export function formatStationTimestamp(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export function formatPricePerGallon(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }

  return `$${value.toFixed(3)}/gal`;
}

export type StationDiscount = {
  savingsPerGallon: number;
  savingsPercent: number;
};

export function getStationDiscount(station: {
  retailPricePerUnit?: number;
  discountedPricePerUnit?: number;
}): StationDiscount | null {
  const { retailPricePerUnit, discountedPricePerUnit } = station;

  if (
    retailPricePerUnit === undefined ||
    discountedPricePerUnit === undefined ||
    retailPricePerUnit <= discountedPricePerUnit
  ) {
    return null;
  }

  const savingsPerGallon = Math.round((retailPricePerUnit - discountedPricePerUnit) * 1000) / 1000;
  const savingsPercent = Math.round((savingsPerGallon / retailPricePerUnit) * 1000) / 10;

  return { savingsPerGallon, savingsPercent };
}

export function formatDiscountSavings(savingsPerGallon: number) {
  return `-$${savingsPerGallon.toFixed(3)}/gal`;
}

export function formatDiscountPercent(savingsPercent: number) {
  return `${savingsPercent.toFixed(1)}% off`;
}

export type StationDiscountSummary = {
  stationsWithDiscount: number;
  stationsWithoutDiscount: number;
  averageSavingsPerGallon: number;
  maxSavingsPerGallon: number;
};

export function summarizeStationDiscounts(
  stations: { retailPricePerUnit?: number; discountedPricePerUnit?: number }[],
): StationDiscountSummary {
  const discounts = stations
    .map((station) => getStationDiscount(station))
    .filter((discount): discount is StationDiscount => discount !== null);

  const stationsWithDiscount = discounts.length;
  const stationsWithoutDiscount = stations.length - stationsWithDiscount;
  const totalSavings = discounts.reduce((sum, discount) => sum + discount.savingsPerGallon, 0);
  const averageSavingsPerGallon =
    stationsWithDiscount > 0 ? Math.round((totalSavings / stationsWithDiscount) * 1000) / 1000 : 0;
  const maxSavingsPerGallon =
    stationsWithDiscount > 0 ? Math.max(...discounts.map((discount) => discount.savingsPerGallon)) : 0;

  return {
    stationsWithDiscount,
    stationsWithoutDiscount,
    averageSavingsPerGallon,
    maxSavingsPerGallon,
  };
}

export function hasStationCoordinates(
  station: FuelStation,
): station is FuelStation & { latitude: number; longitude: number } {
  return (
    typeof station.latitude === "number" &&
    typeof station.longitude === "number" &&
    Number.isFinite(station.latitude) &&
    Number.isFinite(station.longitude)
  );
}

export function getMappableFuelStations(stations: FuelStation[]) {
  return stations.filter(hasStationCoordinates);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildFuelStationPopupHtml(station: FuelStation) {
  const title = escapeHtml(station.name || station.relayLocationId);
  const location = escapeHtml(formatStationLocation(station));
  const merchant = station.merchantName ? escapeHtml(station.merchantName) : null;
  const account = escapeHtml(formatRelayAccount(station.relayAccount));
  const discount = getStationDiscount(station);
  const priceLine =
    station.discountedPricePerUnit !== undefined
      ? `Contract: ${formatPricePerGallon(station.discountedPricePerUnit)}`
      : station.retailPricePerUnit !== undefined
        ? `Retail: ${formatPricePerGallon(station.retailPricePerUnit)}`
        : null;

  return [
    `<strong>${title}</strong>`,
    merchant ? `${merchant}` : null,
    location,
    `Relay · ${account}`,
    priceLine,
    discount ? `<span style="color:#15803d">Save ${formatDiscountSavings(discount.savingsPerGallon)}</span>` : null,
  ]
    .filter(Boolean)
    .join("<br />");
}

export function formatStationLocation(station: {
  city?: string;
  state?: string;
  address?: string;
}) {
  const cityState = [station.city, station.state].filter(Boolean).join(", ");
  if (cityState && station.address) {
    return `${station.address}, ${cityState}`;
  }

  return cityState || station.address || "—";
}
