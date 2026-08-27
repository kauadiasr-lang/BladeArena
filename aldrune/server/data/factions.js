// Faction Web: factions are nodes in a relationship graph. Standing changes
// with one faction partially ripple to connected factions (allies rise a
// little less, rivals fall), so every action reshapes more than one
// relationship at once.

export const FACTIONS = {
  guard: {
    name: 'Guarda de Aldrune',
    color: '#6fa8dc',
    desc: 'Mantém a paz nas cidades e estradas. Odeia foras-da-lei e o Culto.',
  },
  merchants: {
    name: 'Liga Mercante',
    color: '#e0b04a',
    desc: 'Controla o comércio. Recompensa entregas e caça a ladrões.',
  },
  bandits: {
    name: 'Alcateia Cinzenta',
    color: '#a35b3d',
    desc: 'Bandidos das estradas selvagens. Hostis a quase todos, exceto entre si.',
  },
  thieves: {
    name: 'Confraria das Sombras',
    color: '#8a6bb1',
    desc: 'Rede clandestina de ladrões e informantes urbanos.',
  },
  cult: {
    name: 'Culto da Lua Oca',
    color: '#4a3b6b',
    desc: 'Adoradores da lua fragmentada. Praticam necromancia e corrupção.',
  },
  wildkin: {
    name: 'Feras Selvagens',
    color: '#5c8a4a',
    desc: 'Animais e criaturas do território selvagem. Reagem por instinto.',
  },
};

// Directed ripple weights: when standing with `from` changes by delta,
// standing with `to` changes by delta * weight (can be negative = rivalry,
// positive = alliance). Missing pair = no ripple.
export const FACTION_RIPPLE = {
  guard: { merchants: 0.5, bandits: -0.8, thieves: -0.5, cult: -0.9, wildkin: -0.05 },
  merchants: { guard: 0.4, bandits: -0.6, thieves: -0.3, cult: -0.3 },
  bandits: { guard: -0.6, merchants: -0.5, thieves: 0.4, cult: 0.2 },
  thieves: { guard: -0.4, merchants: -0.2, bandits: 0.3, cult: 0.15 },
  cult: { guard: -0.7, merchants: -0.2, bandits: 0.15, wildkin: 0.2 },
  wildkin: { cult: 0.1, guard: -0.05 },
};

export const STARTING_STANDING = () => ({
  guard: 0, merchants: 0, bandits: -20, thieves: 0, cult: -10, wildkin: 0,
});

export function standingLabel(v) {
  if (v >= 75) return 'Reverenciado';
  if (v >= 35) return 'Aliado';
  if (v >= 10) return 'Amistoso';
  if (v > -10) return 'Neutro';
  if (v > -35) return 'Desconfiado';
  if (v > -75) return 'Hostil';
  return 'Inimigo Jurado';
}
