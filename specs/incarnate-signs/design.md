# Design — Incarnate Trait Schema & Sign Language

> Phase 4, spec 1. See `requirements.md` for R# IDs. No handler wiring in this
> spec; all deliverables are shared types and pure server functions. The existing
> `Rng` from `src/server/src/rng/seeded.ts` is reused as-is (I3).

---

## Scope

This spec delivers the **model layer only**: types, a data table, and two pure functions.
No server handler is modified. Signs are not yet broadcast in this spec; that wiring
occurs in the probing spec (Phase 4, spec 3) when `PROBE` and ambient-sign delivery
are added. The separation keeps this spec's surface area small and its tests fast.

---

## Data Models

All types marked **shared** belong in `src/shared/src/signs.ts` and are exported
from `@testament/shared`. Types marked **server-only** belong in
`src/server/src/incarnate/` and must never appear in `@testament/shared`.

### Shared types

```typescript
// src/shared/src/signs.ts

export type Channel =
  | 'RESIDUE'       // Aspect axis  — marks on the site
  | 'STRESS_MARK'   // Frailty axis — reaction when hurt
  | 'REACTION'      // Ward axis    — response to a probe
  | 'SPOOR'         // Disposition  — tracks and movement cadence
  | 'LITURGY'       // RiteKey axis — sigils and devotional resonance
  | 'OMEN';         // Tell axis    — wind-up cue before lethal strike

export type SignToken = string;  // opaque slug, e.g. 'weeping-wax', 'frost-rime'

export type Sign = {
  channel: Channel;
  token:   SignToken;
  // No axis, no value, no trait field — only what the client may receive.
};

export type Tier = 'APPRENTICE' | 'JOURNEYMAN' | 'MASTER';
```

### Server-only trait types

```typescript
// src/server/src/incarnate/types.ts

import type { Tier } from '@testament/shared';

export type TraitAxis =
  | 'ASPECT' | 'FRAILTY' | 'WARD'
  | 'DISPOSITION' | 'RITE_KEY' | 'TELL';

// V1 value sets — 4 values per axis keeps the lexicon small and testable.
export type AspectValue      = 'EMBER' | 'FROST' | 'ROT'  | 'MIRE';
export type FrailtyValue     = 'FLAME' | 'COLD'  | 'SALT' | 'LIGHT';
export type WardValue        = 'FLAME' | 'COLD'  | 'SALT' | 'LIGHT';
export type DispositionValue = 'STALKER' | 'AMBUSHER' | 'TERRITORIAL' | 'FRENZIED';
export type RiteKeyValue     = 'PENANCE' | 'IMMOLATION' | 'INTERMENT' | 'SILENCE';
export type TellValue        = 'LUNGE'   | 'SWEEP'      | 'RECOIL'    | 'SHUDDER';

// Three required (Apprentice tier); three optional (Journeyman+/Master).
export type TraitRoll = {
  aspect:       AspectValue;
  frailty:      FrailtyValue;
  tell:         TellValue;
  ward?:        WardValue;          // Journeyman+
  disposition?: DispositionValue;   // Journeyman+
  riteKey?:     RiteKeyValue;       // Master only
};

// Active axes per tier, ordered Aspect-first (consistent with sign broadcast order).
export const ACTIVE_AXES: Record<Tier, ReadonlyArray<TraitAxis>> = {
  APPRENTICE: ['ASPECT', 'FRAILTY', 'TELL'],
  JOURNEYMAN: ['ASPECT', 'FRAILTY', 'TELL', 'WARD', 'DISPOSITION'],
  MASTER:     ['ASPECT', 'FRAILTY', 'TELL', 'WARD', 'DISPOSITION', 'RITE_KEY'],
};
```

### Sign lexicon

```typescript
// src/server/src/incarnate/lexicon.ts

import type { Channel, SignToken } from '@testament/shared';
import type { TraitAxis } from './types.js';

export type LexiconEntry = {
  axis:    TraitAxis;
  value:   string;
  channel: Channel;
  token:   SignToken;
};

export const SIGN_LEXICON: ReadonlyArray<LexiconEntry> = [
  // ASPECT → RESIDUE
  { axis: 'ASPECT', value: 'EMBER', channel: 'RESIDUE',     token: 'scorched-wax'        },
  { axis: 'ASPECT', value: 'FROST', channel: 'RESIDUE',     token: 'frost-rime'           },
  { axis: 'ASPECT', value: 'ROT',   channel: 'RESIDUE',     token: 'rot-bloom'            },
  { axis: 'ASPECT', value: 'MIRE',  channel: 'RESIDUE',     token: 'weeping-clay'         },
  // FRAILTY → STRESS_MARK
  { axis: 'FRAILTY', value: 'FLAME', channel: 'STRESS_MARK', token: 'flinch-from-flame'   },
  { axis: 'FRAILTY', value: 'COLD',  channel: 'STRESS_MARK', token: 'flinch-from-cold'    },
  { axis: 'FRAILTY', value: 'SALT',  channel: 'STRESS_MARK', token: 'flinch-from-salt'    },
  { axis: 'FRAILTY', value: 'LIGHT', channel: 'STRESS_MARK', token: 'flinch-from-light'   },
  // WARD → REACTION (probe-driven; Ward axis is only observable via active probing)
  { axis: 'WARD', value: 'FLAME', channel: 'REACTION', token: 'drinks-flame'              },
  { axis: 'WARD', value: 'COLD',  channel: 'REACTION', token: 'drinks-cold'               },
  { axis: 'WARD', value: 'SALT',  channel: 'REACTION', token: 'drinks-salt'               },
  { axis: 'WARD', value: 'LIGHT', channel: 'REACTION', token: 'drinks-light'              },
  // DISPOSITION → SPOOR
  { axis: 'DISPOSITION', value: 'STALKER',     channel: 'SPOOR', token: 'trailing-spoor'  },
  { axis: 'DISPOSITION', value: 'AMBUSHER',    channel: 'SPOOR', token: 'still-spoor'     },
  { axis: 'DISPOSITION', value: 'TERRITORIAL', channel: 'SPOOR', token: 'boundary-marks'  },
  { axis: 'DISPOSITION', value: 'FRENZIED',    channel: 'SPOOR', token: 'erratic-spoor'   },
  // RITE_KEY → LITURGY
  { axis: 'RITE_KEY', value: 'PENANCE',    channel: 'LITURGY', token: 'kneeling-sigil'    },
  { axis: 'RITE_KEY', value: 'IMMOLATION', channel: 'LITURGY', token: 'flame-rune'        },
  { axis: 'RITE_KEY', value: 'INTERMENT',  channel: 'LITURGY', token: 'burial-mark'       },
  { axis: 'RITE_KEY', value: 'SILENCE',    channel: 'LITURGY', token: 'voided-glyph'      },
  // TELL → OMEN
  { axis: 'TELL', value: 'LUNGE',   channel: 'OMEN', token: 'drawn-breath-and-lean'       },
  { axis: 'TELL', value: 'SWEEP',   channel: 'OMEN', token: 'wide-shoulder-coil'          },
  { axis: 'TELL', value: 'RECOIL',  channel: 'OMEN', token: 'backward-step-brace'         },
  { axis: 'TELL', value: 'SHUDDER', channel: 'OMEN', token: 'full-body-tremor'            },
];
```

