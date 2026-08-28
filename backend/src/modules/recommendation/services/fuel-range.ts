import {
  DEFAULT_MPG,
  DEFAULT_RESERVE_FUEL_PERCENT,
  DEFAULT_TANK_CAPACITY_GALLONS,
} from "../constants";

export type FuelRangeInput = {
  fuelPercent: number;
  tankCapacityGallons?: number;
  mpg?: number;
  reserveFuelPercent?: number;
};

export type FuelRangeEstimate = {
  fuelPercent: number;
  tankCapacityGallons: number;
  mpg: number;
  reserveFuelPercent: number;
  remainingGallons: number;
  reserveGallons: number;
  usableGallons: number;
  usableRangeMiles: number;
};

function roundGallons(value: number) {
  return Math.round(value * 10) / 10;
}

function roundMiles(value: number) {
  return Math.round(value * 10) / 10;
}

export function resolveTankCapacityGallons(
  tankCapacityGallons: number | undefined,
  fallback: number = DEFAULT_TANK_CAPACITY_GALLONS,
) {
  if (
    typeof tankCapacityGallons === "number" &&
    Number.isFinite(tankCapacityGallons) &&
    tankCapacityGallons > 0
  ) {
    return tankCapacityGallons;
  }

  return fallback;
}

export function calculateFuelRangeEstimate(input: FuelRangeInput): FuelRangeEstimate {
  const tankCapacityGallons = resolveTankCapacityGallons(input.tankCapacityGallons);
  const mpg = input.mpg ?? DEFAULT_MPG;
  const reserveFuelPercent = input.reserveFuelPercent ?? DEFAULT_RESERVE_FUEL_PERCENT;
  const fuelPercent = Math.max(0, Math.min(100, input.fuelPercent));

  const remainingGallons = (tankCapacityGallons * fuelPercent) / 100;
  const reserveGallons = (tankCapacityGallons * reserveFuelPercent) / 100;
  const usableGallons = Math.max(0, remainingGallons - reserveGallons);
  const usableRangeMiles = usableGallons * mpg;

  return {
    fuelPercent,
    tankCapacityGallons,
    mpg,
    reserveFuelPercent,
    remainingGallons: roundGallons(remainingGallons),
    reserveGallons: roundGallons(reserveGallons),
    usableGallons: roundGallons(usableGallons),
    usableRangeMiles: roundMiles(usableRangeMiles),
  };
}
