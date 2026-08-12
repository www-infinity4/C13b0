# Infinity Project Merge Master Plan

Updated: 2026-08-12

## Operating rule: finish, verify, merge

Every implementation task follows one short lifecycle:

1. Start from the current default branch.
2. Change one coherent feature set in one repository.
3. Run the available syntax, data, build, and browser checks.
4. Record exactly what passed and what remains unverified.
5. Mark the pull request ready as soon as its stated work is complete.
6. Squash-merge it immediately.
7. Verify the resulting commit exists on `main` and the public page updates.
8. Close or clearly supersede obsolete and conflicted pull requests.

Draft pull requests are temporary workspaces, not storage. A completed change must not be left in draft status. If `main` moves and creates a conflict, rebuild the finished change on current `main`, test both sides together, merge the replacement, and close the obsolete PR.

## Status language

- **Merged:** implementation is on the default branch.
- **Open—review required:** code exists but needs a defined verification or conflict repair.
- **Main-only audit:** repository exists, but there is no open implementation PR to merge.
- **Design only:** the idea has documentation or conversation history but no verified implementation branch.
- **Production blocker:** a local demonstration exists, but shared accounts, server verification, deployment, rights, or durable data are missing.

## Priority 0 — shared foundation

### INFINITY shared wallet and entitlement service

**Merged foundation**

- `www-infinity4/INFINITY` PR #16: shared wallet/entitlement engine and novelty-research specification.
- `www-infinity4/INFINITY` PR #17: Avatar Coin central ledger.
- Adapters previously merged into Bitcoin Crusher, Alien Radio, Mario Spin, and Mint-For-Infinity.

**Production blocker**

The browser sites still do not share one authoritative balance. The next system must provide authenticated accounts, a durable database, idempotent action receipts, server-verified earning limits, signed commit/token binding, fraud controls, recovery, and a read API used by every live frontend. LocalStorage balances remain device-local demonstrations until this bridge is deployed.

**Definition of done**

- One user sees the same balance on two devices.
- Replaying an action cannot mint twice.
- Daily limits are enforced by the server, not browser time or cleared storage.
- Every accepted earning action stores source repository, full commit hash, action type, timestamp, verification state, and reversal history.
- No site needs a private signing secret in client JavaScript.

### Gitflow and Crown Index

**Merged 2026-08-12**

- `www-infinity4/Gitflow` PR #4: live commit-linked action-token pages, color routes, evidence, floor plans, robot queues, JSON export, and build-task creation.
- `www-infinity4/C13b0` PR #4: repository-first Crown Index and Infinity Auto Builder foundation.

**Next**

- Use the Crown Index as the permanent project inventory.
- Use Gitflow full commit SHAs as immutable token serials.
- Add deployment health, open-PR state, last verified date, and canonical public URL to every indexed repository.
- Never manufacture random commit activity; unavailable routes become visible red repair records.

## Priority 1 — revenue and daily-use applications

### Bitcoin Crusher — `www-infinity4/Bitcoin-Crusher`

**Merged**

- PR #4 merged 2026-08-12: product identity, current owner links, sourced-research purpose, and `site-identity.json`.
- Earlier wallet adapter and marker cleanup were merged in PRs #5 and #6.

**Next build**

1. Browser-test sign-in, spin, research, article viewer, history, export, drawer links, and mobile layout.
2. Replace any simulated research result with source-linked retrieval and an evidence record.
3. Store every completed article with canonical query, sources, timestamps, revision history, and content hash.
4. Connect verified spins and research actions to the shared server ledger; keep the free-spin and daily-limit rules server-side.
5. Keep `BitcoinCrusher.com` a suggested public identity until ownership and DNS are verified.
6. Merge each repaired slice immediately after its browser test.

### Alien Radio — `www-infinity4/Alien-Radio`

**Merged**

- PR #8 merged 2026-08-12: readable bottom work row, real Crossref/OpenAlex research, evidence separation, JSON export, GitHub build tasks, and Gitflow Token Lab routes.
- Earlier shared-wallet adapter and keyless-radio repairs are already merged.

**Open—review required**

- PR #5: Star Token Stage and Avatar Coin station prototype. It remains a draft and has not completed browser/accessibility testing.

**Next build**

1. Verify all radio channels, playback recovery, wallet modal, research search, DOI links, JSON export, and Gitflow links on Android.
2. Rebase PR #5 on current `main`; keep the working radio and new research row intact.
3. Test the Star marks, Token Studio, station identity, qualification timer, interruption reset, and local ledger.
4. Merge PR #5 immediately after those checks; production issuance remains blocked on authenticated server verification.
5. Add the literal Watcher status: source fetched, source failed, token queued, commit bound, or repair needed.

