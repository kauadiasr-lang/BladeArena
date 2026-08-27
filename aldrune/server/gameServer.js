import { generateWorld, isWalkable, biomeAt, BIOME } from './world/worldgen.js';
import { generateDungeon, isDungeonWalkable, tickCorruptionClock } from './world/dungeon.js';
import { AstralCalendar } from './systems/time.js';
import { Store } from './persistence/store.js';
import { createPlayer, publicPlayerState, selfState } from './entities/player.js';
import { spawnMob, publicMobState, aiTick } from './entities/mob.js';
import { MOB_TEMPLATES, rollLoot } from './data/mobs.js';
import { ITEMS, itemDef } from './data/items.js';
import { gainOnUse } from './systems/skills.js';
import { adjustStanding } from './systems/factions.js';
import { prepareCast, commitCast, allKnownSpellNames } from './systems/magic.js';
import { addCorruption, pilgrimageCleanse, priceMultiplier } from './systems/corruption.js';
import { canAttackPlayer, onPlayerKilled } from './systems/pvp.js';
import { claimPlot, visitPlot, tickDecay, findPlot } from './systems/housing.js';
import { playerWeaponDamage, targetArmor, armorReduce, hitChance } from './systems/combat.js';
import { FACTIONS } from './data/factions.js';

const TICK_MS = 100;
const PLAYER_SPEED = 4.0;
const VIEW_RADIUS = 26;
const RESPAWN_MS = 7000;
const SEED = 90210;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function addItem(player, itemId, qty) {
  const def = itemDef(itemId);
  if (!def) return;
  if (def.stack) {
    const existing = player.inventory.find((it) => it.id === itemId);
    if (existing) { existing.qty += qty; return; }
  }
  player.inventory.push({ id: itemId, qty });
}
function hasItem(player, itemId, qty = 1) {
  return player.inventory.filter((it) => it.id === itemId).reduce((s, it) => s + it.qty, 0) >= qty;
}
function removeItem(player, itemId, qty) {
  let remaining = qty;
  player.inventory = player.inventory.filter((it) => {
    if (remaining <= 0 || it.id !== itemId) return true;
    if (it.qty > remaining) { it.qty -= remaining; remaining = 0; return true; }
    remaining -= it.qty; return false;
  });
}

export class GameServer {
  constructor() {
    this.world = generateWorld(SEED);
    this.calendar = new AstralCalendar();
    this.store = new Store();
    this.mobs = new Map();
    this.drops = new Map();
    this.dungeons = new Map();
    this.players = new Map();
    this.sockets = new Map(); // playerId -> ws
    this.pendingRespawns = [];
    this.vendorMult = {};
    this._lastTick = Date.now();
    this._decayAccum = 0;
    this._saveAccum = 0;
    this._dropId = 1;

    for (const sp of this.world.mobSpawns) {
      const mob = spawnMob(sp.templateId, { x: sp.x, y: sp.y });
      mob._spawnPointId = sp.id;
      this.mobs.set(mob.id, mob);
    }
  }

  start() {
    setInterval(() => this.tick(), TICK_MS);
  }

  // ---- connection lifecycle ----
  join(ws, name, appearance) {
    const cleanName = String(name || '').trim().slice(0, 16) || `Vagante${Math.floor(Math.random() * 999)}`;
    const saved = this.store.getPlayer(cleanName);
    const spawnPos = saved?.pos || { x: this.world.spawn.x + (Math.random() - 0.5) * 4, y: this.world.spawn.y + (Math.random() - 0.5) * 4 };
    const player = createPlayer(cleanName, appearance, spawnPos, saved);
    player.alive = true;
    this.players.set(player.id, player);
    this.sockets.set(player.id, ws);
    ws.playerId = player.id;

    this.send(ws, {
      t: 'welcome',
      playerId: player.id,
      world: {
        size: this.world.size, tiles: Array.from(this.world.tiles),
        spawn: this.world.spawn, dungeonEntrances: this.world.dungeonEntrances,
        housingPlots: this.world.housingPlots.map((p) => publicPlot(p, player.id)),
        vendorPos: this.world.vendorPos, shrinePos: this.world.shrinePos,
      },
      factions: FACTIONS,
      items: ITEMS,
      spellbook: allKnownSpellNames(this.store),
      self: selfState(player),
      time: this.calendar.serialize(),
    });
    this.broadcastSystem(`${player.name} chegou a Aldrune.`, 'overworld');
    return player;
  }

