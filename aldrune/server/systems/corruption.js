// Blood & Ash: dark actions (necromancy runes, murder, grave robbing) stain
// the character visibly and change how the world treats them. It is fully
// reversible through Pilgrimage at moon shrines, so it is a playstyle
// dial, not a punishment.
export function corruptionTitle(v) {
  if (v >= 75) return 'Amaldiçoado';
  if (v >= 45) return 'Corrompido';
  if (v >= 15) return 'Manchado';
  return 'Puro';
}

export function addCorruption(player, amount, calendar) {
  const mult = calendar ? calendar.corruptionGainMultiplier() : 1;
  const before = player.corruption;
  player.corruption = Math.max(0, Math.min(100, player.corruption + amount * mult));
  return { before, after: player.corruption, crossed: corruptionTitle(before) !== corruptionTitle(player.corruption) };
}

export function pilgrimageCleanse(player, amount = 20) {
  player.corruption = Math.max(0, player.corruption - amount);
  return player.corruption;
}

// Corruption sours prices and faction goodwill without hard-blocking play.
export function priceMultiplier(player) {
  return 1 + player.corruption / 200; // up to +50% prices at max corruption
}
export function factionGainMultiplier(player) {
  return 1 - player.corruption / 150; // lighter reputation gains while corrupted
}
