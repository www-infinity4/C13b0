# Infinity Cloudflare Builder

This Worker is the authoritative service behind personalized Infinity site generation, optional business/storefront upgrades, user history, and wallet-to-wallet token transfers.

## What it enforces

- D1, not browser storage, owns balances and completed transfers.
- Transfers create matching debit and credit entries in one D1 batch.
- An idempotency key prevents a retry from transferring twice.
- A database trigger rejects overdrafts.
- Business and storefront data attach to an existing site token as upgrades.
- Every build stores a multi-axis variation fingerprint. A new plan is rejected and rerolled when it overlaps too closely with that user's recent builds.
- User history influences secondary terms and presentation choices but never replaces the requested subject.
- Fifteen verified forks are registered in `src/lib/plugin-index.ts`. The router calls up thirteen core website capabilities and adds business/storefront capabilities only when the upgrade or indexed terms require them.
- Actual fork services are supplied through `PLUGIN_ENDPOINTS_JSON`. Every selected role emits a receipt: `INDEXED_REFERENCE` when its repository contract is active but has no service, `EXECUTED` after a successful endpoint response, or `FAILED` with a bounded error.
- Plugin work runs in ordered phases (`discover`, `reason`, `compose`, `business`, `verify`), with independent roles inside a phase allowed to run concurrently. Later endpoints receive successful earlier results.
- Workers AI is optional and only runs when both the `AI` binding and `AI_MODEL` are configured. The deterministic script builder remains available otherwise.

## Routes

- `GET /health`
- `POST /v1/admin/session` — protected provisioning route; returns a session token once
- `POST /v1/admin/issue` — protected, idempotent credit issuance into a known wallet
- `POST /v1/history/events`
- `POST /v1/builds/plan`
- `POST /v1/storefronts`
- `POST /v1/transfers`
- `GET /v1/wallets/:walletId/balance`

All `/v1` routes except provisioning require `Authorization: Bearer <session token>`. The static GitHub Pages client must never contain `ADMIN_SECRET` or `PLUGIN_SERVICE_TOKEN`.

## Deployment checklist

1. Create the D1 database and replace the placeholder database ID in `wrangler.jsonc`.
2. Apply `migrations/0001_infinity_builder.sql`.
3. Set `ADMIN_SECRET` as a Worker secret.
4. Set `PLUGIN_SERVICE_TOKEN` only if the configured plugin endpoints require it.
   Start from `plugin-endpoints.example.json`; a repository URL is not an execution endpoint. Each value must be the HTTPS URL of a narrow adapter deployed from the corresponding fork.
5. Set `AI_MODEL` to the chosen model after verifying it is available in the Cloudflare account.
6. Add the deployed Worker origin as `NEXT_PUBLIC_INFINITY_BUILDER_API` when building C13b0.
7. Provision a user session through the protected route and keep it in session storage or replace provisioning with the final account sign-in flow.

The Worker intentionally does not claim eBay integration. A future marketplace adapter can map a storefront catalog to eBay only after approved OAuth, seller consent, listing validation, and API credentials exist.
