import { CustomerModel } from "../models/customer.model";
import { MerchantContractModel } from "../models/merchant-contract.model";
import { LEGACY_PLACEHOLDER_ADJUSTMENTS, PAULS_ASSETS_SLUG } from "../constants";

export async function ensureContractSeed() {
  const customer = await CustomerModel.findOneAndUpdate(
    { slug: PAULS_ASSETS_SLUG },
    {
      $setOnInsert: {
        slug: PAULS_ASSETS_SLUG,
        name: "Paul's Assets",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" },
  ).lean();

  // Remove example rate adjustments from early bootstrap; real pricing comes from Relay.
  await MerchantContractModel.deleteMany({
    customerId: customer._id,
    rateAdjustmentPerGallon: { $in: [...LEGACY_PLACEHOLDER_ADJUSTMENTS] },
  });
}
