# Infinity OS — C13b0

A Next.js application and **Cartoon Prompt Engine** — a deterministic blueprint generator for 2D cel-shaded animation tiles at 24 fps.

---

## Two things in this repo

| Directory | What it is |
|-----------|-----------|
| `src/app/` | Next.js 16 web app (hydrogen host, P2P signal, 3D visualizer, game) |
| `cartoon-engine/` | Node.js CLI that generates animation blueprints — no video rendered |
| `src/token-engine/` | Browser keystroke + MIDI listener that triggers scenes from physical input |

---

## Cartoon Prompt Engine

### The core idea

The engine never renders video. It outputs **deterministic YAML/JSON blueprint files** that downstream tools (ComfyUI, lip-sync pipelines, 3D renderers) can consume. The same premise always produces the same files. That is the point.

One **tile** = one 30-second animation segment = **720 frames at 24 fps** — structured as 4 stitchable shots:

| Shot | Duration | Frames | Role |
|------|----------|--------|------|
| shot_01 | 3 s | 72 | Establishing / context |
| shot_02 | 9 s | 216 | Dialogue A + lip-sync |
| shot_03 | 9 s | 216 | Dialogue B + lip-sync |
| shot_04 | 9 s | 216 | Action beat + hook pose |

Every `shot_04` ends on a **hook pose** that matches the opening of the next tile, so tiles chain into full episodes without manual editing.

---

### Quick start

```bash
npm install

# Generate a tile (mouse character — default)
npm run generate

# Generate an Investor Gadget tile
npm run generate:gadget

# Run all 112 unit tests
npm test
```

Custom invocation:
```bash
npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts \
  --tile    tile_0003 \
  --character investor_gadget \
  --premise "Gadget intercepts a suspicious briefcase at the train station" \
  --out     my-output/
```

---

### Output files (per tile)

| File | Contents |
|------|----------|
| `<tile>.shots.yaml` | 4-shot blueprint with CharacterDNA consistency string in every shot |
| `<tile>.dialogue.txt` | Dialogue lines per shot, character-labelled |
| `<tile>.visemes.json` | Lip-sync skeleton — frame ranges for shot_02 and shot_03; fill `visemes[]` from audio |
| `<tile>.edl.json` | Edit decision list — shot ordering and exact frame ranges |
| `<tile>.physics.json` | Cartesian movement: `deltaX`, `deltaY`, `frames_to_target`, per-frame `frame_sequence` |
| `<tile>.verify.json` | 4-hash SHA-256 envelope to detect any tampering |

---

### Character registry

| ID | Archetype | Key DNA constants |
|----|-----------|-------------------|
| `mouse_01` | `character.mouse.cartoon.v1` | Gray fur `#D3D3D3`, round ears, long tail |
| `investor_gadget` | `character.investor_gadget.cartoon.v1` | Coat `#808080`, gloves `#FFD700`, chrome telescoping antenna |

**CharacterDNA is hard-coded** in `cartoon-engine/characters.ts`. The `prompt_descriptor` string is automatically appended to every generated frame prompt — no downstream tool ever needs to describe the character from scratch. Change it there and it propagates everywhere.

---

### Physics engine

The engine treats the frame as a normalised `[0, 1] × [0, 1]` Cartesian plane and calculates motion algebraically:

```
deltaX = target.x − initial.x
deltaY = target.y − initial.y
distance = √(deltaX² + deltaY²)
travel_time_s = distance / velocity_units_per_s
frames_to_target = round(travel_time_s × fps)
frame_sequence = linear interpolation from initial to target, one Vector2D per frame
```

**3D extension** (`cartoon-engine/physics3d.ts`) adds a Z-axis for camera depth and parallax. Set `DimensionMode = 'MESH_3D'` and every position becomes `{ x, y, z }`. Use this for:
- Camera dolly/truck moves (Z changes over time)
- Character depth within a scene (foreground ↔ background layers)
- 3D camera splines for complex shots

---

### 4-Hash verification

Every tile ships with a `<tile>.verify.json` containing four SHA-256 digests:

```
Hash 1 — story_hash    : SHA-256( premise JSON )
Hash 2 — geometry_hash : SHA-256( PhysicsMap JSON )
Hash 3 — dna_hash      : SHA-256( CharacterDNA JSON )
Hash 4 — master_hash   : SHA-256( hash1 + hash2 + hash3 )
```

If anything is modified — premise, geometry, or character DNA — `master_hash` will not match on re-computation. Use `verifyEnvelope()` from `cartoon-engine/verify.ts` to check programmatically.

---

### MIDI + keyboard scene triggers (`src/token-engine/`)

The token engine maps physical input to named animation scenes. It is browser-only — use it inside a Next.js Client Component.

**Keystroke patterns** (type the sequence, scene fires):

| Type | Pattern | Scene | Character |
|------|---------|-------|-----------|
| R-E-S-C-U-E | `KeyR KeyE KeyS KeyC KeyU KeyE` | `parking_lot_rescue` | investor_gadget |
| C-H-E-E-S-E | `KeyC KeyH KeyE KeyE KeyS KeyE` | `cheese_discovery` | mouse_01 |
| G-A-D-G-E-T | `KeyG KeyA KeyD KeyG KeyE KeyT` | `gadget_establishing` | investor_gadget |

**MIDI chord patterns** (hold all notes simultaneously):

