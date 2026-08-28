import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  getTwilioConfigController,
  updateTwilioConfigController,
} from "../controllers/twilio-config.controller";
import { updateTwilioConfigSchema } from "../validators/twilio-config.validator";

const twilioConfigRouter = Router();

twilioConfigRouter.get("/", getTwilioConfigController);
twilioConfigRouter.put("/", validateRequest(updateTwilioConfigSchema), updateTwilioConfigController);

export default twilioConfigRouter;
