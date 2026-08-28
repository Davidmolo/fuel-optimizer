const MERCHANT_ALIASES: Record<string, string> = {
  loves: "loves",
  "love's": "loves",
  "loves travel stop": "loves",
  "love's travel stop": "loves",
  pilot: "pilot",
  "pilot flying j": "pilot",
  "pilot travel centers": "pilot",
  speedway: "speedway",
  "speedway llc": "speedway",
};

export function normalizeMerchantKey(merchantName?: string) {
  if (!merchantName?.trim()) {
    return undefined;
  }

  const normalized = merchantName.trim().toLowerCase();
  return MERCHANT_ALIASES[normalized] ?? normalized.replace(/['.]/g, "").replace(/\s+/g, " ").trim();
}
