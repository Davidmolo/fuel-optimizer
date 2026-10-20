import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RelayTransaction } from "../../../integrations/relay";
import {
  mapRelayTransactionToStationUpdate,
  relayDieselPriceFields,
  selectFreshestStations,
  shouldReplaceStoredStationPrice,
  toFuelStationView,
} from "./fuel-station.mapper";
import type { FuelStationDocument } from "../models/fuel-station.model";

function transaction(overrides: Partial<RelayTransaction> & Pick<RelayTransaction, "fuel_items">): RelayTransaction {
  return {
    transaction_id: "txn-1",
    created_at: "2026-10-16T19:03:39.000Z",
    merchant: { name: "Circle K" },
    location: {
      id: "loc-circle-k",
      name: "Circle K #2745064",
    },
    ...overrides,
  };
}

describe("mapRelayTransactionToStationUpdate", () => {
  it("uses the diesel line when DEF is listed first", () => {
    const mapped = mapRelayTransactionToStationUpdate(
      transaction({
        fuel_items: [
          {
            fuel_type: "def",
            fuel_type_description: "Def",
            retail_price_per_unit: "4.799",
            discounted_price_per_unit: "4.799",
          },
          {
            fuel_type: "diesel",
            fuel_type_description: "Diesel",
            retail_price_per_unit: "5.439",
            discounted_price_per_unit: "5.289",
          },
        ],
      }),
    );

    assert.equal(mapped?.fuelType, "diesel");
    assert.equal(mapped?.discountedPricePerUnit, 5.289);
    assert.equal(mapped?.retailPricePerUnit, 5.439);
  });

  it("prefers standard diesel over diesel auto on the same purchase", () => {
    const mapped = mapRelayTransactionToStationUpdate(
      transaction({
        fuel_items: [
          {
            fuel_type: "diesel",
            fuel_type_description: "Diesel auto",
            retail_price_per_unit: "6.899",
            discounted_price_per_unit: "6.899",
          },
          {
            fuel_type: "diesel",
            fuel_type_description: "Diesel",
            retail_price_per_unit: "6.199",
            discounted_price_per_unit: "6.0515",
          },
        ],
      }),
    );

    assert.equal(mapped?.fuelTypeDescription, "Diesel");
    assert.equal(mapped?.discountedPricePerUnit, 6.0515);
  });

  it("does not store a station price from a DEF-only purchase", () => {
    const mapped = mapRelayTransactionToStationUpdate(
      transaction({
        fuel_items: [
          {
            fuel_type: "def",
            fuel_type_description: "Def",
            retail_price_per_unit: "4.799",
            discounted_price_per_unit: "4.799",
          },
        ],
      }),
    );

    assert.equal(mapped, null);
  });

  it("does not store a station price from a reefer-only purchase", () => {
    const mapped = mapRelayTransactionToStationUpdate(
      transaction({
        fuel_items: [
          {
            fuel_type: "reefer",
            fuel_type_description: "Reefer",
            retail_price_per_unit: "6.089",
            discounted_price_per_unit: "5.4517",
          },
        ],
      }),
    );

    assert.equal(mapped, null);
  });
});

describe("selectFreshestStations", () => {
  it("keeps the newest diesel price when two Relay accounts share a location", () => {
    const [selected] = selectFreshestStations([
      {
        relayLocationId: "loc-circle-k",
        relayAccount: "blue_stallion",
        fuelType: "diesel",
        fuelTypeDescription: "Diesel",
        discountedPricePerUnit: 4.329,
        retailPricePerUnit: 4.499,
        lastTransactionAt: "2026-06-13T02:34:26.000Z",
      },
      {
        relayLocationId: "loc-circle-k",
        relayAccount: "azfs",
        fuelType: "diesel",
        fuelTypeDescription: "Diesel",
        discountedPricePerUnit: 5.289,
        retailPricePerUnit: 5.439,
        lastTransactionAt: "2026-10-16T19:03:39.000Z",
      },
    ]);

    assert.equal(selected?.relayAccount, "azfs");
    assert.equal(selected?.discountedPricePerUnit, 5.289);
  });

  it("keeps an older diesel price instead of a newer DEF purchase", () => {
    const [selected] = selectFreshestStations([
      {
        relayLocationId: "loc-maverik",
        fuelType: "diesel",
        fuelTypeDescription: "Diesel",
        discountedPricePerUnit: 5.897,
        retailPricePerUnit: 6.059,
        lastTransactionAt: "2026-10-01T12:00:00.000Z",
      },
      {
        relayLocationId: "loc-maverik",
        fuelType: "def",
        fuelTypeDescription: "Def",
        discountedPricePerUnit: 4.799,
        retailPricePerUnit: 4.799,
        lastTransactionAt: "2026-10-18T12:00:00.000Z",
      },
    ]);

    assert.equal(selected?.fuelType, "diesel");
    assert.equal(selected?.discountedPricePerUnit, 5.897);
    assert.deepEqual(relayDieselPriceFields(selected!), {
      retailPricePerUnit: 6.059,
      discountedPricePerUnit: 5.897,
    });
  });
});

describe("shouldReplaceStoredStationPrice", () => {
  it("replaces a DEF price with the latest diesel purchase", () => {
    assert.equal(
      shouldReplaceStoredStationPrice(
        {
          relayLocationId: "loc-maverik",
          fuelType: "def",
          fuelTypeDescription: "Def",
          discountedPricePerUnit: 4.799,
          retailPricePerUnit: 4.799,
        },
        {
          relayLocationId: "loc-maverik",
          fuelType: "diesel",
          fuelTypeDescription: "Diesel",
          discountedPricePerUnit: 5.897,
          retailPricePerUnit: 6.059,
        },
      ),
      true,
    );
  });

  it("replaces a stored diesel price that does not match the latest diesel purchase", () => {
    assert.equal(
      shouldReplaceStoredStationPrice(
        {
          relayLocationId: "loc-loves",
          fuelType: "diesel",
          fuelTypeDescription: "Diesel",
          discountedPricePerUnit: 5.4331,
          retailPricePerUnit: 5.799,
        },
        {
          relayLocationId: "loc-loves",
          fuelType: "diesel",
          fuelTypeDescription: "Diesel",
          discountedPricePerUnit: 5.8028,
          retailPricePerUnit: 6.089,
        },
      ),
      true,
    );
  });

  it("keeps a stored price that already matches the latest diesel purchase", () => {
    assert.equal(
      shouldReplaceStoredStationPrice(
        {
          relayLocationId: "loc-circle-k",
          fuelType: "diesel",
          fuelTypeDescription: "Diesel",
          discountedPricePerUnit: 5.289,
          retailPricePerUnit: 5.439,
        },
        {
          relayLocationId: "loc-circle-k",
          fuelType: "diesel",
          fuelTypeDescription: "Diesel",
          discountedPricePerUnit: 5.289,
          retailPricePerUnit: 5.439,
        },
      ),
      false,
    );
  });
});

describe("toFuelStationView", () => {
  it("omits DEF and reefer prices from the displayed station price", () => {
    const view = toFuelStationView({
      relayAccount: "azfs",
      relayLocationId: "loc-def",
      fuelType: "def",
      fuelTypeDescription: "Def",
      retailPricePerUnit: 4.799,
      discountedPricePerUnit: 4.799,
      isActive: true,
    } as FuelStationDocument);

    assert.equal(view.retailPricePerUnit, undefined);
    assert.equal(view.discountedPricePerUnit, undefined);
  });
});
