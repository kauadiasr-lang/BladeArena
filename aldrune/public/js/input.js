import { state } from './state.js';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const PANEL_KEYS = { g: 'toggle-spellcraft', i: 'toggle-inventory', k: 'toggle-skills', f: 'toggle-factions', m: 'toggle-map', o: 'toggle-outlaw' };

export function setupInput(net, onAction, onInteract) {
  const chatInput = document.getElementById('chat-input');

  window.addEventListener('keydown', (e) => {
    const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (e.key === 'Enter') {
      if (document.activeElement === chatInput) {
        const text = chatInput.value.trim();
        if (text) net.send({ t: 'chat', msg: text });
        chatInput.value = '';
        chatInput.blur();
      } else if (!typing) {
        chatInput.focus();
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Escape' && document.activeElement === chatInput) { chatInput.blur(); return; }
    if (typing) return;

    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k)) { state.keys.add(k); e.preventDefault(); }
    if (k === ' ') { state.keys.add('space'); e.preventDefault(); }
    if (k === 'e' && !e.repeat) onInteract();
    if (PANEL_KEYS[k] && !e.repeat) onAction(PANEL_KEYS[k]);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    state.keys.delete(k);
    if (k === ' ') state.keys.delete('space');
  });
  window.addEventListener('blur', () => state.keys.clear());

  // Movement + auto-attack loop, matches server tick rate.
  setInterval(() => {
    let x = 0, y = 0;
    if (state.keys.has('w') || state.keys.has('arrowup')) y -= 1;
    if (state.keys.has('s') || state.keys.has('arrowdown')) y += 1;
    if (state.keys.has('a') || state.keys.has('arrowleft')) x -= 1;
    if (state.keys.has('d') || state.keys.has('arrowright')) x += 1;
    net.send({ t: 'move', dir: { x, y } });
    if (state.keys.has('space') && state.target) net.send({ t: 'attack', targetId: state.target });
  }, 100);
}
