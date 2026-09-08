/**
 * Shared, resilient persistence for wallet, token and history records.
 *
 * Every value is JSON-serialized, UTF-8 encoded and stored as base64 inside a
 * small versioned envelope with an integrity checksum. This guarantees:
 *  - content is never written to storage as raw, unencoded plaintext
 *  - corrupted or tampered records are detected on read instead of silently
 *    resurrecting bad data
 *  - a write that fails (for example due to a full quota) automatically
 *    prunes the oldest history entries and retries instead of silently
 *    dropping the save, which is what previously made history "disappear"
 *  - a storage-unavailable environment (private browsing, disabled storage)
 *    falls back to an in-memory store for the lifetime of the tab so the
 *    app keeps working instead of throwing.
 */

const ENVELOPE_VERSION = 1;
const memoryFallback = new Map<string, string>();
const DURABLE_DB = "infinity-persistent-state";
const DURABLE_STORE = "records";

type Envelope = {
  v: number;
  checksum: number;
  data: string;
};

function checksum(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function encode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function wrap(json: string): string {
  const data = encode(json);
  const envelope: Envelope = {
    v: ENVELOPE_VERSION,
    checksum: checksum(data),
    data,
  };
  return JSON.stringify(envelope);
}

type UnwrapResult =
  { status: "ok"; json: string } | { status: "corrupt" } | { status: "legacy" };

function looksLikeEnvelope(value: unknown): value is Partial<Envelope> {
  return (
    typeof value === "object" &&
    value !== null &&
    "v" in value &&
    "data" in value &&
    "checksum" in value
  );
}

function unwrap(raw: string): UnwrapResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "legacy" };
  }
  if (!looksLikeEnvelope(parsed)) return { status: "legacy" };
  const envelope = parsed;
  if (
    typeof envelope.v === "number" &&
    typeof envelope.data === "string" &&
    typeof envelope.checksum === "number" &&
    checksum(envelope.data) === envelope.checksum
  ) {
    try {
      return { status: "ok", json: decode(envelope.data) };
    } catch {
      return { status: "corrupt" };
    }
  }
  return { status: "corrupt" };
}

export type StorageArea = "local" | "session";

function getStorage(area: StorageArea = "local"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return area === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function memoryKey(area: StorageArea, key: string): string {
  return `${area}:${key}`;
}

function openDurableStore(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DURABLE_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DURABLE_STORE))
          request.result.createObjectStore(DURABLE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeDurable(
  key: string,
  value: string,
  area: StorageArea,
): Promise<boolean> {
  if (area !== "local") return false;
  const database = await openDurableStore();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DURABLE_STORE, "readwrite");
      transaction.objectStore(DURABLE_STORE).put(value, key);
      transaction.oncomplete = () => {
        database.close();
        resolve(true);
      };
      transaction.onerror = () => {
        database.close();
        resolve(false);
      };
    } catch {
      database.close();
      resolve(false);
    }
  });
}

async function readDurable(key: string): Promise<string | null> {
  const database = await openDurableStore();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DURABLE_STORE, "readonly");
      const request = transaction.objectStore(DURABLE_STORE).get(key);
      request.onsuccess = () => {
        database.close();
        resolve(typeof request.result === "string" ? request.result : null);
      };
      request.onerror = () => {
        database.close();
        resolve(null);
      };
    } catch {
      database.close();
      resolve(null);
    }
  });
}

async function removeDurable(key: string): Promise<void> {
  const database = await openDurableStore();
  if (!database) return;
  try {
    const transaction = database.transaction(DURABLE_STORE, "readwrite");
    transaction.objectStore(DURABLE_STORE).delete(key);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  } catch {
    database.close();
  }
}

function readRaw(key: string, area: StorageArea = "local"): string | null {
  const storage = getStorage(area);
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null) return value;
    } catch {
      /* storage inaccessible, fall back to memory */
    }
  }
  const memKey = memoryKey(area, key);
  return memoryFallback.has(memKey) ? memoryFallback.get(memKey)! : null;
}

