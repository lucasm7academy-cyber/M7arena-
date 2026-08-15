// api/src/routes/streams.ts
// Transmissões de streamer — substitui o `supabase.from('transmissoes')` do
// Streamers.tsx (swap app.swap.conteudo). Regras: iniciar exige cargo streamer
// (user_roles) e twitch_channel no perfil; a vitrine pública lista só as
// ativas não expiradas, 1 por usuário. Nenhuma regra de negócio no cliente.
import { Router } from "express";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "../db.js";
import { transmissoes } from "../../../db/schema/conteudo.js";
import { userRoles } from "../../../db/schema/identidade.js";
import { getAuthUser } from "../lib/match-flow.js";

export const streamsRouter = Router();

/** Converte a linha do banco no shape legado que o Streamers.tsx consome. */
function toLegacy(t: any) {
  return {
    id: t.id,
    user_id: t.userId,
    twitch_channel: t.twitchChannel,
    titulo: t.titulo,
    campeonato_id: t.campeonatoId,
    duracao_horas: t.duracaoHoras,
    ativo: t.ativo,
    criado_em: t.criadoEm ? new Date(t.criadoEm).toISOString() : null,
    expira_em: t.expiraEm ? new Date(t.expiraEm).toISOString() : null,
    modo: t.modo,
    time1_id: t.time1Id,
    time2_id: t.time2Id,
  };
}

// GET /api/streams — vitrine pública: transmissoes ativas e não expiradas.
streamsRouter.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(transmissoes)
      .where(and(eq(transmissoes.ativo, true), isNotNull(transmissoes.expiraEm), gt(transmissoes.expiraEm, now)));
    return res.json(rows.map(toLegacy));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/streams/minha — live ativa do usuário logado (painel do streamer).
streamsRouter.get("/minha", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const [row] = await db
      .select()
      .from(transmissoes)
      .where(and(eq(transmissoes.userId, user.id), eq(transmissoes.ativo, true)))
      .limit(1);
    return res.json(row ? toLegacy(row) : null);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams — inicia uma transmissão. Requer cargo streamer + twitch.
streamsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    if (!roles.some((r) => r.role === "streamer")) {
      return res.status(403).json({ erro: "sem_cargo_streamer" });
    }
    const twitch = (user.socials as Record<string, string> | null)?.["twitch"] ?? "";
    if (!twitch) return res.status(400).json({ erro: "sem_twitch_no_perfil" });

    const { titulo, campeonatoId, duracaoHoras, modo, time1Id, time2Id } = req.body ?? {};
    const duracao = Number(duracaoHoras) > 0 ? Number(duracaoHoras) : 1;
    const expiraEm = new Date(Date.now() + duracao * 60 * 60 * 1000);

    const [row] = await db
      .insert(transmissoes)
      .values({
        userId: user.id,
        twitchChannel: twitch,
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
    return res.status(201).json(toLegacy(row));
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
