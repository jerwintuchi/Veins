# Design — Real Contract Generation

> Phase 4, spec 2. See `requirements.md` for R# IDs. Depends on spec 1 types
> (`TraitRoll`, `Tier`, `generateTraitRoll`). No new wire events in this spec;
> the existing `ROOM_DEPLOYING` event is updated to carry `ContractIntel` instead
> of `StubContract`.

---

## Scope

Replace the Phase 3 `StubContract` placeholder with a typed `ContractRecord` that:
- Carries a real `TraitRoll` server-side (from spec 1)
- Carries an expedition seed (the single entropy source for a run)
- Exposes only `ContractIntel` to the client (the wire-safe view)

No sign delivery in this spec — that is spec 3. No probing — that is spec 4.

---

## Data Models

### Shared — `src/shared/src/contract.ts`

```typescript
import type { Tier } from './signs.js';

export type PrimaryVerb = 'INVESTIGATE' | 'ELIMINATE' | 'CAPTURE' | 'BANISH';

export type ContractIntel = {
  contractId:  string;
  tier:        Tier;
  targetName:  string;
  siteName:    string;
  primaryVerb: PrimaryVerb;
};
```

`StubContract` is removed from `src/shared/src/lobby.ts` and everywhere. `ContractIntel`
replaces it in:
- `LobbySnapshot.contract: ContractIntel | null`
- `RoomDeployingPayload.contract: ContractIntel`

### Server-only — `src/server/src/incarnate/contractRecord.ts`

```typescript
import type { ContractIntel } from '@testament/shared';
import type { TraitRoll } from './types.js';

export type ContractRecord = ContractIntel & {
  expeditionSeed: string;
  traitRoll:      TraitRoll;
};
```

`RoomRecord.contract` changes from `StubContract | null` to `ContractRecord | null`.

---

## Algorithms

### A12 — generateContract

**Input:** `rng: Rng`, `tier: Tier`, `contractId: string`, `expeditionSeed: string`
**Output:** `ContractRecord`

```
const TARGET_NAMES  = ['The Ashen Warden', 'The Weeping Mire', 'The Frost Penitent', 'The Rot-Bloom']
const SITE_NAMES    = ['The Collapsed Chancel', 'The Salt Marsh', 'The Ember Reach', 'The Sunken Nave']
const PRIMARY_VERBS: PrimaryVerb[] = ['INVESTIGATE', 'ELIMINATE', 'CAPTURE', 'BANISH']

function generateContract(rng, tier, contractId, expeditionSeed):
  return {
    contractId,
    tier,
    expeditionSeed,
    targetName:  rng.pick(TARGET_NAMES),
    siteName:    rng.pick(SITE_NAMES),
    primaryVerb: rng.pick(PRIMARY_VERBS),
    traitRoll:   generateTraitRoll(rng, tier),
  }
```

The call site (`handleAcceptContract`) is responsible for generating entropy:
```typescript
import { randomUUID } from 'node:crypto';
import { createRng, hashSeed } from '../rng/seeded.js';

const expeditionSeed = randomUUID();
const contractId     = randomUUID();
const rng            = createRng(hashSeed(expeditionSeed));
const contract       = generateContract(rng, 'APPRENTICE', contractId, expeditionSeed);
```

### A13 — toContractIntel

**Input:** `contract: ContractRecord`
**Output:** `ContractIntel`

```typescript
function toContractIntel({ expeditionSeed: _, traitRoll: __, ...intel }: ContractRecord): ContractIntel {
  return intel;
}
```

`toSnapshot` in `snapshot.ts` calls this before building `LobbySnapshot`:
```typescript
contract: room.contract ? toContractIntel(room.contract) : null
```

---

## Correctness Properties

**P17**: Contract opacity — `toContractIntel` output has exactly the five `ContractIntel`
fields; `expeditionSeed` and `traitRoll` are absent. [R46, R48]

**P18**: Determinism — `generateContract` with the same arguments produces identical output;
all randomness flows through `rng`. [R44, R47]

**P19**: Server containment — `ContractRecord` never appears in `@testament/shared`. The
snapshot path (`toSnapshot → toContractIntel`) is the only route from a `ContractRecord`
to a client-facing payload, and it strips server-only fields. [R42, R45, R46, R48]

---

## Files Touched

| File | Change |
|------|--------|
| `src/shared/src/contract.ts` | NEW — `PrimaryVerb`, `ContractIntel` |
| `src/shared/src/lobby.ts` | Remove `StubContract`; `LobbySnapshot.contract` → `ContractIntel \| null` |
| `src/shared/src/lobbyMessages.ts` | `RoomDeployingPayload.contract` → `ContractIntel` |
| `src/shared/src/index.ts` | Add `export * from './contract.js'` |
| `src/server/src/incarnate/contractRecord.ts` | NEW — `ContractRecord` server-only type |
| `src/server/src/incarnate/generateContract.ts` | NEW — `generateContract`, `toContractIntel` |
| `src/server/src/rooms/types.ts` | `contract: StubContract \| null` → `ContractRecord \| null` |
| `src/server/src/rooms/snapshot.ts` | Call `toContractIntel` before building `LobbySnapshot` |
| `src/server/src/rooms/fieldData.ts` | Parameter type `StubContract` → `ContractIntel` |
| `src/server/src/rooms/handlers/acceptContract.ts` | Replace stub with `generateContract` |
| `src/server/src/rooms/stubContract.ts` | DELETED — superseded by `generateContract` |

---

## Satisfies Requirements

R42, R43, R44, R45, R46, R47, R48
