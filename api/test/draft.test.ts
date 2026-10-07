import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchDrafts, matchCodes } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";
import { aplicarAcaoDraft, DRAFT_TURN_MS, getTurnOrder } from "../src/lib/draft-flow.js";

/** Cria jogador com Riot vinculado (exigido em apostada; aqui só conveniência). */
async function criaJogador(db: any, id: string) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador", riotId: "RIOT-" + id });
  await db.insert(userWallets).values({ userId: id, mc: 0, mcReservado: 0 });
}

/**
 * Sala 1v1 em `confirmacao` com os 2 jogadores já CONFIRMADOS — um
 * `avaliarTransicoes` deve abrir o draft (ban/pick).
 */
async function criaSalaConfirmada(db: any, values: any = {}) {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  await criaJogador(db, a);
  await criaJogador(db, b);
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db
    .insert(matches)
    .values({
      gameId: "lol",
      mode: "1v1",
      createdBy: dono,
      status: "confirmacao",
      apostaMc: 0,
      taxaPct: "8.99",
      maxJogadores: 2,
      confirmacaoExpiresAt: new Date(Date.now() + 60_000),
      ...values,
    })
    .returning();
  await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "MID", confirmed: true });
  await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "MID", confirmed: true });
  return { sala, blue: a, red: b };
}

