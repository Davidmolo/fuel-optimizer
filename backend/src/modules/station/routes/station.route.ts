import { Router } from "express";
import { requireAdmin } from "../../../middlewares/require-admin";
import {
  importPartnerPriceFileController,
  latestPartnerPriceImportsController,
  uploadPartnerPriceFile,
} from "../controllers/partner-price.controller";
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

stationRouter.get("/prices/latest", requireAdmin, latestPartnerPriceImportsController);
stationRouter.post(
  "/prices/upload",
  requireAdmin,
  uploadPartnerPriceFile,
  importPartnerPriceFileController,
);
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
