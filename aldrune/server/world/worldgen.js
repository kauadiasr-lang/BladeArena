import { makeNoise2D, fbm, mulberry32 } from './noise.js';

export const WORLD_SIZE = 96;
export const TILE = 32;

export const BIOME = {
  WATER: 0, BEACH: 1, PLAINS: 2, FOREST: 3, HILLS: 4, MOUNTAIN: 5, SWAMP: 6, RUINS: 7, TOWN: 8,
};
export const BIOME_NAME = {
  0: 'Água', 1: 'Praia', 2: 'Planície', 3: 'Floresta', 4: 'Colinas', 5: 'Montanha', 6: 'Pântano', 7: 'Ruínas', 8: 'Cidade',
};
// Walkability: water and deep mountain peaks block movement.
export const BLOCKED = new Set([BIOME.WATER]);

export function generateWorld(seed = 1337) {
  const elevNoise = makeNoise2D(seed);
  const moistNoise = makeNoise2D(seed + 999);
  const ruinNoise = makeNoise2D(seed + 4242);
  const rand = mulberry32(seed + 7);
  const size = WORLD_SIZE;
  const tiles = new Uint8Array(size * size);

  const cx = size / 2, cy = size / 2;
  const townRadius = 9;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const elevation = fbm(elevNoise, x, y, { octaves: 4, persistence: 0.5, scale: 0.045 });
      const moisture = fbm(moistNoise, x, y, { octaves: 3, persistence: 0.5, scale: 0.07 });
      const distFromEdge = Math.min(x, y, size - 1 - x, size - 1 - y) / (size * 0.5);
      const e = elevation * Math.min(1, distFromEdge * 2.2); // ocean border

      let biome;
      if (e < 0.24) biome = BIOME.WATER;
      else if (e < 0.29) biome = BIOME.BEACH;
      else if (e > 0.78) biome = BIOME.MOUNTAIN;
      else if (e > 0.6) biome = BIOME.HILLS;
      else if (moisture > 0.72 && e < 0.42) biome = BIOME.SWAMP;
      else if (moisture > 0.48) biome = BIOME.FOREST;
      else biome = BIOME.PLAINS;

      const ruinChance = fbm(ruinNoise, x, y, { octaves: 2, scale: 0.09 });
      if (biome !== BIOME.WATER && biome !== BIOME.BEACH && ruinChance > 0.82) biome = BIOME.RUINS;

      const dTown = Math.hypot(x - cx, y - cy);
      if (dTown < townRadius) biome = BIOME.TOWN;

      tiles[y * size + x] = biome;
    }
  }

  // Dungeon entrances: pick ruin tiles far enough from town.
  const dungeonEntrances = [];
  const dungeonNames = ['Cripta do Eco Perdido', 'Câmaras de Vaslor', 'Poço da Lua Oca', 'Salão dos Ossos', 'Fenda de Cendrith'];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (tiles[y * size + x] === BIOME.RUINS && Math.hypot(x - cx, y - cy) > townRadius + 6) {
        if (rand() < 0.05) {
          dungeonEntrances.push({
            id: `dg_${x}_${y}`, x, y,
            name: dungeonNames[dungeonEntrances.length % dungeonNames.length],
          });
        }
      }
    }
  }

  // Resource nodes for gathering skills.
  const resourceNodes = [];
  let nid = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const b = tiles[y * size + x];
      let kind = null;
      if ((b === BIOME.HILLS || b === BIOME.MOUNTAIN) && rand() < 0.02) kind = 'raw_ore';
      else if ((b === BIOME.FOREST) && rand() < 0.015) kind = 'wood_log';
      else if ((b === BIOME.FOREST || b === BIOME.SWAMP) && rand() < 0.012) kind = 'herb_moonleaf';
      if (kind) {
        resourceNodes.push({ id: `rn_${nid++}`, x, y, item: kind, depleted: false, respawnAt: 0 });
      }
    }
  }

  // Mob spawn points, biome-appropriate, kept away from the safe town.
  const mobSpawns = [];
  let mid = 0;
  const spawnTable = [
    { templateId: 'rabbit', biomes: [BIOME.PLAINS, BIOME.FOREST], chance: 0.006 },
    { templateId: 'boar', biomes: [BIOME.FOREST, BIOME.PLAINS], chance: 0.004 },
    { templateId: 'wolf', biomes: [BIOME.FOREST, BIOME.HILLS], chance: 0.004 },
    { templateId: 'bandit', biomes: [BIOME.PLAINS, BIOME.HILLS], chance: 0.0025 },
    { templateId: 'skeleton', biomes: [BIOME.RUINS, BIOME.SWAMP], chance: 0.02 },
    { templateId: 'cult_acolyte', biomes: [BIOME.RUINS], chance: 0.01 },
  ];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (Math.hypot(x - cx, y - cy) < townRadius + 4) continue;
      const b = tiles[y * size + x];
      for (const entry of spawnTable) {
        if (entry.biomes.includes(b) && rand() < entry.chance) {
          mobSpawns.push({ id: `ms_${mid++}`, x, y, templateId: entry.templateId });
          break;
        }
      }
    }
  }

  // Housing plots: ring around town in walkable, non-forest-dense biomes.
  const housingPlots = [];
  let pid = 0;
  for (let ring = townRadius + 3; ring <= townRadius + 14; ring += 3) {
    const steps = Math.floor((2 * Math.PI * ring) / 4);
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * ring);
      const y = Math.round(cy + Math.sin(ang) * ring);
      if (x < 2 || y < 2 || x > size - 3 || y > size - 3) continue;
      const b = tiles[y * size + x];
      if (b === BIOME.PLAINS || b === BIOME.FOREST) {
        housingPlots.push({ id: `plot_${pid++}`, x, y, claimedBy: null, ownerName: null, decay: 0, lastVisit: 0, chest: [] });
      }
    }
  }

  return {
    seed, size, tiles, spawn: { x: Math.floor(cx), y: Math.floor(cy) },
    dungeonEntrances, resourceNodes, housingPlots, mobSpawns,
    vendorPos: { x: Math.floor(cx) + 2, y: Math.floor(cy) },
    shrinePos: { x: Math.floor(cx) - 2, y: Math.floor(cy) },
  };
}

export function biomeAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.size || y >= world.size) return BIOME.WATER;
  return world.tiles[y * world.size + x];
}

export function isWalkable(world, x, y) {
  return !BLOCKED.has(biomeAt(world, x, y));
}
