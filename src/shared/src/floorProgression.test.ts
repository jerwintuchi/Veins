import { describe, it, expect } from 'vitest';
import type { FloorAdvancedEvent } from './events.js';

describe('FloorAdvancedEvent', () => {
  it('carries the new floor and dungeon layout under strict mode', () => {
    const event: FloorAdvancedEvent = {
      floor: 2,
      dungeon: { runId: 'run-1', width: 80, height: 80, rooms: [], corridors: [] },
    };
    expect(event.floor).toBe(2);
    expect(event.dungeon.runId).toBe('run-1');
  });
});