| Chord | Notes | Scene | Character |
|-------|-------|-------|-----------|
| C major | C4 E4 G4 (60 64 67) | `parking_lot_rescue` | investor_gadget |
| G major | G3 B3 D4 (55 59 62) | `cheese_discovery` | mouse_01 |
| D minor | D4 F4 A4 (62 65 69) | `gadget_arm_extension` | investor_gadget |

When a MIDI chord fires, the note **velocity** maps to character movement speed and **pitch** maps to screen X position via `cartoon-engine/midi-physics.ts` — the performer's physical gesture directly controls the animation geometry.

Usage:
```typescript
'use client';
import { KeystrokeListener, MidiListener } from '@/token-engine/listener';
import { generateTileBlueprint } from '../../cartoon-engine/generator';

const keys = new KeystrokeListener((trigger) => {
  const tile = generateTileBlueprint(
    'tile_live', trigger.scene, 24, trigger.character_id
  );
  console.log(tile.blueprint.shots);
});
keys.start();
```

---

### How tiles stitch into a full episode

```
tile_0001 (30 s) → tile_0002 (30 s) → tile_0003 (30 s) → …
     └── shot_04 hook pose ──▶ shot_01 start pose (match cut)
```

A 20-minute episode = 40 tiles. Generate them sequentially; `stitching.end_hook_frame` on each tile tells the editor which pose bridges to the next.

The EDL files can be assembled by any NLE or custom compositor that reads JSON. The viseme files feed directly into 2D lip-sync compositors (mouth overlay method: one clean head plate + per-viseme mouth sprite per frame).

---

### ComfyUI integration

Each shot's `consistency` field is a complete ComfyUI positive prompt for that character. Feed it as the positive conditioning text. The `blocking` coordinates give character start/end positions for ControlNet pose guidance. The `physics.json` `frame_sequence` gives per-frame XY for motion path nodes.

---

## Next.js app

```bash
npm run dev    # development server at localhost:3000
npm run build  # production build
npm run lint   # ESLint
```

| Route | Description |
|-------|-------------|
| `/` | Home — emoji ID demo, feature cards, token game |
| `/research` | Research articles |
| `/hydrogen-host` | Generate emoji ID, manage contacts |
| `/visualizer` | Interactive 3D cube, signal wave, P2P network |
| `/game` | Token game — stages, stars, bugs |

## Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **Lucide React** icons
- **Jest + ts-jest** for cartoon-engine tests
- **js-yaml** for YAML blueprint output
- **Node.js `crypto`** (built-in) for SHA-256 hashes — no external crypto deps


## Marketplace sale + fulfillment implementation ledger

This section is an implementation contract, not a claim that every item is complete. Automation and agents should compare these requirements against the live code and mark an item complete only after code and runtime verification.

### Implemented / present in source
- [x] Test Mercury-dime advertisement card exists in the Infinity Phi runtime.
- [x] Collect action writes the advertisement into the shared Shop cart path.
- [x] Collected state uses the same live cart as the cart UI so browser-storage failure does not immediately undo the visible state.
- [x] Successful Collect requests one Control Phi collect credit, representing 0.1 StarCoin progress, with listing-ID deduplication.
- [x] Successful Collect requests that the Shop cart open so the collected card can be seen immediately.
- [x] Shop Phi can receive the seed query `Mercury dime` from the advertisement.

### Must be runtime-verified
- [ ] On the deployed Android page, one tap changes `Collect` to `Collected`.
- [ ] The exact Mercury-dime card appears in the visible Shop cart immediately after collection.
- [ ] Control Phi visibly reports the 0.1 StarCoin collection credit exactly once.
- [ ] Collected/cart state survives refresh and cross-device use after durable server persistence is added.
- [ ] Shop Phi provider tabs render real provider inventory inside Shop Phi rather than merely redirecting from the provider tab.

### Not built yet — sale/order backend
- [ ] Replace the current simulated 100-Quant checkout with a verified wallet transaction.
- [ ] Create a Cloudflare Worker order API and D1 order storage.
- [ ] Store order ID, listing ID, seller ID, buyer ID, amount, payment transaction ID, timestamps and fulfillment status.
- [ ] Store buyer shipping name/address as private fulfillment data; never embed shipping PII in a transferable Quant, StarCoin, public ledger, URL, advertisement, or public event.
- [ ] Authorize shipping-data reads so only the authenticated seller for that order and the buyer can access appropriate order data.
- [ ] Seller wallet inbox message: `Sale received · Mercury dime · 100 Quants · Ship item`.
- [ ] `Ship item` opens the private fulfillment record with order number and buyer-provided shipping information.
- [ ] Seller can mark order shipped and optionally add carrier/tracking.
- [ ] Buyer wallet/order history receives fulfillment status updates.
- [ ] Idempotency: one payment transaction can create only one order and one seller receipt.
- [ ] Never display `paid` or `100 Quants received` until the wallet transaction is server-verified.

### Agent/README continuity rule
For substantial Infinity/Phi subsystems, maintain a repository implementation ledger like this one. Requirements must be classified as implemented, runtime-verification-needed, or not-built. A bot must not infer completion from prose, a commit existing, or a UI mockup. Completion requires the relevant code plus verification evidence.

Claude-Flow/Monitor automation should use these ledgers as audit inputs: inspect unchecked items, compare them with repository/runtime state, create scoped repair jobs, and only change status after verification.
