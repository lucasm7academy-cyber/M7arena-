import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client } from 'pg';

const PORT = parseInt(process.env.WS_PORT || '8080', 10);
const server = createServer();
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Erro na conexão:', err);
  });
});

async function startPgListener() {
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pgClient.connect();
    await pgClient.query('LISTEN match_rooms_channel');

    pgClient.on('notification', (msg) => {
      if (msg.channel === 'match_rooms_channel' && msg.payload) {
        const payload = msg.payload;
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    });

    console.log('[Realtime] Serviço WebSocket + LISTEN/NOTIFY iniciado na porta', PORT);
  } catch (err) {
    console.error('[Realtime] Erro ao conectar ao Postgres para LISTEN:', err);
  }
}

server.listen(PORT, () => {
  startPgListener();
});
