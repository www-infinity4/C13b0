# Cloudflare Machine Inventory

This record distinguishes a deployed Cloudflare resource from a completed Infinity machine.

## Connected account

- Account label: connected Cloudflare account
- Account ID: intentionally omitted from public source
- Workers subdomain: `marvaseater.workers.dev`
- Evidence source: read-only Cloudflare API inspection on 2026-08-23

The ChatGPT login and Cloudflare login do not need to use the same email. The current connector is authorized to this Cloudflare account only.

## Core Worker snapshot

| Worker | Bindings observed | Intended machine | Current state |
|---|---|---|---|
| `infinity-ledger` | D1 `DB` (identifier redacted) | Shared wallet and ledger foundation | Partial; client and ownership verification remain |
| `starquest-ledger` | D1 `DB` (identifier redacted), connector secret | StarQuest event and Star Coin ledger | Partial; live browser flow remains unverified |
| `infinity-rogers` | D1 `DB` (identifier redacted), model-provider secret | Shared conversational AI | Partial; client, authorization, and response checks remain |
| `infinity-dashboard-watson-ai` | None | Earlier dashboard shell | Legacy; no canonical repository mapping |

Secret values are never copied into this repository. Only the binding names and types are inventoried.

## Health rule

A resource may be marked `operational` only when all of these are true:

1. The Cloudflare resource exists and has a current deployment.
2. A canonical GitHub repository owns its source.
3. Required bindings exist.
4. The public or authenticated health route responds correctly.
5. At least one real client completes its intended end-to-end flow.
6. Logs and receipts show the result was persisted.
7. Security and regression checks pass.

Until then it remains `partial`, `legacy`, or `unknown` even if Cloudflare reports a successful upload.

## Next census step

Replace the checked-in snapshot with a server-side C13b0 census job that reads Cloudflare and GitHub, writes sanitized machine records, compares them with the previous census, and creates repair actions for drift. The census must never expose secrets or silently delete legacy deployments.
