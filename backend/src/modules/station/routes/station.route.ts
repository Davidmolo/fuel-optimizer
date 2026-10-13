import { Router } from "express";
import { requireAdmin } from "../../../middlewares/require-admin";
import {
  getStationController,
  listRelayDriversController,
  listStationsController,
  syncStationDriversController,
  syncStationTransactionsController,
  syncStationsController,
} from "../controllers/station.controller";
import {
  validateGetStation,
  validateListRelayDrivers,
  validateListStations,
  validateSyncStations,
} from "../validators/station.validator";

const stationRouter = Router();

stationRouter.post("/sync", requireAdmin, validateSyncStations, syncStationsController);
stationRouter.post("/sync/drivers", requireAdmin, validateSyncStations, syncStationDriversController);
stationRouter.post(
  "/sync/transactions",
  requireAdmin,
  validateSyncStations,
  syncStationTransactionsController,
);
stationRouter.get("/", validateListStations, listStationsController);
stationRouter.get("/drivers", validateListRelayDrivers, listRelayDriversController);
stationRouter.get("/:relayLocationId", validateGetStation, getStationController);

export default stationRouter;
