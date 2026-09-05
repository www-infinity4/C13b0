class FakeStorage {
  private store = new Map<string, string>();
  quotaLimit: number | null = null;

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    if (this.quotaLimit !== null && value.length > this.quotaLimit) {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    }
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const fakeStorage = new FakeStorage();
(globalThis as unknown as { window: { localStorage: FakeStorage } }).window = {
  localStorage: fakeStorage,
};

import { secureLoad, secureRemove, secureSave } from "../secure-storage";

const KEY = "test_c13b0_secure_storage_key";

describe("secure-storage", () => {
  beforeEach(() => {
    fakeStorage.clear();
    fakeStorage.quotaLimit = null;
  });

  it("round-trips a value and does not store it as plaintext", () => {
    const value = { walletId: "abc", tokens: [{ id: "1", title: "First" }] };
    expect(secureSave(KEY, value)).toBe(true);
    const raw = fakeStorage.getItem(KEY)!;
    expect(raw).not.toContain("walletId");
    expect(raw).not.toContain("First");
    expect(secureLoad(KEY, null)).toEqual(value);
  });

  it("returns the fallback when nothing is stored", () => {
    expect(secureLoad(KEY, "fallback")).toBe("fallback");
  });

  it("migrates legacy unencoded plaintext JSON written by older versions", () => {
    fakeStorage.setItem(KEY, JSON.stringify([{ id: "legacy" }]));
    expect(secureLoad<{ id: string }[]>(KEY, [])).toEqual([{ id: "legacy" }]);
  });

  it("detects corrupted/tampered records and returns the fallback", () => {
    secureSave(KEY, { ok: true });
    const raw = JSON.parse(fakeStorage.getItem(KEY)!);
    raw.data = raw.data.slice(0, -2) + "zz";
    fakeStorage.setItem(KEY, JSON.stringify(raw));
    expect(secureLoad(KEY, null)).toBe(null);
  });

  it("prunes oldest array entries and retries when storage is full", () => {
    fakeStorage.quotaLimit = 400;
    const big = Array.from({ length: 8 }, (_, i) => ({ id: String(i), blob: "x".repeat(40) }));
    const ok = secureSave(KEY, big);
    expect(ok).toBe(true);
    const stored = secureLoad<typeof big>(KEY, []);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.length).toBeLessThan(big.length);
    expect(stored).toEqual(big.slice(0, stored.length));
  });

  it("falls back to an in-memory store and still round-trips when storage keeps failing", () => {
    fakeStorage.quotaLimit = 0;
    const value = { id: "still-here" };
    const ok = secureSave(KEY, value);
    expect(ok).toBe(false);
    expect(secureLoad(KEY, null)).toEqual(value);
  });

  it("removes a persisted value", () => {
    secureSave(KEY, { a: 1 });
    secureRemove(KEY);
    expect(fakeStorage.getItem(KEY)).toBe(null);
    expect(secureLoad(KEY, null)).toBe(null);
  });
});
