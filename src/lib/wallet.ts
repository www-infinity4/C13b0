import { secureLoad, secureSave } from "./secure-storage";

export type WalletRecord = { walletId: string; displayName: string };

type WalletApi = {
  createWallet(input: { displayName: string }): WalletRecord;
  snapshot(): { currentWalletId: string | null; wallets: Record<string, WalletRecord> };
};

declare global {
  interface Window {
    InfinityUnifiedWallet?: { UnifiedInfinityWallet: new () => WalletApi };
  }
}

const LOCAL_WALLET = "c13b0_infinity_wallet_v1";

export function loadLocalWallet(): WalletRecord | null {
  return secureLoad<WalletRecord | null>(LOCAL_WALLET, null);
}

export function saveLocalWallet(wallet: WalletRecord): void {
  secureSave(LOCAL_WALLET, wallet);
}

export function connectOrCreateWallet(displayName = "Infinity Wallet"): WalletRecord {
  let wallet: WalletRecord | null = null;
  try {
    if (window.InfinityUnifiedWallet) {
      const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
      const state = api.snapshot();
      wallet = state.currentWalletId
        ? state.wallets[state.currentWalletId] || null
        : api.createWallet({ displayName });
    }
  } catch {
    /* fall through to local fallback */
  }
  if (!wallet) {
    const existing = loadLocalWallet();
    wallet =
      existing || { walletId: `infinity-${crypto.randomUUID()}`, displayName };
  }
  saveLocalWallet(wallet);
  return wallet;
}

export function formatWalletId(id: string): string {
  return id.length > 32 ? `${id.slice(0, 16)}…${id.slice(-10)}` : id;
}
