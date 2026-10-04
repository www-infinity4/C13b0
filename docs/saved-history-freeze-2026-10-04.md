# Saved-history responsiveness repair

Baseline commit: b410a5ccbe53fff849c5568dc123847d4b60436b.

In a mobile browser with 230 sample saved research records (about 2 MB encoded), repeated wallet snapshots took 155–244 ms each. The page recorded background tasks around one second and missed timer ticks. The clean browser remained responsive. These measurements reproduce saved-history stalls, not the user's exact personal browser state.

The repair retains existing envelope version, checksum verification, Unicode content, storage keys, wallet identity, token ownership, paired credits, balances, history and cloud synchronization. Encoding now uses bounded chunks. Decoding uses indexed byte copies instead of a callback per character. Durable saves avoid a redundant durable mirror call. Wallet totals reuse the decoded research ledger and recompute when relevant stored inputs change, including the active account. The shared counter also reuses its decoded ledger.

Hidden website builds wait until typing and recent interaction stop. Only the latest pending build starts; pointer, key and focus activity immediately release an active hidden builder. Wallet and counter asset versions are bumped so existing profiles receive the new code.

Before release: Monitor Observer `/p/observer/run` returned `ok:true`, observe-only, no configured results. It cannot certify these pages by itself. Existing storage/wallet tests passed (17), including added large Unicode/checksum coverage. The 230-record cache checks verify invalidation, source attribution, account changes and count reuse. A timer harness verifies builder deferral and release.

After release: check real mobile search, typing, text selection, wallet opening, News Phi navigation and the same saved-history stress case. No actual user credentials or account balances are used for testing.

Rollback: revert this feature commit and let the existing Pages deployment rebuild. The storage envelope and data shape are unchanged; the previous runtime can read every saved record. Do not clear browser storage or create another wallet as a repair step.
