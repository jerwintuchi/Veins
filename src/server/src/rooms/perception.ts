// Distributed Perception (R60): server-side channel assignment and sign filtering.
// Interim assignment until the loadout economy becomes the source (the filtering
// machinery stays). Pure functions; all randomness flows through the seeded Rng (I3).
import type { Channel, Sign, Tier } from '@testament/shared';
import { CHANNELS } from '@testament/shared';
import type { Rng } from '../rng/seeded.js';
import type { TraitAxis } from '../incarnate/types.js';
import { AMBIENT_AXES } from '../incarnate/types.js';

export const MIN_CHANNELS_PER_PLAYER = 2;

const AXIS_TO_CHANNEL: Record<TraitAxis, Channel> = {
  ASPECT:      'RESIDUE',
  FRAILTY:     'STRESS_MARK',
  TELL:        'OMEN',
  WARD:        'REACTION',
  DISPOSITION: 'SPOOR',
  RITE_KEY:    'LITURGY',
};

// The channels that can carry a sign this expedition: ambient channels for the
// tier plus REACTION (probe-gated), in canonical order.
export function channelsForTier(tier: Tier): Channel[] {
  const relevant = new Set<Channel>(AMBIENT_AXES[tier].map(a => AXIS_TO_CHANNEL[a]));
  relevant.add('REACTION');
  return CHANNELS.filter(c => relevant.has(c));
}

export function assignPerception(
  rng: Rng,
  playerIds: string[],
  channels: Channel[],
): Map<string, Channel[]> {
  const assignment = new Map<string, Channel[]>();

  // Solo perceives everything (TD-008: never lacking).
  if (playerIds.length === 1) {
    assignment.set(playerIds[0]!, [...channels]);
    return assignment;
  }

  // Fisher–Yates shuffle, then deal round-robin so the union is always complete.
  const shuffled = [...channels];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  for (const id of playerIds) assignment.set(id, []);
  shuffled.forEach((channel, i) => {
    assignment.get(playerIds[i % playerIds.length]!)!.push(channel);
  });

  // Top up with overlap: nobody reads fewer than MIN_CHANNELS_PER_PLAYER.
  let cursor = 0;
  for (const set of assignment.values()) {
    while (set.length < Math.min(MIN_CHANNELS_PER_PLAYER, channels.length)) {
      const candidate = shuffled[cursor % shuffled.length]!;
      cursor++;
      if (!set.includes(candidate)) set.push(candidate);
    }
  }

  for (const [id, set] of assignment) {
    assignment.set(id, CHANNELS.filter(c => set.includes(c)));
  }
  return assignment;
}

export function filterSigns(signs: Sign[], channels: Channel[]): Sign[] {
  return signs.filter(s => channels.includes(s.channel));
}
