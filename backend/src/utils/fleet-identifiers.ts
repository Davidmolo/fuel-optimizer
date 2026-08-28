export function normalizeUnitNumber(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeVin(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}
