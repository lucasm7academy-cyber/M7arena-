#!/usr/bin/env node
/**
 * Teste do serviço realtime (P4, design v3 §7). Cada fase é independente e
 * reporta PASS/FAIL por comportamento:
 *
 *   1. Sem cookie m7_session                  → rejeitado no handshake (trava 1)
 *   2. Origin errado (mesmo com cookie)       → rejeitado no handshake (trava 2)
 *   3. Não-participante subscribe sala N      → error "sem_permissao" (trava 3)
 *   4. Participante subscribe sala N          → "subscribed" (travas 1/3)
 *   5. pg_notify com sala_num                 → "match_update" chega no socket
 *   6. pg_notify com uuid interno (matches.id)→ "match_update" chega no socket
 *
 * Uso:
 *   node scripts/test-realtime.mjs --reject-only          (só fases 1 e 2)
 *   node scripts/test-realtime.mjs \
 *     TEST_SESSION=<token participante> TEST_FORBIDDEN_SESSION=<token não-participante> \
 *     TEST_MATCH=<sala_num> TEST_MATCH_UUID=<uuid> TEST_DATABASE_URL=<postgres-url>
 */
import WebSocket from "ws";
import pg from "pg";

const URL = process.env.WS_URL || "ws://localhost:3000/ws";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";

function tentar({ origin = ORIGIN, cookie, descricao, onOpen }) {
  return new Promise((resolve) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const ws = new WebSocket(URL, { origin, headers });
    let resolvido = false;
    const finish = (ok, motivo) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        /* já fechou */
      }
      console.log(`${ok ? "PASS" : "FAIL"} ${descricao} — ${motivo}`);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false, "timeout"), 6000);
    ws.on("open", () => {
      if (onOpen) onOpen(ws, finish);
      else finish(true, "conexão aceita");
    });
    ws.on("unexpected-response", (_req, res) => {
      finish(res.statusCode === 401 || res.statusCode === 403, `rejeitado HTTP ${res.statusCode}`);
    });
    ws.on("error", () => {
      /* sem upgrade: erro aparece como unexpected-response na maioria dos casos */
    });
  });
}

async function notificar(payload) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SELECT pg_notify('matches_channel', $1)", [JSON.stringify(payload)]);
  await client.end();
}

async function main() {
  const onlyReject = process.argv.includes("--reject-only");
  const session = process.env.TEST_SESSION;
  const forbidden = process.env.TEST_FORBIDDEN_SESSION;
  const match = process.env.TEST_MATCH;
  const matchUuid = process.env.TEST_MATCH_UUID;

  let ok = true;

  ok = (await tentar({ descricao: "sem cookie → rejeitado" })) && ok;
  ok =
    (await tentar({
      origin: "http://evil.example",
      cookie: session ? `m7_session=${session}` : undefined,
      descricao: "origin errado (com cookie) → rejeitado",
    })) && ok;

  if (onlyReject) {
    process.exit(ok ? 0 : 1);
  }

  if (forbidden && match) {
    ok =
      (await tentar({
        cookie: `m7_session=${forbidden}`,
        descricao: `não-participante subscribe sala ${match} → sem_permissao`,
        onOpen: (ws, finish) => {
          ws.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
          ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "error" && msg.error === "sem_permissao") {
              finish(true, "error sem_permissao recebido");
            } else if (msg.type === "subscribed") {
              finish(false, "não-participante foi assinado");
            }
          });
        },
      })) && ok;
  } else {
    console.log("SKIP fase 3: defina TEST_FORBIDDEN_SESSION e TEST_MATCH");
  }

  if (session && match) {
    ok =
      (await tentar({
        cookie: `m7_session=${session}`,
        descricao: `participante subscribe sala ${match} → subscribed`,
        onOpen: (ws, finish) => {
          ws.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
          ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "subscribed" && Number(msg.matchId) === Number(match)) {
              finish(true, "subscribed recebido");
            } else if (msg.type === "error") {
              finish(false, `erro do servidor: ${msg.error}`);
            }
          });
        },
      })) && ok;

    if (ok) {
      ok =
        (await tentar({
          cookie: `m7_session=${session}`,
          descricao: `pg_notify sala_num ${match} → match_update`,
          onOpen: (ws, finish) => {
            ws.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
            ws.on("message", (raw) => {
              const msg = JSON.parse(raw.toString());
              if (msg.type === "subscribed") {
                notificar({ matchId: match }).catch(() => undefined);
              } else if (msg.type === "match_update" && Number(msg.matchId) === Number(match)) {
                finish(true, "match_update recebido");
              }
            });
          },
        })) && ok;
    } else {
      console.log("SKIP fase 5: fase 4 falhou");
    }
  } else {
    console.log("SKIP fases 4/5: defina TEST_SESSION e TEST_MATCH");
  }

  if (session && match && matchUuid) {
    ok =
      (await tentar({
        cookie: `m7_session=${session}`,
        descricao: `pg_notify uuid ${matchUuid} → match_update`,
        onOpen: (ws, finish) => {
          ws.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
          ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "subscribed") {
              notificar({ matchId: matchUuid }).catch(() => undefined);
            } else if (msg.type === "match_update" && Number(msg.matchId) === Number(match)) {
              finish(true, "match_update recebido");
            }
          });
        },
      })) && ok;
  } else {
    console.log("SKIP fase 6: defina TEST_SESSION, TEST_MATCH e TEST_MATCH_UUID");
  }

  process.exit(ok ? 0 : 1);
}

main();
