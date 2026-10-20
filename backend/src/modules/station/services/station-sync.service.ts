import {
  getConfiguredRelayAccounts,
  listRelayDrivers,
  listRelayFuelTransactions,
  splitDateRangeIntoWindows,
  type RelayAccount,
  type RelayTransaction,
} from "../../../integrations/relay";
import { mapRelayTransactionToPersist } from "../../reports/mappers/relay-fuel-transaction.mapper";
import { RelayFuelTransactionModel } from "../../reports/models/relay-fuel-transaction.model";
import { FuelStationModel } from "../models/fuel-station.model";
import { RelayDriverModel } from "../models/relay-driver.model";
import {
  mapRelayDriverFields,
  mapRelayTransactionToStationUpdate,
  shouldReplaceStoredStationPrice,
} from "../mappers/fuel-station.mapper";
import { syncMerchantContractsFromStations } from "../../contract/services/contract-merchant-sync.service";

const DEFAULT_TRANSACTION_LOOKBACK_DAYS = 30;
const SCHEDULED_TRANSACTION_LOOKBACK_DAYS = 2;

type TransactionSyncOptions = {
  dtstart?: string;
  dtend?: string;
  accounts?: RelayAccount[];
};

function toRfc3339(date: Date) {
  return date.toISOString();
}

function getTransactionWindow(lookbackDays: number) {
  const dtend = new Date();
  const dtstart = new Date(dtend);
  dtstart.setUTCDate(dtstart.getUTCDate() - lookbackDays);

  return {
    dtstart: toRfc3339(dtstart),
    dtend: toRfc3339(dtend),
  };
}

function getDefaultTransactionWindow() {
  return getTransactionWindow(DEFAULT_TRANSACTION_LOOKBACK_DAYS);
}

export function getScheduledTransactionWindow() {
  return getTransactionWindow(SCHEDULED_TRANSACTION_LOOKBACK_DAYS);
}

