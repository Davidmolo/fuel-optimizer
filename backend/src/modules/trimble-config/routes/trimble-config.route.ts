import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  getTrimbleConfigController,
  testTrimbleConnectionController,
  updateTrimbleConfigController,
} from "../controllers/trimble-config.controller";
import {
  testTrimbleConnectionSchema,
  updateTrimbleConfigSchema,
} from "../validators/trimble-config.validator";

const trimbleConfigRouter = Router();

trimbleConfigRouter.get("/", getTrimbleConfigController);
trimbleConfigRouter.put("/", validateRequest(updateTrimbleConfigSchema), updateTrimbleConfigController);
trimbleConfigRouter.post(
  "/test",
  validateRequest(testTrimbleConnectionSchema),
  testTrimbleConnectionController,
);

export default trimbleConfigRouter;
