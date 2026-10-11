import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchDrafts, matchCodes } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";
import { aplicarAcaoDraft, DRAFT_TURN_MS, getTurnOrder } from "../src/lib/draft/index.js";

/** Cria jogador com Riot vinculado (exigido em apostada; aqui só conveniência). */
async function criaJogador(db: any, id: string) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador", riotId: "RIOT-" + id });
  await db.insert(userWallets).values({ userId: id, mc: 0, mcReservado: 0 });
}

/**
 * Sala em `confirmacao` com 2 jogadores já CONFIRMADOS. O `mode` decide o
 * fluxo: 5v5/time_vs_time têm draft; 1v1/ARAM pulam a fase. maxJogadores=2
 * basta — o motor só olha o MODO para montar a ordem dos turnos.
 */
async function criaSalaConfirmada(db: any, mode = "5v5", values: any = {}) {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  await criaJogador(db, a);
  await criaJogador(db, b);
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const roleSlot = mode === "1v1" || mode === "aram" ? "MID" : "JG";
  const [sala] = await db
    .insert(matches)
    .values({
      gameId: "lol",
      mode,
      createdBy: dono,
      status: "confirmacao",
      apostaMc: 0,
      taxaPct: "8.99",
      maxJogadores: 2,
      confirmacaoExpiresAt: new Date(Date.now() + 60_000),
      ...values,
    })
    .returning();
  await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot, confirmed: true });
  await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot, confirmed: true });
  return { sala, blue: a, red: b };
}

describe("draft: modos sem draft (1v1/ARAM) pulam a fase", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("1v1 e ARAM: confirmados → iniciando_partida com código (sem linha de draft)", async () => {
    const db = ctx.db;
    // Código para a fila do 1v1 e código genérico (ARAM usa os genéricos, ADR-042).
    await db.insert(matchCodes).values({ code: "BR050c8-SKIP1V1", used: false, mode: "1v1" });
    await db.insert(matchCodes).values({ code: "BR04fa2-SKIPARAM", used: false, mode: null });

    for (const modo of ["1v1", "aram"]) {
      const { sala } = await criaSalaConfirmada(db, modo);
      const r = await avaliarTransicoes(db as any, sala.id);

      assert.equal(r.estado, "iniciando_partida", `${modo}: pula o draft`);

      const drafts = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
      assert.equal(drafts.length, 0, `${modo}: nenhuma linha de draft criada`);

      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.ok(m.codigoPartida && m.codigoPartida !== "SEM-CODIGO-AGUARDE", `${modo}: código atribuído ao pular`);
      assert.ok(m.iniciandoPartidaAt, `${modo}: timer de início marcado pelo servidor`);

      const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.ok(players.every((p: any) => p.linked === true), `${modo}: vagas vinculadas`);
    }
  });
});

describe("draft 5v5: confirmacao abre o draft e o servidor é a autoridade", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("todos confirmados → estado draft com linha de draft criada e prazo do servidor", async () => {
    const db = ctx.db;
    const { sala } = await criaSalaConfirmada(db, "5v5");

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

  test("time_vs_time usa o mesmo draft do 5v5 (hoje idêntico; arquivo próprio)", async () => {
    const db = ctx.db;
    const { sala } = await criaSalaConfirmada(db, "time_vs_time");

    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "draft");
    assert.deepEqual(getTurnOrder("time_vs_time"), getTurnOrder("5v5"));
  });

  test("ação do time errado é recusada; a do time certo avança o turno", async () => {
    const db = ctx.db;
    const { sala, blue, red } = await criaSalaConfirmada(db, "5v5");
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

  test("ban vencido vira ban vazio (null) com catch-up; pick vencido cancela o draft", async () => {
    const db = ctx.db;
    const { sala } = await criaSalaConfirmada(db, "5v5");
    await avaliarTransicoes(db as any, sala.id);

    // Força o prazo 45s para trás (> 1 turno de 30s): o catch-up do servidor
    // resolve DOIS bans vencidos de uma vez (turnos 0 e 1) e para no turno 2.
    await db
      .update(matchDrafts)
      .set({ turnDeadlineAt: new Date(Date.now() - DRAFT_TURN_MS * 1.5) })
      .where(eq(matchDrafts.matchId, sala.id));

    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "draft", "ban vencido NÃO cancela o draft");

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.deepEqual(draft.blueBans, [null], "ban vazio do azul registrado como null");
    assert.deepEqual(draft.redBans, [null], "catch-up também consumiu o ban do vermelho");
    assert.equal(draft.currentTurn, 2);
    assert.equal(draft.currentTeam, "blue");
    assert.equal(draft.currentPhase, "ban");

    // Avança a fixture até um turno de PICK e força o pick vencido: o draft
    // cancela e a sala volta a `confirmacao` (jogadores seguem na sala).
    await db
      .update(matchDrafts)
      .set({ currentTurn: 6, currentPhase: "pick", currentTeam: "blue", turnDeadlineAt: new Date(Date.now() - DRAFT_TURN_MS * 1.5) })
      .where(eq(matchDrafts.matchId, sala.id));
    const r2 = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r2.estado, "confirmacao", `esperado confirmacao, veio ${r2.estado}`);

    const restantes = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(restantes.length, 0, "linha do draft removida no cancelamento");

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "confirmacao");
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.ok(players.every((p: any) => p.confirmed === false && p.linked === false), "confirmações e vínculos resetados");
  });

  test("draft 5v5 completo (20 turnos) fecha e a sala vai para iniciando_partida com código", async () => {
    const db = ctx.db;
    const { sala, blue, red } = await criaSalaConfirmada(db, "5v5");

    // Pool com 1 código genérico — a atribuição no fechamento usa este.
    await db.insert(matchCodes).values({ code: "BR04fa2-TEST5V5", used: false, mode: null });

    await avaliarTransicoes(db as any, sala.id);
    const [match] = await db.select().from(matches).where(eq(matches.id, sala.id));

    const ordem = getTurnOrder("5v5");
    assert.equal(ordem.length, 20);

    for (let i = 0; i < ordem.length; i++) {
      const turno = ordem[i];
      const user = turno.team === "blue" ? blue : red;
      const r = await aplicarAcaoDraft(db as any, match, user, turno.phase, `Campeao${i}`);
      assert.equal(r.ok, true, `ação ${i} (${turno.team}/${turno.phase}) deve passar`);
    }

    // O loop que roda nas rotas/tick fecha o draft: código + iniciando_partida.
    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "iniciando_partida");

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(draft.status, "finished");
    assert.equal(draft.blueBans.length, 5);
    assert.equal(draft.redBans.length, 5);
    assert.equal(draft.bluePicks.length, 5);
    assert.equal(draft.redPicks.length, 5);

    const [matchFinal] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.ok(matchFinal.codigoPartida && matchFinal.codigoPartida !== "SEM-CODIGO-AGUARDE", "código atribuído no fechamento do draft");
    assert.ok(matchFinal.iniciandoPartidaAt, "timer de início marcado pelo servidor");
  });
});
