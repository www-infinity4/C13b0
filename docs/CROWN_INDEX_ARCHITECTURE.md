# Crown Index — C13b0 Discovery Backbone

## Purpose

Crown Index is the shared discovery, provenance, ranking, and generation backbone for Infinity systems. It is not only a web-search page. It is the layer that:

- scans approved sources;
- normalizes websites, repositories, media, coins, avatars, cards, research records, and generated worlds into one index;
- preserves source and ownership history;
- ranks results transparently;
- gives Infinity AI structured evidence;
- gives the Builder Agent enough verified material to generate a site;
- supplies StarQuest with Star Coin and Avatar Coin identities;
- connects Portal, Treasury, marketplace, and token systems.

Recovered architecture from prior conversations:

```text
Treasury ↔ Portal ↔ Crown Index
                    ↓
Research Agent → evidence and source records
Builder Agent  → generated websites and experiences
Token Manager  → token/coin pages and sale records
Orchestrator   → job coordination
Code Review    → security and standards gate
```

The wider Mongoose.OS design treats repositories as machines. Crown Index is the searchable registry and routing layer that allows those machines to be discovered and combined.

## Core rule

Crown Index must never treat “found,” “generated,” “verified,” “owned,” and “valuable” as the same thing.

Every item carries explicit states:

- discovery status;
- source type;
- source authority;
- ownership status;
- identity verification;
- rights verification;
- generated/edited/original state;
- ranking score and score explanation;
- speculative versus completed value;
- privacy level;
- security review status.

## Indexed entity types

```text
website
page
repository
article
paper
image
video
audio
person
organization
project
product
trading-card
coin
star-coin
avatar-coin
coupon
event
world
scene
character
research-record
calculation
sensor-session
```

## Crown Record

A Crown Record is the canonical envelope for every indexed entity.

```ts
interface CrownRecord {
  id: string;
  entityType: CrownEntityType;
  canonicalUrl?: string;
  title: string;
  summary: string;
  text: string;
  tags: string[];
  sources: CrownSource[];
  owner?: CrownIdentityRef;
  creator?: CrownIdentityRef;
  rights: CrownRights;
  provenance: CrownProvenanceEvent[];
  verification: CrownVerification;
  ranking: CrownRankingSignals;
  relationships: CrownRelationship[];
  assets: CrownAssetRef[];
  value?: CrownValueRecord;
  starQuest?: StarQuestIdentity;
  generatedSite?: GeneratedSiteRecord;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: string;
  updatedAt: string;
}
```

## Scanner architecture

The scanner is permission-aware and modular.

```text
Seed Queue
→ Policy Gate
→ Fetch Adapter
→ Content Parser
→ Canonicalizer
→ Duplicate/Variant Detector
→ Rights and Identity Classifier
→ Safety Scanner
→ Crown Record Builder
→ Search Index
→ Relationship Graph
→ Builder Queue
```

### Approved scan sources

- user-supplied URLs;
- public pages that permit crawling;
- connected GitHub repositories;
- user-owned uploads;
- authorized public APIs;
- sitemaps and feeds;
- manually submitted StarQuest/coin/avatar records.

### Prohibited scanner behavior

- bypassing authentication;
- ignoring robots or source terms;
- scraping private accounts;
- collecting hidden personal data;
- copying copyrighted media into generated sites without permission;
- executing remote scripts;
- following unbounded link traps;
- indexing secrets, tokens, private keys, or credentials;
- generating false celebrity endorsements;
- assigning market value from attention alone.

## Search and ranking

Crown Index should provide multiple ranking views rather than one opaque universal score:

- Relevance
- Freshness
- Trust
- Originality
- Creator authority
- Community interest
- StarQuest compatibility
- Completed-market evidence
- Personal collection relevance
- Infinity ecosystem usefulness

The default rank combines normalized signals:

```text
score =
  0.30 relevance
+ 0.16 sourceTrust
+ 0.12 provenanceCompleteness
+ 0.10 freshness
+ 0.08 originality
+ 0.08 relationshipStrength
+ 0.06 accessibilityQuality
+ 0.05 communityInterest
+ 0.05 securityQuality
```

No paid placement may secretly alter organic ranking. Sponsored results must be labeled and separated.

## AI site-generation pipeline

Crown Index does not simply copy the highest-ranked page. The site generator receives a verified evidence bundle:

```text
User intent
→ Crown search
→ diversified source set
→ rights filter
→ contradiction and duplicate analysis
→ content plan
→ asset manifest
→ component plan
→ generated preview
→ code/security review
→ owner approval
→ publish
→ re-index generated site with provenance
```

A generated page must retain citations or source references for factual material and must record which assets were generated, supplied, licensed, or linked.

## StarQuest backbone

StarQuest uses Crown Index for identity and provenance.

### Star Coin

A Star Coin represents a project, creator, character, world, achievement, or approved public identity.

### Avatar Coin

An Avatar Coin represents the user-controlled visual identity used across StarQuest worlds.

The index stores:

- permanent Crown ID;
- display name;
- current avatar asset;
- prior avatar versions;
- world memberships;
- coin serial and edition;
- creator/owner rights;
- public verification state;
- linked cards, coupons, tickets, achievements, and media;
- wallet destination reference;
- revocation/recovery events;
- privacy and discoverability settings.

A typed name alone never proves a public figure created or endorsed a coin.

## Token-to-webpage-to-sale integration

```text
Crown identity
→ verified asset capsule
→ Builder Agent page
→ Token Manager edition
→ Portal discovery
→ Treasury transaction record
→ Crown provenance update
```

Completed sale data is separate from speculative value, asking price, attention, likes, and internal reward points.

## Search surfaces

Crown Index should power:

- public web search;
- Infinity repository search;
- research search;
- card and coin search;
- StarQuest people/world search;
- personal library search;
- generated-site search;
- visual similarity search;
- relationship graph exploration;
- “build a site from these results.”

## Security design

- server-side fetch workers;
- strict URL allow/deny rules;
- DNS rebinding and SSRF protection;
- content-size and timeout limits;
- MIME verification;
- HTML sanitization;
- no remote script execution;
- malware scanning for uploads;
- immutable provenance events;
- signed manifests;
- per-user quotas;
- rate limiting;
- isolated preview environments;
- audit logs;
- secret scanning before indexing;
- encryption for private records;
- hardware-backed/passkey account authorization where available.

No system can guarantee zero possibility of compromise. Crown Index must use defense in depth, reproducible builds, and reviewable records rather than claiming absolute immunity.

## Initial C13b0 implementation

This branch introduces:

- shared Crown Index types;
- deterministic ranking functions;
- scan-policy and normalization helpers;
- StarQuest Star Coin and Avatar Coin records;
- generated-site evidence bundles;
- seed examples and tests in later passes.

It does not yet operate a production crawler or public search cluster.