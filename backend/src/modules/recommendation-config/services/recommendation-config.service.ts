import {
  RECOMMENDATION_CONFIG_DEFAULTS,
  type RecommendationConfigValues,
} from "../../recommendation/constants";
import { RecommendationConfigModel } from "../models/recommendation-config.model";

const DEFAULT_RECOMMENDATION_CONFIG_KEY = "recommendation_config";

function toConfigValues(document: RecommendationConfigValues): RecommendationConfigValues {
  return {
    corridorBufferMiles: document.corridorBufferMiles,
    maxSearchAheadMiles: document.maxSearchAheadMiles,
    maxRoutingLookups: document.maxRoutingLookups,
    preFilterDistanceBufferPercent: document.preFilterDistanceBufferPercent,
    defaultTankCapacityGallons: document.defaultTankCapacityGallons,
    defaultMpg: document.defaultMpg,
    defaultReserveFuelPercent: document.defaultReserveFuelPercent,
    maxAlternates: document.maxAlternates,
    minAheadOnRouteMiles: document.minAheadOnRouteMiles,
    sweetSpotMinPercent: document.sweetSpotMinPercent,
    sweetSpotMaxPercent: document.sweetSpotMaxPercent,
  };
}

export function getDefaultRecommendationConfig(): RecommendationConfigValues {
  return { ...RECOMMENDATION_CONFIG_DEFAULTS };
}

export async function getRecommendationConfigDocument() {
  return RecommendationConfigModel.findOne({ key: DEFAULT_RECOMMENDATION_CONFIG_KEY }).lean();
}

export async function getRecommendationConfig(): Promise<RecommendationConfigValues> {
  const config = await getRecommendationConfigDocument();

  if (!config) {
    return getDefaultRecommendationConfig();
  }

  return toConfigValues(config);
}

export async function ensureRecommendationConfigSeed() {
  await RecommendationConfigModel.findOneAndUpdate(
    { key: DEFAULT_RECOMMENDATION_CONFIG_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_RECOMMENDATION_CONFIG_KEY,
        ...RECOMMENDATION_CONFIG_DEFAULTS,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function getRecommendationConfigForSettings() {
  const config = await getRecommendationConfigDocument();

  if (!config) {
    return null;
  }

  return {
    key: config.key,
    ...toConfigValues(config),
    updatedAt: config.updatedAt,
  };
}

export async function updateRecommendationConfig(payload: RecommendationConfigValues) {
  const existing = await RecommendationConfigModel.findOne({ key: DEFAULT_RECOMMENDATION_CONFIG_KEY });

  if (!existing) {
    return null;
  }

  if (payload.sweetSpotMinPercent > payload.sweetSpotMaxPercent) {
    throw new Error("Sweet spot minimum must be less than or equal to sweet spot maximum");
  }

  const updated = await RecommendationConfigModel.findOneAndUpdate(
    { key: DEFAULT_RECOMMENDATION_CONFIG_KEY },
    { $set: payload },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return null;
  }

  return {
    key: updated.key,
    ...toConfigValues(updated),
    updatedAt: updated.updatedAt,
  };
}
