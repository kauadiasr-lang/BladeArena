import { state, RUNES, ITEM_ICON } from './state.js';

let net = null;
const SKILL_NAMES = {
  swordsmanship: 'Espadas', archery: 'Arco e Flecha', magery: 'Magia',
  mining: 'Mineração', herbalism: 'Herbalismo', woodcutting: 'Corte de Madeira',
  lockpicking: 'Arrombamento', mercantile: 'Mercancia',
};
const VENDOR_STOCK = ['minor_potion', 'bread', 'arrow', 'rusty_sword', 'hunting_bow', 'iron_dagger', 'leather_vest', 'apprentice_staff'];

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function standingLabel(v) {
  if (v >= 75) return 'Reverenciado'; if (v >= 35) return 'Aliado'; if (v >= 10) return 'Amistoso';
  if (v > -10) return 'Neutro'; if (v > -35) return 'Desconfiado'; if (v > -75) return 'Hostil';
  return 'Inimigo Jurado';
}
function corruptionTitle(v) {
  if (v >= 75) return 'Amaldiçoado'; if (v >= 45) return 'Corrompido'; if (v >= 15) return 'Manchado'; return 'Puro';
}

export function initUI(netInstance) {
  net = netInstance;
  document.querySelectorAll('#hud-hotbar button').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  document.querySelectorAll('.panel .close').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.panel').classList.add('hidden'));
  });
  document.getElementById('btn-cast').addEventListener('click', castSelected);
}

export function handleAction(action) {
  if (action === 'attack') { if (state.target) net.send({ t: 'attack', targetId: state.target }); return; }
  if (action === 'toggle-outlaw') { net.send({ t: 'toggle_outlaw' }); return; }
  const map = { 'toggle-spellcraft': 'panel-spellcraft', 'toggle-inventory': 'panel-inventory', 'toggle-skills': 'panel-skills', 'toggle-factions': 'panel-factions', 'toggle-map': 'panel-map' };
  const id = map[action];
  if (id) togglePanel(id);
}
export function togglePanel(id) {
  const el = document.getElementById(id);
  const wasHidden = el.classList.contains('hidden');
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  if (wasHidden) el.classList.remove('hidden');
  if (id === 'panel-map' && wasHidden) drawMinimap();
  if (id === 'panel-spellcraft' && wasHidden) { renderRunePicker(); updateCodex(); }
  if (id === 'panel-inventory' && wasHidden) updateInventory();
  if (id === 'panel-skills' && wasHidden) updateSkills();
  if (id === 'panel-factions' && wasHidden) updateFactions();
}

export function toast(msg) {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function addChatLine(text, cls) {
  const log = document.getElementById('chat-log');
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 80) log.removeChild(log.firstChild);
}

