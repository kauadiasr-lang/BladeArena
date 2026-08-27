import { MOB_TEMPLATES } from '../data/mobs.js';
import { standing } from '../systems/factions.js';

let nextMobId = 1;

export function spawnMob(templateId, pos) {
  const t = MOB_TEMPLATES[templateId];
  if (!t) return null;
  return {
    id: `m${nextMobId++}`, templateId, name: t.name, faction: t.faction,
    hp: t.hp, maxHp: t.hp, pos: { x: pos.x, y: pos.y }, home: { x: pos.x, y: pos.y },
    state: 'idle', target: null, wanderTimer: Math.random() * 3, attackCooldown: 0,
    alive: true,
  };
}

export function publicMobState(m) {
  return { id: m.id, templateId: m.templateId, name: m.name, faction: m.faction, hp: m.hp, maxHp: m.maxHp, pos: m.pos, state: m.state, alive: m.alive };
}

// Simple finite-state AI: idle/wander -> chase (if hostile+in radius) -> attack -> flee (low hp, skittish types).
export function aiTick(mob, nearbyPlayers, dt, calendar, onAttack) {
  const t = MOB_TEMPLATES[mob.templateId];
  if (!mob.alive) return;
  mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
  const slowed = mob.slowUntil && mob.slowUntil > Date.now();
  const speed = t.speed * (calendar?.isNight ? (t.nightBonus || 1) : 1) * (slowed ? 0.35 : 1);

  if (t.behavior === 'flee' && mob.hp < t.hp) {
    const threat = nearbyPlayers.find((p) => dist(p.pos, mob.pos) < t.radius);
    if (threat) {
      moveAway(mob, threat.pos, speed, dt);
      return;
    }
  }

  let victim = null;
  if (t.aggro) {
    victim = nearbyPlayers
      .filter((p) => p.alive && dist(p.pos, mob.pos) < t.radius && standing(p, t.faction) < 50)
      .sort((a, b) => dist(a.pos, mob.pos) - dist(b.pos, mob.pos))[0];
  }

  if (victim) {
    mob.state = 'chase';
    mob.target = victim.id;
    const d = dist(victim.pos, mob.pos);
    if (d > 0.9) {
      moveToward(mob, victim.pos, speed, dt);
    } else if (mob.attackCooldown <= 0) {
      mob.attackCooldown = 1.1;
      onAttack(mob, victim, t);
    }
    return;
  }

  mob.state = 'idle';
  mob.target = null;
  mob.wanderTimer -= dt;
  if (mob.wanderTimer <= 0) {
    mob.wanderTimer = 2 + Math.random() * 3;
    mob._wanderDir = { x: (Math.random() - 0.5), y: (Math.random() - 0.5) };
  }
  if (mob._wanderDir && dist(mob.pos, mob.home) < 6) {
    mob.pos.x += mob._wanderDir.x * speed * 0.3 * dt;
    mob.pos.y += mob._wanderDir.y * speed * 0.3 * dt;
  } else {
    moveToward(mob, mob.home, speed * 0.3, dt);
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function moveToward(mob, target, speed, dt) {
  const d = dist(mob.pos, target);
  if (d < 0.01) return;
  mob.pos.x += ((target.x - mob.pos.x) / d) * speed * dt;
  mob.pos.y += ((target.y - mob.pos.y) / d) * speed * dt;
}
function moveAway(mob, from, speed, dt) {
  const d = dist(mob.pos, from) || 1;
  mob.pos.x += ((mob.pos.x - from.x) / d) * speed * dt;
  mob.pos.y += ((mob.pos.y - from.y) / d) * speed * dt;
}
