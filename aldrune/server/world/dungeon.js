import { mulberry32 } from './noise.js';
import { spawnMob } from '../entities/mob.js';

// "Wounds": procedurally generated dungeons instanced per party. The longer
// a party lingers, a Corruption Clock rises and mutates the dungeon -
// walls shift open, tougher things wake up - rewarding a fast, decisive
// raid over grinding every room clean.
const SIZE = 32;
let nextInstanceId = 1;

export function generateDungeon(seedBase, entrance) {
  const rand = mulberry32(seedBase);
  const grid = new Uint8Array(SIZE * SIZE); // 0 = wall, 1 = floor
  const rooms = [];
  const roomCount = 7 + Math.floor(rand() * 4);
  for (let i = 0; i < roomCount; i++) {
    const w = 3 + Math.floor(rand() * 5);
    const h = 3 + Math.floor(rand() * 5);
    const x = 1 + Math.floor(rand() * (SIZE - w - 2));
    const y = 1 + Math.floor(rand() * (SIZE - h - 2));
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
    carveRoom(grid, x, y, w, h);
  }
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, rooms[i - 1], rooms[i]);
  }

  const entranceRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];

  const instance = {
    id: `dg${nextInstanceId++}`,
    entranceId: entrance.id,
    name: entrance.name,
    grid, size: SIZE,
    entrancePos: { x: entranceRoom.cx, y: entranceRoom.cy },
    exitPos: { x: exitRoom.cx, y: exitRoom.cy },
    rooms,
    mobs: new Map(),
    drops: new Map(),
    players: new Set(),
    corruption: 0,
    createdAt: Date.now(),
    mutationsTriggered: new Set(),
  };

  const mobPool = ['skeleton', 'skeleton', 'cult_acolyte'];
  for (let i = 1; i < rooms.length; i++) {
    if (rand() < 0.75) {
      const kind = mobPool[Math.floor(rand() * mobPool.length)];
      const mob = spawnMob(kind, { x: rooms[i].cx, y: rooms[i].cy });
      instance.mobs.set(mob.id, mob);
    }
    if (rand() < 0.3) {
      const dropId = `chest_${i}`;
      instance.drops.set(dropId, {
        id: dropId, pos: { x: rooms[i].cx + 1, y: rooms[i].cy }, kind: 'chest',
        items: [{ id: 'gold_coin', qty: 5 + Math.floor(rand() * 20) }],
      });
    }
  }
  return instance;
}

export function isDungeonWalkable(instance, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= instance.size || iy >= instance.size) return false;
  return instance.grid[iy * instance.size + ix] === 1;
}

// Called periodically while the instance has occupants. Raises the
// Corruption Clock and, at thresholds, mutates the dungeon.
export function tickCorruptionClock(instance, dtSeconds, broadcast) {
  if (instance.players.size === 0 || instance.corruption >= 100) return;
  instance.corruption = Math.min(100, instance.corruption + dtSeconds * (100 / 240)); // ~4 min to max
  for (const threshold of [25, 50, 75, 100]) {
    if (instance.corruption >= threshold && !instance.mutationsTriggered.has(threshold)) {
      instance.mutationsTriggered.add(threshold);
      mutate(instance, threshold);
      broadcast(instance, threshold);
    }
  }
}

function mutate(instance, threshold) {
  const rand = Math.random;
  // Open a random wall into floor somewhere near the middle rooms - the dungeon "shifts".
  for (let tries = 0; tries < 20; tries++) {
    const x = 1 + Math.floor(rand() * (instance.size - 2));
    const y = 1 + Math.floor(rand() * (instance.size - 2));
    if (instance.grid[y * instance.size + x] === 0) {
      instance.grid[y * instance.size + x] = 1;
      break;
    }
  }
  const room = instance.rooms[Math.floor(rand() * instance.rooms.length)];
  const kind = threshold >= 100 ? 'cult_acolyte' : (rand() < 0.5 ? 'skeleton' : 'cult_acolyte');
  const extra = threshold >= 100 ? 2 : 1;
  for (let i = 0; i < extra; i++) {
    const mob = spawnMob(kind, { x: room.cx + i, y: room.cy });
    if (threshold >= 100) { mob.hp *= 2; mob.maxHp = mob.hp; mob.elite = true; mob.name = 'Arauto da Lua Oca'; }
    instance.mobs.set(mob.id, mob);
  }
}

function carveRoom(grid, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      grid[yy * SIZE + xx] = 1;
    }
  }
}
function carveCorridor(grid, a, b) {
  let x = a.cx, y = a.cy;
  while (x !== b.cx) { grid[y * SIZE + x] = 1; x += x < b.cx ? 1 : -1; }
  while (y !== b.cy) { grid[y * SIZE + x] = 1; y += y < b.cy ? 1 : -1; }
  grid[y * SIZE + x] = 1;
}
