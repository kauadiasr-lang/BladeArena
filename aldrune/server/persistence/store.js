import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'saves');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(file, fallback) {
  ensureDir();
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  ensureDir();
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export class Store {
  constructor() {
    this.players = loadJSON('players.json', {});
    this.codex = loadJSON('codex.json', {});
    this.plots = loadJSON('plots.json', {});
    this.dirty = false;
  }

  savePlayer(player) {
    this.players[player.name.toLowerCase()] = serializePlayer(player);
    this.dirty = true;
  }

  getPlayer(name) {
    return this.players[name.toLowerCase()] || null;
  }

  saveCodexEntry(comboKey, entry) {
    this.codex[comboKey] = entry;
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    saveJSON('players.json', this.players);
    saveJSON('codex.json', this.codex);
    saveJSON('plots.json', this.plots);
    this.dirty = false;
  }
}

export function serializePlayer(player) {
  return {
    name: player.name, appearance: player.appearance, pos: player.pos,
    hp: player.hp, maxHp: player.maxHp, mana: player.mana, maxMana: player.maxMana,
    stamina: player.stamina, maxStamina: player.maxStamina,
    skills: player.skills, inventory: player.inventory, equipped: player.equipped,
    gold: player.gold, factionStanding: player.factionStanding, corruption: player.corruption,
    outlaw: player.outlaw, murders: player.murders, knownSpells: player.knownSpells,
    plotId: player.plotId, savedAt: Date.now(),
  };
}
