# Wallet recovery: October 4, 2026

Observed on the live /infinity-phi/ route: a client exception in formatWalletId
(`Cannot read properties of undefined (reading 'length')`). The shared wallet
can contain cloud records with `id` instead of C13b0's `walletId`.

The reader now accepts either field, or the already-selected wallet map key.
It preserves the wallet record, balances, token IDs and selected identity.
Malformed local/cache/cookie records no longer reach the header unchecked.
No balance reconstruction, mint, account creation, or ledger migration is part
of this repair.

Verification: the ten wallet tests pass, including cloud id records, a legacy
map record, prior local recovery, shared-client recovery and identity formatting.

Preserve previous responsiveness fixes: 3e6196b (saved history), 8d54ea9
(first-page wallet work), and the storage/event-loop repairs from October 3.

Related gateway repair belongs to QuantaPhi: the old GitHub storage bridge
must keep its original origin when the .org gateway rewrites navigation.
The .org /__wallet-handoff endpoint must serve the recovery page. That page
must keep its return-origin allowlist and credential selection protections.
