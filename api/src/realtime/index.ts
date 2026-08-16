/**
 * realtime/index.ts — serviço WebSocket próprio (P4, design v3 §7).
 *
 * Substitui o `supabase.channel` por um WebSocket na VPS que SÓ transporta o id
 * da sala. Princípio: o socket nunca leva dados — ao receber `match_update`, o
 * cliente refaz `GET /api/matches/:id`, que valida permissão de novo no
 * servidor (trava 4).
 *
 * Segurança (6 travas):
 *  1. Cookie `m7_session` validado no handshake (sessão viva na tabela
 *     `user_sessions`, mesma regra de routes/auth.ts e match-flow.ts).
 *  2. `Origin` conferido contra `APP_URL` antes de aceitar o upgrade.
 *  3. `subscribe_match` é aceito para qualquer usuário autenticado (o estado
 *     da sala é público e o chat é para todos na sala — ADR-040); enviar chat
 *     continua exigindo Riot vinculado (`enviarChat`).
 *  4. Os dados nunca vêm do socket — o cliente refaz o GET.
 *  5. Máx. 10 conexões por usuário (derruba a mais antiga) + matchId validado.
 *  6. Ping/pong a cada 30s; conexão que não responde 2 pings é derrubada.
 *
 * Robustez do LISTEN: UMA conexão dedicada (`pg.Client`, nunca o pool) com
 * reconexão automática + re-LISTEN ao detectar queda. Por isso o DATABASE_URL
 * deste serviço aponta DIRETO para o postgres — o pgbouncer em transaction mode
 * não entrega NOTIFY.
 *
 * Processo separado da API (serviço `realtime` do compose, porta interna 3001),
 * então tem acesso próprio ao banco para validar sessão e autorização.
 */

import http from "http";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import pg from "pg";

dotenv.config();

const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@postgres:5432/m7arena";

const MAX_CONEXOES_POR_USUARIO = 10;
const PING_INTERVAL_MS = 30_000;
const RECONEXAO_BASE_MS = 1_000;
const RECONEXAO_MAX_MS = 30_000;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Chat (ADR-040): validações e rate limit do chat_send. ──
const CHAT_MIN_INTERVALO_MS = 1_000;        // 1 msg/s por usuário
const CHAT_MAX_EM_5MIN = 40;                // teto por janela
const CHAT_JANELA_MS = 5 * 60 * 1000;       // janela do rate limit
const CHAT_BODY_MAX = 200;

// ── Origens permitidas. APP_URL pode ser lista separada por vírgula. ──
const allowedOrigins = new Set<string>();
for (const o of (process.env.APP_URL || "http://localhost:3000").split(",")) {
  const t = o.trim().replace(/\/+$/, "");
  if (t) allowedOrigins.add(t);
}

// Pool para auth/autorização (pequeno). O LISTEN fica numa conexão à parte.
const authPool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// sala_num público → sockets inscritos. A sala que o cliente refaz via GET.
const rooms = new Map<number, Set<WebSocket>>();
// socket → sala_num (para limpar a assinatura no close).
const socketRoom = new Map<WebSocket, number>();
// userId → sockets (limite de conexões por usuário).
const userSockets = new Map<string, Set<WebSocket>>();
// userId por socket, setado no handshake (handleUpgrade não leva argumento extra).
const socketUser = new Map<WebSocket, string>();
// Socket → uuid interno do match (para o INSERT do chat, que referencia matches.id).
const socketMatchId = new Map<WebSocket, string>();
// userId → timestamps das mensagens (rate limit em memória; processo único).
const chatTimestamps = new Map<string, number[]>();
// Estado de liveness do ping/pong.
const socketState = new WeakMap<WebSocket, { isAlive: boolean }>();
// cache uuid → sala_num (o NOTIFY às vezes traz o uuid interno de matches.id).
const uuidCache = new Map<string, number>();

const wss = new WebSocketServer({ noServer: true });

function lerCookie(header: string | undefined, nome: string): string | null {
  if (!header) return null;
  for (const parte of header.split(";")) {
    const idx = parte.indexOf("=");
    if (idx === -1) continue;
    if (parte.slice(0, idx).trim() === nome) return parte.slice(idx + 1).trim();
  }
  return null;
}

