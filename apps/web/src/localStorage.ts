export function availableLocalStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    // Access to the Storage property itself may be blocked by browser policy.
    return null;
  }
}

export function getItem(
  key: string,
  storage: Pick<Storage, "getItem"> | null = availableLocalStorage(),
): string | null {
  if (storage === null) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(
  key: string,
  value: string,
  storage: Pick<Storage, "setItem"> | null = availableLocalStorage(),
): void {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(key, value);
  } catch {
    // Browsing modes or storage quotas may reject writes; callers remain usable.
  }
}

export function removeItem(
  key: string,
  storage: Pick<Storage, "removeItem"> | null = availableLocalStorage(),
): void {
  if (storage === null) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch {
    // Same as setItem.
  }
}
