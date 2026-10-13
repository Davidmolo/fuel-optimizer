import { Router } from "express";
import { requireAdmin } from "../../../middlewares/require-admin";
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

fleetRouter.post("/sync", requireAdmin, syncFleetController);
fleetRouter.post("/sync/registry", requireAdmin, syncFleetRegistryController);
fleetRouter.post("/sync/telemetry", requireAdmin, syncFleetTelemetryController);
fleetRouter.post("/copilot-assets/sync", requireAdmin, syncCopilotAssetsController);
fleetRouter.get("/vehicles", validateListFleetVehicles, listFleetVehiclesController);
fleetRouter.get("/vehicles/:identifier", validateGetFleetVehicle, getFleetVehicleController);

export default fleetRouter;
