// UO-inspired skill-by-use progression: no levels, no XP bars. Every skill
// climbs only through practice, higher skill = harder to raise further, and
// a global point cap forces horizontal specialization - to raise a skill at
// the cap, some other skill has to give a little ground.
export const SKILL_LIST = [
  'swordsmanship', 'archery', 'magery', 'mining', 'herbalism', 'woodcutting', 'lockpicking', 'mercantile',
];
export const SKILL_NAMES = {
  swordsmanship: 'Espadas', archery: 'Arco e Flecha', magery: 'Magia',
  mining: 'Mineração', herbalism: 'Herbalismo', woodcutting: 'Corte de Madeira',
  lockpicking: 'Arrombamento', mercantile: 'Mercancia',
};
export const SKILL_CAP = 100;
export const GLOBAL_CAP = 500;

export function emptySkills() {
  const s = {};
  for (const k of SKILL_LIST) s[k] = 0;
  return s;
}

export function totalSkillPoints(skills) {
  return Object.values(skills).reduce((a, b) => a + b, 0);
}

// Returns the new value gained (0 if no gain this attempt), and whether a
// point was borrowed from another skill because the global cap was hit.
export function gainOnUse(player, skillName, difficulty = 0.5) {
  const skills = player.skills;
  const cur = skills[skillName] ?? 0;
  if (cur >= SKILL_CAP) return { gained: 0 };
  const gainChance = Math.max(0.04, Math.min(0.9, (1 - cur / SKILL_CAP) * (0.4 + difficulty)));
  if (Math.random() >= gainChance) return { gained: 0 };

  const gain = 0.1 + difficulty * 0.15;
  const total = totalSkillPoints(skills);
  let borrowedFrom = null;
  if (total >= GLOBAL_CAP) {
    let best = null;
    for (const k of SKILL_LIST) {
      if (k === skillName) continue;
      if (skills[k] > 0 && (!best || skills[k] > skills[best])) best = k;
    }
    if (best) {
      skills[best] = Math.max(0, skills[best] - gain);
      borrowedFrom = best;
    } else {
      return { gained: 0 };
    }
  }
  skills[skillName] = Math.min(SKILL_CAP, cur + gain);
  return { gained: skills[skillName] - cur, value: skills[skillName], borrowedFrom };
}