async function syncRelayDriversForAccount(account: RelayAccount) {
  const drivers = await listRelayDrivers(account);
  const syncedAt = new Date();
  const currentDriverIds = drivers.map((driver) => driver.id);

  if (drivers.length > 0) {
    await RelayDriverModel.bulkWrite(
      drivers.map((driver) => ({
        updateOne: {
          filter: { relayAccount: account, relayDriverId: driver.id },
          update: {
            $set: {
              relayAccount: account,
              relayDriverId: driver.id,
              ...mapRelayDriverFields(driver),
              isActive: true,
              syncedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  await RelayDriverModel.updateMany(
    {
      relayAccount: account,
      relayDriverId: { $nin: currentDriverIds },
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        syncedAt,
      },
    },
  );

  return {
    account,
    driverCount: drivers.length,
    driversSyncedAt: syncedAt.toISOString(),
  };
}

export async function syncRelayDrivers(accounts = getConfiguredRelayAccounts()) {
  if (accounts.length === 0) {
    return {
      accounts: [],
      totalDriverCount: 0,
    };
  }

  // Serialize accounts — parallel driver pagination (~40 pages) bursts Relay's rate limit.
  const results = [];
  for (const account of accounts) {
    results.push(await syncRelayDriversForAccount(account));
  }

  return {
    accounts: results,
    totalDriverCount: results.reduce((sum, result) => sum + result.driverCount, 0),
  };
}

async function syncRelayTransactionsForAccount(
  account: RelayAccount,
  window: { dtstart: string; dtend: string },
) {
  const transactionWindows = splitDateRangeIntoWindows(window.dtstart, window.dtend);
  const transactions = await listRelayFuelTransactions(account, window);
  const syncedAt = new Date();
  const stationUpdates = new Map<
    string,
    NonNullable<ReturnType<typeof mapRelayTransactionToStationUpdate>> & { relayAccount: RelayAccount }
  >();

  const transactionPersists: NonNullable<ReturnType<typeof mapRelayTransactionToPersist>>[] = [];

  for (const transaction of transactions) {
    const mapped = mapRelayTransactionToStationUpdate(transaction);
    const persistMapped = mapRelayTransactionToPersist(account, transaction);

    if (persistMapped) {
      transactionPersists.push(persistMapped);
    }

    if (!mapped) {
      continue;
    }

    const existing = stationUpdates.get(mapped.relayLocationId);
    const transactionAt = mapped.lastTransactionAt;

    if (
      !existing ||
      (transactionAt && existing.lastTransactionAt && transactionAt > existing.lastTransactionAt) ||
      (transactionAt && !existing.lastTransactionAt)
    ) {
      stationUpdates.set(mapped.relayLocationId, {
        relayAccount: account,
        ...mapped,
      });
    }
  }

  const stationWrites = [...stationUpdates.values()];

  if (stationWrites.length > 0) {
    await FuelStationModel.bulkWrite(
      stationWrites.map((station) => ({
        updateOne: {
          filter: {
            relayAccount: account,
            relayLocationId: station.relayLocationId,
          },
          update: {
            $set: {
              ...station,
              isActive: true,
              syncedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  if (transactionPersists.length > 0) {
    await RelayFuelTransactionModel.bulkWrite(
      transactionPersists.map((row) => ({
        updateOne: {
          filter: {
            relayAccount: row.relayAccount,
            transactionId: row.transactionId,
          },
          update: {
            $set: {
              ...row,
              syncedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  return {
    account,
    transactionCount: transactions.length,
    transactionWindowCount: transactionWindows.length,
    stationCount: stationWrites.length,
    persistedTransactionCount: transactionPersists.length,
    transactionsUnavailable: transactions.length === 0,
    window,
    stationsSyncedAt: syncedAt.toISOString(),
  };
}

export async function reconcileStoredDieselPrices(accounts: RelayAccount[]) {
  if (accounts.length === 0) {
    return 0;
  }

  const storedTransactions = await RelayFuelTransactionModel.find({
    relayAccount: { $in: accounts },
  })
    .select({ relayAccount: 1, raw: 1 })
    .lean();

  const latestByStation = new Map<
    string,
    NonNullable<ReturnType<typeof mapRelayTransactionToStationUpdate>> & { relayAccount: RelayAccount }
  >();

  for (const storedTransaction of storedTransactions) {
    const mapped = mapRelayTransactionToStationUpdate(storedTransaction.raw as RelayTransaction);

    if (!mapped?.relayLocationId || !mapped.lastTransactionAt) {
      continue;
    }

    const key = `${storedTransaction.relayAccount}:${mapped.relayLocationId}`;
    const existing = latestByStation.get(key);

    if (!existing?.lastTransactionAt || mapped.lastTransactionAt > existing.lastTransactionAt) {
      latestByStation.set(key, {
        relayAccount: storedTransaction.relayAccount,
        ...mapped,
      });
    }
  }

  if (latestByStation.size === 0) {
    return 0;
  }

  const stations = await FuelStationModel.find({
    relayAccount: { $in: accounts },
  })
    .select({
      relayAccount: 1,
      relayLocationId: 1,
      fuelType: 1,
      fuelTypeDescription: 1,
      retailPricePerUnit: 1,
      discountedPricePerUnit: 1,
    })
    .lean();

  const writes = stations.flatMap((station) => {
    const incoming = latestByStation.get(`${station.relayAccount}:${station.relayLocationId}`);

    if (!incoming || !shouldReplaceStoredStationPrice(station, incoming)) {
      return [];
    }

    return [
      {
        updateOne: {
          filter: {
            relayAccount: station.relayAccount,
            relayLocationId: station.relayLocationId,
          },
          update: {
            $set: {
              ...incoming,
              isActive: true,
              syncedAt: new Date(),
            },
          },
        },
      },
    ];
  });

  if (writes.length > 0) {
    await FuelStationModel.bulkWrite(writes, { ordered: false });
  }

  return writes.length;
}

export async function syncRelayTransactions(options: TransactionSyncOptions = {}) {
  const accounts = options.accounts?.length ? options.accounts : getConfiguredRelayAccounts();
  const window = {
    dtstart: options.dtstart || getDefaultTransactionWindow().dtstart,
    dtend: options.dtend || getDefaultTransactionWindow().dtend,
  };

  if (accounts.length === 0) {
    return {
      window,
      accounts: [],
      totalTransactionCount: 0,
      totalStationCount: 0,
      merchantContracts: await syncMerchantContractsFromStations(),
    };
  }

  // Serialize accounts so both keys do not hit /fuel/transactions/ at the same instant.
  const results = [];
  for (const account of accounts) {
    results.push(await syncRelayTransactionsForAccount(account, window));
  }
  const reconciledStationCount = await reconcileStoredDieselPrices(accounts);
  const merchantContracts = await syncMerchantContractsFromStations();

  return {
    window,
    accounts: results,
    totalTransactionCount: results.reduce((sum, result) => sum + result.transactionCount, 0),
    totalStationCount: results.reduce((sum, result) => sum + result.stationCount, 0),
    reconciledStationCount,
    merchantContracts,
  };
}

export async function syncStationsFromRelay(options: TransactionSyncOptions = {}) {
  const drivers = await syncRelayDrivers(options.accounts);
  const transactions = await syncRelayTransactions(options);

  return {
    ...drivers,
    ...transactions,
  };
}
