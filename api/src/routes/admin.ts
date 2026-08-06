import { Router } from "express";
import { eq, and, gt, inArray, desc, sql } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles, userWallets } from "../../../db/schema/identidade.js";
import { payments, platformRevenue } from "../../../db/schema/economia.js";
import { userStrikes } from "../../../db/schema/apostas.js";
import { removerStrike } from "../lib/match-flow.js";

export const adminRouter = Router();

async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

const ROLE_TO_LEGACY: Record<string, string> = {
  admin: "admin",
  proprietario: "proprietario",
  organizer: "organizador",
  streamer: "streamer",
  caster: "caster",
  user: "jogador",
};

const LEGACY_TO_ROLE: Record<string, string> = {
  admin: "admin",
  proprietario: "proprietario",
  organizador: "organizer",
  streamer: "streamer",
  caster: "caster",
  jogador: "user",
};

// ── GET /api/admin/cargos — lista usuários e cargos ────────────────────────
// Substitui a RPC listar_admins_com_email. Só admin/proprietário vê. Lista
// TODOS os usuários (não só quem tem cargo) — o painel de cargos do site
// original mostra a base completa para o proprietário promover/rebaixar.
adminRouter.get("/cargos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode listar cargos" });
    }

    // LEFT JOIN: usuários sem linha em user_roles aparecem com cargo vazio.
    // Usa o cargo "mais alto" por usuário (proprietario > admin > ...) via
    // DISTINCT ON, no mesmo espírito da RPC antiga.
    const rows: any[] = await db
      .selectDistinctOn([users.id], {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: userRoles.role,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .orderBy(users.id, desc(userRoles.role))
      .limit(500);

    return res.json(rows.map((r) => ({
      id: r.id,
      user_id: r.id,
      email: r.email,
      display_name: r.displayName,
      cargo: r.role ? ROLE_TO_LEGACY[r.role] || r.role : "jogador",
    })));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar cargos" });
  }
});

// ── PUT /api/admin/cargos/:userId — atualiza cargo de um usuário ───────────
// Substitui a RPC atualizar_cargo_usuario. Só proprietário pode.
adminRouter.put("/cargos/:userId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas proprietário pode alterar cargos" });
    }

    const { userId } = req.params;
    const novoCargo = String(req.body?.p_cargo ?? req.body?.cargo ?? "").trim();
    if (!novoCargo) return res.status(400).json({ error: "cargo é obrigatório" });

    const newRole = LEGACY_TO_ROLE[novoCargo] || novoCargo;
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "Usuário não encontrado" });

    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, ["admin", "organizer", "streamer", "caster", "user"])));
    if (newRole !== "user") {
      await db.insert(userRoles).values({ userId, role: newRole });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar cargo" });
  }
});

// ── GET /api/admin/strikes/:userId — lista strikes de um usuário (admin) ────
// Design v3 §2.1: admin pode ver o histórico de punições para decidir se perdoa.
adminRouter.get("/strikes/:userId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode ver strikes" });
    }

    const rows = await db
      .select()
      .from(userStrikes)
      .where(eq(userStrikes.userId, req.params.userId))
      .orderBy(desc(userStrikes.createdAt));
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar strikes" });
  }
});

// ── DELETE /api/admin/strikes/:id — remove um strike (admin, auditado) ─────
// Seta removido_por/removido_em (o strike deixa de contar). Idempotente:
// já removido → ok sem duplicar auditoria.
adminRouter.delete("/strikes/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode remover strike" });
    }

    const [strike] = await db.select().from(userStrikes).where(eq(userStrikes.id, req.params.id)).limit(1);
    if (!strike) return res.status(404).json({ error: "Strike não encontrado" });

    // Seta removido_por/removido_em e, se a contagem cair abaixo do teto,
    // reativa a suspensão que os strikes causaram.
    const total = await removerStrike(db, strike.id, user.id);
    return res.json({ ok: true, strikes: total });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao remover strike" });
  }
});

