import { Router } from "express";
import { attachRequestUserIfPresent } from "../../../middlewares/require-authenticated-user";
import { getDriverComplianceController } from "../controllers/report.controller";
import { validateDriverComplianceQuery } from "../validators/report.validator";

const reportsRouter = Router();

reportsRouter.use(attachRequestUserIfPresent);

reportsRouter.get(
  "/driver-compliance",
  validateDriverComplianceQuery,
  getDriverComplianceController,
);

export default reportsRouter;
