import { state, TILE, BIOME_COLOR } from './state.js';

const FACTION_MOB_COLOR = { wildkin: '#6fae52', bandits: '#b0563a', cult: '#7a4ab1', guard: '#6fa8dc' };

export function startRenderLoop(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
  window.addEventListener('resize', resize);
  resize();

  function frame() {
    draw(ctx, canvas);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function worldToScreen(x, y, cam, canvas) {
  return { x: (x - cam.x) * TILE + canvas.width / 2, y: (y - cam.y) * TILE + canvas.height / 2 };
}

function draw(ctx, canvas) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.self) return;
  const cam = state.self.pos;

  if (state.zone === 'dungeon' && state.instance) drawDungeon(ctx, canvas, cam);
  else if (state.world) drawOverworld(ctx, canvas, cam);

  drawDrops(ctx, canvas, cam);
  drawMobs(ctx, canvas, cam);
  drawPlayers(ctx, canvas, cam);
  drawSelf(ctx, canvas);
  drawFloatingTexts(ctx, canvas, cam);
  if (state.zone === 'overworld') drawNightOverlay(ctx, canvas);
}

function drawOverworld(ctx, canvas, cam) {
  const world = state.world;
  const tilesX = Math.ceil(canvas.width / TILE) + 2;
  const tilesY = Math.ceil(canvas.height / TILE) + 2;
  const startX = Math.floor(cam.x - tilesX / 2);
  const startY = Math.floor(cam.y - tilesY / 2);
  for (let ty = startY; ty < startY + tilesY; ty++) {
    for (let tx = startX; tx < startX + tilesX; tx++) {
      if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) continue;
      const biome = world.tiles[ty * world.size + tx];
      const p = worldToScreen(tx, ty, cam, canvas);
      ctx.fillStyle = BIOME_COLOR[biome] || '#222';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), TILE + 1, TILE + 1);
    }
  }
  for (const d of world.dungeonEntrances) drawIcon(ctx, canvas, cam, d, '⚔️', d.name);
  drawIcon(ctx, canvas, cam, world.vendorPos, '🛒', 'Mercador');
  drawIcon(ctx, canvas, cam, world.shrinePos, '🌙', 'Santuário da Lua');
  for (const n of state.nodes) if (!n.depleted) drawIcon(ctx, canvas, cam, n, nodeIcon(n.item), null, 18);
  for (const p of state.plots) {
    const icon = p.mine ? '🏡' : p.claimedBy ? '🏠' : '🟫';
    drawIcon(ctx, canvas, cam, p, icon, p.ownerName ? `Lote de ${p.ownerName}` : 'Lote livre', 20);
  }
}

