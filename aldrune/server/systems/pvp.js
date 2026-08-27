import { BIOME, biomeAt } from '../world/worldgen.js';
import { adjustStanding } from './factions.js';

// Town + roads (biome TOWN) are guard-protected: unconsented attacks there
// are blocked and punished instantly. The Wilds and dungeons are
// consent-based full-loot PvP: either both players must be flagged Outlaw,
// or the zone itself is a free-PvP zone (dungeon instances).
export function canAttackPlayer(attacker, defender, world, zoneFreePvp) {
  if (!defender.alive || attacker.id === defender.id) return { ok: false };
  const inGuardZone = isGuardZone(attacker, world) || isGuardZone(defender, world);
  if (inGuardZone) return { ok: false, reason: 'Zona protegida pela Guarda.' };
  if (zoneFreePvp) return { ok: true, consensual: true };
  if (attacker.outlaw && defender.outlaw) return { ok: true, consensual: true };
  return { ok: false, reason: 'Ative o modo Foragido para lutar contra outros jogadores.' };
}

function isGuardZone(player, world) {
  if (player.dungeon) return false; // dungeon zones use their own grid, not the overworld
  return biomeAt(world, Math.round(player.pos.x), Math.round(player.pos.y)) === BIOME.TOWN;
}

export function isUnlawfulKill(victim, killer, zoneFreePvp) {
  if (zoneFreePvp) return false;
  if (victim.outlaw) return false; // killing an outlaw is a lawful bounty kill
  return true;
}

export function onPlayerKilled(victim, killer, world, zoneFreePvp) {
  const unlawful = isUnlawfulKill(victim, killer, zoneFreePvp);
  const fullLoot = zoneFreePvp || victim.outlaw || killer.outlaw;
  let dropped = [];
  if (fullLoot) {
    dropped = victim.inventory.splice(0, victim.inventory.length);
  }
  if (unlawful) {
    killer.murders += 1;
    adjustStanding(killer, 'guard', -25);
    if (killer.murders >= 5) killer.outlaw = true; // Hunted: forced outlaw status
  }
  return { unlawful, fullLoot, dropped };
}