### Infinity Mint — `www-infinity4/Mint-For-Infinity`

**Merged**

- PR #5 merged 2026-08-12 after resolving conflicted PR #3.
- Current `main` combines the portrait-free IC note, local-calendar $10 limit, varying hash serials, signatures, attachments, Alien Mint mode, and keyless local Gemma/ShieldGemma moderation.
- Obsolete PR #3 is closed as superseded.

**Production blockers**

- Wallet and daily limit are still browser-local.
- Git commit binding remains provisional.
- The approved binary artwork is still missing at `infinity-mint/assets/infinity-capital-note-master.webp`.

**Next build**

1. Add the approved master artwork without replacing the working SVG fallback.
2. Preserve the required text, IC monogram, signature area, commit serial, and portrait-free design.
3. Bind each accepted mint to the shared account service and a permanent action receipt.
4. Enforce ten $1 notes / $10 per day on the server.
5. Add printable and wallet views from the same canonical note record.
6. Merge artwork, server binding, and print view as separate verified changes.

### StarQuest TV — `www-infinity4/TV-Database`

**Merged foundation**

- PRs #41 and #42: catalog/player/share repairs and archive audit work.
- PR #57: viewer-started Gemma/Cosmo companion, voice interaction, program research, sparse watch-along prompts, labeled sponsored suggestions, and local shopping list.

**Open—review required**

- PR #23: user-created worlds and renameable Cosmo. It was built on the old `agent/tv-player-repair` stack and must be rebuilt or retargeted on current `main` before merge.

**Next build**

1. Rebuild PR #23 on current `main` without losing the repaired player or current Cosmo.
2. Browser-test share buttons, hamburger, StarCoin counter, one-tap playback, search, For You variety, archive fallbacks, and companion start/stop.
3. Make shares payout-eligible only after server verification; client-only clicks remain visible but unverified.
4. Add per-title source records: playable file, rights/source page, captions, metadata, last check, and failure reason.
5. Keep companion speech sparse, interruptible, consent-controlled, and visibly label sponsored suggestions.
6. Merge the world builder immediately after the current-main browser pass.

### StarQuest companion repositories

- `www-infinity4/StarQuest` has open PR #1 (operating architecture) and PR #2 (MLB Watch research platform). Audit and test them separately; do not confuse them with the TV-Database player.
- `www-infinity4/StarQuestVideo` currently has no open PR. Classify whether it is a deployment surface, archive, or separate product before adding duplicate player code.

## Priority 2 — creation studios

### 3D Graphics Studio

**Canonical candidates**

- `www-infinity4/Infinity-Graphics` — existing graphics interface; no open PR.
- `www-infinity4/3d-world` — existing 3D project; no open PR.
- `www-infinity4/3D-Printer` — early repository; no open PR.
- `www-infinity4/Light-Field-Surface-Rendering-Virtual-Environments` — early research repository.

**Plan**

1. Audit the runnable routes and choose `Infinity-Graphics` as the studio shell unless the existing code proves unsuitable.
2. Import—not duplicate—the strongest scene, camera, material, lighting, text, extrusion, and export modules from `3d-world`.
3. Build readable pages for Scene, Object, Materials, Lighting, Animation, Render, Export, Research, and Commit Token.
4. Support browser-native project save/export before adding remote rendering.
5. Link exported objects and renders to their source commit tokens.
6. Create one PR per working studio module and merge it immediately.

### Cartoon Generator

**Canonical candidates**

- `www-infinity4/Cartoon-Generator` — substantial repository; no open PR.
- `www-infinity4/Digitoon` — related graphics/cartoon repository; no open PR.

**Plan**

1. Audit both products and choose one canonical editor; preserve the other as a source module or archive.
2. Build character, pose, expression, scene, speech, panel, timeline, audio, and export pages.
3. Add reusable character sheets so the same character remains visually consistent across scenes.
4. Separate procedural browser drawing from genuine model-backed image generation in the interface.
5. Record prompt, seed/settings, source images, rights notes, output hash, and commit token for every exported scene.
6. Merge the audit first, then editor modules one at a time.

### Image Generator — `www-infinity4/Image-Generator`

**Open—review required**

- PR #1 adds a slot, drawing canvas, token piano, microphone pitch detector, procedural canvas generator, local ledger, and browser authentication code.

**Important truth**

The current PR describes a procedural Canvas generator; that is not equivalent to a modern text-to-image AI model. The microphone and local password/encryption code also require explicit permission, security, and mobile lifecycle testing.

**Plan**