---

## Algorithms

### A10 — deriveSigns

**Input:** `traits: TraitRoll`, `tier: Tier`
**Output:** `Sign[]` — length equals `ACTIVE_AXES[tier].length`

```
function deriveSigns(traits, tier):
  signs = []
  for axis in ACTIVE_AXES[tier]:
    field = AXIS_TO_FIELD[axis]   // 'ASPECT' -> 'aspect', etc.
    value = traits[field]
    entry = SIGN_LEXICON.find(e => e.axis === axis && e.value === value)
    if entry is undefined:
      throw Error(`lexicon missing entry: ${axis} / ${String(value)}`)
    signs.push({ channel: entry.channel, token: entry.token })
  return signs
```

Where `AXIS_TO_FIELD` is a compile-time constant record:
```typescript
const AXIS_TO_FIELD: Record<TraitAxis, keyof TraitRoll> = {
  ASPECT:      'aspect',
  FRAILTY:     'frailty',
  TELL:        'tell',
  WARD:        'ward',
  DISPOSITION: 'disposition',
  RITE_KEY:    'riteKey',
};
```

**Invariant:** the returned objects contain only `channel` and `token`; no `axis`,
`value`, or any other field is added. This is enforced by the object literal shape.

### A11 — generateTraitRoll

**Input:** `rng: Rng` (from `src/server/src/rng/seeded.ts`), `tier: Tier`
**Output:** `TraitRoll`

```
const ASPECT_VALUES:      readonly AspectValue[]      = ['EMBER','FROST','ROT','MIRE']
const FRAILTY_VALUES:     readonly FrailtyValue[]     = ['FLAME','COLD','SALT','LIGHT']
const TELL_VALUES:        readonly TellValue[]        = ['LUNGE','SWEEP','RECOIL','SHUDDER']
const WARD_VALUES:        readonly WardValue[]        = ['FLAME','COLD','SALT','LIGHT']
const DISPOSITION_VALUES: readonly DispositionValue[] = ['STALKER','AMBUSHER','TERRITORIAL','FRENZIED']
const RITE_KEY_VALUES:    readonly RiteKeyValue[]     = ['PENANCE','IMMOLATION','INTERMENT','SILENCE']

function generateTraitRoll(rng, tier):
  roll: Partial<TraitRoll> = {
    aspect:  rng.pick(ASPECT_VALUES),
    frailty: rng.pick(FRAILTY_VALUES),
    tell:    rng.pick(TELL_VALUES),
  }
  if tier === 'JOURNEYMAN' || tier === 'MASTER':
    roll.ward        = rng.pick(WARD_VALUES)
    roll.disposition = rng.pick(DISPOSITION_VALUES)
  if tier === 'MASTER':
    roll.riteKey = rng.pick(RITE_KEY_VALUES)
  return roll as TraitRoll
```

**I3 invariant:** the `rng` parameter must be the expedition seeded RNG. The function
introduces no entropy of its own. The call site (contract generation, Phase 4 spec 2)
is responsible for seeding and passing the correct `Rng`.

---

## Correctness Properties

**P12**: Sign opacity — every object in `deriveSigns` output has exactly `{ channel, token }`.
No axis name, axis value, or trait field appears in the output. [R34, R40]

**P13**: Lexicon completeness — for every `(axis, value)` pair reachable by
`generateTraitRoll` at Master tier (the widest roll), a matching entry exists in
`SIGN_LEXICON`. A cross-check test (T44) verifies this at the data level. [R39]

**P14**: Lexicon token uniqueness — all `token` values in `SIGN_LEXICON` are distinct.
This prevents two different traits from producing the same observable sign, which would
make the sign language ambiguous. [R39]

**P15**: Determinism — `deriveSigns` is a pure function (no side effects, no closure
over mutable state); same inputs always produce the same output. `generateTraitRoll`
is deterministic given the same `Rng` sequence. [R35, R36]

**P16**: Server containment — `TraitRoll` and all axis type definitions live entirely
within `src/server/`; none are exported from `src/shared/`. A TypeScript structural
check in T40's test file verifies this. [R33, R38]

---

## Satisfies Requirements

R33, R34, R35, R36, R37, R38, R39, R40, R41
