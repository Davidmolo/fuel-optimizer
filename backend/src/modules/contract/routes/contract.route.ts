import { Router } from "express";
import {
  getStationContractPricingController,
  listContractPricingController,
  listCustomersController,
  listMerchantContractsController,
  syncMerchantContractsController,
} from "../controllers/contract.controller";
import {
  validateGetStationContractPricing,
  validateListContractPricing,
  validateListMerchantContracts,
} from "../validators/contract.validator";

const contractRouter = Router();

contractRouter.get("/customers", listCustomersController);
contractRouter.post("/sync/merchants", syncMerchantContractsController);
contractRouter.get("/merchants", validateListMerchantContracts, listMerchantContractsController);
contractRouter.get("/pricing", validateListContractPricing, listContractPricingController);
contractRouter.get(
  "/pricing/:relayLocationId",
  validateGetStationContractPricing,
  getStationContractPricingController,
);

export default contractRouter;
