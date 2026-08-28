import type { CustomerDocument } from "../models/customer.model";
import type { MerchantContractDocument } from "../models/merchant-contract.model";
import type { ContractPricingResult } from "../services/contract-pricing.engine";
import type { FuelStationDocument } from "../../station/models/fuel-station.model";

export function toCustomerView(customer: CustomerDocument & { _id: unknown }) {
  return {
    id: String(customer._id),
    slug: customer.slug,
    name: customer.name,
    isActive: customer.isActive,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function toMerchantContractView(contract: MerchantContractDocument & { _id: unknown }) {
  return {
    id: String(contract._id),
    customerId: String(contract.customerId),
    merchantKey: contract.merchantKey,
    merchantDisplayName: contract.merchantDisplayName,
    rateAdjustmentPerGallon: contract.rateAdjustmentPerGallon,
    coveredRelayLocationIds: contract.coveredRelayLocationIds,
    effectiveFrom: contract.effectiveFrom?.toISOString(),
    effectiveTo: contract.effectiveTo?.toISOString(),
    isActive: contract.isActive,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

export function toStationContractPricingView(
  station: FuelStationDocument,
  pricing: ContractPricingResult,
) {
  return {
    relayAccount: station.relayAccount,
    relayLocationId: station.relayLocationId,
    merchantName: station.merchantName,
    name: station.name,
    city: station.city,
    state: station.state,
    retailPricePerUnit: station.retailPricePerUnit,
    discountedPricePerUnit: station.discountedPricePerUnit,
    pricing,
  };
}

export function buildContractPricingSummary(
  items: ReturnType<typeof toStationContractPricingView>[],
) {
  const available = items.filter((item) => item.pricing.available);
  const unavailable = items.length - available.length;

  return {
    stationCount: items.length,
    pricedStationCount: available.length,
    unavailableStationCount: unavailable,
    merchantCount: new Set(available.map((item) => item.merchantName).filter(Boolean)).size,
  };
}
