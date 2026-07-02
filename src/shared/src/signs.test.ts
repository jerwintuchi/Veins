// T39: Shared sign types — Channel, SignToken, Sign, Tier
// T54: Stimulus + STIMULI (probe-handler spec, R53)
import { describe, it, expect } from 'vitest';
import type { Channel, Sign, Tier, SignToken, Stimulus } from './signs.js';
import { STIMULI } from './signs.js';

// T39(a): Channel is a union of exactly 6 literals.
function assertChannelExhaustive(c: Channel): string {
  switch (c) {
    case 'RESIDUE':     return c;
    case 'STRESS_MARK': return c;
    case 'REACTION':    return c;
    case 'SPOOR':       return c;
    case 'LITURGY':     return c;
    case 'OMEN':        return c;
  }
}

// T39(c): Tier is a union of exactly 3 literals.
function assertTierExhaustive(t: Tier): string {
  switch (t) {
    case 'APPRENTICE': return t;
    case 'JOURNEYMAN': return t;
    case 'MASTER':     return t;
  }
}

// T39(b): Sign satisfies { channel: Channel; token: SignToken }.
const _signShape = {
  channel: 'RESIDUE' as Channel,
  token:   'scorched-wax' as SignToken,
} satisfies Sign;

// T39(d): Sign with an extra 'axis' field does not satisfy Sign.
// @ts-expect-error — extra field 'axis' is not part of Sign
const _badSign: Sign = { channel: 'RESIDUE', token: 'scorched-wax', axis: 'ASPECT' };

// T39(a redux): a 7th Channel literal is rejected.
// @ts-expect-error — 'AURA' is not a valid Channel
const _badChannel: Channel = 'AURA';

// T39(c redux): a 4th Tier literal is rejected.
// @ts-expect-error — 'GRANDMASTER' is not a valid Tier
const _badTier: Tier = 'GRANDMASTER';

describe('Channel', () => {
  it('covers exactly 6 values', () => {
    const channels: Channel[] = ['RESIDUE', 'STRESS_MARK', 'REACTION', 'SPOOR', 'LITURGY', 'OMEN'];
    expect(channels).toHaveLength(6);
    // Exhaustive switch compiles — checked statically above.
    channels.forEach(c => expect(assertChannelExhaustive(c)).toBe(c));
  });
});

describe('Tier', () => {
  it('covers exactly 3 values', () => {
    const tiers: Tier[] = ['APPRENTICE', 'JOURNEYMAN', 'MASTER'];
    expect(tiers).toHaveLength(3);
    tiers.forEach(t => expect(assertTierExhaustive(t)).toBe(t));
  });
});

// T54(a): Stimulus is a union of exactly 4 literals.
function assertStimulusExhaustive(s: Stimulus): string {
  switch (s) {
    case 'FLAME': return s;
    case 'COLD':  return s;
    case 'SALT':  return s;
    case 'LIGHT': return s;
  }
}

// T54(b): a 5th Stimulus literal is rejected.
// @ts-expect-error — 'SILVER' is not a valid Stimulus
const _badStimulus: Stimulus = 'SILVER';

describe('Stimulus / STIMULI (R53)', () => {
  it('STIMULI contains exactly the four stimulus literals', () => {
    expect([...STIMULI].sort()).toEqual(['COLD', 'FLAME', 'LIGHT', 'SALT']);
    STIMULI.forEach(s => expect(assertStimulusExhaustive(s)).toBe(s));
  });
});

describe('Sign', () => {
  it('round-trips channel and token', () => {
    const sign: Sign = { channel: 'OMEN', token: 'drawn-breath-and-lean' };
    expect(sign.channel).toBe('OMEN');
    expect(sign.token).toBe('drawn-breath-and-lean');
  });

  it('has exactly two keys', () => {
    const sign: Sign = { channel: 'RESIDUE', token: 'frost-rime' };
    expect(Object.keys(sign).sort()).toEqual(['channel', 'token']);
  });
});
