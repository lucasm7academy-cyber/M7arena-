import { Router } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";
import { tierlistSubmissions } from "../../../db/schema/tierlist.js";
import { validarTierlistPayload } from "../lib/tierlist.js";

export const tierlistsRouter = Router();

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const rateHits = new Map<string, number[]>();

function permitirEnvio(ip: string): boolean {
  const agora = Date.now();
  const validos = (rateHits.get(ip) ?? []).filter((t) => agora - t < RATE_WINDOW_MS);
  if (validos.length >= RATE_MAX) {
    rateHits.set(ip, validos);
    return false;
  }
  validos.push(agora);
  rateHits.set(ip, validos);
  return true;
}

/** Sessão opcional: o formulário não exige conta, mas vincula se estiver logado. */
async function getAuthUserId(req: any): Promise<string | null> {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const [session] = await db
    .select({ userId: userSessions.userId })
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);
  return session?.userId ?? null;
}

// POST /api/tierlists — formulário público da M7 Academy.
// Sem login obrigatório; o cliente envia o snapshot da Riot que acabou de
// consultar pelo proxy /api/riot. O upsert por puuid permite a pessoa corrigir
// a resposta sem criar duplicata para a importação no app desktop.
tierlistsRouter.post("/", async (req, res) => {
  try {
    // Honeypot: campo invisível que humano não preenche. Responde "ok" para o
    // bot não tentar de novo, mas não grava nada.
    if (typeof req.body?.website === "string" && req.body.website.trim()) {
      return res.status(201).json({ ok: true, id: null });
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!permitirEnvio(ip)) {
      res.setHeader("Retry-After", String(Math.ceil(RATE_WINDOW_MS / 1000)));
      return res.status(429).json({ error: "Muitos envios em pouco tempo. Tente novamente em alguns minutos." });
    }

    const parsed = validarTierlistPayload(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const userId = await getAuthUserId(req);
    const agora = new Date();
    const values = {
      ...parsed.data,
      userId,
      source: "site",
      consentedAt: agora,
      updatedAt: agora,
    };

    const updateSet: Record<string, any> = {
      ...parsed.data,
      source: "site",
      consentedAt: agora,
      updatedAt: agora,
    };
    // Envio anônimo de quem já tinha uma resposta vinculada não apaga o vínculo.
    if (userId) updateSet.userId = userId;

    const [row] = await db
      .insert(tierlistSubmissions)
      .values(values)
      .onConflictDoUpdate({
        target: tierlistSubmissions.puuid,
        set: updateSet,
      })
      .returning({ id: tierlistSubmissions.id });

    return res.status(201).json({ ok: true, id: row.id });
  } catch (error: any) {
    console.error("[tierlist] erro ao salvar:", error?.message || error);
    return res.status(500).json({ error: "Não foi possível salvar sua tier list. Tente novamente." });
  }
});
