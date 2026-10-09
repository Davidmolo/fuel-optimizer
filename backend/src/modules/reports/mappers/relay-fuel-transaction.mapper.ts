import type { RelayAccount, RelayTransaction } from "../../../integrations/relay";

function parseNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sumGallons(transaction: RelayTransaction) {
  if (!transaction.fuel_items?.length) {
    return undefined;
  }

  let total = 0;
  let hasValue = false;

  for (const item of transaction.fuel_items) {
    const volume = parseNumber(item.volume);
    if (volume === undefined) {
      continue;
    }
    total += volume;
    hasValue = true;
  }

  return hasValue ? total : undefined;
}

export function mapRelayTransactionToPersist(
  account: RelayAccount,
  transaction: RelayTransaction,
) {
  const location = transaction.location;
  if (!location?.id || !transaction.transaction_id || !transaction.created_at) {
    return null;
  }

  const occurredAt = new Date(transaction.created_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return {
    relayAccount: account,
    transactionId: transaction.transaction_id,
    locationId: location.id,
    merchantName: transaction.merchant?.name,
    city: location.city,
    state: location.state,
    latitude: location.latitude,
    longitude: location.longitude,
    amountPaid: parseNumber(transaction.total_amount_paid),
    gallons: sumGallons(transaction),
    occurredAt,
    raw: transaction as unknown as Record<string, unknown>,
  };
}
