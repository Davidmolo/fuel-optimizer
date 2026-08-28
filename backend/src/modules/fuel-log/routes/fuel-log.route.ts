import { Router } from "express";
import { validateRequest } from "../../../middlewares/validate-request";
import { createFuelLogController, listFuelLogsController } from "../controllers/fuel-log.controller";
import { createFuelLogSchema } from "../validators/fuel-log.validator";

const fuelLogRouter = Router();

fuelLogRouter.get("/", listFuelLogsController);
fuelLogRouter.post("/", validateRequest(createFuelLogSchema), createFuelLogController);

export default fuelLogRouter;
