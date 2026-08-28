const DEMO_MODE_STORAGE_KEY = "fuel-optimizer-demo-mode";
const DEMO_FUEL_STORAGE_KEY = "fuel-optimizer-demo-fuel-percent";

export function getStoredDemoMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

export function setStoredDemoMode(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? "true" : "false");
}

export function getStoredDemoFuelPercent() {
  if (typeof window === "undefined") {
    return 20;
  }

  const stored = window.localStorage.getItem(DEMO_FUEL_STORAGE_KEY);
  const parsed = stored ? Number.parseFloat(stored) : 20;

  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.max(5, Math.min(95, parsed));
}

export function setStoredDemoFuelPercent(value: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEMO_FUEL_STORAGE_KEY, String(value));
}