function writeRaw(
  key: string,
  value: string,
  area: StorageArea = "local",
): boolean {
  const storage = getStorage(area);
  const memKey = memoryKey(area, key);
  if (storage) {
    try {
      storage.setItem(key, value);
      memoryFallback.delete(memKey);
      return true;
    } catch {
      /* fall through to retry/fallback below */
    }
  }
  memoryFallback.set(memKey, value);
  return storage === null;
}

/**
 * Encode and persist a value under `key`, verifying the write actually
 * landed. When the payload is an array and the initial write fails (for
 * example a full storage quota), the oldest entries are pruned and the
 * write is retried so recent history is never silently lost.
 */
export function secureSave<T>(
  key: string,
  value: T,
  area: StorageArea = "local",
): boolean {
  const durableEnvelope = wrap(JSON.stringify(value));
  void writeDurable(key, durableEnvelope, area);
  const attempt = (payload: T): boolean => {
    const envelope = wrap(JSON.stringify(payload));
    const ok = writeRaw(key, envelope, area);
    if (!ok) return false;
    // Verify the write is actually readable back before trusting it.
    const verify = unwrap(readRaw(key, area) ?? "");
    return verify.status === "ok" && verify.json === JSON.stringify(payload);
  };

  if (attempt(value)) return true;

  if (Array.isArray(value) && value.length > 1) {
    // Keep the newest records. Keeping the first half could discard the
    // research package that had just been created.
    let shrinking = value.slice(-Math.max(1, Math.floor(value.length / 2)));
    while (shrinking.length > 0) {
      if (attempt(shrinking as unknown as T)) return true;
      shrinking = shrinking.slice(-Math.floor(shrinking.length / 2));
    }
  }

  memoryFallback.set(memoryKey(area, key), wrap(JSON.stringify(value)));
  return false;
}

/** Save to both the fast local store and IndexedDB before continuing. */
export async function secureSaveDurable<T>(
  key: string,
  value: T,
  area: StorageArea = "local",
): Promise<boolean> {
  const localSaved = secureSave(key, value, area);
  const durableSaved = await writeDurable(
    key,
    wrap(JSON.stringify(value)),
    area,
  );
  return localSaved || durableSaved;
}

/**
 * Read and decode the value stored under `key`. Falls back to parsing
 * legacy, unencoded plaintext JSON written by older versions of the app so
 * existing history is migrated rather than dropped, and returns
 * `fallback` when nothing usable is found.
 */
export function secureLoad<T>(
  key: string,
  fallback: T,
  area: StorageArea = "local",
): T {
  const raw = readRaw(key, area);
  if (raw === null) return fallback;
  const result = unwrap(raw);
  if (result.status === "corrupt") return fallback;
  try {
    if (result.status === "ok") return JSON.parse(result.json) as T;
    // Legacy plaintext record from before encoding was introduced.
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Restore the complete IndexedDB copy, with local/session storage fallback. */
export async function secureLoadDurable<T>(
  key: string,
  fallback: T,
  area: StorageArea = "local",
): Promise<T> {
  if (area === "session") return secureLoad(key, fallback, area);
  const raw = await readDurable(key);
  if (raw === null) return secureLoad(key, fallback, area);
  const result = unwrap(raw);
  if (result.status === "corrupt") return secureLoad(key, fallback, area);
  try {
    return JSON.parse(result.status === "ok" ? result.json : raw) as T;
  } catch {
    return secureLoad(key, fallback, area);
  }
}

/** Remove a persisted value from both storage and the memory fallback. */
export function secureRemove(key: string, area: StorageArea = "local"): void {
  const storage = getStorage(area);
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  memoryFallback.delete(memoryKey(area, key));
  if (area === "local") void removeDurable(key);
}