/** Trava 1: sessão viva no banco → userId. */
async function sessaoValida(token: string): Promise<string | null> {
  const r = await authPool.query(
    `SELECT us.user_id AS "userId"
       FROM user_sessions us
      WHERE us.session_token = $1 AND us.expires > now()
      LIMIT 1`,
    [token]
  );
  return r.rowCount ? (r.rows[0].userId as string) : null;
}

/** Resolve a sala por sala_num (número) ou uuid, e popula o cache uuid→sala_num. */
async function buscarMatch(ref: string): Promise<{ id: string; salaNum: number } | null> {
  const isNumero = /^[0-9]+$/.test(ref);
  const r = await authPool.query(
    isNumero
      ? `SELECT id, sala_num AS "salaNum" FROM matches WHERE sala_num = $1 LIMIT 1`
      : `SELECT id, sala_num AS "salaNum" FROM matches WHERE id = $1 LIMIT 1`,
    [isNumero ? Number(ref) : ref]
  );
  if (!r.rowCount) return null;
  const id = String(r.rows[0].id);
  const salaNum = Number(r.rows[0].salaNum);
  if (uuidRegex.test(id)) uuidCache.set(id, salaNum);
  return { id, salaNum };
}

function enviar(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function removerDaSala(ws: WebSocket) {
  socketMatchId.delete(ws);
  const salaNum = socketRoom.get(ws);
  if (salaNum === undefined) return;
  socketRoom.delete(ws);
  const set = rooms.get(salaNum);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(salaNum);
  }
}

/** Trava 5: derruba a conexão mais antiga quando o usuário estoura o limite. */
function registrarConexao(ws: WebSocket, userId: string) {
  let sockets = userSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    userSockets.set(userId, sockets);
  }
  sockets.add(ws);
  if (sockets.size > MAX_CONEXOES_POR_USUARIO) {
    const maisAntiga = sockets.values().next().value as WebSocket | undefined;
    if (maisAntiga) {
      sockets.delete(maisAntiga);
      removerDaSala(maisAntiga);
      maisAntiga.terminate();
    }
  }
}

async function tratarMensagem(ws: WebSocket, raw: RawData) {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    enviar(ws, { type: "error", error: "mensagem_invalida" });
    return;
  }
  if (msg?.type === "subscribe_match") {
    await assinarSala(ws, msg);
  } else if (msg?.type === "chat_send") {
    await enviarChat(ws, msg);
  }
}

async function assinarSala(ws: WebSocket, msg: any) {
  const ref = String(msg.matchId ?? "").trim();
  if (!/^[0-9]+$/.test(ref) && !uuidRegex.test(ref)) {
    enviar(ws, { type: "error", error: "match_id_invalido" });
    return;
  }

  try {
    const match = await buscarMatch(ref);
    if (!match) {
      enviar(ws, { type: "error", error: "sala_nao_encontrada" });
      return;
    }
    // Qualquer usuário autenticado pode assinar a sala (o estado da sala é
    // público e o chat é para todos que estão na sala, na vaga ou não — ADR-040).
    // A sessão já foi validada no handshake (trava 1); enviar mensagem continua
    // exigindo Riot vinculado, checado em `enviarChat`.
    const userId = socketUser.get(ws);
    if (!userId) {
      enviar(ws, { type: "error", error: "nao_autenticado" });
      return;
    }
    removerDaSala(ws);
    socketRoom.set(ws, match.salaNum);
    socketMatchId.set(ws, match.id);
    let set = rooms.get(match.salaNum);
    if (!set) {
      set = new Set();
      rooms.set(match.salaNum, set);
    }
    set.add(ws);
    enviar(ws, { type: "subscribed", matchId: match.salaNum });
  } catch (err: any) {
    console.error(`[m7arena-realtime] Erro ao assinar sala: ${err?.message}`);
    enviar(ws, { type: "error", error: "erro_interno" });
  }
}

// ── CHAT (ADR-040) ───────────────────────────────
function permitidoNoRateLimit(userId: string): boolean {
  const agora = Date.now();
  const limiar = agora - CHAT_JANELA_MS;
  const ts = (chatTimestamps.get(userId) ?? []).filter((t) => t > limiar);
  if (ts.length >= CHAT_MAX_EM_5MIN) return false;
  if (ts.length > 0 && agora - ts[ts.length - 1] < CHAT_MIN_INTERVALO_MS) return false;
  ts.push(agora);
  chatTimestamps.set(userId, ts);
  return true;
}

