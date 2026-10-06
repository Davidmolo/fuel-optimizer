import { Router } from "express";
import {
  attachFuelStopController,
  dispatchWithFuelStopController,
  getActiveLoadController,
  getTrimbleTripController,
  getTrimbleTripRoutePathController,
  getTripContextController,
  getTripRouteController,
  listActiveLoadsController,
  listAssignmentsController,
  listTripContextsController,
  planTrimbleTripController,
  dispatchTrimbleTripController,
  syncTmsController,
  syncTmsFleetController,
  syncTmsLoadsController,
  updateInProgressFuelStopController,
} from "../controllers/tms.controller";
import {
  validateAttachFuelStop,
  validateDispatchTrimbleTrip,
  validateDispatchWithFuelStop,
  validateGetActiveLoad,
  validateGetTripContext,
  validateListActiveLoads,
  validatePlanTrimbleTrip,
  validateUpdateInProgressFuelStop,
} from "../validators/tms.validator";

const tmsRouter = Router();

tmsRouter.post("/sync", syncTmsController);
tmsRouter.post("/sync/fleet", syncTmsFleetController);
tmsRouter.post("/sync/loads", syncTmsLoadsController);
tmsRouter.get("/loads/active", validateListActiveLoads, listActiveLoadsController);
tmsRouter.get("/loads/active/:loadId", validateGetActiveLoad, getActiveLoadController);
tmsRouter.post("/loads/:loadId/trimble-trip", validatePlanTrimbleTrip, planTrimbleTripController);
tmsRouter.get("/loads/:loadId/trimble-trip", validateGetActiveLoad, getTrimbleTripController);
tmsRouter.post(
  "/loads/:loadId/trimble-trip/dispatch",
  validateDispatchTrimbleTrip,
  dispatchTrimbleTripController,
);
tmsRouter.post(
  "/loads/:loadId/trimble-trip/fuel-stop",
  validateAttachFuelStop,
  attachFuelStopController,
);
tmsRouter.put(
  "/loads/:loadId/trimble-trip/fuel-stop",
  validateUpdateInProgressFuelStop,
  updateInProgressFuelStopController,
);
tmsRouter.post(
  "/loads/:loadId/trimble-trip/dispatch-with-fuel",
  validateDispatchWithFuelStop,
  dispatchWithFuelStopController,
);
tmsRouter.get(
  "/loads/:loadId/trimble-trip/route-path",
  validateGetActiveLoad,
  getTrimbleTripRoutePathController,
);
tmsRouter.get("/trip-context", listTripContextsController);
tmsRouter.get("/trip-context/:identifier/route", validateGetTripContext, getTripRouteController);
tmsRouter.get("/trip-context/:identifier", validateGetTripContext, getTripContextController);
tmsRouter.get("/assignments", listAssignmentsController);

export default tmsRouter;
