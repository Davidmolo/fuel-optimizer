/** Demo mode is retired for live use. Helpers kept as no-ops for any leftover imports. */

export function getStoredDemoMode() {
  return false;
}

export function setStoredDemoMode(_enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("fuel-optimizer-demo-mode");
}

export function getStoredDemoFuelPercent() {
  return 20;
}

export function setStoredDemoFuelPercent(_value: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("fuel-optimizer-demo-fuel-percent");
}
