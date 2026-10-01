import { Router } from "express";
import {
  getActiveLoadController,
  getTrimbleTripController,
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
} from "../controllers/tms.controller";
import {
  validateGetActiveLoad,
  validateGetTripContext,
  validateListActiveLoads,
  validatePlanTrimbleTrip,
  validateDispatchTrimbleTrip,
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
tmsRouter.get("/trip-context", listTripContextsController);
tmsRouter.get("/trip-context/:identifier/route", validateGetTripContext, getTripRouteController);
tmsRouter.get("/trip-context/:identifier", validateGetTripContext, getTripContextController);
tmsRouter.get("/assignments", listAssignmentsController);

export default tmsRouter;
