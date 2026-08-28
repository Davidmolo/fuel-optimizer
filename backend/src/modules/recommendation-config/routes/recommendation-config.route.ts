import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  getRecommendationConfigController,
  updateRecommendationConfigController,
} from "../controllers/recommendation-config.controller";
import { updateRecommendationConfigSchema } from "../validators/recommendation-config.validator";

const recommendationConfigRouter = Router();

recommendationConfigRouter.get("/", getRecommendationConfigController);
recommendationConfigRouter.put(
  "/",
  validateRequest(updateRecommendationConfigSchema),
  updateRecommendationConfigController,
);

export default recommendationConfigRouter;
