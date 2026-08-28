/** Default values used when no recommendation config exists in the database. */
export const RECOMMENDATION_CONFIG_DEFAULTS = {
  corridorBufferMiles: 15,
  maxSearchAheadMiles: 100,
  maxRoutingLookups: 25,
  preFilterDistanceBufferPercent: 10,
  defaultTankCapacityGallons: 150,
  defaultMpg: 6.5,
  defaultReserveFuelPercent: 15,
  maxAlternates: 2,
  minAheadOnRouteMiles: 1,
  sweetSpotMinPercent: 25,
  sweetSpotMaxPercent: 75,
} as const;

export type RecommendationConfigValues = {
  corridorBufferMiles: number;
  maxSearchAheadMiles: number;
  maxRoutingLookups: number;
  preFilterDistanceBufferPercent: number;
  defaultTankCapacityGallons: number;
  defaultMpg: number;
  defaultReserveFuelPercent: number;
  maxAlternates: number;
  minAheadOnRouteMiles: number;
  sweetSpotMinPercent: number;
  sweetSpotMaxPercent: number;
};

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.corridorBufferMiles */
export const DEFAULT_CORRIDOR_BUFFER_MILES = RECOMMENDATION_CONFIG_DEFAULTS.corridorBufferMiles;

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.defaultTankCapacityGallons */
export const DEFAULT_TANK_CAPACITY_GALLONS = RECOMMENDATION_CONFIG_DEFAULTS.defaultTankCapacityGallons;

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.defaultMpg */
export const DEFAULT_MPG = RECOMMENDATION_CONFIG_DEFAULTS.defaultMpg;

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.defaultReserveFuelPercent */
export const DEFAULT_RESERVE_FUEL_PERCENT = RECOMMENDATION_CONFIG_DEFAULTS.defaultReserveFuelPercent;

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.maxAlternates */
export const DEFAULT_MAX_ALTERNATES = RECOMMENDATION_CONFIG_DEFAULTS.maxAlternates;

/** @deprecated Use RECOMMENDATION_CONFIG_DEFAULTS.minAheadOnRouteMiles */
export const MIN_AHEAD_ON_ROUTE_MILES = RECOMMENDATION_CONFIG_DEFAULTS.minAheadOnRouteMiles;
