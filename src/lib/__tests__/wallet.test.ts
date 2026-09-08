class FakeStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
}

const localStorage = new FakeStorage();
const sessionStorage = new FakeStorage();
const browser = {
  localStorage,
  sessionStorage,
  dispatchEvent: jest.fn(),
} as unknown as Window & typeof globalThis;

Object.assign(globalThis, {
  window: browser,
  localStorage,
  sessionStorage,
  document: { cookie: "" },
  location: { protocol: "https:" },
});

import { secureLoad, secureSave } from "../secure-storage";
import {
  connectOrCreateWallet,
  formatWalletId,
  loadLocalWallet,
} from "../wallet";

const LOCAL = "c13b0_infinity_wallet_v1";
const UNIFIED = "infinity_unified_wallet_v1";
const unifiedState = (wallet: { walletId: string; displayName: string }) => ({
  schema: "infinity/unified-wallet/v1",
  currentWalletId: wallet.walletId,
  wallets: { [wallet.walletId]: wallet },
  tokens: {},
  sales: {},
  payableAccounts: {},
  events: [],
  updatedAt: null,
});

describe("wallet synchronization", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (globalThis.document as { cookie: string }).cookie = "";
    delete (browser as Window & { InfinityUnifiedWallet?: unknown })
      .InfinityUnifiedWallet;
    jest.clearAllMocks();
  });

  it("returns null before a wallet has been created", () => {
    expect(loadLocalWallet()).toBeNull();
  });

  it("creates one active wallet in both C13b0 and the unified store", () => {
    const wallet = connectOrCreateWallet();
    expect(secureLoad(LOCAL, null)).toEqual(wallet);
    expect(JSON.parse(localStorage.getItem(UNIFIED)!).currentWalletId).toBe(
      wallet.walletId,
    );
  });

  it("promotes an older C13b0-only wallet into the unified store", () => {
    const wallet = { walletId: "infinity-old", displayName: "Old wallet" };
    secureSave(LOCAL, wallet);
    expect(loadLocalWallet()).toEqual(wallet);
    expect(JSON.parse(localStorage.getItem(UNIFIED)!).wallets[wallet.walletId])
      .toMatchObject(wallet);
  });

  it("adopts the active shared wallet when the local mirror differs", () => {
    secureSave(LOCAL, { walletId: "local", displayName: "Local" });
    const shared = { walletId: "shared", displayName: "Shared" };
    localStorage.setItem(UNIFIED, JSON.stringify(unifiedState(shared)));
    expect(loadLocalWallet()).toEqual(shared);
    expect(secureLoad(LOCAL, null)).toEqual(shared);
  });

  it("uses the active wallet exposed by the shared wallet client", () => {
    const shared = { walletId: "client", displayName: "Client" };
    (browser as Window & { InfinityUnifiedWallet?: unknown }).InfinityUnifiedWallet = {
      UnifiedInfinityWallet: class {
        snapshot() {
          return unifiedState(shared);
        }
        createWallet() {
          return shared;
        }
      },
    };
    expect(connectOrCreateWallet()).toEqual(shared);
  });

  it("passes an existing local identity into an empty shared client", () => {
    const local = { walletId: "keep-me", displayName: "Existing" };
    secureSave(LOCAL, local);
    let received: Record<string, string> | null = null;
    (browser as Window & { InfinityUnifiedWallet?: unknown }).InfinityUnifiedWallet = {
      UnifiedInfinityWallet: class {
        snapshot() {
          return { currentWalletId: null, wallets: {} };
        }
        createWallet(input: Record<string, string>) {
          received = input;
          return input as typeof local;
        }
      },
    };
    expect(connectOrCreateWallet()).toEqual(local);
    expect(received).toMatchObject({ walletId: "keep-me" });
  });

  it("keeps short wallet IDs readable", () => {
    expect(formatWalletId("infinity-short")).toBe("infinity-short");
  });

  it("shortens long wallet IDs without hiding their endpoints", () => {
    const id = "infinity-wallet:abcdefghijklmnopqrstuvwxyz0123456789";
    const formatted = formatWalletId(id);
    expect(formatted).toContain("…");
    expect(formatted.startsWith(id.slice(0, 16))).toBe(true);
    expect(formatted.endsWith(id.slice(-10))).toBe(true);
  });
});
