import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import {
  getMailConfigController,
  updateMailConfigController,
} from "../controllers/mail-config.controller";
import { updateMailConfigSchema } from "../validators/mail-config.validator";

const mailConfigRouter = Router();

mailConfigRouter.get("/", getMailConfigController);
mailConfigRouter.put("/", validateRequest(updateMailConfigSchema), updateMailConfigController);

export default mailConfigRouter;
