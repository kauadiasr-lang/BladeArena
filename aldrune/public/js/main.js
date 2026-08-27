import { Net } from './net.js';
import { state, TILE } from './state.js';
import { setupInput } from './input.js';
import { startRenderLoop } from './render.js';
import * as ui from './ui.js';

const SKIN = ['#d9a066', '#c17a4e', '#8a5a35', '#e8c39e', '#5a3d28'];
const HAIR = ['#3a2a20', '#161616', '#8a6a3a', '#c9a227', '#7a2a2a'];
const OUTFIT = ['#5b8dd9', '#7a4ab1', '#4a9d5f', '#b4394a', '#d4af6a'];

const appearance = { body: SKIN[0], hair: HAIR[0], outfit: OUTFIT[0] };

function buildSwatches(container, colors, key) {
  container.innerHTML = '';
  colors.forEach((c, i) => {
    const el = document.createElement('div');
    el.style.background = c;
    if (i === 0) el.classList.add('selected');
    el.addEventListener('click', () => {
      appearance[key] = c;
      [...container.children].forEach((ch) => ch.classList.remove('selected'));
      el.classList.add('selected');
    });
    container.appendChild(el);
  });
}
buildSwatches(document.querySelector('.swatches[data-target="body"]'), SKIN, 'body');
buildSwatches(document.querySelector('.swatches[data-target="hair"]'), HAIR, 'hair');
buildSwatches(document.querySelector('.swatches[data-target="outfit"]'), OUTFIT, 'outfit');

const net = new Net(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
state.net = net;
ui.initUI(net);
window.__ALDRUNE_STATE__ = state; // debug/introspection hook

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.getElementById('btn-enter').addEventListener('click', enter);
document.getElementById('input-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });

async function enter() {
  const name = document.getElementById('input-name').value.trim();
  if (!name) { document.getElementById('input-name').focus(); return; }
  document.getElementById('btn-enter').disabled = true;
  document.getElementById('btn-enter').textContent = 'Conectando...';
  try {
    await net.connect();
    net.send({ t: 'join', name, appearance });
  } catch (err) {
    document.getElementById('btn-enter').disabled = false;
    document.getElementById('btn-enter').textContent = 'Entrar em Aldrune';
    ui.toast('Não foi possível conectar ao servidor.');
  }
}

net.on('welcome', (msg) => {
  state.playerId = msg.playerId;
  state.world = { ...msg.world, tiles: new Uint8Array(msg.world.tiles) };
  state.factions = msg.factions;
  state.items = msg.items;
  state.spellbook = msg.spellbook;
  state.self = msg.self;
  state.time = msg.time;
  switchScreen('screen-game');
  const canvas = document.getElementById('canvas');
  startRenderLoop(canvas);
  setupInput(net, ui.handleAction, ui.doInteract);
  canvas.addEventListener('click', onCanvasClick);
  ui.addChatLine('Bem-vindo a Aldrune. Use WASD para mover, clique num alvo e Espaço para atacar, E para interagir.', 'sys');
  ui.updateHud();
});

net.on('state', (msg) => {
  state.zone = msg.zone;
  state.self = msg.self;
  state.players = msg.players;
  state.mobs = msg.mobs;
  state.time = msg.time;
  state.drops = msg.drops || [];
  if (msg.zone === 'overworld') {
    state.nodes = msg.nodes || [];
    state.plots = msg.plots || [];
  } else {
    state.instanceCorruption = msg.corruption;
  }
  ui.updateHud();
  if (!panelHidden('panel-inventory')) ui.updateInventory();
  if (!panelHidden('panel-skills')) ui.updateSkills();
  if (!panelHidden('panel-factions')) ui.updateFactions();
  if (!panelHidden('panel-map')) ui.drawMinimap();
});

net.on('dungeon_enter', (msg) => {
  state.instance = msg.instance;
  ui.toast(`Você adentra ${msg.instance.name}...`);
});
net.on('dungeon_leave', () => {
  state.instance = null;
  ui.toast('Você retorna à superfície.');
});

net.on('chat', (msg) => ui.addChatLine(`${msg.from}: ${msg.msg}`, msg.corrupt ? 'corrupt-msg' : null));
net.on('system', (msg) => ui.addChatLine(msg.msg, 'sys'));
net.on('error', (msg) => ui.toast(msg.msg));
net.on('skill_up', (msg) => {
  spawnFloat(`+${SKILL_LABEL(msg.skill)}`, '#d4af6a', 0, -10, false);
  if (!panelHidden('panel-skills')) ui.updateSkills();
});
net.on('discovery', (msg) => {
  state.spellbook[msg.comboKey] = { name: msg.name, discoverer: msg.discoverer };
  ui.toast(`✨ Novo feitiço descoberto: "${msg.name}" por ${msg.discoverer}!`);
  if (!panelHidden('panel-spellcraft')) ui.updateCodex();
});
net.on('combat', (msg) => {
  const isSelf = msg.targetId === state.playerId;
  const entity = findEntity(msg.targetId);
  const color = msg.result === 'miss' ? '#999' : (isSelf ? '#d64545' : '#ffd166');
  const text = msg.result === 'miss' ? 'ERROU' : `-${msg.dmg}`;
  if (entity) spawnFloat(text, color, entity.pos.x, entity.pos.y, true);
  else if (isSelf) spawnFloat(text, color, 0, 0, false);
});
net.on('__close', () => ui.toast('Conexão perdida com o servidor.'));

function findEntity(id) {
  if (id === state.playerId) return state.self;
  return state.mobs.find((m) => m.id === id) || state.players.find((p) => p.id === id);
}
function spawnFloat(text, color, x, y, world) {
  state.floatingTexts.push({ text, color, x, y, world, createdAt: Date.now() });
}
function panelHidden(id) { return document.getElementById(id).classList.contains('hidden'); }
function SKILL_LABEL(key) {
  const names = { swordsmanship: 'Espadas', archery: 'Arco', magery: 'Magia', mining: 'Mineração', herbalism: 'Herbalismo', woodcutting: 'Corte', lockpicking: 'Arromb.', mercantile: 'Mercancia' };
  return names[key] || key;
}

function onCanvasClick(e) {
  if (!state.self) return;
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = state.self.pos.x + (mx - canvas.width / 2) / TILE;
  const wy = state.self.pos.y + (my - canvas.height / 2) / TILE;
  let best = null, bestD = 1.1;
  for (const m of state.mobs) {
    if (!m.alive) continue;
    const d = Math.hypot(m.pos.x - wx, m.pos.y - wy);
    if (d < bestD) { bestD = d; best = m.id; }
  }
  for (const p of state.players) {
    if (!p.alive) continue;
    const d = Math.hypot(p.pos.x - wx, p.pos.y - wy);
    if (d < bestD) { bestD = d; best = p.id; }
  }
  state.target = best;
}