function drawDungeon(ctx, canvas, cam) {
  const inst = state.instance;
  const tilesX = Math.ceil(canvas.width / TILE) + 2;
  const tilesY = Math.ceil(canvas.height / TILE) + 2;
  const startX = Math.floor(cam.x - tilesX / 2);
  const startY = Math.floor(cam.y - tilesY / 2);
  for (let ty = startY; ty < startY + tilesY; ty++) {
    for (let tx = startX; tx < startX + tilesX; tx++) {
      if (tx < 0 || ty < 0 || tx >= inst.size || ty >= inst.size) continue;
      const floor = inst.grid[ty * inst.size + tx] === 1;
      const p = worldToScreen(tx, ty, cam, canvas);
      ctx.fillStyle = floor ? '#2a2436' : '#0c0a12';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), TILE + 1, TILE + 1);
    }
  }
  const corruptAlpha = Math.min(0.45, (state.instanceCorruption || 0) / 220);
  ctx.fillStyle = `rgba(90,20,120,${corruptAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function nodeIcon(item) {
  if (item === 'raw_ore') return '⛏️';
  if (item === 'wood_log') return '🪵';
  return '🌿';
}

function drawIcon(ctx, canvas, cam, pos, icon, label, size = 22) {
  const p = worldToScreen(pos.x, pos.y, cam, canvas);
  if (p.x < -40 || p.y < -40 || p.x > canvas.width + 40 || p.y > canvas.height + 40) return;
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, p.x, p.y);
  if (label) {
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#d4af6a';
    ctx.fillText(label, p.x, p.y - size / 2 - 4);
  }
}

function drawDrops(ctx, canvas, cam) {
  const pool = state.zone === 'dungeon' ? (state.instance?.drops || []) : state.drops;
  for (const d of pool) drawIcon(ctx, canvas, cam, d.pos, d.kind === 'chest' ? '🗝️' : '💰', null, 18);
}

function drawMobs(ctx, canvas, cam) {
  for (const m of state.mobs) {
    if (!m.alive) continue;
    const p = worldToScreen(m.pos.x, m.pos.y, cam, canvas);
    const color = FACTION_MOB_COLOR[m.faction] || '#aaa';
    drawBody(ctx, p, color, m.id === state.target, m.elite);
    drawNameHp(ctx, p, m.name, m.hp, m.maxHp);
  }
}

function drawPlayers(ctx, canvas, cam) {
  for (const p of state.players) {
    if (!p.alive) continue;
    const sp = worldToScreen(p.pos.x, p.pos.y, cam, canvas);
    drawBody(ctx, sp, p.appearance?.outfit || '#8899aa', p.id === state.target, false, p.corruption, p.outlaw);
    drawNameHp(ctx, sp, p.name, p.hp, p.maxHp);
  }
}

function drawSelf(ctx, canvas) {
  const p = { x: canvas.width / 2, y: canvas.height / 2 };
  const self = state.self;
  drawBody(ctx, p, self.appearance?.outfit || '#8899aa', false, false, self.corruption, self.outlaw);
  drawNameHp(ctx, p, self.name + ' (você)', self.hp, self.maxHp);
}

function drawBody(ctx, p, color, selected, elite, corruption = 0, outlaw = false) {
  if (selected) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffdd66'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (corruption >= 45) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(122,74,177,${Math.min(0.5, corruption / 150)})`; ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, elite ? 13 : 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = outlaw ? '#d64545' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = outlaw ? 2.5 : 1;
  ctx.stroke();
}

function drawNameHp(ctx, p, name, hp, maxHp) {
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e2d0';
  ctx.fillText(name, p.x, p.y - 22);
  const w = 30, h = 4;
  ctx.fillStyle = '#1a1822';
  ctx.fillRect(p.x - w / 2, p.y - 17, w, h);
  ctx.fillStyle = hp / maxHp > 0.4 ? '#4a9d5f' : '#b4394a';
  ctx.fillRect(p.x - w / 2, p.y - 17, w * Math.max(0, hp / maxHp), h);
}

function drawFloatingTexts(ctx, canvas, cam) {
  const now = Date.now();
  state.floatingTexts = state.floatingTexts.filter((f) => now - f.createdAt < 1000);
  for (const f of state.floatingTexts) {
    const t = (now - f.createdAt) / 1000;
    const p = f.world ? worldToScreen(f.x, f.y, cam, canvas) : { x: canvas.width / 2 + f.x, y: canvas.height / 2 + f.y };
    ctx.globalAlpha = 1 - t;
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';
    ctx.fillText(f.text, p.x, p.y - 30 - t * 24);
    ctx.globalAlpha = 1;
  }
}

function drawNightOverlay(ctx, canvas) {
  const { isNight, hour, weather } = state.time;
  let alpha = 0;
  if (isNight) {
    const depth = hour >= 22 || hour < 4 ? 0.55 : 0.32;
    alpha = depth;
  }
  if (alpha > 0) {
    ctx.fillStyle = `rgba(6,10,30,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (weather === 'nevoa') {
    ctx.fillStyle = 'rgba(200,200,210,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (weather === 'chuva') {
    ctx.strokeStyle = 'rgba(180,200,230,0.35)';
    ctx.lineWidth = 1;
    const t = Date.now() / 40;
    for (let i = 0; i < 60; i++) {
      const x = (i * 53 + t * 2) % (canvas.width + 40) - 20;
      const y = (i * 97 + t * 6) % (canvas.height + 40) - 20;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke();
    }
  }
}
