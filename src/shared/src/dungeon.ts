// Dungeon geometry types and constants (invariant I4). Generation logic lives in
// src/server/src/dungeon/.

// Half-width of a dungeon corridor in world units. Full width = 2 × this value.
// Must be ≥ PLAYER_RADIUS so players can navigate corridors without clipping walls.
export const CORRIDOR_HALF_WIDTH = 20;

export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type DungeonRoomId = string; // "room-0", "room-1", ... by traversal order

export type DungeonRoom = {
  id: DungeonRoomId;
  rect: Rect;
};

// Connects two rooms. Carries room ids (for graph/connectivity reasoning) and
// geometric endpoints (room centers) so clients can render an L-shaped passage.
export type Corridor = {
  fromRoomId: DungeonRoomId;
  toRoomId: DungeonRoomId;
  from: Point;
  to: Point;
};

export type DungeonLayout = {
  runId: string;
  width: number;
  height: number;
  rooms: DungeonRoom[];
  corridors: Corridor[];
};

export type DungeonConfig = {
  width: number;
  height: number;
  minLeafSize: number; // a leaf smaller than this is not split further
  maxDepth: number; // hard cap on BSP recursion depth
  roomPadding: number; // gap between a room and its leaf boundary (>= 1)
};