  leave(ws) {
    const player = this.players.get(ws.playerId);
    if (!player) return;
    if (player.dungeon) {
      const inst = this.dungeons.get(player.dungeon.instanceId);
      inst?.players.delete(player.id);
    }
    this.store.savePlayer(player);
    this.players.delete(player.id);
    this.sockets.delete(player.id);
    this.broadcastSystem(`${player.name} partiu.`, 'overworld');
  }

  send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  sendTo(playerId, msg) {
    const ws = this.sockets.get(playerId);
    if (ws) this.send(ws, msg);
  }
  broadcastSystem(msg, zone, instanceId) {
    for (const p of this.players.values()) {
      if (zone === 'overworld' && p.zone === 'overworld') this.sendTo(p.id, { t: 'system', msg });
      if (zone === 'dungeon' && p.dungeon?.instanceId === instanceId) this.sendTo(p.id, { t: 'system', msg });
    }
  }
  broadcastAll(msg) {
    for (const p of this.players.values()) this.sendTo(p.id, msg);
  }

  // ---- main loop ----
  tick() {
    const now = Date.now();
    const dt = Math.min(0.5, (now - this._lastTick) / 1000);
    this._lastTick = now;
    this.calendar.tick(dt);

    for (const player of this.players.values()) this.tickPlayer(player, dt, now);

    const overworldPlayers = [...this.players.values()].filter((p) => p.zone === 'overworld' && p.alive);
    for (const mob of this.mobs.values()) {
      if (!mob.alive) continue;
      const nearby = overworldPlayers.filter((p) => dist(p.pos, mob.pos) < 40);
      aiTick(mob, nearby, dt, this.calendar, (m, victim, tmpl) => this.mobAttackPlayer(m, victim, tmpl));
    }
    this.pendingRespawns = this.pendingRespawns.filter((r) => {
      if (now < r.at) return true;
      const mob = spawnMob(r.templateId, r.pos);
      mob._spawnPointId = r.spawnPointId;
      this.mobs.set(mob.id, mob);
      return false;
    });

    for (const inst of this.dungeons.values()) {
      const instPlayers = [...inst.players].map((id) => this.players.get(id)).filter((p) => p && p.alive);
      for (const mob of inst.mobs.values()) {
        if (!mob.alive) continue;
        aiTick(mob, instPlayers, dt, this.calendar, (m, victim, tmpl) => this.mobAttackPlayer(m, victim, tmpl, inst));
      }
      tickCorruptionClock(inst, dt, (i, threshold) => {
        const msg = threshold >= 100
          ? `A Câmara desperta por completo. Algo poderoso agora vigia ${i.name}.`
          : `Vocês sentem a corrupção crescer em ${i.name} (${threshold}%). O local está mudando.`;
        this.broadcastSystem(msg, 'dungeon', i.id);
      });
      if (inst.players.size === 0 && !inst._emptyAt) inst._emptyAt = now;
      if (inst.players.size > 0) inst._emptyAt = null;
      if (inst._emptyAt && now - inst._emptyAt > 5 * 60 * 1000) this.dungeons.delete(inst.id);
    }

    this._decayAccum += dt;
    if (this._decayAccum > 30) {
      tickDecay(this.world, this._decayAccum);
      this._decayAccum = 0;
    }
    for (const [id, drop] of this.drops) if (now > drop.expiresAt) this.drops.delete(id);
    for (const node of this.world.resourceNodes) {
      if (node.depleted && now > node.respawnAt) node.depleted = false;
    }

    this._saveAccum += dt;
    if (this._saveAccum > 20) { this.store.flush(); this._saveAccum = 0; }

    for (const player of this.players.values()) this.sendState(player);
  }

