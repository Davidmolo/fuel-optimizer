import { Router } from "express";
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

stationRouter.post("/sync", validateSyncStations, syncStationsController);
stationRouter.post("/sync/drivers", validateSyncStations, syncStationDriversController);
stationRouter.post("/sync/transactions", validateSyncStations, syncStationTransactionsController);
stationRouter.get("/", validateListStations, listStationsController);
stationRouter.get("/drivers", validateListRelayDrivers, listRelayDriversController);
stationRouter.get("/:relayLocationId", validateGetStation, getStationController);

export default stationRouter;
