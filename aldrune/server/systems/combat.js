import { itemDef } from '../data/items.js';

function rollRange([min, max]) { return min + Math.random() * (max - min); }

export function hitChance(attackSkill, defenseSkill = 0) {
  return Math.max(0.2, Math.min(0.95, 0.55 + (attackSkill - defenseSkill) / 200));
}

export function armorReduce(dmg, armor) {
  return Math.max(1, dmg - armor * 0.6);
}

export function playerWeaponDamage(player) {
  const weaponId = player.equipped.hand;
  const weapon = weaponId ? itemDef(weaponId) : null;
  if (!weapon || weapon.type !== 'weapon') return { dmg: 1 + Math.random() * 2, skill: 'swordsmanship', ranged: false, weapon: null };
  const skillValue = player.skills[weapon.skill] || 0;
  const base = rollRange(weapon.dmg);
  const bonus = base * (skillValue / 200); // up to +50% at 100 skill
  return { dmg: base + bonus, skill: weapon.skill, ranged: !!weapon.ranged, weapon };
}

export function targetArmor(target) {
  if (target.equipped) {
    const armorItem = target.equipped.body ? itemDef(target.equipped.body) : null;
    return armorItem?.armor || 0;
  }
  return target.armor || 0;
}

export function mobDamageRoll(template) {
  return rollRange(template.dmg);
}
