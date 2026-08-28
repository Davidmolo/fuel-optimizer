import { z } from "zod";

const recommendationConfigBodySchema = z
  .object({
    corridorBufferMiles: z.coerce.number().min(1).max(50),
    maxSearchAheadMiles: z.coerce.number().min(10).max(500),
    maxRoutingLookups: z.coerce.number().int().min(5).max(100),
    preFilterDistanceBufferPercent: z.coerce.number().min(0).max(50),
    defaultTankCapacityGallons: z.coerce.number().min(50).max(500),
    defaultMpg: z.coerce.number().min(1).max(20),
    defaultReserveFuelPercent: z.coerce.number().min(0).max(50),
    maxAlternates: z.coerce.number().int().min(0).max(5),
    minAheadOnRouteMiles: z.coerce.number().min(0).max(25),
    sweetSpotMinPercent: z.coerce.number().min(0).max(100),
    sweetSpotMaxPercent: z.coerce.number().min(0).max(100),
  })
  .refine((value) => value.sweetSpotMinPercent <= value.sweetSpotMaxPercent, {
    message: "Sweet spot minimum must be less than or equal to sweet spot maximum",
    path: ["sweetSpotMinPercent"],
  });

export const updateRecommendationConfigSchema = z.object({
  body: recommendationConfigBodySchema,
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
