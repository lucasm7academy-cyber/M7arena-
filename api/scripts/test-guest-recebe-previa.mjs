#!/usr/bin/env node
/**
 * Cenário exato do usuário (2026-10-17): um jogador autenticado escolhe um
 * campeão (draft_preview) e o espectador ANÔNIMO na mesma sala precisa ver a
 * prévia na bola. Prova que o visitante RECEBE prévia de quem tem sessão.
 *
 * Uso (dentro do container realtime):
 *   node test-guest-recebe-previa.mjs   (TEST_SESSION e TEST_MATCH no env)
 */
import WebSocket from "ws";

const URL = process.env.WS_URL || "ws://localhost:3001/ws";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const SESSION = process.env.TEST_SESSION;
const MATCH = Number(process.env.TEST_MATCH);

if (!SESSION || !MATCH) {
  console.log("SKIP: defina TEST_SESSION e TEST_MATCH");
  process.exit(1);
}

const visitante = new WebSocket(URL, { origin: ORIGIN });
const jogador = new WebSocket(URL, { origin: ORIGIN, headers: { Cookie: `m7_session=${SESSION}` } });

let recebeu = false;
let jogadorPronto = false;
let visitantePronto = false;

function tentarEnviar() {
  if (jogadorPronto && visitantePronto && !recebeu) {
    // Margem para o visitante terminar de entrar na sala antes do envio.
    setTimeout(() => {
      if (recebeu) return;
      console.log("INFO jogador envia draft_preview (Ahri/blue)");
      jogador.send(JSON.stringify({ type: "draft_preview", matchId: MATCH, championId: "Ahri", side: "blue" }));
    }, 300);
  }
}

const timer = setTimeout(() => {
  console.log(recebeu ? "" : "FAIL visitante NÃO recebeu a prévia do jogador (timeout 6s)");
  process.exit(recebeu ? 0 : 1);
}, 6000);

visitante.on("open", () => visitante.send(JSON.stringify({ type: "subscribe_match", matchId: MATCH })));
visitante.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "subscribed") {
    visitantePronto = true;
    tentarEnviar();
  } else if (msg.type === "draft_preview") {
    console.log(`PASS visitante recebeu draft_preview — championId=${msg.championId} side=${msg.side}`);
    recebeu = true;
    clearTimeout(timer);
    process.exit(0);
  }
});
visitante.on("error", (e) => {
  console.log(`FAIL erro no socket visitante: ${e?.message}`);
  process.exit(1);
});

jogador.on("open", () => jogador.send(JSON.stringify({ type: "subscribe_match", matchId: MATCH })));
jogador.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "subscribed") {
    jogadorPronto = true;
    tentarEnviar();
  }
});
jogador.on("error", (e) => {
  console.log(`FAIL erro no socket jogador: ${e?.message}`);
  process.exit(1);
});
