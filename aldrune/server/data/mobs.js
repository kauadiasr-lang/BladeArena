export const MOB_TEMPLATES = {
  rabbit: {
    name: 'Coelho', faction: 'wildkin', hp: 8, dmg: [0, 0], speed: 1.6,
    behavior: 'flee', aggro: false, biomes: ['plains', 'forest'], loot: [],
    xpSkill: null, radius: 10,
  },
  wolf: {
    name: 'Lobo', faction: 'wildkin', hp: 30, dmg: [3, 7], speed: 1.8,
    behavior: 'pack', aggro: true, biomes: ['forest', 'hills'], loot: [{ id: 'wood_log', chance: 0.1, qty: [1, 1] }],
    radius: 12, nightBonus: 1.2,
  },
  bandit: {
    name: 'Bandido', faction: 'bandits', hp: 45, dmg: [4, 9], speed: 1.2,
    behavior: 'aggressive', aggro: true, biomes: ['plains', 'hills', 'forest'],
    loot: [{ id: 'gold_coin', chance: 1, qty: [3, 12] }, { id: 'bandit_trophy', chance: 0.3, qty: [1, 1] }, { id: 'iron_dagger', chance: 0.15, qty: [1, 1] }],
    radius: 14,
  },
  skeleton: {
    name: 'Esqueleto', faction: 'cult', hp: 35, dmg: [3, 8], speed: 0.9,
    behavior: 'aggressive', aggro: true, biomes: ['ruins', 'swamp'],
    loot: [{ id: 'gold_coin', chance: 0.6, qty: [1, 6] }, { id: 'rune_mortis', chance: 0.08, qty: [1, 1] }],
    radius: 12, nightBonus: 1.4,
  },
  cult_acolyte: {
    name: 'Acólito da Lua Oca', faction: 'cult', hp: 40, dmg: [5, 10], speed: 1.0,
    behavior: 'caster', aggro: true, biomes: ['ruins', 'swamp'],
    loot: [{ id: 'gold_coin', chance: 0.8, qty: [4, 10] }, { id: 'rune_umbra', chance: 0.12, qty: [1, 1] }],
    radius: 16, nightBonus: 1.3,
  },
  boar: {
    name: 'Javali', faction: 'wildkin', hp: 22, dmg: [2, 5], speed: 1.3,
    behavior: 'territorial', aggro: false, biomes: ['forest', 'plains'],
    loot: [{ id: 'bread', chance: 0.2, qty: [1, 2] }], radius: 10,
  },
};

export function rollLoot(template) {
  const drops = [];
  for (const l of template.loot || []) {
    if (Math.random() < l.chance) {
      const qty = l.qty[0] + Math.floor(Math.random() * (l.qty[1] - l.qty[0] + 1));
      drops.push({ id: l.id, qty });
    }
  }
  return drops;
}
