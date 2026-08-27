import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameServer } from './gameServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const game = new GameServer();
game.start();

wss.on('connection', (ws) => {
  let joined = false;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!joined) {
      if (msg.t !== 'join') return;
      game.join(ws, msg.name, msg.appearance);
      joined = true;
      return;
    }
    game.handleMessage(ws, msg);
  });
  ws.on('close', () => { if (joined) game.leave(ws); });
});

server.listen(PORT, () => {
  console.log(`Aldrune Online rodando em http://localhost:${PORT}`);
});

process.on('SIGINT', () => { game.store.flush(); process.exit(0); });
process.on('SIGTERM', () => { game.store.flush(); process.exit(0); });
