"use client";

import { useCallback, useSyncExternalStore } from "react";

type JsonSnapshotCacheEntry = {
  raw: string | null;
  value: unknown;
};

const jsonSnapshotCache = new Map<string, JsonSnapshotCacheEntry>();

function subscribeToKey(key: string, onStoreChange: () => void) {
  const handler = (event: Event) => {
    if (event instanceof StorageEvent && event.key && event.key !== key) {
      return;
    }
    onStoreChange();
  };

  window.addEventListener("storage", handler);
  window.addEventListener(`persisted:${key}`, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(`persisted:${key}`, handler);
  };
}

function readBoolean(key: string, defaultValue: boolean) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }
    return stored === "true";
  } catch {
    return defaultValue;
  }
}

export function usePersistedBoolean(key: string, defaultValue = false) {
  const value = useSyncExternalStore(
    (onStoreChange) => subscribeToKey(key, onStoreChange),
    () => readBoolean(key, defaultValue),
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const prev = readBoolean(key, defaultValue);
      const resolved = typeof next === "function" ? next(prev) : next;
      try {
        window.localStorage.setItem(key, String(resolved));
        window.dispatchEvent(new Event(`persisted:${key}`));
      } catch {
        // ignore write errors
      }
    },
    [key, defaultValue],
  );

  return [value, setValue, true] as const;
}

const serverJsonSnapshotCache = new Map<string, unknown>();

function cloneDefault<T>(defaultValue: T): T {
  if (typeof defaultValue === "object" && defaultValue !== null) {
    return { ...defaultValue } as T;
  }
  return defaultValue;
}

function getServerJsonSnapshot<T>(key: string, defaultValue: T): T {
  if (!serverJsonSnapshotCache.has(key)) {
    serverJsonSnapshotCache.set(key, cloneDefault(defaultValue));
  }
  return serverJsonSnapshotCache.get(key) as T;
}

function readJsonSnapshot<T>(key: string, defaultValue: T): T {
  let stored: string | null = null;

  try {
    stored = window.localStorage.getItem(key);
  } catch {
    stored = null;
  }

  const cached = jsonSnapshotCache.get(key);
  if (cached && cached.raw === stored) {
    return cached.value as T;
  }

  let value: T;

  if (stored === null) {
    value = cached?.raw === null ? (cached.value as T) : cloneDefault(defaultValue);
  } else {
    try {
      value = JSON.parse(stored) as T;
    } catch {
      value = cached?.raw === null ? (cached.value as T) : cloneDefault(defaultValue);
      stored = null;
    }
  }

  jsonSnapshotCache.set(key, { raw: stored, value });
  return value;
}

export function usePersistedJson<T>(key: string, defaultValue: T) {
  const value = useSyncExternalStore(
    (onStoreChange) => subscribeToKey(key, onStoreChange),
    () => readJsonSnapshot(key, defaultValue),
    () => getServerJsonSnapshot(key, defaultValue),
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readJsonSnapshot(key, defaultValue);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;

      try {
        const serialized = JSON.stringify(resolved);
        window.localStorage.setItem(key, serialized);
        jsonSnapshotCache.set(key, { raw: serialized, value: resolved });
        window.dispatchEvent(new Event(`persisted:${key}`));
      } catch {
        // ignore write errors
      }
    },
    [key, defaultValue],
  );

  return [value, setValue] as const;
}
