#!/usr/bin/env node
/**
 * Teste do serviço realtime (P4, design v3 §7). Cada fase é independente e
 * reporta PASS/FAIL por comportamento:
 *
 *   1. Sem cookie m7_session                → VISITANTE aceito no handshake
 *   2. Origin errado (mesmo com cookie)     → rejeitado no handshake (trava 2)
 *   3. Visitante subscribe sala N           → "subscribed" (estado é público)
 *   4. Visitante chat_send                  → chat_error "nao_autenticado"
 *   5. Visitante draft_preview              → NÃO chega para quem tem sessão
 *   6. Autenticado subscribe sala N         → "subscribed"
 *   7. pg_notify com sala_num               → "match_update" chega no socket
 *   8. pg_notify com uuid interno (matches.id) → "match_update" chega no socket
 *
 * Uso:
 *   node scripts/test-realtime.mjs --guest-only
 *   node scripts/test-realtime.mjs \
 *     TEST_SESSION=<token> TEST_MATCH=<sala_num> \
 *     TEST_MATCH_UUID=<uuid do matches.id> TEST_DATABASE_URL=<postgres-url>
 */
import WebSocket from "ws";
import pg from "pg";

const URL = process.env.WS_URL || "ws://localhost:3000/ws";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";

function tentar({ origin = ORIGIN, cookie, descricao, onOpen, rejeicaoEsperada = false }) {
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
    const timer = setTimeout(() => finish(false, "timeout"), 9000);
    ws.on("open", () => {
      if (rejeicaoEsperada) {
        finish(false, "conexão aceita quando deveria ser rejeitada");
        return;
      }
      if (onOpen) onOpen(ws, finish);
      else finish(true, "conexão aceita");
    });
    ws.on("unexpected-response", (_req, res) => {
      if (rejeicaoEsperada) {
        finish(res.statusCode === 401 || res.statusCode === 403, `rejeitado HTTP ${res.statusCode}`);
      } else {
        finish(false, `rejeitado HTTP ${res.statusCode}`);
      }
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
  const onlyGuest = process.argv.includes("--guest-only");
  const session = process.env.TEST_SESSION;
  const match = process.env.TEST_MATCH;
  const matchUuid = process.env.TEST_MATCH_UUID;

  let ok = true;

  // 1. Sem cookie → visitante (espectador anônimo) aceito.
  ok = (await tentar({ descricao: "sem cookie → visitante aceito (só recebe)" })) && ok;

  // 2. Origin errado → rejeitado, com ou sem sessão.
  ok =
    (await tentar({
      origin: "http://evil.example",
      cookie: session ? `m7_session=${session}` : undefined,
      descricao: "origin errado → rejeitado no handshake",
      rejeicaoEsperada: true,
    })) && ok;

  if (match) {
    // 3. Visitante assina (o estado da sala é público — ADR-040).
    ok =
      (await tentar({
        descricao: `visitante subscribe sala ${match} → subscribed`,
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

    // 4. Visitante NÃO envia chat.
    ok =
      (await tentar({
        descricao: "visitante chat_send → chat_error nao_autenticado",
        onOpen: (ws, finish) => {
          ws.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
          ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "subscribed") {
              ws.send(JSON.stringify({ type: "chat_send", body: "teste visitante" }));
            } else if (msg.type === "chat_error" && msg.error === "nao_autenticado") {
              finish(true, "chat bloqueado para visitante");
            } else if (msg.type === "chat_message") {
              finish(false, "visitante conseguiu enviar chat");
            }
          });
        },
      })) && ok;

    // 5. Prévia de visitante NÃO vaza — precisa de uma sessão autenticada
    // escutando a mesma sala para provar que nada chega.
    if (session) {
      ok =
        (await tentar({
          cookie: `m7_session=${session}`,
          descricao: "visitante draft_preview → não chega para quem tem sessão",
          onOpen: (wsAutenticado, finish) => {
            wsAutenticado.on("message", (raw) => {
              const msg = JSON.parse(raw.toString());
              if (msg.type === "draft_preview") {
                finish(false, "prévia de visitante chegou na sala");
                return;
              }
              if (msg.type !== "subscribed") return;
              // Autenticado já está na sala; agora o visitante assina e manda
              // a prévia falsa (depois do "subscribed" dele, para o envio não
              // cair na janela em que a assinatura ainda não terminou).
              const visitante = new WebSocket(URL, { origin: ORIGIN });
              visitante.on("message", (raw2) => {
                const msg2 = JSON.parse(raw2.toString());
                if (msg2.type !== "subscribed") return;
                visitante.send(JSON.stringify({ type: "draft_preview", championId: "Aatrox", side: "blue" }));
                setTimeout(() => {
                  try {
                    visitante.terminate();
                  } catch {
                    /* já fechou */
                  }
                  finish(true, "prévia de visitante ignorada");
                }, 1500);
              });
              visitante.on("open", () => {
                visitante.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
              });
            });
            wsAutenticado.send(JSON.stringify({ type: "subscribe_match", matchId: Number(match) }));
          },
        })) && ok;
    } else {
      console.log("SKIP fase 5: defina TEST_SESSION");
    }
  } else {
    console.log("SKIP fases 3/4/5: defina TEST_MATCH");
  }

  if (onlyGuest) {
    process.exit(ok ? 0 : 1);
  }

  if (session && match) {
    ok =
      (await tentar({
        cookie: `m7_session=${session}`,
        descricao: `autenticado subscribe sala ${match} → subscribed`,
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
      console.log("SKIP fase 7: fase 6 falhou");
    }
  } else {
    console.log("SKIP fases 6/7: defina TEST_SESSION e TEST_MATCH");
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
    console.log("SKIP fase 8: defina TEST_SESSION, TEST_MATCH e TEST_MATCH_UUID");
  }

  process.exit(ok ? 0 : 1);
}

main();
