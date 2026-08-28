import {
  getConfiguredRelayAccounts,
  listRelayDrivers,
  listRelayFuelTransactions,
  splitDateRangeIntoWindows,
  type RelayAccount,
} from "../../../integrations/relay";
import { FuelStationModel } from "../models/fuel-station.model";
import { RelayDriverModel } from "../models/relay-driver.model";
import { mapRelayDriverFields, mapRelayTransactionToStationUpdate } from "../mappers/fuel-station.mapper";
import { syncMerchantContractsFromStations } from "../../contract/services/contract-merchant-sync.service";

const DEFAULT_TRANSACTION_LOOKBACK_DAYS = 30;

type TransactionSyncOptions = {
  dtstart?: string;
  dtend?: string;
  accounts?: RelayAccount[];
};

function toRfc3339(date: Date) {
  return date.toISOString();
}

function getDefaultTransactionWindow() {
  const dtend = new Date();
  const dtstart = new Date(dtend);
  dtstart.setUTCDate(dtstart.getUTCDate() - DEFAULT_TRANSACTION_LOOKBACK_DAYS);

  return {
    dtstart: toRfc3339(dtstart),
    dtend: toRfc3339(dtend),
  };
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

  const results = await Promise.all(accounts.map((account) => syncRelayDriversForAccount(account)));

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

  for (const transaction of transactions) {
    const mapped = mapRelayTransactionToStationUpdate(transaction);

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

  return {
    account,
    transactionCount: transactions.length,
    transactionWindowCount: transactionWindows.length,
    stationCount: stationWrites.length,
    transactionsUnavailable: transactions.length === 0,
    window,
    stationsSyncedAt: syncedAt.toISOString(),
  };
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

  const results = await Promise.all(accounts.map((account) => syncRelayTransactionsForAccount(account, window)));
  const merchantContracts = await syncMerchantContractsFromStations();

  return {
    window,
    accounts: results,
    totalTransactionCount: results.reduce((sum, result) => sum + result.transactionCount, 0),
    totalStationCount: results.reduce((sum, result) => sum + result.stationCount, 0),
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
