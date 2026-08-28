import { normalizeMerchantKey } from "../utils/merchant-key";

export type StationPriceInput = {
  relayLocationId: string;
  merchantName?: string;
  retailPricePerUnit?: number;
  discountedPricePerUnit?: number;
};

export type MerchantContractRule = {
  merchantKey: string;
  merchantDisplayName: string;
  /** Optional extra adjustment on top of Relay discounted price (default 0). */
  rateAdjustmentPerGallon?: number;
  coveredRelayLocationIds?: string[];
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isActive: boolean;
};

export type ContractPricingUnavailableReason =
  | "no_contract"
  | "no_base_price"
  | "station_not_covered"
  | "contract_inactive";

export type ContractPricingResult =
  | {
      available: true;
      effectivePricePerGallon: number;
      relayDiscountedPricePerGallon?: number;
      retailPricePerGallon?: number;
      basePricePerGallon: number;
      rateAdjustmentPerGallon: number;
      merchantKey: string;
      merchantDisplayName: string;
      basePriceSource: "relay_discounted" | "retail";
    }
  | {
      available: false;
      reason: ContractPricingUnavailableReason;
      merchantKey?: string;
    };

type ResolveContractPricingOptions = {
  asOf?: Date;
};

function roundPrice(value: number) {
  return Math.round(value * 1000) / 1000;
}

function resolveRelayBasePrice(station: StationPriceInput) {
  if (station.discountedPricePerUnit !== undefined) {
    return {
      basePricePerGallon: station.discountedPricePerUnit,
      basePriceSource: "relay_discounted" as const,
      relayDiscountedPricePerGallon: station.discountedPricePerUnit,
      retailPricePerGallon: station.retailPricePerUnit,
    };
  }

  if (station.retailPricePerUnit !== undefined) {
    return {
      basePricePerGallon: station.retailPricePerUnit,
      basePriceSource: "retail" as const,
      relayDiscountedPricePerGallon: undefined,
      retailPricePerGallon: station.retailPricePerUnit,
    };
  }

  return undefined;
}

function isContractActive(contract: MerchantContractRule, asOf: Date) {
  if (!contract.isActive) {
    return false;
  }

  if (contract.effectiveFrom && asOf < contract.effectiveFrom) {
    return false;
  }

  if (contract.effectiveTo && asOf > contract.effectiveTo) {
    return false;
  }

  return true;
}

function isStationCovered(contract: MerchantContractRule, relayLocationId: string) {
  if (!contract.coveredRelayLocationIds?.length) {
    return true;
  }

  return contract.coveredRelayLocationIds.includes(relayLocationId);
}

export function resolveContractPricing(
  station: StationPriceInput,
  contracts: MerchantContractRule[],
  options: ResolveContractPricingOptions = {},
): ContractPricingResult {
  const asOf = options.asOf ?? new Date();
  const merchantKey = normalizeMerchantKey(station.merchantName);

  if (!merchantKey) {
    return { available: false, reason: "no_contract" };
  }

  const contract = contracts.find((entry) => entry.merchantKey === merchantKey);

  if (!contract) {
    return { available: false, reason: "no_contract", merchantKey };
  }

  if (!isContractActive(contract, asOf)) {
    return { available: false, reason: "contract_inactive", merchantKey };
  }

  if (!isStationCovered(contract, station.relayLocationId)) {
    return { available: false, reason: "station_not_covered", merchantKey };
  }

  const basePrice = resolveRelayBasePrice(station);

  if (!basePrice) {
    return { available: false, reason: "no_base_price", merchantKey };
  }

  const rateAdjustmentPerGallon = contract.rateAdjustmentPerGallon ?? 0;
  const effectivePricePerGallon = roundPrice(basePrice.basePricePerGallon + rateAdjustmentPerGallon);

  return {
    available: true,
    effectivePricePerGallon,
    relayDiscountedPricePerGallon: basePrice.relayDiscountedPricePerGallon,
    retailPricePerGallon: basePrice.retailPricePerGallon,
    basePricePerGallon: basePrice.basePricePerGallon,
    rateAdjustmentPerGallon,
    merchantKey,
    merchantDisplayName: contract.merchantDisplayName,
    basePriceSource: basePrice.basePriceSource,
  };
}
