export const TILE = 32;

export const RUNES = {
  ignis: { label: 'Ignis · Fogo', icon: '🔥' },
  glacies: { label: 'Glacies · Gelo', icon: '❄️' },
  vis: { label: 'Vis · Força', icon: '💥' },
  vita: { label: 'Vita · Vida', icon: '💚' },
  mortis: { label: 'Mortis · Morte', icon: '💀', corrupting: true },
  umbra: { label: 'Umbra · Sombra', icon: '🌑', corrupting: true },
};

export const BIOME_COLOR = {
  0: '#1c3f5e', 1: '#c9b378', 2: '#4f8a3a', 3: '#25532a',
  4: '#7c703f', 5: '#6b6b6b', 6: '#3c4a30', 7: '#4a3f52', 8: '#a3854f',
};

export const ITEM_ICON = {
  weapon: '⚔️', armor: '🛡️', food: '🍞', potion: '🧪', resource: '⛏️',
  rune: '✨', currency: '🪙', trophy: '🏅', ammo: '➶',
};

export const state = {
  net: null,
  playerId: null,
  world: null,
  self: null,
  players: [],
  mobs: [],
  drops: [],
  nodes: [],
  plots: [],
  zone: 'overworld',
  instance: null,
  time: { day: 0, hour: 0, minute: 0, isNight: false, moonPhase: 'Nova', weather: 'claro' },
  items: {},
  factions: {},
  spellbook: {},
  target: null,
  selectedRunes: [],
  keys: new Set(),
  floatingTexts: [],
};
