import type { DungeonLayout } from '@veins/shared';
import { isWalkable } from './collision.js';

const MAX_ITERATIONS = 5000;
const LOS_STEP = 0.5; // sample every half-tile along the ray
// Coarse A* tile size. With CORRIDOR_HALF_WIDTH=20 (40-unit corridor), TILE=10
// gives 4-tile-wide corridors instead of 40, keeping A* within MAX_ITERATIONS
// even for the largest dungeons.
const TILE = 10;

// Returns true if a straight line from (sx,sy) to (gx,gy) stays entirely walkable.
// When LOS exists, direct movement is always optimal — A* is unnecessary.
function hasLineOfSight(
  sx: number, sy: number, gx: number, gy: number, dungeon: DungeonLayout,
): boolean {
  const dx = gx - sx;
  const dy = gy - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < LOS_STEP) return true;
  const steps = Math.ceil(dist / LOS_STEP);
  const ux = dx / dist;
  const uy = dy / dist;
  for (let i = 1; i <= steps; i++) {
    if (!isWalkable(sx + ux * i * LOS_STEP, sy + uy * i * LOS_STEP, dungeon)) return false;
  }
  return true;
}

type Key = string;
function k(x: number, y: number): Key { return `${x},${y}`; }
function fromK(key: Key): [number, number] {
  const comma = key.indexOf(',');
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A* on the integer tile grid. Returns the centre of the first tile step toward
// goal, or null if the goal is unreachable, the path exceeds MAX_ITERATIONS, or
// start and goal are in the same tile. Start tile is always seeded into the open
// set so entities that begin in a wall can still navigate out.
export function findNextWaypoint(
  startX: number, startY: number,
  goalX: number, goalY: number,
  dungeon: DungeonLayout,
): { x: number; y: number } | null {
  const sx = Math.floor(startX / TILE);
  const sy = Math.floor(startY / TILE);
  const gx = Math.floor(goalX / TILE);
  const gy = Math.floor(goalY / TILE);

  if (sx === gx && sy === gy) return null;
  // If the straight line is clear, direct movement is optimal — skip A*.
  if (hasLineOfSight(startX, startY, goalX, goalY, dungeon)) return null;

  const startKey = k(sx, sy);
  const goalKey  = k(gx, gy);

  const gScore = new Map<Key, number>([[startKey, 0]]);
  const parent = new Map<Key, Key>();
  const open   = new Map<Key, number>([[startKey, Math.abs(sx - gx) + Math.abs(sy - gy)]]);
  const closed = new Set<Key>();

  let iter = 0;
  while (open.size > 0 && iter++ < MAX_ITERATIONS) {
    // Pop node with lowest f-score.
    let bestKey: Key | null = null;
    let bestF = Infinity;
    for (const [key, f] of open) {
      if (f < bestF) { bestF = f; bestKey = key; }
    }
    if (!bestKey) break;

    if (bestKey === goalKey) {
      // Trace parent chain from goal back to start; return centre of first step.
      const path: Key[] = [];
      let cur = goalKey;
      while (cur !== startKey) {
        path.push(cur);
        const p = parent.get(cur);
        if (!p) break;
        cur = p;
      }
      path.reverse(); // path[0] = first step from start
      const firstStep = path[0];
      if (!firstStep) return null;
      const [fx, fy] = fromK(firstStep);
      return { x: (fx + 0.5) * TILE, y: (fy + 0.5) * TILE };
    }

    open.delete(bestKey);
    closed.add(bestKey);

    const [cx, cy] = fromK(bestKey);
    const cg = gScore.get(bestKey) ?? 0;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nk = k(nx, ny);

      if (closed.has(nk)) continue;
      if (!isWalkable((nx + 0.5) * TILE, (ny + 0.5) * TILE, dungeon)) continue;

      const ng = cg + 1;
      const existing = gScore.get(nk);
      if (existing === undefined || ng < existing) {
        gScore.set(nk, ng);
        parent.set(nk, bestKey);
        open.set(nk, ng + Math.abs(nx - gx) + Math.abs(ny - gy));
      }
    }
  }

  return null;
}
