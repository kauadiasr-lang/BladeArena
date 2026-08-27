// Item templates. Instances carried by players are {id, qty, quality?}.
export const ITEMS = {
  // Weapons
  rusty_sword: { name: 'Espada Enferrujada', type: 'weapon', slot: 'hand', skill: 'swordsmanship', dmg: [3, 6], speed: 1.0, value: 8 },
  hunting_bow: { name: 'Arco de Caça', type: 'weapon', slot: 'hand', skill: 'archery', dmg: [2, 7], speed: 1.2, ranged: true, value: 12, ammo: 'arrow' },
  apprentice_staff: { name: 'Cajado de Aprendiz', type: 'weapon', slot: 'hand', skill: 'magery', dmg: [1, 3], speed: 0.8, value: 15 },
  iron_dagger: { name: 'Adaga de Ferro', type: 'weapon', slot: 'hand', skill: 'swordsmanship', dmg: [2, 4], speed: 1.6, value: 6 },
  // Ammo
  arrow: { name: 'Flecha', type: 'ammo', value: 1, stack: true },
  // Armor
  leather_vest: { name: 'Colete de Couro', type: 'armor', slot: 'body', armor: 3, value: 10 },
  // Consumables
  bread: { name: 'Pão', type: 'food', heal: 8, value: 2, stack: true },
  minor_potion: { name: 'Poção Menor de Vida', type: 'potion', heal: 25, value: 10, stack: true },
  // Resources / crafting & gathering skill
  raw_ore: { name: 'Minério Bruto', type: 'resource', skill: 'mining', value: 3, stack: true },
  iron_ingot: { name: 'Lingote de Ferro', type: 'resource', value: 6, stack: true },
  herb_moonleaf: { name: 'Folha-da-Lua', type: 'resource', skill: 'herbalism', value: 4, stack: true },
  wood_log: { name: 'Tora de Madeira', type: 'resource', skill: 'woodcutting', value: 2, stack: true },
  // Rune fragments for spellcrafting (see runes.js for meanings)
  rune_ignis: { name: 'Fragmento Rúnico: Ignis (Fogo)', type: 'rune', rune: 'ignis', value: 20, stack: true },
  rune_glacies: { name: 'Fragmento Rúnico: Glacies (Gelo)', type: 'rune', rune: 'glacies', value: 20, stack: true },
  rune_vis: { name: 'Fragmento Rúnico: Vis (Força)', type: 'rune', rune: 'vis', value: 20, stack: true },
  rune_vita: { name: 'Fragmento Rúnico: Vita (Vida)', type: 'rune', rune: 'vita', value: 25, stack: true },
  rune_mortis: { name: 'Fragmento Rúnico: Mortis (Morte)', type: 'rune', rune: 'mortis', value: 30, stack: true, corrupting: true },
  rune_umbra: { name: 'Fragmento Rúnico: Umbra (Sombra)', type: 'rune', rune: 'umbra', value: 22, stack: true, corrupting: true },
  // Loot / treasure
  gold_coin: { name: 'Moeda de Ouro', type: 'currency', value: 1, stack: true },
  bandit_trophy: { name: 'Insígnia de Bandido', type: 'trophy', value: 5, stack: true },
};

export function itemDef(id) {
  return ITEMS[id];
}
