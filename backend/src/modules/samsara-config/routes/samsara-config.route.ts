import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  getSamsaraConfigController,
  updateSamsaraConfigController,
} from "../controllers/samsara-config.controller";
import { updateSamsaraConfigSchema } from "../validators/samsara-config.validator";

const samsaraConfigRouter = Router();

samsaraConfigRouter.get("/", getSamsaraConfigController);
samsaraConfigRouter.put("/", validateRequest(updateSamsaraConfigSchema), updateSamsaraConfigController);

export default samsaraConfigRouter;
