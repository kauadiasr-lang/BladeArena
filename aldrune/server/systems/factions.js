import { FACTION_RIPPLE, FACTIONS } from '../data/factions.js';

export function adjustStanding(player, factionId, delta) {
  if (!FACTIONS[factionId]) return {};
  const changes = {};
  const apply = (id, amount) => {
    const cur = player.factionStanding[id] ?? 0;
    const next = Math.max(-100, Math.min(100, cur + amount));
    player.factionStanding[id] = next;
    changes[id] = next;
  };
  apply(factionId, delta);
  const ripple = FACTION_RIPPLE[factionId] || {};
  for (const [otherId, weight] of Object.entries(ripple)) {
    apply(otherId, delta * weight);
  }
  return changes;
}

export function standing(player, factionId) {
  return player.factionStanding[factionId] ?? 0;
}
