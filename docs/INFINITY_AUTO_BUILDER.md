# Infinity Auto Builder

The Auto Builder is the production loop that turns the Crown Index repository catalog into an active improvement system.

## Aim

Every site should move through a repeatable maturity path:

```text
prototype → functional → polished → production
```

The Builder does not rename repositories just to improve presentation. A repository such as
`www-infinity4/Bitcoin-Crusher` may keep that durable code address while presenting the product as
**Bitcoin Crusher** and carrying a suggested public identity such as **BitcoinCrusher.com**.

A suggested domain is not treated as owned or connected until registration, DNS, TLS, and the deployed
site have been verified.

## Continuous bloom cycle

1. **Scan** repository roots, README files, routes, assets, commands, dependencies, deployments, and security signals.
2. **Shape** the public identity, information architecture, audience, and central product journey.
3. **Build out** missing explanations, demonstrations, tools, pages, data, and meaningful interactions.
4. **Format** responsive layouts, navigation, typography, component consistency, accessibility, and visual hierarchy.
5. **Verify** tests, production build, browser behavior, links, source claims, performance, and security.
6. **Publish** only after the review gate passes.
7. **Re-index** the verified result with provenance and begin the next measured cycle.

## Guardrails

- No silent production publishing.
- No destructive repository merging or deletion.
- No invented validation, citations, deployments, domain ownership, or security guarantees.
- Every change is linked to a scan finding and acceptance criteria.
- Blockers and major defects come before visual expansion.
- User work and unique repository history are preserved.
- Generated factual content keeps its evidence and source links.
- A failed validation blocks publishing and creates a new Builder finding.

## Current implementation

`src/builder/auto-builder.ts` defines:

- public site identity records;
- repository scan results;
- maturity scores;
- evidence-backed findings;
- prioritized Builder actions;
- the review-required publishing gate;
- the initial Bitcoin Crusher blueprint.

The `/builder` page makes the workflow visible. The next implementation pass should connect these
records to live GitHub inventory scanning, branch creation, isolated previews, browser verification,
and Crown Index provenance updates.

## Personalized Cloudflare build layer

`cloudflare/infinity-builder/worker.ts` and `src/lib/site-variation.ts` add the durable generation layer:

- each user has an ordered research/build history in D1;
- current subject, chosen aims, added search terms, token identity, requested upgrades, and prior site fingerprints become generation inputs;
- layout, palette, typography, narrative order, interaction pattern, illustration direction, and plugin route form the variation fingerprint;
- the duplicate detector retries when a new fingerprint is more than 20% similar to the closest prior site, forcing at least four of the six major design axes to change;
- history contributes secondary context but cannot silently replace the requested subject;
- Business and Storefront are optional upgrades attached to the existing site token;
- the server stores structured scripts and provenance for later rendering and review;
- wallet-to-wallet transfers use an immutable double-entry D1 ledger with idempotency and overdraft protection.

The fifteen plugin roles are stable orchestration slots. Their actual fork endpoints must be configured explicitly; an empty slot is never reported as having executed.