  tickPlayer(player, dt, now) {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    if (!player.alive) {
      if (now >= player.respawnAt) {
        player.alive = true;
        player.hp = Math.round(player.maxHp * 0.6);
        player.mana = Math.round(player.maxMana * 0.6);
        player.pos = { x: this.world.spawn.x, y: this.world.spawn.y };
        player.zone = 'overworld';
        player.dungeon = null;
      }
      return;
    }
    const outOfCombat = now - (player.lastCombatAt || 0) > 5000;
    player.hp = Math.min(player.maxHp, player.hp + (outOfCombat ? 1.2 : 0.2) * dt);
    player.mana = Math.min(player.maxMana, player.mana + 1.5 * dt);
    player.stamina = Math.min(player.maxStamina, player.stamina + 3 * dt);

    const dir = player.dir || { x: 0, y: 0 };
    const mag = Math.hypot(dir.x, dir.y);
    if (mag > 0.01) {
      const nx = dir.x / mag, ny = dir.y / mag;
      const slowed = player.slowUntil && player.slowUntil > now;
      const speed = PLAYER_SPEED * (slowed ? 0.35 : 1);
      const stepX = nx * speed * dt, stepY = ny * speed * dt;
      const walk = (x, y) => (player.dungeon
        ? isDungeonWalkable(this.dungeons.get(player.dungeon.instanceId), x, y)
        : isWalkable(this.world, Math.round(x), Math.round(y)));
      if (walk(player.pos.x + stepX, player.pos.y)) player.pos.x += stepX;
      if (walk(player.pos.x, player.pos.y + stepY)) player.pos.y += stepY;
      player.facing = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'down' : 'up');
    }
    visitPlot(player, this.world);
  }

  mobAttackPlayer(mob, player, template, inst) {
    const dmg = armorReduce(rollDmg(template.dmg), targetArmor(player));
    player.hp -= dmg;
    player.lastCombatAt = Date.now();
    if (player.hp <= 0 && player.alive) this.killPlayer(player, null, inst);
  }

  killPlayer(player, killerPlayer, inst) {
    player.alive = false;
    player.hp = 0;
    player.respawnAt = Date.now() + RESPAWN_MS;
    if (killerPlayer) {
      const zoneFreePvp = !!inst;
      const result = onPlayerKilled(player, killerPlayer, this.world, zoneFreePvp);
      this.sendTo(killerPlayer.id, { t: 'system', msg: `Você derrotou ${player.name}.${result.unlawful ? ' Isso foi um assassinato ilegal!' : ''}` });
      this.sendTo(player.id, { t: 'system', msg: `Você foi derrotado por ${killerPlayer.name}.${result.fullLoot ? ' Seus itens foram saqueados.' : ''}` });
    } else {
      this.sendTo(player.id, { t: 'system', msg: 'Você caiu em combate e retornará em breve.' });
    }
  }

  // ---- state broadcasting ----
  sendState(player) {
    const ws = this.sockets.get(player.id);
    if (!ws) return;
    if (player.dungeon) {
      const inst = this.dungeons.get(player.dungeon.instanceId);
      if (!inst) return;
      const players = [...inst.players].map((id) => this.players.get(id)).filter(Boolean).map(publicPlayerState);
      const mobs = [...inst.mobs.values()].filter((m) => m.alive).map(publicMobState);
      this.send(ws, {
        t: 'state', zone: 'dungeon', instanceId: inst.id, corruption: Math.round(inst.corruption),
        time: this.calendar.serialize(), self: selfState(player), players, mobs,
        drops: [...inst.drops.values()],
      });
      return;
    }
    const players = [...this.players.values()]
      .filter((p) => p.zone === 'overworld' && p.id !== player.id && dist(p.pos, player.pos) < VIEW_RADIUS)
      .map(publicPlayerState);
    const mobs = [...this.mobs.values()]
      .filter((m) => m.alive && dist(m.pos, player.pos) < VIEW_RADIUS)
      .map(publicMobState);
    const drops = [...this.drops.values()].filter((d) => dist(d.pos, player.pos) < VIEW_RADIUS);
    const nodes = this.world.resourceNodes.filter((n) => dist(n, player.pos) < VIEW_RADIUS);
    const plots = this.world.housingPlots.map((p) => publicPlot(p, player.id));
    this.send(ws, {
      t: 'state', zone: 'overworld', time: this.calendar.serialize(), self: selfState(player),
      players, mobs, drops, nodes, plots,
    });
  }

  // ---- message dispatch ----
  handleMessage(ws, msg) {
    const player = this.players.get(ws.playerId);
    if (!player) return;
    try {
      switch (msg.t) {
        case 'move': this.onMove(player, msg); break;
        case 'chat': this.onChat(player, msg); break;
        case 'attack': this.onAttack(player, msg); break;
        case 'cast': this.onCast(player, msg); break;
        case 'gather': this.onGather(player, msg); break;
        case 'craft': this.onCraft(player, msg); break;
        case 'equip': this.onEquip(player, msg); break;
        case 'use_item': this.onUseItem(player, msg); break;
        case 'pickup': this.onPickup(player, msg); break;
        case 'vendor_buy': this.onVendorBuy(player, msg); break;
        case 'vendor_sell': this.onVendorSell(player, msg); break;
        case 'toggle_outlaw': this.onToggleOutlaw(player); break;
        case 'enter_dungeon': this.onEnterDungeon(player, msg); break;
        case 'leave_dungeon': this.onLeaveDungeon(player); break;
        case 'claim_plot': this.onClaimPlot(player, msg); break;
        case 'chest_deposit': this.onChestDeposit(player, msg); break;
        case 'chest_withdraw': this.onChestWithdraw(player, msg); break;
        case 'plot_list_item': this.onPlotListItem(player, msg); break;
        case 'plot_buy': this.onPlotBuy(player, msg); break;
        case 'collect_plot_gold': this.onCollectPlotGold(player); break;
        case 'pilgrimage': this.onPilgrimage(player); break;
        default: break;
      }
    } catch (err) {
      this.sendTo(player.id, { t: 'error', msg: 'Ocorreu um erro ao processar sua ação.' });
      console.error('handleMessage error', msg.t, err);
    }
  }

  onMove(player, msg) {
    if (!player.alive) return;
    const { x = 0, y = 0 } = msg.dir || {};
    const mag = Math.hypot(x, y);
    player.dir = mag > 1 ? { x: x / mag, y: y / mag } : { x, y };
  }

  onChat(player, msg) {
    const text = String(msg.msg || '').slice(0, 200).trim();
    if (!text) return;
    const payload = { t: 'chat', from: player.name, msg: text, corrupt: player.corruption >= 45 };
    if (player.dungeon) {
      const inst = this.dungeons.get(player.dungeon.instanceId);
      for (const id of inst?.players || []) this.sendTo(id, payload);
    } else {
      for (const p of this.players.values()) if (p.zone === 'overworld') this.sendTo(p.id, payload);
    }
  }

  resolveTarget(player, targetId) {
    if (player.dungeon) {
      const inst = this.dungeons.get(player.dungeon.instanceId);
      if (inst.mobs.has(targetId)) return { entity: inst.mobs.get(targetId), kind: 'mob', inst };
      const p = this.players.get(targetId);
      if (p && p.dungeon?.instanceId === inst.id) return { entity: p, kind: 'player', inst };
      return null;
    }
    if (this.mobs.has(targetId)) return { entity: this.mobs.get(targetId), kind: 'mob' };
    const p = this.players.get(targetId);
    if (p && p.zone === 'overworld') return { entity: p, kind: 'player' };
    return null;
  }

  onAttack(player, msg) {
    if (!player.alive || player.attackCooldown > 0) return;
    const found = this.resolveTarget(player, msg.targetId);
    if (!found || !found.entity.alive) return;
    const { entity: target, kind, inst } = found;
    const { dmg, skill, ranged, weapon } = playerWeaponDamage(player);
    const range = ranged ? 9 : 1.4;
    if (dist(player.pos, target.pos) > range) { this.sendTo(player.id, { t: 'error', msg: 'Fora de alcance.' }); return; }
    if (ranged) {
      if (!hasItem(player, 'arrow', 1)) { this.sendTo(player.id, { t: 'error', msg: 'Sem flechas.' }); return; }
      removeItem(player, 'arrow', 1);
    }
    if (kind === 'player') {
      const perm = canAttackPlayer(player, target, this.world, !!player.dungeon);
      if (!perm.ok) { this.sendTo(player.id, { t: 'error', msg: perm.reason }); return; }
    }
    player.attackCooldown = 1 / (weapon?.speed || 1);
    player.lastCombatAt = Date.now();
    const gain = gainOnUse(player, skill, 0.5);
    if (gain.gained > 0) this.sendTo(player.id, { t: 'skill_up', skill, value: Math.round(gain.value * 10) / 10 });

    const chance = hitChance(player.skills[skill] || 0, kind === 'player' ? (target.skills?.[skill] || 0) : 0);
    if (Math.random() > chance) { this.sendTo(player.id, { t: 'combat', result: 'miss', targetId: target.id }); return; }
    const finalDmg = Math.round(armorReduce(dmg, targetArmor(target)));
    target.hp -= finalDmg;
    this.broadcastCombat(player, target, finalDmg, kind, inst);

    if (kind === 'mob') {
      const tmpl = MOB_TEMPLATES[target.templateId];
      if (target.hp <= 0) this.killMob(target, tmpl, player, inst);
    } else if (kind === 'player') {
      target.lastCombatAt = Date.now();
      if (target.hp <= 0 && target.alive) this.killPlayer(target, player, inst);
    }
  }

  broadcastCombat(attacker, target, dmg, kind, inst) {
    const payload = { t: 'combat', result: 'hit', attackerId: attacker.id, targetId: target.id, dmg, targetHp: Math.max(0, Math.round(target.hp)) };
    if (inst) {
      for (const id of inst.players) this.sendTo(id, payload);
    } else {
      for (const p of this.players.values()) if (p.zone === 'overworld') this.sendTo(p.id, payload);
    }
  }

  killMob(mob, tmpl, killer, inst) {
    mob.alive = false;
    const loot = rollLoot(tmpl);
    if (loot.length) {
      const dropId = `d${this._dropId++}`;
      const drop = { id: dropId, pos: { ...mob.pos }, items: loot, expiresAt: Date.now() + 180000 };
      if (inst) inst.drops.set(dropId, drop); else this.drops.set(dropId, drop);
    }
    if (tmpl.aggro) {
      const factionDelta = tmpl.faction === 'cult' ? -12 : tmpl.faction === 'bandits' ? -10 : -4;
      adjustStanding(killer, mob.faction, factionDelta);
    }
    if (!inst) {
      this.mobs.delete(mob.id);
      if (mob._spawnPointId) {
        this.pendingRespawns.push({ spawnPointId: mob._spawnPointId, templateId: mob.templateId, pos: mob.home, at: Date.now() + 20000 + Math.random() * 25000 * (this.calendar.isNight ? 0.6 : 1) });
      }
    }
  }

  onCast(player, msg) {
    if (!player.alive || player.attackCooldown > 0) return;
    const runeIds = msg.runes || [];
    // Validate everything (fragments owned, mana, effect shape) WITHOUT
    // spending anything yet - a cast that fails target/range/permission
    // checks below must not cost the player runes, mana, or hand out a
    // false Codex discovery for a spell that never actually landed.
    const prep = prepareCast(player, runeIds);
    if (!prep.ok) { this.sendTo(player.id, { t: 'error', msg: prep.error }); return; }
    const { effect } = prep;

    let target = player;
    let kind = 'player', inst = null;
    if (effect.kind !== 'heal') {
      const found = this.resolveTarget(player, msg.targetId);
      if (!found || !found.entity.alive) { this.sendTo(player.id, { t: 'error', msg: 'Alvo inválido.' }); return; }
      if (dist(player.pos, found.entity.pos) > 11) { this.sendTo(player.id, { t: 'error', msg: 'Fora de alcance.' }); return; }
      if (found.kind === 'player') {
        const perm = canAttackPlayer(player, found.entity, this.world, !!player.dungeon);
        if (!perm.ok) { this.sendTo(player.id, { t: 'error', msg: perm.reason }); return; }
      }
      ({ entity: target, kind, inst } = found);
    } else if (msg.targetId) {
      const found = this.resolveTarget(player, msg.targetId);
      if (found?.entity?.alive) target = found.entity;
    }

    // All checks passed - now it's safe to actually spend the components.
    const result = commitCast(player, this.store, runeIds, prep.counts, effect, msg.proposedName);
    player.attackCooldown = Math.max(0.9, effect.cost * 0.06);
    player.lastCombatAt = Date.now();
    const potency = this.calendar.runePotency(effect.element || (effect.kind === 'heal' ? 'heal' : ''));

    if (effect.kind === 'heal') {
      const heal = Math.round(effect.amount * potency);
      target.hp = Math.min(target.maxHp, target.hp + heal);
      this.sendTo(player.id, { t: 'system', msg: `Você conjurou ${result.spellName} (+${heal} vida).` });
    } else {
      const dmg = Math.round(armorReduce(effect.amount * potency, targetArmor(target)));
      target.hp -= dmg;
      this.broadcastCombat(player, target, dmg, kind, inst);
      if (effect.knockback) {
        const d = dist(player.pos, target.pos) || 1;
        target.pos.x += ((target.pos.x - player.pos.x) / d) * 1.5;
        target.pos.y += ((target.pos.y - player.pos.y) / d) * 1.5;
      }
      if (effect.slow) target.slowUntil = Date.now() + (effect.root ? 4000 : 2500);
      if (effect.drain) player.hp = Math.min(player.maxHp, player.hp + Math.round(dmg * 0.4));
      if (effect.corrupting) addCorruption(player, 6 * runeIds.length, this.calendar);
      gainOnUse(player, 'magery', 0.6);

      if (kind === 'mob' && target.hp <= 0) this.killMob(target, MOB_TEMPLATES[target.templateId], player, inst);
      else if (kind === 'player' && target.hp <= 0 && target.alive) this.killPlayer(target, player, inst);
    }

    if (result.discovery) {
      this.broadcastAll({ t: 'discovery', name: result.discovery.name, discoverer: result.discovery.discoverer, comboKey: result.discovery.comboKey });
      this.broadcastAll({ t: 'system', msg: `✨ ${result.discovery.discoverer} descobriu um novo feitiço: "${result.discovery.name}"! Adicionado ao Grimório compartilhado.` });
    }
  }

  onGather(player, msg) {
    const node = this.world.resourceNodes.find((n) => n.id === msg.nodeId);
    if (!node || node.depleted) return;
    if (dist(player.pos, node) > 2.2) { this.sendTo(player.id, { t: 'error', msg: 'Aproxime-se do recurso.' }); return; }
    const def = itemDef(node.item);
    const gain = gainOnUse(player, def.skill, 0.5);
    if (gain.gained > 0) this.sendTo(player.id, { t: 'skill_up', skill: def.skill, value: Math.round(gain.value * 10) / 10 });
    addItem(player, node.item, 1);
    node.depleted = true;
    node.respawnAt = Date.now() + 30000 + Math.random() * 30000;
    this.sendTo(player.id, { t: 'system', msg: `Você coletou ${def.name}.` });
  }

  onCraft(player, msg) {
    if (msg.recipe === 'smelt_ore') {
      if (!hasItem(player, 'raw_ore', 2)) { this.sendTo(player.id, { t: 'error', msg: 'Requer 2 Minério Bruto.' }); return; }
      removeItem(player, 'raw_ore', 2);
      addItem(player, 'iron_ingot', 1);
      gainOnUse(player, 'mining', 0.3);
    }
  }

  onEquip(player, msg) {
    const item = player.inventory[msg.idx];
    if (!item) return;
    const def = itemDef(item.id);
    if (def.type === 'weapon') player.equipped.hand = item.id;
    else if (def.type === 'armor') player.equipped.body = item.id;
  }

  onUseItem(player, msg) {
    const item = player.inventory[msg.idx];
    if (!item) return;
    const def = itemDef(item.id);
    if (def.heal) {
      player.hp = Math.min(player.maxHp, player.hp + def.heal);
      item.qty -= 1;
      if (item.qty <= 0) player.inventory.splice(msg.idx, 1);
    }
  }

  onPickup(player, msg) {
    const pool = player.dungeon ? this.dungeons.get(player.dungeon.instanceId)?.drops : this.drops;
    const drop = pool?.get(msg.dropId);
    if (!drop || dist(player.pos, drop.pos) > 2.2) return;
    for (const it of drop.items) addItem(player, it.id, it.qty);
    pool.delete(msg.dropId);
  }

  onVendorBuy(player, msg) {
    if (dist(player.pos, this.world.vendorPos) > 3) { this.sendTo(player.id, { t: 'error', msg: 'Aproxime-se do Mercador.' }); return; }
    const def = itemDef(msg.itemId);
    if (!def) return;
    const price = Math.ceil(def.value * (this.vendorMult[msg.itemId] || 1) * priceMultiplier(player));
    if (player.gold < price) { this.sendTo(player.id, { t: 'error', msg: 'Ouro insuficiente.' }); return; }
    player.gold -= price;
    addItem(player, msg.itemId, 1);
    this.vendorMult[msg.itemId] = Math.min(3, (this.vendorMult[msg.itemId] || 1) * 1.03);
    gainOnUse(player, 'mercantile', 0.3);
  }

  onVendorSell(player, msg) {
    if (dist(player.pos, this.world.vendorPos) > 3) { this.sendTo(player.id, { t: 'error', msg: 'Aproxime-se do Mercador.' }); return; }
    const item = player.inventory[msg.idx];
    if (!item) return;
    const def = itemDef(item.id);
    const price = Math.floor(def.value * 0.6 * (1 / (this.vendorMult[item.id] || 1)));
    player.gold += price * item.qty;
    this.vendorMult[item.id] = Math.max(0.4, (this.vendorMult[item.id] || 1) * 0.97);
    player.inventory.splice(msg.idx, 1);
    gainOnUse(player, 'mercantile', 0.3);
  }

  onToggleOutlaw(player) {
    if (player.murders >= 5) { this.sendTo(player.id, { t: 'error', msg: 'Você é Procurado e não pode deixar de ser Foragido.' }); return; }
    player.outlaw = !player.outlaw;
    this.sendTo(player.id, { t: 'system', msg: player.outlaw ? 'Você agora é um Foragido: pode lutar contra outros jogadores, mas também pode ser caçado.' : 'Você voltou a ser um cidadão de bem.' });
  }

  onEnterDungeon(player, msg) {
    const entrance = this.world.dungeonEntrances.find((e) => e.id === msg.entranceId);
    if (!entrance || dist(player.pos, entrance) > 2.5) { this.sendTo(player.id, { t: 'error', msg: 'Aproxime-se da entrada.' }); return; }
    let inst = [...this.dungeons.values()].find((d) => d.entranceId === entrance.id && d.players.size > 0 && d.players.size < 4 && d.corruption < 90);
    if (!inst) {
      inst = generateDungeon(Date.now() & 0xffffffff, entrance);
      this.dungeons.set(inst.id, inst);
    }
    player._overworldReturn = { ...player.pos };
    player.zone = 'dungeon';
    player.dungeon = { instanceId: inst.id };
    player.pos = { ...inst.entrancePos };
    inst.players.add(player.id);
    this.send(this.sockets.get(player.id), { t: 'dungeon_enter', instance: { id: inst.id, name: inst.name, size: inst.size, grid: Array.from(inst.grid), entrancePos: inst.entrancePos } });
  }

  onLeaveDungeon(player) {
    if (!player.dungeon) return;
    const inst = this.dungeons.get(player.dungeon.instanceId);
    inst?.players.delete(player.id);
    player.zone = 'overworld';
    player.pos = player._overworldReturn || { ...this.world.spawn };
    player.dungeon = null;
    this.send(this.sockets.get(player.id), { t: 'dungeon_leave' });
  }

  onClaimPlot(player, msg) {
    const res = claimPlot(player, this.world, msg.plotId);
    if (!res.ok) { this.sendTo(player.id, { t: 'error', msg: res.error }); return; }
    this.sendTo(player.id, { t: 'system', msg: 'Você reivindicou este lote de terra. Visite-o regularmente ou ele se deteriorará.' });
  }

  ownPlot(player) { return this.world.housingPlots.find((p) => p.claimedBy === player.id); }

  onChestDeposit(player, msg) {
    const plot = this.ownPlot(player);
    const item = player.inventory[msg.idx];
    if (!plot || !item || dist(player.pos, plot) > 3) return;
    const qty = Math.min(item.qty, msg.qty || item.qty);
    plot.chest.push({ id: item.id, qty });
    item.qty -= qty;
    if (item.qty <= 0) player.inventory.splice(msg.idx, 1);
  }

  onChestWithdraw(player, msg) {
    const plot = this.ownPlot(player);
    const entry = plot?.chest?.[msg.idx];
    if (!plot || !entry || dist(player.pos, plot) > 3) return;
    addItem(player, entry.id, entry.qty);
    plot.chest.splice(msg.idx, 1);
  }

  onPlotListItem(player, msg) {
    const plot = this.ownPlot(player);
    const entry = plot?.chest?.[msg.idx];
    if (!plot || !entry || !msg.price || msg.price <= 0) return;
    plot.shop = plot.shop || [];
    plot.shop.push({ id: entry.id, qty: entry.qty, price: Math.round(msg.price) });
    plot.chest.splice(msg.idx, 1);
  }

  onPlotBuy(player, msg) {
    const plot = findPlot(this.world, msg.plotId);
    const listing = plot?.shop?.[msg.listingIdx];
    if (!plot || !listing || dist(player.pos, plot) > 3) return;
    if (player.gold < listing.price) { this.sendTo(player.id, { t: 'error', msg: 'Ouro insuficiente.' }); return; }
    player.gold -= listing.price;
    plot.pendingGold = (plot.pendingGold || 0) + listing.price;
    addItem(player, listing.id, listing.qty);
    plot.shop.splice(msg.listingIdx, 1);
  }

  onCollectPlotGold(player) {
    const plot = this.ownPlot(player);
    if (!plot || dist(player.pos, plot) > 3 || !plot.pendingGold) return;
    player.gold += plot.pendingGold;
    this.sendTo(player.id, { t: 'system', msg: `Você coletou ${plot.pendingGold} de ouro da sua banca.` });
    plot.pendingGold = 0;
  }

  onPilgrimage(player) {
    if (dist(player.pos, this.world.shrinePos) > 3) { this.sendTo(player.id, { t: 'error', msg: 'Aproxime-se do Santuário da Lua.' }); return; }
    if (player.corruption <= 0) { this.sendTo(player.id, { t: 'system', msg: 'Sua alma já está pura.' }); return; }
    pilgrimageCleanse(player, 25);
    this.sendTo(player.id, { t: 'system', msg: `Peregrinação concluída. Corrupção reduzida (agora ${Math.round(player.corruption)}).` });
  }
}

function rollDmg([min, max]) { return min + Math.random() * (max - min); }

function publicPlot(plot, viewerId) {
  const isOwner = plot.claimedBy === viewerId;
  return {
    id: plot.id, x: plot.x, y: plot.y, claimedBy: plot.claimedBy, ownerName: plot.ownerName,
    decay: Math.round(plot.decay), shop: plot.shop || [], ruinLoot: plot.ruinLoot || null,
    chest: isOwner ? plot.chest : undefined,
    pendingGold: isOwner ? (plot.pendingGold || 0) : undefined,
    mine: isOwner,
  };
}
