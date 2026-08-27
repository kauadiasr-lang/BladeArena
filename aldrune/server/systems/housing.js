// Territory claims: a free plot near town can be claimed, gets a storage
// chest and an optional player-run shop listing. Plots that go unvisited
// decay visually and mechanically over real time (weather + neglect), and
// once fully decayed become lootable ruins anyone can reclaim - the map
// keeps reshaping itself around how people actually play.
const DECAY_PER_HOUR = 100 / (24 * 3); // fully decays after 3 real days of neglect
const VISIT_RADIUS = 2.5;

export function findPlot(world, plotId) {
  return world.housingPlots.find((p) => p.id === plotId) || null;
}

export function claimPlot(player, world, plotId) {
  const plot = findPlot(world, plotId);
  if (!plot) return { ok: false, error: 'Lote inexistente.' };
  if (plot.claimedBy) return { ok: false, error: 'Este lote já pertence a outra pessoa.' };
  if (dist(player.pos, plot) > VISIT_RADIUS) return { ok: false, error: 'Aproxime-se do lote para reivindicá-lo.' };
  if (player.plotId) return { ok: false, error: 'Você já possui um lote de terra.' };
  plot.claimedBy = player.id;
  plot.ownerName = player.name;
  plot.decay = 0;
  plot.lastVisit = Date.now();
  plot.chest = [];
  plot.shop = [];
  player.plotId = plot.id;
  return { ok: true, plot };
}

export function visitPlot(player, world) {
  const plot = world.housingPlots.find((p) => p.claimedBy === player.id);
  if (plot && dist(player.pos, plot) <= VISIT_RADIUS) {
    plot.decay = Math.max(0, plot.decay - 5);
    plot.lastVisit = Date.now();
  }
}

export function tickDecay(world, dtSeconds) {
  const hours = dtSeconds / 3600;
  for (const plot of world.housingPlots) {
    if (!plot.claimedBy) continue;
    plot.decay = Math.min(100, plot.decay + DECAY_PER_HOUR * hours);
    if (plot.decay >= 100) {
      // Ruins: chest contents spill for anyone to find, plot returns to the wild.
      plot.claimedBy = null;
      plot.ownerName = null;
      plot.ruinLoot = plot.chest;
      plot.chest = [];
      plot.shop = [];
      plot.decay = 0;
    }
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
