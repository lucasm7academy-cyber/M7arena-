import { Router } from "express";
import { db } from "../../db.js";
import { getAuthUser } from "../../lib/content.js";
import { ErroPoker, comprarEntrada, fecharMesa, listarMesas, criarMesa } from "./service.js";

export const pokerRouter = Router();

pokerRouter.get("/rooms", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    return res.json({ rooms: await listarMesas(db, user?.id) });
  } catch (error: any) {
    return responderErro(res, error);
  }
});

pokerRouter.post("/rooms", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, erro: "nao_autenticado", error: "nao_autenticado" });
    }
    const room = await db.transaction((tx) => criarMesa(tx, user.id, req.body ?? {}));
    return res.json({ ok: true, room });
  } catch (error: any) {
    return responderErro(res, error);
  }
});

function responderErro(res: any, error: any) {
  if (error instanceof ErroPoker) {
    return res.status(error.status).json({ ok: false, erro: error.code, error: error.code });
  }
  return res.status(500).json({ ok: false, erro: "erro_interno", error: error?.message || "erro_interno" });
}

// POST /api/poker/buyin — autenticado. Debita EA (nunca MC) e abre a sessão.
pokerRouter.post("/buyin", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, erro: "nao_autenticado", error: "nao_autenticado" });
    }
    const resultado = await db.transaction((tx) => comprarEntrada(tx, user.id, req.body ?? {}));
    return res.json({ ok: true, sessionId: resultado.sessionId, ea: resultado.ea });
  } catch (error: any) {
    return responderErro(res, error);
  }
});

// POST /api/poker/cashout — autenticado. Credita o stack e fecha a sessão; a
// segunda chamada na mesma sessão recebe 400 sessao_encerrada sem creditar.
pokerRouter.post("/cashout", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, erro: "nao_autenticado", error: "nao_autenticado" });
    }
    const resultado = await db.transaction((tx) => fecharMesa(tx, user.id, req.body ?? {}));
    return res.json({ ok: true, ea: resultado.ea, payout: resultado.payout });
  } catch (error: any) {
    return responderErro(res, error);
  }
});