describe("draft: confirmacao abre o draft e o servidor é a autoridade", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("todos confirmados → estado draft com linha de draft criada e prazo do servidor", async () => {
    const db = ctx.db;
    const { sala } = await criaSalaConfirmada(db);

    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "draft");

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.ok(draft, "linha de draft criada");
    assert.equal(draft.status, "ongoing");
    assert.equal(draft.currentTurn, 0);
    assert.equal(draft.currentPhase, "ban");
    assert.equal(draft.currentTeam, "blue");
    assert.deepEqual(draft.blueBans, []);
    assert.deepEqual(draft.redBans, []);

    // Prazo é do SERVIDOR e está no futuro (~30s), nunca no relógio do cliente.
    const restante = new Date(draft.turnDeadlineAt).getTime() - Date.now();
    assert.ok(restante > DRAFT_TURN_MS - 5_000 && restante <= DRAFT_TURN_MS, `prazo ~30s (veio ${restante}ms)`);

    // Sala ainda NÃO tem código — ele só é atribuído quando o draft fecha.
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "draft");
    assert.equal(m.codigoPartida, null);
  });

  test("ação do time errado é recusada; a do time certo avança o turno", async () => {
    const db = ctx.db;
    const { sala, blue, red } = await criaSalaConfirmada(db);
    await avaliarTransicoes(db as any, sala.id);
    const [match] = await db.select().from(matches).where(eq(matches.id, sala.id));

    // Turno 0 é ban do AZUL — o vermelho tentando banir é recusado.
    const errado = await aplicarAcaoDraft(db as any, match, red, "ban", "Aatrox");
    assert.equal(errado.ok, false);
    assert.equal(errado.erro, "fora_do_turno");

    // Azul bane → turno 1 (ban do vermelho).
    const ok = await aplicarAcaoDraft(db as any, match, blue, "ban", "Aatrox");
    assert.equal(ok.ok, true);

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.deepEqual(draft.blueBans, ["Aatrox"]);
    assert.equal(draft.currentTurn, 1);
    assert.equal(draft.currentTeam, "red");
    assert.equal(draft.currentPhase, "ban");

    // Campeão repetido é recusado (o vermelho tenta banir o mesmo Aatrox).
    const [match2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    const repetido = await aplicarAcaoDraft(db as any, match2, red, "ban", "Aatrox");
    assert.equal(repetido.ok, false);
    assert.equal(repetido.erro, "campeao_indisponivel");

    // Fase inválida: tentar PICK durante o ban.
    const fase = await aplicarAcaoDraft(db as any, match2, red, "pick", "Ahri");
    assert.equal(fase.ok, false);
    assert.equal(fase.erro, "fase_invalida");
  });

  test("ban vencido vira ban vazio (null) e avança; pick vencido cancela o draft", async () => {
    const db = ctx.db;
    const { sala, blue } = await criaSalaConfirmada(db);
    await avaliarTransicoes(db as any, sala.id);

    // Força o prazo do turno 0 para o passado (simula jogador AFK no ban).
    await db
      .update(matchDrafts)
      .set({ turnDeadlineAt: new Date(Date.now() - DRAFT_TURN_MS) })
      .where(eq(matchDrafts.matchId, sala.id));

    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "draft", "ban vencido NÃO cancela o draft");

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.deepEqual(draft.blueBans, [null], "ban vazio registrado como null");
    assert.equal(draft.currentTurn, 1);
    assert.equal(draft.currentTeam, "red");

    // Avança ban do vermelho (vencido) → turno 2 (pick do azul), e força o
    // pick vencido: o draft cancela e a sala volta a `preenchendo`...
    await db
      .update(matchDrafts)
      .set({ turnDeadlineAt: new Date(Date.now() - DRAFT_TURN_MS) })
      .where(eq(matchDrafts.matchId, sala.id));
    await avaliarTransicoes(db as any, sala.id);

    await db
      .update(matchDrafts)
      .set({ turnDeadlineAt: new Date(Date.now() - DRAFT_TURN_MS) })
      .where(eq(matchDrafts.matchId, sala.id));
    const r2 = await avaliarTransicoes(db as any, sala.id);
    // A sala sai do draft; como os 2 jogadores seguem na sala, o próprio loop
    // reabre a `confirmacao` (é o comportamento esperado).
    assert.ok(r2.estado === "confirmacao" || r2.estado === "preenchendo", `esperado confirmacao/preenchendo, veio ${r2.estado}`);

    const restantes = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(restantes.length, 0, "linha do draft removida no cancelamento");

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "confirmacao");
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.ok(players.every((p: any) => p.confirmed === false && p.linked === false), "confirmações e vínculos resetados");
  });

  test("draft completo (1v1: 4 turnos) fecha e a sala vai para iniciando_partida com código", async () => {
    const db = ctx.db;
    const { sala, blue, red } = await criaSalaConfirmada(db);

    // Pool com 1 código para o 1v1 — a atribuição no fechamento usa este.
    await db.insert(matchCodes).values({ code: "BR050c8-TESTCODE", used: false, mode: "1v1" });

    await avaliarTransicoes(db as any, sala.id);
    let [match] = await db.select().from(matches).where(eq(matches.id, sala.id));

    // TURN_ORDER_1V1: ban blue, ban red, pick blue, pick red.
    const passos: Array<{ user: string; tipo: "ban" | "pick"; champ: string }> = [
      { user: blue, tipo: "ban", champ: "Aatrox" },
      { user: red, tipo: "ban", champ: "Ahri" },
      { user: blue, tipo: "pick", champ: "Zed" },
      { user: red, tipo: "pick", champ: "Yasuo" },
    ];
    assert.equal(getTurnOrder("1v1").length, passos.length);

    for (const p of passos) {
      const r = await aplicarAcaoDraft(db as any, match, p.user, p.tipo, p.champ);
      assert.equal(r.ok, true, `ação ${p.tipo} ${p.champ} deve passar`);
    }

    // O loop que roda nas rotas/tick fecha o draft: código + iniciando_partida.
    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "iniciando_partida");

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(draft.status, "finished");
    assert.deepEqual(draft.bluePicks, ["Zed"]);
    assert.deepEqual(draft.redPicks, ["Yasuo"]);

    [match] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.ok(match.codigoPartida && match.codigoPartida !== "SEM-CODIGO-AGUARDE", "código atribuído no fechamento do draft");
    assert.ok(match.iniciandoPartidaAt, "timer de início marcado pelo servidor");
  });
});