/** chat_send: valida (assinado, body, ban, Riot, rate limit) → INSERT → fan-out. */
async function enviarChat(ws: WebSocket, msg: any) {
  const salaNum = socketRoom.get(ws);
  const matchId = socketMatchId.get(ws);
  if (salaNum === undefined || !matchId) {
    enviar(ws, { type: "chat_error", error: "nao_assinado" });
    return;
  }
  const body = typeof msg?.body === "string" ? msg.body.trim() : "";
  if (body.length < 1 || body.length > CHAT_BODY_MAX) {
    enviar(ws, { type: "chat_error", error: "body_invalido" });
    return;
  }
  const userId = socketUser.get(ws);
  if (!userId) {
    enviar(ws, { type: "chat_error", error: "nao_autenticado" });
    return;
  }
  if (!permitidoNoRateLimit(userId)) {
    enviar(ws, { type: "chat_error", error: "rate_limited" });
    return;
  }

  try {
    const { rows: [u] } = await authPool.query(
      `SELECT id, display_name AS "displayName", avatar_url AS "avatarUrl", status, riot_id AS "riotId"
         FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!u) {
      enviar(ws, { type: "chat_error", error: "nao_autenticado" });
      return;
    }
    if (u.status === "banida") {
      enviar(ws, { type: "chat_error", error: "conta_banida" });
      return;
    }
    if (!u.riotId) {
      enviar(ws, { type: "chat_error", error: "riot_id_necessario" });
      return;
    }

    // Cor do nick = time do remetente NO MOMENTO do envio (ADR-040): a mensagem
    // nasce com a cor e não muda se o jogador trocar de lado depois.
    const { rows: [sideRow] } = await authPool.query(
      `SELECT side FROM match_players WHERE match_id = $1 AND user_id = $2 LIMIT 1`,
      [matchId, userId]
    );
    const cor = sideRow ? (sideRow.side === "red" ? "#ef4444" : "#3B82F6") : "#FFB700";

    const { rows: [row] } = await authPool.query(
      `INSERT INTO sala_mensagens (match_id, user_id, body, cor)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [matchId, userId, body, cor]
    );

    const msgObj = {
      id: Number(row.id),
      user_id: userId,
      nome: u.displayName || "Jogador",
      avatar: u.avatarUrl ?? null,
      body,
      cor,
      created_at: new Date(row.created_at).toISOString(),
    };
    const payload = JSON.stringify({ type: "chat_message", matchId: salaNum, msg: msgObj });
    const room = rooms.get(salaNum);
    if (room) {
      for (const cliente of room) {
        if (cliente.readyState === WebSocket.OPEN) cliente.send(payload);
      }
    }
  } catch (err: any) {
    console.error(`[m7arena-realtime] Erro no chat: ${err?.message}`);
    enviar(ws, { type: "chat_error", error: "erro_interno" });
  }
}

/** Fan-out do NOTIFY: só o id da sala, só para quem assinou aquela sala. */
async function handleNotification(payload: string) {
  let data: any;
  try {
    data = JSON.parse(payload);
  } catch {
    return;
  }
  const ref = data?.matchId ?? data?.id;
  if (ref === undefined || ref === null) return;

  let salaNum: number | null = null;
  if (/^[0-9]+$/.test(String(ref))) {
    salaNum = Number(ref);
  } else {
    const refStr = String(ref);
    const cache = uuidCache.get(refStr);
    if (cache !== undefined) {
      salaNum = cache;
    } else {
      const r = await authPool.query(
        `SELECT sala_num AS "salaNum" FROM matches WHERE id = $1 LIMIT 1`,
        [refStr]
      );
      if (r.rowCount) {
        salaNum = Number(r.rows[0].salaNum);
        uuidCache.set(refStr, salaNum);
      }
    }
  }
  if (salaNum === null) return;

  const room = rooms.get(salaNum);
  if (!room || room.size === 0) return;
  const mensagem = JSON.stringify({ type: "match_update", matchId: salaNum });
  for (const cliente of room) {
    if (cliente.readyState === WebSocket.OPEN) cliente.send(mensagem);
  }
}

