import { WebSocketServer, WebSocket } from "ws";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/m7arena";

const wss = new WebSocketServer({ port: PORT });
console.log(`[m7arena-realtime] Servidor WebSocket rodando na porta ${PORT}`);

// Conexões de salas: matchId -> Set<WebSocket>
const roomSockets = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws, req) => {
  let currentRoom: string | null = null;

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === "subscribe_match" && data.matchId) {
        if (currentRoom && roomSockets.has(currentRoom)) {
          roomSockets.get(currentRoom)?.delete(ws);
        }
        currentRoom = data.matchId;
        if (!roomSockets.has(currentRoom!)) {
          roomSockets.set(currentRoom!, new Set());
        }
        roomSockets.get(currentRoom!)!.add(ws);
        ws.send(JSON.stringify({ type: "subscribed", matchId: currentRoom }));
      }
    } catch {}
  });

  ws.on("close", () => {
    if (currentRoom && roomSockets.has(currentRoom)) {
      roomSockets.get(currentRoom)?.delete(ws);
    }
  });
});

// Postgres LISTEN/NOTIFY listener
const pgClient = new pg.Client({ connectionString: DATABASE_URL });

async function initPgListener() {
  try {
    await pgClient.connect();
    await pgClient.query("LISTEN matches_channel");
    await pgClient.query("LISTEN notifications_channel");

    pgClient.on("notification", (msg) => {
      if (msg.channel === "matches_channel" && msg.payload) {
        try {
          const payload = JSON.parse(msg.payload);
          const matchId = payload.matchId || payload.id;
          if (matchId && roomSockets.has(matchId)) {
            for (const client of roomSockets.get(matchId)!) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "match_update", data: payload }));
              }
            }
          }
        } catch {}
      }
    });

    console.log("[m7arena-realtime] Escutando notificações do Postgres (LISTEN matches_channel)");
  } catch (err) {
    console.warn("[m7arena-realtime] Aviso: Falha ao conectar no Postgres para NOTIFY:", err);
  }
}

initPgListener();
