import { RUNES, KNOWN_SPELLS, comboKey, resolveSpellEffect, proceduralName } from '../data/runes.js';

const NAME_RE = /^[\p{L}0-9 '\-]{3,32}$/u;

// Validates that a rune combination can be cast right now (fragments in
// inventory, enough mana) WITHOUT consuming anything or touching the
// codex. The caller must check the target (for damage-kind spells) between
// this and commitCast - a failed cast should never cost the player runes,
// mana, or hand out a discovery for a spell that never actually landed.
// Returns { ok, error?, effect?, counts? }
export function prepareCast(player, runeIds) {
  if (!Array.isArray(runeIds) || runeIds.length < 1 || runeIds.length > 3) {
    return { ok: false, error: 'Combine de 1 a 3 fragmentos rúnicos.' };
  }
  for (const id of runeIds) {
    if (!RUNES[id]) return { ok: false, error: `Runa desconhecida: ${id}` };
  }
  const counts = {};
  for (const id of runeIds) counts[id] = (counts[id] || 0) + 1;
  for (const [runeId, need] of Object.entries(counts)) {
    const itemId = `rune_${runeId}`;
    const have = player.inventory.filter((it) => it.id === itemId).reduce((s, it) => s + it.qty, 0);
    if (have < need) return { ok: false, error: `Faltam fragmentos de ${RUNES[runeId].label}.` };
  }
  const effect = resolveSpellEffect(runeIds);
  if (!effect) return { ok: false, error: 'Combinação inválida.' };
  if (player.mana < effect.cost) return { ok: false, error: 'Mana insuficiente.' };
  return { ok: true, effect, counts };
}

// Actually consumes the components + mana and resolves the spell's name,
// registering a new Codex discovery the first time this exact combination
// is ever committed on this server. Only call this once prepareCast
// succeeded AND (for damage spells) a valid, in-range target was confirmed.
export function commitCast(player, store, runeIds, counts, effect, proposedName) {
  for (const [runeId, need] of Object.entries(counts)) {
    consumeItem(player, `rune_${runeId}`, need);
  }
  player.mana -= effect.cost;

  const key = comboKey(runeIds);
  let spellName;
  let discovery = null;
  if (KNOWN_SPELLS[key]) {
    spellName = KNOWN_SPELLS[key].name;
  } else if (store.codex[key]) {
    spellName = store.codex[key].name;
  } else {
    const clean = proposedName && NAME_RE.test(proposedName.trim()) ? proposedName.trim() : proceduralName(runeIds, effect);
    spellName = clean;
    const entry = { name: clean, discoverer: player.name, discoveredAt: Date.now(), comboKey: key, effect };
    store.saveCodexEntry(key, entry);
    discovery = entry;
  }
  if (!player.knownSpells.includes(key)) player.knownSpells.push(key);

  return { spellName, comboKey: key, discovery };
}

function consumeItem(player, itemId, qty) {
  let remaining = qty;
  player.inventory = player.inventory.filter((it) => {
    if (remaining <= 0 || it.id !== itemId) return true;
    if (it.qty > remaining) { it.qty -= remaining; remaining = 0; return true; }
    remaining -= it.qty;
    return false;
  });
}

export function allKnownSpellNames(store) {
  const out = {};
  for (const [key, s] of Object.entries(KNOWN_SPELLS)) out[key] = { name: s.name, discoverer: 'Grêmio dos Magos' };
  for (const [key, e] of Object.entries(store.codex)) out[key] = { name: e.name, discoverer: e.discoverer };
  return out;
}
