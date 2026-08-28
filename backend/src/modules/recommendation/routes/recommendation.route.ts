import { Router } from "express";
import { requireAuthenticatedUser } from "../../../middlewares/require-authenticated-user";
import {
  getRecommendationByTruckIdController,
  getRecommendationController,
} from "../controllers/recommendation.controller";
import {
  validateGetRecommendation,
  validateGetRecommendationByTruckId,
} from "../validators/recommendation.validator";

const recommendationRouter = Router();

recommendationRouter.use(requireAuthenticatedUser);

recommendationRouter.get("/", validateGetRecommendationByTruckId, getRecommendationByTruckIdController);
recommendationRouter.get("/:identifier", validateGetRecommendation, getRecommendationController);

export default recommendationRouter;
