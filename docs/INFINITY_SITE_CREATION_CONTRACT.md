# Infinity Site Creation Contract

**Status:** Required default for every new Infinity web project.

A site is not complete when only its application feature works. C13b0/site-builder must bootstrap the common Infinity infrastructure at creation time and the scanner must verify it afterward.

## Required build output

Every new site must ship with:

- working application entry point (never README-only when the project is intended to be a site)
- mobile-first layout
- GitHub-ready repository structure
- deployment configuration appropriate to the detected framework
- current centralized Infinity unified-wallet client
- visible Share/Post control with native Web Share where supported and X/Twitter share fallback
- project-specific 1200x630 social preview artwork that visually explains the project's actual purpose
- Open Graph metadata (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
- X/Twitter large-card metadata
- canonical URL
- meaningful title and description
- README explaining purpose, architecture, run/deploy path, and public URL
- basic runtime/error handling
- `infinity-site.json` scanner manifest

## Framework adapters

C13b0 must detect before modifying:

- `static-html`: inject metadata/scripts/components into the actual HTML entry point.
- `next-app`: use App Router metadata/layout and public assets.
- `vite-react` / React SPA: update HTML shell plus application component mount.
- `streamlit` / server app: do not paste browser HTML into README; create the framework-appropriate shell/deployment path.
- `worker` / API-only / research-only: classify it instead of pretending it is a GitHub Pages site.

Unknown frameworks are marked `needs-adapter`; they are not blindly rewritten.

## Central components

Common wallet/share/community code is versioned centrally. Sites reference the current compatible release rather than receiving independent frozen copies. Project identity, preview artwork, metadata, application code, and manifest stay inside each repository.

## Scanner manifest

Each site should include `infinity-site.json` with at least:

```json
{
  "schema": "infinity-site/v1",
  "siteId": "repo-name",
  "title": "Human readable title",
  "purpose": "One sentence describing what the site does",
  "framework": "static-html",
  "canonicalUrl": "",
  "preview": "share-preview.png",
  "wallet": { "required": true },
  "share": { "required": true },
  "readme": { "required": true },
  "deployment": { "required": true },
  "ai": { "mode": "none", "fallback": "none" }
}
```

The scanner verifies the manifest against the repository and deployed page rather than trusting the manifest alone.

## Scanner states

- GREEN: deployable/live and contract-compliant
- YELLOW: site exists but required pieces are incomplete
- RED: intended site is broken or has no usable application entry point
- PURPLE: AI/runtime dependency needs repair or fallback
- BLUE: non-site/research/API repository; preserve and document rather than forcing a webpage

## AI rule

Local WebGPU AI is an optimization, never the only application path. A site that requests AI must capability-test WebGPU/model loading and expose a configured server/Worker/API fallback. Device storage, browser quota, GPU memory, unsupported browser APIs, or model download failure must not be reported as generic `storage full` errors.

## Coin / ledger rule

Coins and balances must not depend on browser `localStorage` as the authoritative ledger. Browser storage may be an offline cache. Durable balances, receipts, watch/share progress, and idempotency belong in a server-side ledger. Quota/storage errors must identify the exact failing storage operation and must not silently discard a reward.

## Completion gate

Before C13b0 reports a new web project complete, it must answer YES to:

1. Does the intended application render?
2. Does it have a README?
3. Is the deployment path valid for its framework?
4. Is the canonical URL configured or explicitly pending deployment?
5. Is the unified wallet installed?
6. Is Share/Post installed?
7. Is project-specific preview artwork present and referenced by OG/X metadata?
8. Is the scanner manifest present?
9. If AI is required, is capability detection plus fallback present?
10. If rewards/coins are used, is durable-ledger configuration present rather than local-storage-only accounting?

This contract is the default meaning of **build an Infinity website**. These requirements should not need to be requested again on later projects.
