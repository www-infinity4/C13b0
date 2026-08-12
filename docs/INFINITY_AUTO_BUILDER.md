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
