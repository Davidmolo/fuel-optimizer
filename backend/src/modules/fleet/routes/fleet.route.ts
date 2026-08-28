import { Router } from "express";
import {
  getFleetVehicleController,
  listFleetVehiclesController,
  syncFleetController,
  syncFleetRegistryController,
  syncFleetTelemetryController,
} from "../controllers/fleet.controller";
import { validateGetFleetVehicle, validateListFleetVehicles } from "../validators/fleet.validator";

const fleetRouter = Router();

fleetRouter.post("/sync", syncFleetController);
fleetRouter.post("/sync/registry", syncFleetRegistryController);
fleetRouter.post("/sync/telemetry", syncFleetTelemetryController);
fleetRouter.get("/vehicles", validateListFleetVehicles, listFleetVehiclesController);
fleetRouter.get("/vehicles/:identifier", validateGetFleetVehicle, getFleetVehicleController);

export default fleetRouter;
