import { Router } from "express";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { matchPrints } from "../../../db/schema/apostas.js";
import { users } from "../../../db/schema/identidade.js";
import { getAuthUser } from "../lib/match-flow.js";
import { acessoSala } from "../lib/acesso-sala.js";

export const printsRouter = Router();

/**
 * Prints de prova (design v3 §6). Leitura só para participantes da sala e
 * revisores (admin/moderador) — a URL retornada nunca é link direto do disco:
 * passa por `GET /api/prints/:id/arquivo`, que revalida permissão a cada
 * requisição. O `<img src>` do navegador reenvia o cookie httpOnly, então a
 * mesma sessão que lista os prints serve o arquivo.
 */

/**
 * Lista os prints de uma partida com o nome do jogador. A `url` devolvida é o
 * endpoint autenticado, não o caminho físico em /uploads/.
 */
export async function listarPrints(db: any, matchId: string) {
  const rows = await db
    .select({
      id: matchPrints.id,
      matchId: matchPrints.matchId,
      userId: matchPrints.userId,
      url: matchPrints.url,
      createdAt: matchPrints.createdAt,
      nomeJogador: users.displayName,
    })
    .from(matchPrints)
    .innerJoin(users, eq(users.id, matchPrints.userId))
    .where(eq(matchPrints.matchId, matchId))
    .orderBy(matchPrints.createdAt);
  return rows.map((p: any) => ({ ...p, url: `/api/prints/${p.id}/arquivo` }));
}

// GET /api/prints/:matchId — lista prints de uma partida (participante ou revisor)
printsRouter.get("/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const acesso = await acessoSala(db, user.id, req.params.matchId);
    if (acesso === "nenhum") return res.status(403).json({ erro: "sem_permissao" });
    const prints = await listarPrints(db, req.params.matchId);
    return res.json(prints);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

/**
 * Resolve o caminho físico de um print a partir da URL gravada no banco.
 * O caminho foi gerado pelo servidor no upload, mas revalidamos o prefixo para
 * garantir que nenhum dado corrompido leve a leitura para fora do bucket.
 */
export function resolverArquivoPrint(publicUrl: string): string | null {
  if (!publicUrl?.startsWith("/uploads/match-prints/")) return null;
  const rel = publicUrl.replace(/^\/uploads\//, "");
  const base = path.join(obterUploadDirPrints(), "match-prints");
  const abs = path.normalize(path.join(obterUploadDirPrints(), rel));
  if (!abs.startsWith(base)) return null;
  return abs;
}

function obterUploadDirPrints(): string {
  return process.env.UPLOAD_DIR || "/var/www/uploads";
}

// GET /api/prints/:id/arquivo — serve o arquivo (participante ou revisor)
printsRouter.get("/:id/arquivo", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const [print] = await db.select().from(matchPrints).where(eq(matchPrints.id, req.params.id)).limit(1);
    if (!print) return res.status(404).json({ erro: "nao_encontrado" });
    const acesso = await acessoSala(db, user.id, print.matchId);
    if (acesso === "nenhum") return res.status(403).json({ erro: "sem_permissao" });
    const abs = resolverArquivoPrint(print.url);
    if (!abs || !fs.existsSync(abs)) return res.status(404).json({ erro: "arquivo_nao_encontrado" });
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(abs);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