1. Review the entire diff for credential handling, microphone start/stop, background claims, storage limits, XSS, and mobile battery use.
2. Remove any misleading “always-on” behavior that the mobile browser cannot reliably provide.
3. Label procedural art and model-generated art as different engines.
4. Verify slot, drawing, image export, token ledger, piano, mic permission denial, and data deletion.
5. Replace the wordmark’s Infinity symbol with the word “Infinity.”
6. Merge PR #1 only after the above checks.
7. `www-infinity4/Image-Generator4` PR #1 is an unfinished duplicate; close or archive it after confirming no unique implementation exists.

### Collectible Card Studio

**Canonical source**

- `www-infinity4/Goudey-Tradition-Trading-Card-Company-LLC` contains the large card library and has no open PR.
- No verified standalone Card Generator repository was found.

**Plan**

1. Preserve the Goudey repository as the authoritative card/catalog source; do not bulk-rewrite its large asset history.
2. Add a studio module for exact-image placement, crop, border, title, set, year, serial, 1/1 mark, fine print, and front/back export.
3. Store templates separately from card images so a design can be reused without degrading the source image.
4. Add rights/source, artist/model, prompt, revision, asset hash, and commit token metadata.
5. Build mobile controls with a full-resolution export path.
6. Merge template engine, catalog browser, and export pipeline separately.

## Priority 3 — quantum and scientific systems

### Infinity Quantum Systems — `www-infinity4/Infinity-Quantum-Systems`

**Merged**

- PR #6 merged 2026-08-12: Static Coherence RF control design integrated into Resonant OS sections with measurement, sham controls, rollback, and safety boundaries.

**Related merged portal**

- `www-infinity4/Dual-Purpose` PR #2: interactive B₂O₃/electron-cloud research portal, evidence ledger, research-robot queue, and Boron Vault demonstration.

**Related repositories**

- `www-infinity4/Quantum-Physics-Metalurgy`
- `www-infinity4/Quantum-Surfacing-Decentralized-Identity-Network-DIN-`

**Plan**

1. Treat Infinity Quantum Systems as the canonical documentation and simulation hub instead of creating an empty duplicate `resonant-os` repository.
2. Add the Quantum Microphone, elemental/ratio tables, atomic-computer model, resonance calculators, field/geometry visualizers, sensor logging, experiment protocols, and searchable theory notebook as separate modules.
3. Keep established physics, engineering inference, testable hypothesis, speculative framework, and rejected claims visibly distinct.
4. Implement electron-cloud “place and time” first as an inspectable state/probability simulation and software-state model.
5. Require a physical state variable, observable, controls, uncertainty, energy accounting, and failure criterion before describing a material concept as a device.
6. Exclude hazardous synthesis, uncontrolled emissions, signal jamming, medical claims, and weapon functions.
7. Merge every completed calculator, visualizer, or document immediately.

## Priority 4 — planned but not yet implemented

### Auto Pen

No repository was found. Create it only after defining the first working job: transform a selected research/token record into an editable draft with sources and revision history. It must not publish automatically.

### Auto Me

No repository was found. Start with a local import/export format for user-owned history and preferences, explicit consent, deletion, and field-level provenance. Do not scrape private accounts or silently infer sensitive traits.

### 100+ site marker wave

The Wave registry and shared marker concepts exist, but rollout must follow the canonical component and server-ledger work. Each site receives at most the intentional anchors defined by its product, not a layer of unreadable markers on every word.

## Permanent merge checklist

For every PR:

- [ ] Based on current `main`
- [ ] Scope named in plain language
- [ ] Syntax/data checks pass
- [ ] Build passes when a build exists
- [ ] Android-width browser path checked
- [ ] Existing primary feature still works
- [ ] Security/privacy permissions checked
- [ ] Claims and money/reward states labeled truthfully
- [ ] Public links and asset paths resolve
- [ ] PR marked ready
- [ ] Squash-merged immediately
- [ ] Merge SHA recorded in Crown Index
- [ ] Live route checked after deployment
- [ ] Obsolete PR closed or marked superseded

## Next execution order

1. Shared authenticated wallet/action-receipt API and database.
2. TV-Database PR #23 rebuild and full StarQuest browser sweep.
3. Alien Radio PR #5 rebase, test, and merge.
4. Image-Generator PR #1 security/browser repair and merge; retire Image-Generator4 duplicate.
5. Audit and establish the canonical 3D Graphics Studio.
6. Audit Cartoon-Generator versus Digitoon and merge the first canonical editor page.
7. Add the Collectible Card Studio without rewriting the Goudey asset library.
8. Expand Infinity Quantum Systems module by module.
9. Create Auto Pen and Auto Me only from explicit, testable first functions.
