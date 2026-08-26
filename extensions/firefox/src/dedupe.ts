const SESSION_STORAGE_KEY = "successfulTargetUrls";

export interface PostHistoryStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function storedTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Tracks in-flight and successfully posted target URLs for this browser session. */
export class PostHistory {
  readonly #seen: Set<string>;
  readonly #inFlight = new Set<string>();
  readonly #storage: PostHistoryStorage | undefined;
  #pendingWrite = Promise.resolve();

  constructor(
    successfulTargets: Iterable<string> = [],
    storage?: PostHistoryStorage,
  ) {
    this.#seen = new Set(successfulTargets);
    this.#storage = storage;
  }

  static async load(storage: PostHistoryStorage): Promise<PostHistory> {
    const stored = await storage.get(SESSION_STORAGE_KEY);
    return new PostHistory(storedTargets(stored[SESSION_STORAGE_KEY]), storage);
  }

  hasSeen(targetUrl: string): boolean {
    return this.#seen.has(targetUrl) || this.#inFlight.has(targetUrl);
  }

  tryStart(targetUrl: string): boolean {
    if (this.hasSeen(targetUrl)) return false;
    this.#inFlight.add(targetUrl);
    return true;
  }

  async complete(targetUrl: string): Promise<void> {
    this.#inFlight.delete(targetUrl);
    this.#seen.add(targetUrl);
    const storage = this.#storage;
    if (storage === undefined) return;

    const write = this.#pendingWrite
      .catch(() => undefined)
      .then(() =>
        storage.set({
          [SESSION_STORAGE_KEY]: [...this.#seen],
        }),
      );
    this.#pendingWrite = write.then(() => undefined);
    await write;
  }

  release(targetUrl: string): void {
    this.#inFlight.delete(targetUrl);
  }
}