// ── Handshake: Origin (trava 2) + cookie (trava 1), antes do upgrade. ──
const httpServer = http.createServer((_req, res) => {
  res.writeHead(400).end();
});

httpServer.on("upgrade", (req, socket) => {
  (async () => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin.replace(/\/+$/, ""))) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    const token = lerCookie(req.headers.cookie, "m7_session");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const userId = await sessaoValida(token);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, Buffer.alloc(0), (ws) => {
      socketUser.set(ws, userId);
      wss.emit("connection", ws, req);
    });
  })().catch((err) => {
    console.error(`[m7arena-realtime] Upgrade rejeitado: ${err?.message}`);
    socket.destroy();
  });
});

wss.on("connection", (ws: WebSocket) => {
  const userId = socketUser.get(ws);
  if (!userId) {
    ws.close();
    return;
  }

  registrarConexao(ws, userId);

  socketState.set(ws, { isAlive: true });
  ws.on("pong", () => {
    const st = socketState.get(ws);
    if (st) st.isAlive = true;
  });

  ws.on("message", (raw) => {
    void tratarMensagem(ws, raw);
  });

  ws.on("close", () => {
    const sockets = userSockets.get(userId);
    sockets?.delete(ws);
    if (sockets && sockets.size === 0) userSockets.delete(userId);
    socketUser.delete(ws);
    removerDaSala(ws);
  });

  ws.on("error", () => {
    ws.close();
  });
});

// ── Ping/pong (trava 6): sem pong por 2 intervalos, derruba. ──
const pingTimer = setInterval(() => {
  for (const ws of wss.clients) {
    const st = socketState.get(ws);
    if (!st) continue;
    if (!st.isAlive) {
      ws.terminate(); // não respondeu ao ping anterior
      continue;
    }
    st.isAlive = false;
    ws.ping();
  }
}, PING_INTERVAL_MS);

// ── LISTEN dedicado com reconexão + re-LISTEN ──
let listenerClient: pg.Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;

function reagendarReconexao() {
  if (shuttingDown || reconnectTimer) return;
  const delay = Math.min(RECONEXAO_BASE_MS * 2 ** reconnectAttempt, RECONEXAO_MAX_MS);
  reconnectAttempt += 1;
  console.log(`[m7arena-realtime] LISTEN caiu — reconectando em ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void conectarListener();
  }, delay);
}

async function conectarListener() {
  if (shuttingDown) return;
  const client = new pg.Client({ connectionString: DATABASE_URL });
  listenerClient = client;

  client.on("error", (err) => {
    console.error(`[m7arena-realtime] Erro na conexão LISTEN: ${err.message}`);
    client.end().catch(() => undefined);
    reagendarReconexao();
  });
  client.on("end", () => {
    reagendarReconexao();
  });

  try {
    await client.connect();
    await client.query("LISTEN matches_channel");
    reconnectAttempt = 0;
    console.log("[m7arena-realtime] Escutando notificações do Postgres (LISTEN matches_channel)");

    client.on("notification", (msg: pg.Notification) => {
      if (msg.channel === "matches_channel" && msg.payload) {
        void handleNotification(msg.payload);
      }
    });

    // Clientes refazem o GET das salas inscritas para recuperar o que passou
    // durante a queda do LISTEN. Sem matchId → o hook usa a sala que assinou.
    const aviso = JSON.stringify({ type: "match_update" });
    for (const room of rooms.values()) {
      for (const cliente of room) {
        if (cliente.readyState === WebSocket.OPEN) cliente.send(aviso);
      }
    }
  } catch (err: any) {
    console.error(`[m7arena-realtime] Falha ao conectar no Postgres para LISTEN: ${err?.message}`);
    client.end().catch(() => undefined);
    reagendarReconexao();
  }
}

function shutdown() {
  shuttingDown = true;
  if (pingTimer) clearInterval(pingTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  for (const ws of wss.clients) ws.terminate();
  wss.close(() => {
    void authPool.end().then(() => {
      if (listenerClient) void listenerClient.end().catch(() => undefined);
      process.exit(0);
    });
  });
}

httpServer.listen(PORT, () => {
  console.log(`[m7arena-realtime] Servidor WebSocket rodando na porta ${PORT}`);
});

void conectarListener();

process.on("SIGTERM", () => shutdown());
process.on("SIGINT", () => shutdown());
