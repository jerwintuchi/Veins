import { describe, it, expect, vi, afterEach } from 'vitest';
import { ReconnectTokenStore } from './ReconnectTokenStore.js';

// T11: reconnect token store

afterEach(() => vi.restoreAllMocks());

describe('ReconnectTokenStore.issue + resolve', () => {
  it('resolve returns the entry for a valid unexpired token', () => {
    const store = new ReconnectTokenStore();
    const token = store.issue('p1', 'ABC123');
    const entry = store.resolve(token);
    expect(entry).toBeDefined();
    expect(entry?.playerId).toBe('p1');
    expect(entry?.roomCode).toBe('ABC123');
  });

  it('resolve returns undefined for an unknown token', () => {
    const store = new ReconnectTokenStore();
    expect(store.resolve('not-a-real-token')).toBeUndefined();
  });

  it('resolve returns undefined for an expired token', () => {
    const store = new ReconnectTokenStore();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now); // issue time
    const token = store.issue('p1', 'ABC123');
    vi.spyOn(Date, 'now').mockReturnValue(now + 121_000); // 121s later — past 120s TTL
    expect(store.resolve(token)).toBeUndefined();
  });
});

describe('ReconnectTokenStore.revoke', () => {
  it('resolve returns undefined after revoke', () => {
    const store = new ReconnectTokenStore();
    const token = store.issue('p1', 'ABC123');
    store.revoke(token);
    expect(store.resolve(token)).toBeUndefined();
  });
});

describe('ReconnectTokenStore: only latest token is valid per player', () => {
  it('old token is invalidated when a new one is issued', () => {
    const store = new ReconnectTokenStore();
    const t1 = store.issue('p1', 'ABC123');
    const t2 = store.issue('p1', 'ABC123');
    expect(store.resolve(t1)).toBeUndefined();
    expect(store.resolve(t2)).toBeDefined();
  });
});
