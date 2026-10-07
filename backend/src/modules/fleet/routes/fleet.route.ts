import { Router } from "express";
import { attachRequestUserIfPresent } from "../../../middlewares/require-authenticated-user";
import {
  getFleetVehicleController,
  listFleetVehiclesController,
  syncCopilotAssetsController,
  syncFleetController,
  syncFleetRegistryController,
  syncFleetTelemetryController,
} from "../controllers/fleet.controller";
import { validateGetFleetVehicle, validateListFleetVehicles } from "../validators/fleet.validator";

const fleetRouter = Router();

fleetRouter.use(attachRequestUserIfPresent);

fleetRouter.post("/sync", syncFleetController);
fleetRouter.post("/sync/registry", syncFleetRegistryController);
fleetRouter.post("/sync/telemetry", syncFleetTelemetryController);
fleetRouter.post("/copilot-assets/sync", syncCopilotAssetsController);
fleetRouter.get("/vehicles", validateListFleetVehicles, listFleetVehiclesController);
fleetRouter.get("/vehicles/:identifier", validateGetFleetVehicle, getFleetVehicleController);

export default fleetRouter;
