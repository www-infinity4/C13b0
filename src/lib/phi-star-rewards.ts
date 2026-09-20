"use client";

export type PhiStarReward = { awarded: number; progressToNextCoin: number };
export type PhiStarSnapshot = {
  balance: number;
  progress: number;
  shares: number;
  effective: number;
};

const read = (key: string, fallback: any) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
};

export function phiStarSnapshot(): PhiStarSnapshot {
  const session = read("starquest_session", null),
    users = read("starquest_users", {}),
    profile =
      (session?.key && users[session.key]) ||
      read("starquest_guest_profile_v1", {}),
    balance = Math.max(0, Number(profile?.tokens) || 0),
    progress = Math.max(0, Number(profile?.pendingShareCredits) || 0),
    shares = Math.max(0, Number(profile?.shareCount) || 0);
  return { balance, progress, shares, effective: balance + progress / 10 };
}

function mirrorUnifiedWallet(wallet: any) {
  try {
    const state = read("infinity_unified_wallet_v1", null),
      walletId = state?.currentWalletId;
    if (!walletId || !state?.wallets?.[walletId]) return;
    const active = state.wallets[walletId],
      balances =
        active.balances && typeof active.balances === "object"
          ? active.balances
          : {};
    active.balances = {
      ...balances,
      starCoin: wallet.tokens + wallet.pendingShareCredits / 10,
      starCoinWhole: wallet.tokens,
      starCoinProgress: wallet.pendingShareCredits,
    };
    active.starCoinShares = wallet.shareCount;
    state.updatedAt = new Date().toISOString();
    localStorage.setItem("infinity_unified_wallet_v1", JSON.stringify(state));
  } catch {}
}

export function awardPhiStarCredit(
  action: "share" | "collect",
  reference: string,
): PhiStarReward {
  try {
    const session = read("starquest_session", null),
      users = read("starquest_users", {}),
      signed = session?.key && users[session.key],
      wallet: any =
        signed ||
        read("starquest_guest_profile_v1", {
          tokens: 0,
          shareCount: 0,
          pendingShareCredits: 0,
          shareEvents: [],
          ledger: [],
        }),
      normalizedReference = String(reference || "").trim(),
      eventType = action === "share" ? "share_credit" : "collect_credit";
    wallet.tokens = Math.max(0, Number(wallet.tokens) || 0);
    wallet.pendingShareCredits = Math.max(
      0,
      Number(wallet.pendingShareCredits) || 0,
    );
    wallet.shareCount = Math.max(0, Number(wallet.shareCount) || 0);
    wallet.shareEvents = Array.isArray(wallet.shareEvents)
      ? wallet.shareEvents
      : [];
    wallet.ledger = Array.isArray(wallet.ledger) ? wallet.ledger : [];
    if (
      action === "collect" &&
      wallet.ledger.some(
        (entry: any) =>
          entry?.type === eventType &&
          entry?.referenceId === normalizedReference,
      )
    )
      return {
        awarded: 0,
        progressToNextCoin: wallet.pendingShareCredits,
      };
    const id = `phi-${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (action === "share") {
      wallet.shareCount += 1;
      wallet.shareEvents.push({
        id,
        reference: normalizedReference,
        method: "phi_share",
        confirmed: true,
        createdAt: Date.now(),
      });
    }
    wallet.pendingShareCredits += 1;
    let awarded = 0;
    while (wallet.pendingShareCredits >= 10) {
      wallet.pendingShareCredits -= 10;
      wallet.tokens += 1;
      awarded += 1;
    }
    wallet.ledger.push({
      id: `tx-${id}`,
      type: eventType,
      amount: awarded,
      credit: 0.1,
      balance: wallet.tokens,
      pendingShareCredits: wallet.pendingShareCredits,
      referenceId: normalizedReference,
      createdAt: Date.now(),
    });
    if (signed) {
      users[session.key] = wallet;
      localStorage.setItem("starquest_users", JSON.stringify(users));
    } else {
      localStorage.setItem(
        "starquest_guest_profile_v1",
        JSON.stringify(wallet),
      );
    }
    mirrorUnifiedWallet(wallet);
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    return { awarded, progressToNextCoin: wallet.pendingShareCredits };
  } catch {
    return { awarded: 0, progressToNextCoin: 0 };
  }
}
