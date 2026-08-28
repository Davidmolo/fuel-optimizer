import { model, Schema } from "mongoose";
import type { RecommendationConfigValues } from "../../recommendation/constants";

export type RecommendationConfigDocument = RecommendationConfigValues & {
  key: string;
  createdAt: Date;
  updatedAt: Date;
};

const recommendationConfigSchema = new Schema<RecommendationConfigDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    corridorBufferMiles: { type: Number, required: true, min: 1, max: 50 },
    maxSearchAheadMiles: { type: Number, required: true, min: 10, max: 500 },
    maxRoutingLookups: { type: Number, required: true, min: 5, max: 100 },
    preFilterDistanceBufferPercent: { type: Number, required: true, min: 0, max: 50 },
    defaultTankCapacityGallons: { type: Number, required: true, min: 50, max: 500 },
    defaultMpg: { type: Number, required: true, min: 1, max: 20 },
    defaultReserveFuelPercent: { type: Number, required: true, min: 0, max: 50 },
    maxAlternates: { type: Number, required: true, min: 0, max: 5 },
    minAheadOnRouteMiles: { type: Number, required: true, min: 0, max: 25 },
    sweetSpotMinPercent: { type: Number, required: true, min: 0, max: 100 },
    sweetSpotMaxPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

export const RecommendationConfigModel = model<RecommendationConfigDocument>(
  "RecommendationConfig",
  recommendationConfigSchema,
);
