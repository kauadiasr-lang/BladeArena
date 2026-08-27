import { emptySkills } from '../systems/skills.js';
import { STARTING_STANDING } from '../data/factions.js';

let nextId = 1;

export function createPlayer(name, appearance, spawnPos, saved) {
  const base = {
    id: `p${nextId++}`,
    name,
    appearance: appearance || { body: '#d9a066', hair: '#3a2a20', outfit: '#5b8dd9' },
    zone: 'overworld',
    pos: { x: spawnPos.x, y: spawnPos.y },
    dir: { x: 0, y: 0 },
    facing: 'down',
    hp: 60, maxHp: 60, mana: 40, maxMana: 40, stamina: 50, maxStamina: 50,
    skills: emptySkills(),
    inventory: [
      { id: 'rusty_sword', qty: 1 }, { id: 'bread', qty: 3 }, { id: 'minor_potion', qty: 2 },
      { id: 'rune_ignis', qty: 3 }, { id: 'rune_vita', qty: 2 }, { id: 'rune_glacies', qty: 2 },
      { id: 'arrow', qty: 10 },
    ],
    equipped: { hand: 'rusty_sword', body: null },
    gold: 25,
    factionStanding: STARTING_STANDING(),
    corruption: 0,
    outlaw: false,
    murders: 0,
    knownSpells: [],
    plotId: null,
    target: null,
    attackCooldown: 0,
    alive: true,
    respawnAt: 0,
    lastActionAt: Date.now(),
    dungeon: null, // { instanceId } when inside a dungeon zone
  };
  const player = saved ? { ...base, ...saved, id: base.id } : base;
  player.inventory = player.inventory || base.inventory;
  player.skills = { ...emptySkills(), ...(player.skills || {}) };
  player.factionStanding = { ...STARTING_STANDING(), ...(player.factionStanding || {}) };
  player.knownSpells = player.knownSpells || [];
  return player;
}

export function publicPlayerState(p) {
  return {
    id: p.id, name: p.name, appearance: p.appearance, zone: p.zone, pos: p.pos, facing: p.facing,
    hp: p.hp, maxHp: p.maxHp, corruption: p.corruption, outlaw: p.outlaw, murders: p.murders, alive: p.alive,
  };
}

export function selfState(p) {
  return {
    id: p.id, name: p.name, appearance: p.appearance, zone: p.zone, pos: p.pos,
    hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, stamina: p.stamina, maxStamina: p.maxStamina,
    skills: p.skills, inventory: p.inventory, equipped: p.equipped, gold: p.gold,
    factionStanding: p.factionStanding, corruption: p.corruption, outlaw: p.outlaw, murders: p.murders,
    knownSpells: p.knownSpells, plotId: p.plotId, alive: p.alive,
  };
}
