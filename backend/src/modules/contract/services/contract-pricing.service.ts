import { HttpError } from "../../../utils/http-error";
import type { RelayAccount } from "../../../integrations/relay";
import { FuelStationModel } from "../../station/models/fuel-station.model";
import { CustomerModel } from "../models/customer.model";
import { MerchantContractModel } from "../models/merchant-contract.model";
import {
  buildContractPricingSummary,
  toCustomerView,
  toMerchantContractView,
  toStationContractPricingView,
} from "../mappers/contract.mapper";
import {
  resolveContractPricing,
  type MerchantContractRule,
} from "./contract-pricing.engine";

import { PAULS_ASSETS_SLUG } from "../constants";

export async function getCustomerBySlug(slug: string) {
  const customer = await CustomerModel.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();

  if (!customer) {
    throw new HttpError("Customer not found", 404);
  }

  return customer;
}

export async function listCustomers() {
  const customers = await CustomerModel.find({ isActive: true }).sort({ name: 1 }).lean();
  return customers.map(toCustomerView);
}

export async function listMerchantContracts(customerSlug: string) {
  const customer = await getCustomerBySlug(customerSlug);
  const contracts = await MerchantContractModel.find({ customerId: customer._id })
    .sort({ merchantDisplayName: 1 })
    .lean();

  return {
    customer: toCustomerView(customer),
    items: contracts.map(toMerchantContractView),
  };
}

export async function loadActiveContractRules(customerId: string): Promise<MerchantContractRule[]> {
  const contracts = await MerchantContractModel.find({
    customerId,
    isActive: true,
  }).lean();

  return contracts.map((contract) => ({
    merchantKey: contract.merchantKey,
    merchantDisplayName: contract.merchantDisplayName,
    rateAdjustmentPerGallon: contract.rateAdjustmentPerGallon ?? 0,
    coveredRelayLocationIds: contract.coveredRelayLocationIds,
    effectiveFrom: contract.effectiveFrom,
    effectiveTo: contract.effectiveTo,
    isActive: contract.isActive,
  }));
}

type ListContractPricingOptions = {
  customerSlug?: string;
  relayAccount?: RelayAccount;
  merchant?: string;
  state?: string;
  activeOnly?: boolean;
};

export async function listContractPricing(options: ListContractPricingOptions = {}) {
  const customerSlug = options.customerSlug ?? PAULS_ASSETS_SLUG;
  const customer = await getCustomerBySlug(customerSlug);
  const contractRules = await loadActiveContractRules(String(customer._id));

  const filter: Record<string, unknown> = {};

  if (options.relayAccount) {
    filter.relayAccount = options.relayAccount;
  }

  if (options.merchant) {
    filter.merchantName = new RegExp(options.merchant, "i");
  }

  if (options.state) {
    filter.state = options.state.toUpperCase();
  }

  if (options.activeOnly !== false) {
    filter.isActive = true;
  }

  const stations = await FuelStationModel.find(filter)
    .sort({ merchantName: 1, state: 1, name: 1 })
    .lean();

  const items = stations.map((station) => {
    const pricing = resolveContractPricing(
      {
        relayLocationId: station.relayLocationId,
        merchantName: station.merchantName,
        retailPricePerUnit: station.retailPricePerUnit,
        discountedPricePerUnit: station.discountedPricePerUnit,
      },
      contractRules,
    );

    return toStationContractPricingView(station, pricing);
  });

  const contractedItems = items.filter((item) => item.pricing.available);

  return {
    customer: toCustomerView(customer),
    summary: buildContractPricingSummary(items),
    items: contractedItems,
    excludedCount: items.length - contractedItems.length,
  };
}

export async function getStationContractPricing(
  relayLocationId: string,
  options: { customerSlug?: string; relayAccount?: RelayAccount } = {},
) {
  const customerSlug = options.customerSlug ?? PAULS_ASSETS_SLUG;
  const customer = await getCustomerBySlug(customerSlug);
  const contractRules = await loadActiveContractRules(String(customer._id));

  const filter: Record<string, unknown> = { relayLocationId };

  if (options.relayAccount) {
    filter.relayAccount = options.relayAccount;
  }

  const station = await FuelStationModel.findOne(filter).lean();

  if (!station) {
    throw new HttpError("Fuel station not found", 404);
  }

  const pricing = resolveContractPricing(
    {
      relayLocationId: station.relayLocationId,
      merchantName: station.merchantName,
      retailPricePerUnit: station.retailPricePerUnit,
      discountedPricePerUnit: station.discountedPricePerUnit,
    },
    contractRules,
  );

  return {
    customer: toCustomerView(customer),
    station: toStationContractPricingView(station, pricing),
  };
}