export function updateHud() {
  const s = state.self;
  if (!s) return;
  setBar('bar-hp', 'txt-hp', s.hp, s.maxHp);
  setBar('bar-mana', 'txt-mana', s.mana, s.maxMana);
  setBar('bar-stamina', 'txt-stamina', s.stamina, s.maxStamina);
  document.getElementById('txt-gold').textContent = `${Math.round(s.gold)} ouro`;
  document.getElementById('txt-corruption').textContent = `${corruptionTitle(s.corruption)} (${Math.round(s.corruption)})`;
  const outlawEl = document.getElementById('txt-outlaw');
  outlawEl.classList.toggle('hidden', !s.outlaw);
  outlawEl.textContent = s.murders >= 5 ? 'PROCURADO' : 'FORAGIDO';

  const t = state.time;
  document.getElementById('txt-clock').textContent = `Dia ${t.day}, ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  document.getElementById('txt-moon').textContent = `Lua: ${t.moonPhase}`;
  document.getElementById('txt-weather').textContent = t.weather;

  updateTargetPanel();
  updatePrompt();
}

function setBar(barId, txtId, cur, max) {
  document.getElementById(barId).style.width = `${Math.max(0, (cur / max) * 100)}%`;
  document.getElementById(txtId).textContent = `${Math.round(cur)}/${Math.round(max)}`;
}

function updateTargetPanel() {
  const panel = document.getElementById('hud-target');
  if (!state.target) { panel.classList.add('hidden'); return; }
  const entity = state.mobs.find((m) => m.id === state.target) || state.players.find((p) => p.id === state.target);
  if (!entity || !entity.alive) { panel.classList.add('hidden'); state.target = null; return; }
  panel.classList.remove('hidden');
  document.getElementById('target-name').textContent = entity.name;
  document.getElementById('bar-target-hp').style.width = `${Math.max(0, (entity.hp / entity.maxHp) * 100)}%`;
}

function nearestInteractable() {
  const s = state.self; if (!s) return null;
  if (state.zone === 'dungeon') return null;
  const w = state.world;
  const candidates = [];
  for (const d of w.dungeonEntrances) candidates.push({ kind: 'dungeon', ref: d, d: dist(s.pos, d) });
  for (const n of state.nodes) if (!n.depleted) candidates.push({ kind: 'gather', ref: n, d: dist(s.pos, n) });
  candidates.push({ kind: 'vendor', ref: w.vendorPos, d: dist(s.pos, w.vendorPos) });
  candidates.push({ kind: 'shrine', ref: w.shrinePos, d: dist(s.pos, w.shrinePos) });
  for (const p of state.plots) candidates.push({ kind: p.mine ? 'ownplot' : p.claimedBy ? 'otherplot' : 'freeplot', ref: p, d: dist(s.pos, p) });
  candidates.sort((a, b) => a.d - b.d);
  const closest = candidates[0];
  if (!closest || closest.d > 2.6) return null;
  return closest;
}

function updatePrompt() {
  const el = document.getElementById('prompt-interact');
  const it = nearestInteractable();
  if (!it) { el.classList.add('hidden'); return; }
  const label = {
    dungeon: `[E] Entrar em ${it.ref.name}`, gather: '[E] Coletar recurso', vendor: '[E] Ver Mercador',
    shrine: '[E] Fazer Peregrinação (reduz Corrupção)', ownplot: '[E] Ver seu lote', otherplot: null,
    freeplot: '[E] Reivindicar este lote',
  }[it.kind];
  if (!label) { el.classList.add('hidden'); return; }
  el.textContent = label;
  el.classList.remove('hidden');
  state._nearest = it;
}

export function doInteract() {
  const it = state._nearest;
  if (!it) return;
  if (it.kind === 'dungeon') net.send({ t: 'enter_dungeon', entranceId: it.ref.id });
  else if (it.kind === 'gather') net.send({ t: 'gather', nodeId: it.ref.id });
  else if (it.kind === 'vendor') { togglePanel('panel-vendor'); renderVendor(); }
  else if (it.kind === 'shrine') net.send({ t: 'pilgrimage' });
  else if (it.kind === 'ownplot') { togglePanel('panel-housing'); renderHousing(); }
  else if (it.kind === 'freeplot') net.send({ t: 'claim_plot', plotId: it.ref.id });
}

// ---- Inventory ----
export function updateInventory() {
  const list = document.getElementById('inventory-list');
  list.innerHTML = '';
  const s = state.self;
  const nearVendor = s && dist(s.pos, state.world.vendorPos) <= 3;
  const ownPlot = state.plots.find((p) => p.mine);
  const nearOwnPlot = ownPlot && s && dist(s.pos, ownPlot) <= 3;
  s.inventory.forEach((item, idx) => {
    const def = state.items[item.id];
    if (!def) return;
    const row = document.createElement('div');
    row.className = 'item-row';
    const actions = [];
    if (def.type === 'weapon' || def.type === 'armor') actions.push(`<button data-act="equip">Equipar</button>`);
    if (def.heal) actions.push(`<button data-act="use">Usar</button>`);
    if (nearVendor) actions.push(`<button data-act="sell">Vender (${Math.floor(def.value * 0.6)}o)</button>`);
    if (nearOwnPlot) actions.push(`<button data-act="deposit">Guardar</button>`);
    row.innerHTML = `<span>${ITEM_ICON[def.type] || '❔'} ${def.name} ${item.qty > 1 ? `×${item.qty}` : ''}</span><span class="item-actions">${actions.join('')}</span>`;
    row.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'equip') net.send({ t: 'equip', idx });
        if (act === 'use') net.send({ t: 'use_item', idx });
        if (act === 'sell') net.send({ t: 'vendor_sell', idx });
        if (act === 'deposit') net.send({ t: 'chest_deposit', idx, qty: item.qty });
      });
    });
    list.appendChild(row);
  });
  document.getElementById('txt-equip-hand').textContent = s.equipped.hand ? state.items[s.equipped.hand]?.name : 'Punho';
  document.getElementById('txt-equip-body').textContent = s.equipped.body ? state.items[s.equipped.body]?.name : 'Sem armadura';
}

// ---- Skills ----
export function updateSkills() {
  const list = document.getElementById('skills-list');
  list.innerHTML = '';
  const s = state.self;
  for (const [key, val] of Object.entries(s.skills)) {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `<div class="label"><span>${SKILL_NAMES[key] || key}</span><span>${val.toFixed(1)}</span></div><div class="skill-bar"><div class="skill-bar-fill" style="width:${val}%"></div></div>`;
    list.appendChild(row);
  }
}

// ---- Factions ----
export function updateFactions() {
  const list = document.getElementById('factions-list');
  list.innerHTML = '';
  const s = state.self;
  for (const [id, val] of Object.entries(s.factionStanding)) {
    const def = state.factions[id];
    if (!def) continue;
    const pct = (val + 100) / 2;
    const row = document.createElement('div');
    row.className = 'faction-row';
    row.innerHTML = `<div class="label"><span>${def.name}</span><span>${standingLabel(val)} (${Math.round(val)})</span></div><div class="faction-bar"><div class="faction-bar-fill" style="width:${pct}%;left:0;background:${def.color}"></div></div>`;
    list.appendChild(row);
  }
}

// ---- Spellcraft ----
export function renderRunePicker() {
  const picker = document.getElementById('rune-picker');
  picker.innerHTML = '';
  const counts = {};
  for (const it of state.self.inventory) {
    if (it.id.startsWith('rune_')) counts[it.id.slice(5)] = (counts[it.id.slice(5)] || 0) + it.qty;
  }
  for (const [id, def] of Object.entries(RUNES)) {
    const chip = document.createElement('div');
    chip.className = 'rune-chip' + (state.selectedRunes.includes(id) ? ' selected' : '');
    const qty = counts[id] || 0;
    chip.innerHTML = `${def.icon} ${def.label}<div class="qty">×${qty}</div>`;
    chip.addEventListener('click', () => {
      if (qty <= 0 && !state.selectedRunes.includes(id)) return;
      const i = state.selectedRunes.indexOf(id);
      if (i >= 0) state.selectedRunes.splice(i, 1);
      else if (state.selectedRunes.length < 3) state.selectedRunes.push(id);
      renderRunePicker();
      updateSpellPreview();
    });
    picker.appendChild(chip);
  }
}
function updateSpellPreview() {
  const preview = document.getElementById('spell-preview');
  if (state.selectedRunes.length === 0) { preview.textContent = 'Selecione runas...'; return; }
  const labels = state.selectedRunes.map((id) => RUNES[id].label).join(' + ');
  const corrupting = state.selectedRunes.some((id) => RUNES[id].corrupting);
  preview.textContent = `${labels}${corrupting ? ' — magia sombria: aumenta Corrupção' : ''}`;
}
function castSelected() {
  if (state.selectedRunes.length === 0) return;
  const proposedName = document.getElementById('spell-name-input').value.trim();
  net.send({ t: 'cast', runes: [...state.selectedRunes], targetId: state.target || undefined, proposedName: proposedName || undefined });
  state.selectedRunes = [];
  renderRunePicker();
  updateSpellPreview();
}
export function updateCodex() {
  document.getElementById('codex-count').textContent = Object.keys(state.spellbook).length;
  const list = document.getElementById('codex-list');
  list.innerHTML = '';
  for (const s of Object.values(state.spellbook)) {
    const div = document.createElement('div');
    div.textContent = `${s.name} — descoberto por ${s.discoverer}`;
    list.appendChild(div);
  }
}

// ---- Vendor ----
function renderVendor() {
  const list = document.getElementById('vendor-buy-list');
  list.innerHTML = '';
  for (const id of VENDOR_STOCK) {
    const def = state.items[id];
    if (!def) continue;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<span>${ITEM_ICON[def.type] || '❔'} ${def.name}</span><span class="item-actions"><button>Comprar (${def.value}o)</button></span>`;
    row.querySelector('button').addEventListener('click', () => net.send({ t: 'vendor_buy', itemId: id }));
    list.appendChild(row);
  }
}

