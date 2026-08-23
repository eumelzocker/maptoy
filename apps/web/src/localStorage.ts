function globalStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function getItem(
  key: string,
  storage: Pick<Storage, "getItem"> | null = globalStorage(),
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
  storage: Pick<Storage, "setItem"> | null = globalStorage(),
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
  storage: Pick<Storage, "removeItem"> | null = globalStorage(),
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
