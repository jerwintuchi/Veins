export type Channel =
  | 'RESIDUE'       // Aspect axis  — marks on the site
  | 'STRESS_MARK'   // Frailty axis — reaction when hurt
  | 'REACTION'      // Ward axis    — response to a probe
  | 'SPOOR'         // Disposition  — tracks and movement cadence
  | 'LITURGY'       // RiteKey axis — sigils and devotional resonance
  | 'OMEN';         // Tell axis    — wind-up cue before lethal strike

// Canonical channel order, used wherever a stable ordering is needed.
export const CHANNELS: ReadonlyArray<Channel> =
  ['RESIDUE', 'STRESS_MARK', 'REACTION', 'SPOOR', 'LITURGY', 'OMEN'];

export type SignToken = string;

export type Sign = {
  channel: Channel;
  token:   SignToken;
};

export type Tier = 'APPRENTICE' | 'JOURNEYMAN' | 'MASTER';

// A stimulus the party can apply with a probe (present flame, cold, salt, light).
// Client-chosen party behavior — carries no trait semantics; the server-only
// WardValue is defined against the same elements but never crosses the wire.
export type Stimulus = 'FLAME' | 'COLD' | 'SALT' | 'LIGHT';

export const STIMULI: ReadonlyArray<Stimulus> = ['FLAME', 'COLD', 'SALT', 'LIGHT'];
