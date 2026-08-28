import { HttpError } from "../../../utils/http-error";
import { FuelStationModel } from "../../station/models/fuel-station.model";
import { CustomerModel } from "../models/customer.model";
import { normalizeMerchantKey } from "../utils/merchant-key";
import { MerchantContractModel } from "../models/merchant-contract.model";
import { toCustomerView } from "../mappers/contract.mapper";
import { PAULS_ASSETS_SLUG } from "../constants";

type MerchantAggregate = {
  displayName: string;
  stationCount: number;
};

async function getCustomerBySlug(slug: string) {
  const customer = await CustomerModel.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();

  if (!customer) {
    throw new HttpError("Customer not found", 404);
  }

  return customer;
}

export async function syncMerchantContractsFromStations(customerSlug = PAULS_ASSETS_SLUG) {
  const customer = await getCustomerBySlug(customerSlug);
  const stations = await FuelStationModel.find({
    isActive: true,
    discountedPricePerUnit: { $ne: null },
    merchantName: { $exists: true, $nin: [null, ""] },
  }).lean();

  const merchants = new Map<string, MerchantAggregate>();

  for (const station of stations) {
    const merchantKey = normalizeMerchantKey(station.merchantName);

    if (!merchantKey || station.discountedPricePerUnit === undefined) {
      continue;
    }

    const existing = merchants.get(merchantKey);
    merchants.set(merchantKey, {
      displayName: station.merchantName?.trim() || existing?.displayName || merchantKey,
      stationCount: (existing?.stationCount ?? 0) + 1,
    });
  }

  const syncedAt = new Date();

  for (const [merchantKey, info] of merchants) {
    await MerchantContractModel.findOneAndUpdate(
      { customerId: customer._id, merchantKey },
      {
        $setOnInsert: {
          customerId: customer._id,
          merchantKey,
          rateAdjustmentPerGallon: 0,
          isActive: true,
        },
        $set: {
          merchantDisplayName: info.displayName,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  return {
    customer: toCustomerView(customer),
    merchantCount: merchants.size,
    stationCount: stations.length,
    syncedAt: syncedAt.toISOString(),
  };
}
