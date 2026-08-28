"use client";

import { useSyncExternalStore } from "react";

export function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
