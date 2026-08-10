// src/routes/og.ts — Página de preview social (Open Graph) de uma sala.
//
// Quando um crawler (WhatsApp, Facebook, Discord, Telegram, Twitter...) busca
// `/5v5/123`, o Nginx detecta o User-Agent de bot e serve ESTA página em vez
// do SPA (que não executa JS — o crawler não veria os meta tags dinâmicos).
// O humano que clica no link continua caindo no SPA normal (o Nginx só desvia
// bots). Evidência: é o único jeito de o card do link mostrar a imagem do modo
// da sala — OG estático do index.html não sabe qual sala foi compartilhada.
import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { buscarSalaPorNumero } from "../lib/match-flow.js";

export const ogRouter = Router();

/** Imagem de fundo do card por modo (web/public/images — servida pelo Nginx). */
const IMAGEM_POR_MODO: Record<string, string> = {
  "5v5": "/images/fundoCard5v5.webp",
  aram: "/images/fundoCardAram.webp",
  "1v1": "/images/fundoCard1v1.webp",
  time_vs_time: "/images/fundoCardTime.webp",
};

/** Rotula o estado da sala para a descrição do card (pt-BR). */
function rotuloEstado(status: string | null): string {
  const rotulos: Record<string, string> = {
    preenchendo: "Aguardando jogadores",
    confirmacao: "Confirmando presença",
    iniciando_partida: "Iniciando partida",
    partida_iniciada: "Partida em andamento",
    finalizacao: "Finalizando",
    aguardando_revisao: "Em análise de resultado",
    encerrada: "Encerrada",
    cancelada: "Cancelada",
  };
  return rotulos[status ?? ""] ?? "Sala de partida";
}

/** Escapa texto para dentro de atributos HTML (título/descrição). */
function escapa(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET /api/og/:modo/:id — devolve HTML mínimo com os meta tags OG da sala.
ogRouter.get("/:modo/:id", async (req, res) => {
  try {
    const modo = req.params.modo;
    const idParam = req.params.id;
    const salaNum = Number(idParam);

    const sala = Number.isInteger(salaNum) && salaNum > 0
      ? await buscarSalaPorNumero(db, salaNum)
      : null;

    // Base da URL: usa APP_URL (determinístico em dev/prod) em vez de derivar
    // do request — o nginx do container repassa sem Host/X-Forwarded para a
    // rota OG, então req.protocol/host apontariam para o upstream interno.
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const modoValido = modo in IMAGEM_POR_MODO;

    // Sala não existe (ou modo errado na URL): cai no card genérico da home,
    // para o link nunca abrir "quebrado" num app de mensagem.
    if (!sala || !modoValido) {
      const fallback = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>M7 Arena | Campeonatos de League of Legends com Premiação em Pix</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="M7 Arena" />
    <meta property="og:title" content="M7 Arena | Salas de League of Legends" />
    <meta property="og:description" content="Monte seu time, encontre parceiros e dispute partidas de LoL com premiação em MC." />
    <meta property="og:url" content="${escapa(baseUrl)}/jogar" />
    <meta property="og:image" content="${escapa(baseUrl)}/images/cropped-cropped-LOGO-M7-PNG-1%20(4).png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
  </head>
  <body></body>
</html>`;
      return res.type("html").send(fallback);
    }

    const [row] = await db
      .select({ total: count() })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, sala.id));

    const jogadores = row?.total ?? 0;
    const maxJogadores = sala.maxJogadores ?? 10;
    const nome = sala.nome || `Sala ${sala.mode} #${String(salaNum).padStart(6, "0")}`;
    const premio = (sala.apostaMc ?? 0) > 0 ? `${sala.apostaMc} MC` : "Casual";
    const elo = sala.eloMinimo ? `Elos ${sala.eloMinimo}+` : "Todos os elos";
    const urlSala = `${baseUrl}/${modo}/${salaNum}`;
    const imagem = `${baseUrl}${IMAGEM_POR_MODO[modo]}`;

    const descricao = `${jogadores}/${maxJogadores} vagas · ${premio} · ${elo} · ${rotuloEstado(sala.status)}`;

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <title>${escapa(nome)} | M7 Arena</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="M7 Arena" />
    <meta property="og:title" content="${escapa(nome)}" />
    <meta property="og:description" content="${escapa(descricao)}" />
    <meta property="og:url" content="${escapa(urlSala)}" />
    <meta property="og:image" content="${escapa(imagem)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapa(nome)}" />
    <meta name="twitter:description" content="${escapa(descricao)}" />
    <meta name="twitter:image" content="${escapa(imagem)}" />
  </head>
  <body></body>
</html>`;

    return res.type("html").send(html);
  } catch (error: any) {
    // Nunca engole erro: o card não pode mentir (403/500 deixa o app de
    // mensagem sem preview — aceitável, e o link continua funcional).
    return res.status(500).send("Erro ao gerar preview");
  }
});
