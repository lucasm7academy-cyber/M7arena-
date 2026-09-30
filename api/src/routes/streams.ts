// api/src/routes/streams.ts
// Transmissões de streamer + agenda de jogos de campeonato (spec 2026-09-29).
// As regras vivem em lib/streams.ts; aqui só sessão/validação de cargo e o
// mapeamento erro → HTTP.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { transmissoes } from "../../../db/schema/conteudo.js";
import { getAuthUser } from "../lib/match-flow.js";
import {
  toLegacyTransmissao,
  listarVitrine,
  minhaTransmissao,
  listarAgenda,
  pegarVaga,
  soltarVaga,
  entrarNoAr,
  validarStreamer,
} from "../lib/streams.js";

export const streamsRouter = Router();

const HTTP_ERRO: Record<string, number> = {
  sem_cargo_streamer: 403,
  nao_e_o_streamer: 403,
  sem_twitch_no_perfil: 400,
  jogo_nao_encontrado: 404,
  jogo_nao_confirmado: 409,
  jogo_finalizado: 409,
  vaga_ocupada: 409,
  live_no_ar: 409,
  fora_da_janela: 409,
};

function responderErro(res: any, resultado: { erro: string }) {
  return res.status(HTTP_ERRO[resultado.erro] ?? 400).json({ erro: resultado.erro });
}

// GET /api/streams — vitrine pública.
streamsRouter.get("/", async (_req, res) => {
  try {
    const rows = await listarVitrine(db);
    return res.json(rows.map(toLegacyTransmissao));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/streams/agenda — jogos agendáveis (público; enriquecido se logado).
streamsRouter.get("/agenda", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    return res.json(await listarAgenda(db, { userId: user?.id ?? null }));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/streams/minha — live ativa do usuário logado (painel do streamer).
streamsRouter.get("/minha", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const row = await minhaTransmissao(db, user.id);
    return res.json(row ? toLegacyTransmissao(row) : null);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/agenda/:matchId — pega a vaga do jogo.
streamsRouter.post("/agenda/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const v = await validarStreamer(db, user.id);
    if (!v.ok) return responderErro(res, v);
    const r = await pegarVaga(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// DELETE /api/streams/agenda/:matchId — solta a vaga (sem live no ar).
streamsRouter.delete("/agenda/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const r = await soltarVaga(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/agenda/:matchId/no-ar — abre a live do jogo escalado.
streamsRouter.post("/agenda/:matchId/no-ar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const r = await entrarNoAr(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.status(201).json({
      transmissao: toLegacyTransmissao(r.transmissao),
      codigo_partida: r.codigo_partida,
    });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams — inicia transmissão livre (fluxo atual, sem jogo).
streamsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const v = await validarStreamer(db, user.id);
    if (!v.ok) return responderErro(res, v);

    const { titulo, campeonatoId, duracaoHoras, modo, time1Id, time2Id } = req.body ?? {};
    const duracao = Number(duracaoHoras) > 0 ? Number(duracaoHoras) : 1;
    const expiraEm = new Date(Date.now() + duracao * 60 * 60 * 1000);

    const [row] = await db
      .insert(transmissoes)
      .values({
        userId: user.id,
        twitchChannel: v.twitch,
        titulo: typeof titulo === "string" ? titulo : null,
        campeonatoId: campeonatoId ?? null,
        duracaoHoras: duracao,
        ativo: true,
        expiraEm,
        modo: modo === "amistoso" || modo === "campeonato" ? modo : "padrao",
        time1Id: time1Id ?? null,
        time2Id: time2Id ?? null,
      })
      .returning();
    return res.status(201).json(toLegacyTransmissao(row));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/:id/parar — encerra a live (só o dono).
streamsRouter.post("/:id/parar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const [row] = await db.select().from(transmissoes).where(eq(transmissoes.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ erro: "transmissao_nao_encontrada" });
    if (row.userId !== user.id) return res.status(403).json({ erro: "sem_permissao" });
    await db.update(transmissoes).set({ ativo: false }).where(eq(transmissoes.id, req.params.id));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