// ---- Housing ----
function renderHousing() {
  const plot = state.plots.find((p) => p.mine);
  const body = document.getElementById('housing-body');
  if (!plot) { body.innerHTML = '<p class="panel-note">Você ainda não possui um lote.</p>'; return; }
  let html = `<p class="panel-note">Deterioração: ${plot.decay}% — visite regularmente para conservar o lote.</p>`;
  html += `<p>Ouro pendente da banca: ${plot.pendingGold || 0} <button id="btn-collect-gold">Coletar</button></p>`;
  html += '<h4>Baú</h4><div id="chest-list" class="item-list"></div>';
  html += '<h4>Banca (à venda)</h4><div id="shop-list" class="item-list"></div>';
  body.innerHTML = html;
  document.getElementById('btn-collect-gold').addEventListener('click', () => net.send({ t: 'collect_plot_gold' }));
  const chestList = document.getElementById('chest-list');
  (plot.chest || []).forEach((entry, idx) => {
    const def = state.items[entry.id];
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<span>${def?.name || entry.id} ×${entry.qty}</span><span class="item-actions"><button data-w>Retirar</button><input type="number" min="1" value="10" style="width:50px"><button data-l>Anunciar</button></span>`;
    row.querySelector('[data-w]').addEventListener('click', () => net.send({ t: 'chest_withdraw', idx }));
    row.querySelector('[data-l]').addEventListener('click', () => {
      const price = Number(row.querySelector('input').value) || 1;
      net.send({ t: 'plot_list_item', idx, price });
    });
    chestList.appendChild(row);
  });
  const shopList = document.getElementById('shop-list');
  (plot.shop || []).forEach((entry) => {
    const def = state.items[entry.id];
    const row = document.createElement('div');
    row.className = 'item-row';
    row.textContent = `${def?.name || entry.id} ×${entry.qty} — ${entry.price}o`;
    shopList.appendChild(row);
  });
}

// ---- Minimap ----
export function drawMinimap() {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  const w = state.world;
  if (!w) return;
  const scale = canvas.width / w.size;
  for (let y = 0; y < w.size; y++) {
    for (let x = 0; x < w.size; x++) {
      const biome = w.tiles[y * w.size + x];
      ctx.fillStyle = ['#1c3f5e', '#c9b378', '#4f8a3a', '#25532a', '#7c703f', '#6b6b6b', '#3c4a30', '#4a3f52', '#a3854f'][biome] || '#222';
      ctx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
    }
  }
  ctx.font = `${Math.max(8, scale * 2)}px sans-serif`;
  ctx.textAlign = 'center';
  for (const d of w.dungeonEntrances) ctx.fillText('⚔️', d.x * scale, d.y * scale);
  for (const p of state.plots) if (p.claimedBy) ctx.fillText(p.mine ? '🏡' : '🏠', p.x * scale, p.y * scale);
  if (state.self) {
    ctx.fillStyle = '#ffdd66';
    ctx.beginPath();
    ctx.arc(state.self.pos.x * scale, state.self.pos.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
