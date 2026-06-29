// Player state and movement constants. Types and constants only (invariant I4).

export type PlayerState = {
  hp: number;
  maxHp: number;
  downed: boolean;
  x: number;
  y: number;
};

export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED  = 120; // world units per second
export const PLAYER_RADIUS = 12;  // body radius used by collision and client rendering
