import type {
  DungeonConfig,
  DungeonLayout,
  DungeonRoom,
  Corridor,
  Point,
  Rect,
} from '@veins/shared';
import { createRng, hashSeed, type Rng } from '../rng/seeded.js';

// Standard dungeon tuning. Lives here next to the algorithm; adjust per-floor
// later when the Bleed Clock / depth-scaling work begins.
export const STANDARD_DUNGEON_CONFIG: DungeonConfig = {
  width: 80,
  height: 80,
  minLeafSize: 16,
  maxDepth: 4,
  roomPadding: 2,
};

type BspResult = {
  rooms: DungeonRoom[];
  corridors: Corridor[];
  rep: DungeonRoom; // representative room used to connect this subtree upward
};

// Mutable id counter threaded through the recursion so room ids reflect a fixed
// traversal order (left before right), keeping generation deterministic.
type IdCounter = { next: number };

function center(rect: Rect): Point {
  return {
    x: Math.floor(rect.x + rect.width / 2),
    y: Math.floor(rect.y + rect.height / 2),
  };
}

function placeRoomInLeaf(leaf: Rect, config: DungeonConfig, rng: Rng, ids: IdCounter): DungeonRoom {
  const pad = config.roomPadding;
  const innerW = Math.max(1, leaf.width - 2 * pad);
  const innerH = Math.max(1, leaf.height - 2 * pad);

  const minW = Math.min(innerW, Math.max(2, Math.floor(innerW / 2)));
  const minH = Math.min(innerH, Math.max(2, Math.floor(innerH / 2)));

  const roomW = rng.int(minW, innerW);
  const roomH = rng.int(minH, innerH);

  const offX = rng.int(0, innerW - roomW);
  const offY = rng.int(0, innerH - roomH);

  const rect: Rect = {
    x: leaf.x + pad + offX,
    y: leaf.y + pad + offY,
    width: roomW,
    height: roomH,
  };

  return { id: `room-${ids.next++}`, rect };
}

function buildNode(rect: Rect, depth: number, config: DungeonConfig, rng: Rng, ids: IdCounter): BspResult {
  const canSplitX = rect.width >= 2 * config.minLeafSize;
  const canSplitY = rect.height >= 2 * config.minLeafSize;

  if (depth >= config.maxDepth || (!canSplitX && !canSplitY)) {
    const room = placeRoomInLeaf(rect, config, rng, ids);
    return { rooms: [room], corridors: [], rep: room };
  }

  let splitVertical: boolean;
  if (canSplitX && canSplitY) {
    if (rect.width > rect.height) splitVertical = true;
    else if (rect.height > rect.width) splitVertical = false;
    else splitVertical = rng.float() < 0.5;
  } else {
    splitVertical = canSplitX;
  }

  let left: Rect;
  let right: Rect;
  if (splitVertical) {
    const sx = rng.int(config.minLeafSize, rect.width - config.minLeafSize);
    left = { x: rect.x, y: rect.y, width: sx, height: rect.height };
    right = { x: rect.x + sx, y: rect.y, width: rect.width - sx, height: rect.height };
  } else {
    const sy = rng.int(config.minLeafSize, rect.height - config.minLeafSize);
    left = { x: rect.x, y: rect.y, width: rect.width, height: sy };
    right = { x: rect.x, y: rect.y + sy, width: rect.width, height: rect.height - sy };
  }

  const l = buildNode(left, depth + 1, config, rng, ids);
  const r = buildNode(right, depth + 1, config, rng, ids);

  // One corridor per internal node connects the two subtrees -> spanning tree.
  const corridor: Corridor = {
    fromRoomId: l.rep.id,
    toRoomId: r.rep.id,
    from: center(l.rep.rect),
    to: center(r.rep.rect),
  };

  return {
    rooms: [...l.rooms, ...r.rooms],
    corridors: [...l.corridors, ...r.corridors, corridor],
    rep: l.rep,
  };
}

// `floor` folds into the seed so each floor of a run is a distinct but fully
// deterministic dungeon. The layout's `runId` field stays the bare run id.
export function generateDungeon(
  runId: string,
  config: DungeonConfig = STANDARD_DUNGEON_CONFIG,
  floor = 1
): DungeonLayout {
  const rng = createRng(hashSeed(`${runId}#${floor}`));
  const root: Rect = { x: 0, y: 0, width: config.width, height: config.height };
  const ids: IdCounter = { next: 0 };

  const result = buildNode(root, 0, config, rng, ids);

  return {
    runId,
    width: config.width,
    height: config.height,
    rooms: result.rooms,
    corridors: result.corridors,
  };
}
