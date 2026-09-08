import { secureLoad, secureSave } from "./secure-storage";

export type WalletRecord = { walletId: string; displayName: string };

type WalletApi = {
  createWallet(input: { displayName: string }): WalletRecord;
  snapshot(): {
    currentWalletId: string | null;
    wallets: Record<string, WalletRecord>;
  };
};

declare global {
  interface Window {
    InfinityUnifiedWallet?: { UnifiedInfinityWallet: new () => WalletApi };
  }
}

const LOCAL_WALLET = "c13b0_infinity_wallet_v1";
const UNIFIED_WALLET = "infinity_unified_wallet_v1";
const UNIFIED_SCHEMA = "infinity/unified-wallet/v1";
const WALLET_COOKIE = "infinity_wallet_backup";

type UnifiedWalletState = {
  schema: string;
  currentWalletId: string | null;
  wallets: Record<string, WalletRecord & Record<string, unknown>>;
  tokens?: Record<string, unknown>;
  sales?: Record<string, unknown>;
  payableAccounts?: Record<string, number>;
  events?: unknown[];
  updatedAt?: string | null;
};

function readUnifiedState(): UnifiedWalletState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(UNIFIED_WALLET) || "null");
    return parsed?.schema === UNIFIED_SCHEMA && parsed.wallets
      ? (parsed as UnifiedWalletState)
      : null;
  } catch {
    return null;
  }
}

function activeUnifiedWallet(): WalletRecord | null {
  const state = readUnifiedState();
  return state?.currentWalletId
    ? state.wallets[state.currentWalletId] || null
    : null;
}

function activateUnifiedWallet(wallet: WalletRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readUnifiedState();
    if (
      existing?.currentWalletId === wallet.walletId &&
      existing.wallets[wallet.walletId]
    )
      return;
    const state: UnifiedWalletState = existing || {
      schema: UNIFIED_SCHEMA,
      currentWalletId: null,
      wallets: {},
      tokens: {},
      sales: {},
      payableAccounts: {},
      events: [],
      updatedAt: null,
    };
    state.wallets[wallet.walletId] = {
      balances: {},
      tokenIds: [],
      sourceSystems: [],
      createdAt: new Date().toISOString(),
      ...state.wallets[wallet.walletId],
      ...wallet,
    };
    state.currentWalletId = wallet.walletId;
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(UNIFIED_WALLET, JSON.stringify(state));
  } catch {
    // The encoded C13b0 copy and cookie remain available as recovery mirrors.
  }
}

function loadWalletCookie(): WalletRecord | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${WALLET_COOKIE}=`))
      ?.slice(WALLET_COOKIE.length + 1);
    return raw ? (JSON.parse(decodeURIComponent(raw)) as WalletRecord) : null;
  } catch {
    return null;
  }
}

export function loadLocalWallet(): WalletRecord | null {
  const unified = activeUnifiedWallet();
  const local =
    secureLoad<WalletRecord | null>(LOCAL_WALLET, null) || loadWalletCookie();
  const wallet = unified || local;
  if (!wallet) return null;

  if (!local || local.walletId !== wallet.walletId) secureSave(LOCAL_WALLET, wallet);
  if (!unified) activateUnifiedWallet(wallet);
  return wallet;
}

export function saveLocalWallet(wallet: WalletRecord): void {
  secureSave(LOCAL_WALLET, wallet);
  activateUnifiedWallet(wallet);
  if (typeof document !== "undefined") {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${WALLET_COOKIE}=${encodeURIComponent(JSON.stringify(wallet))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    window.dispatchEvent(new Event("infinity-wallet-updated"));
  }
}

export function connectOrCreateWallet(
  displayName = "Infinity Wallet",
): WalletRecord {
  const existing = loadLocalWallet();
  let wallet: WalletRecord | null = existing;
  try {
    if (window.InfinityUnifiedWallet) {
      const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
      const state = api.snapshot();
      const active = state.currentWalletId
        ? state.wallets[state.currentWalletId] || null
        : null;
      wallet =
        active ||
        (existing
          ? api.createWallet(
              {
                walletId: existing.walletId,
                displayName: existing.displayName,
              } as { displayName: string },
            )
          : api.createWallet({ displayName }));
    }
  } catch {
    /* fall through to local fallback */
  }
  if (!wallet) {
    const randomId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    wallet = existing || { walletId: `infinity-${randomId}`, displayName };
  }
  saveLocalWallet(wallet);
  return wallet;
}

export function formatWalletId(id: string): string {
  return id.length > 32 ? `${id.slice(0, 16)}…${id.slice(-10)}` : id;
}
