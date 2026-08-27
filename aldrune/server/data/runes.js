// Rune Echo spellcrafting. Players combine 1-3 rune fragments; the server
// resolves the effect from the runes' raw properties. A handful of potent
// combinations are pre-named ("taught" spells available from trainers);
// everything else is undiscovered territory. The FIRST player to
// successfully cast a never-before-seen combination on this server names
// it, and it is broadcast to everyone and saved forever in the shared
// Grimoire Codex, where anyone can look it up and learn the recipe.

export const RUNES = {
  ignis: { name: 'Ignis', label: 'Fogo', power: 8, cost: 6, tags: ['damage', 'fire'] },
  glacies: { name: 'Glacies', label: 'Gelo', power: 6, cost: 6, tags: ['damage', 'frost', 'slow'] },
  vis: { name: 'Vis', label: 'Força', power: 5, cost: 5, tags: ['damage', 'force', 'knockback'] },
  vita: { name: 'Vita', label: 'Vida', power: 10, cost: 8, tags: ['heal'] },
  mortis: { name: 'Mortis', label: 'Morte', power: 12, cost: 10, tags: ['damage', 'drain'], corrupting: true },
  umbra: { name: 'Umbra', label: 'Sombra', power: 4, cost: 4, tags: ['debuff', 'stealth'], corrupting: true },
};

export function comboKey(runeIds) {
  return [...runeIds].sort().join('+');
}

// Pre-discovered "taught" spells, known to everyone from the start.
export const KNOWN_SPELLS = {
  [comboKey(['ignis'])]: { name: 'Fagulha', kind: 'damage', element: 'fire' },
  [comboKey(['glacies'])]: { name: 'Lasca de Gelo', kind: 'damage', element: 'frost', slow: true },
  [comboKey(['vis'])]: { name: 'Rajada de Força', kind: 'damage', element: 'force', knockback: true },
  [comboKey(['vita'])]: { name: 'Toque Curativo', kind: 'heal' },
  [comboKey(['ignis', 'vis'])]: { name: 'Explosão Flamejante', kind: 'damage', element: 'fire', aoe: true },
  [comboKey(['glacies', 'vis'])]: { name: 'Grilhão Gélido', kind: 'damage', element: 'frost', slow: true, root: true },
  [comboKey(['mortis', 'umbra'])]: { name: 'Sopro da Lua Oca', kind: 'damage', element: 'death', drain: true },
};

// Resolve the mechanical effect of any combination (known or novel) purely
// from the constituent runes' stats, so every combo the server has never
// seen still produces a coherent, balanced spell.
export function resolveSpellEffect(runeIds) {
  const runes = runeIds.map((id) => RUNES[id]).filter(Boolean);
  if (runes.length === 0) return null;
  const n = runes.length;
  const scale = 1 - 0.15 * (n - 1);
  const totalPower = runes.reduce((s, r) => s + r.power, 0) * Math.max(0.4, scale);
  const cost = runes.reduce((s, r) => s + r.cost, 0);
  const tags = new Set(runes.flatMap((r) => r.tags));
  const corrupting = runes.some((r) => r.corrupting);
  const elementRune = runes.find((r) => r.tags.some((t) => ['fire', 'frost', 'force', 'death'].includes(t)));
  const element = elementRune ? elementRune.tags.find((t) => ['fire', 'frost', 'force', 'death'].includes(t)) : 'arcane';

  if (tags.has('heal') && !tags.has('damage')) {
    return { kind: 'heal', amount: Math.round(totalPower * 1.4), cost, corrupting, tags: [...tags] };
  }
  return {
    kind: 'damage',
    element,
    amount: Math.round(totalPower * (tags.has('heal') ? 0.6 : 1)),
    cost,
    slow: tags.has('slow'),
    knockback: tags.has('knockback'),
    drain: tags.has('drain'),
    aoe: n >= 3,
    corrupting,
    tags: [...tags],
  };
}

const NAME_FRAGMENTS = {
  fire: ['Chama', 'Brasa', 'Ígneo'], frost: ['Gélido', 'Congelante', 'Rima'],
  force: ['Impacto', 'Onda', 'Ruptura'], death: ['Fúnebre', 'Sombrio', 'Ceifar'],
  arcane: ['Arcano', 'Éter', 'Prisma'], heal: ['Renovo', 'Amparo', 'Vigor'],
};
export function proceduralName(runeIds, effect) {
  const bucket = NAME_FRAGMENTS[effect.element || (effect.kind === 'heal' ? 'heal' : 'arcane')] || NAME_FRAGMENTS.arcane;
  const word = bucket[(runeIds.join('').length + runeIds.length) % bucket.length];
  const labels = runeIds.map((id) => RUNES[id]?.label).filter(Boolean).join('-');
  return `${word} de ${labels}`;
}