// ── GET /api/admin/financeiro?periodo=today|7|30|all — dashboard financeiro ──
// Visão financeira do painel (ADR-032). Só admin/proprietário.
//   faturamento       = R$ recebidos (payments status=approved, amount_brl)
//   saques            = R$ pagos ao cliente (fluxo sec.pix ainda inexistente → zero)
//   lucro             = MC retido/queimado pela plataforma (taxa de sala hoje;
//                       lojas futuras entram no mesmo somatório), R$1 = 100 MC
//   mcEmCirculacao    = MC vivo no projeto (mc + mc_reservado em user_wallets)
//   dinheiroNoProjeto = mcEmCirculacao ÷ 100 (quanto o projeto "tem" em MC)
// Série diária (serie[]): faturamento/saques/lucro por dia no período.
adminRouter.get("/financeiro", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário" });
    }

    const periodo = String(req.query.periodo || "30");
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    // "Hoje" agrega por hora (como o dashboard da barbearia); o resto por dia.
    const porHora = periodo === "today";

    let inicio: Date;
    if (periodo === "today") inicio = inicioHoje;
    else if (periodo === "7") inicio = new Date(inicioHoje.getTime() - 6 * 86400000);
    else if (periodo === "30") inicio = new Date(inicioHoje.getTime() - 29 * 86400000);
    else inicio = new Date(2020, 0, 1); // 'all' — começa do primeiro movimento

    // Faturamento por bucket (hora no "Hoje", dia nos demais): payments aprovados (R$).
    const truncFat = porHora ? "hour" : "day";
    const fat = await db.execute(sql`
      SELECT to_char(date_trunc(${truncFat}, ${payments.paidAt}), 'YYYY-MM-DD HH24:00') AS dia,
             COALESCE(SUM(${payments.amountBrl})::float, 0) AS total
      FROM ${payments}
      WHERE ${payments.status} = 'approved' AND ${payments.paidAt} >= ${inicio}
      GROUP BY 1
    `);

    // Lucro por bucket: MC retido pela plataforma (taxas de sala). Lojas futuras
    // queimam MC no mesmo padrão — somar a fonte delas aqui quando existirem.
    const lucro = await db.execute(sql`
      SELECT to_char(date_trunc(${truncFat}, ${platformRevenue.createdAt}), 'YYYY-MM-DD HH24:00') AS dia,
             COALESCE(SUM(${platformRevenue.mcFee} + ${platformRevenue.mcFeeRounding}), 0) AS mc
      FROM ${platformRevenue}
      WHERE ${platformRevenue.createdAt} >= ${inicio}
      GROUP BY 1
    `);

    // MC em circulação (snapshot atual — dinheiro que o projeto "tem" em MC).
    const circ = await db.execute(sql`
      SELECT COALESCE(SUM(${userWallets.mc} + ${userWallets.mcReservado}), 0) AS mc
      FROM ${userWallets}
    `);

    const fatMap = new Map<string, number>();
    for (const r of (fat as any).rows) fatMap.set(r.dia, Number(r.total));
    const lucroMap = new Map<string, number>();
    for (const r of (lucro as any).rows) lucroMap.set(r.dia, Number(r.mc));

    const mcTotal = Number((circ as any).rows?.[0]?.mc ?? 0);

    // Série contínua: preenche buckets sem movimento com zero para o gráfico não
    // ter buracos. Em 'all', começa do primeiro registro (senão seriam anos de
    // zeros antes da plataforma existir).
    if (periodo === "all") {
      const primeiroMov = [...fatMap.keys(), ...lucroMap.keys()].sort()[0];
      if (primeiroMov) inicio = new Date(primeiroMov.slice(0, 10) + "T00:00:00Z");
    }

    const serie: { data: string; faturamento: number; saques: number; lucro: number }[] = [];
    const bucketKey = (d: Date) =>
      porHora
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 00:00`;

    const passo = porHora ? 3600_000 : 86400_000;
    for (let t = inicio.getTime(); t <= agora.getTime(); t += passo) {
      const key = bucketKey(new Date(t));
      serie.push({
        data: key,
        faturamento: fatMap.get(key) ?? 0,
        saques: 0,
        lucro: (lucroMap.get(key) ?? 0) / 100,
      });
    }

    const totais = {
      faturamento: serie.reduce((a, p) => a + p.faturamento, 0),
      saques: 0,
      lucro: serie.reduce((a, p) => a + p.lucro, 0),
      mcEmCirculacao: mcTotal,
      dinheiroNoProjeto: mcTotal / 100,
    };

    return res.json({ periodo, totais, serie });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar financeiro" });
  }
});
