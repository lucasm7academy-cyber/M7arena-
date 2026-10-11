import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches, tournamentSeriesGames } from "../../db/schema/tournaments.js";
import { matches, matchDrafts, matchCodes, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import {
  criarSalaCampeonato,
  entrarNaVaga,
  marcarPronto,
  escolherLado,
  escolherPickOrder,
  shapeSalaCampeonato,
  avancarSalaCampeonatoAposJogada,
} from "../src/lib/sala-campeonato.js";
import {
  garantirDraftSalaCampeonato,
  avaliarDraftSalaCampeonato,
  aplicarAcaoSalaCampeonato,
  ladoPrimeiroPick,
  campeoesTravados,
} from "../src/lib/sala-campeonato-draft.js";

const U = (n: number) => `aaaaaaae-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbbe-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "org@x.com", displayName: "Organizador" },
    { id: U(2), email: "membro-a@x.com", displayName: "Membro A" },
    { id: U(4), email: "dono-b@x.com", displayName: "Dono B" },
    { id: U(5), email: "estranho@x.com", displayName: "Estranho" },
  ]);
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "AAA", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "BLACKSAILS", tag: "BBB", ownerId: U(4) },
  ]);
  await db.insert(teamMembers).values([{ teamId: T(1), userId: U(2), roleSlot: "mid", status: "accepted" }]);
  await db.insert(matchCodes).values({ code: "BR-DRAFT-CAMP-1", used: false });

  const [torneio] = await db
    .insert(tournaments)
    .values({
      gameId: "lol",
      slug: "draft-sala",
      name: "Draft Sala",
      format: "groups",
      status: "in_progress",
      organizerId: U(1),
    })
    .returning();
  const [serie] = await db
    .insert(tournamentMatches)
    .values({
      tournamentId: torneio.id,
      phase: "group_stage",
      round: 0,
      teamAId: T(1),
      teamBId: T(2),
      teamATag: "AAA",
      teamBTag: "BBB",
      status: "confirmado",
      displayDate: "A COMBINAR",
      displayTime: "--:--",
    })
    .returning();
  return { torneio, serie };
}

const usuarioDoLado = (lado: string) => (lado === "blue" ? U(2) : U(4));

async function lerDraft(ctx: any, matchId: string, jogo: number) {
  const rows = await ctx.db.select().from(matchDrafts).where(eq(matchDrafts.matchId, matchId));
  return rows.find((r: any) => r.jogo === jogo) ?? null;
}

async function acaoDraft(ctx: any, sala: any, tipo: "ban" | "pick", userId: string, champ: unknown) {
  return ctx.db.transaction(async (tx: any) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    await garantirDraftSalaCampeonato(tx, m, estado);
    await avaliarDraftSalaCampeonato(tx, m);
    return aplicarAcaoSalaCampeonato(tx, m, userId, tipo, champ);
  });
}

/** Leva a sala até camp_draft (vagas → PRONTOS → lado → pick order). */
async function paraCampDraft(ctx: any) {
  const { torneio, serie } = ctx.seed;
  const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
  const sala = r.sala;
  await entrarNaVaga(ctx.db, { salaNum: sala.salaNum, userId: U(2), side: "blue" });
  await entrarNaVaga(ctx.db, { salaNum: sala.salaNum, userId: U(4), side: "red" });
  await marcarPronto(ctx.db, { salaNum: sala.salaNum, userId: U(2) });
  await marcarPronto(ctx.db, { salaNum: sala.salaNum, userId: U(4) });
  const [estado] = await ctx.db
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, sala.id));
  const sorteado = estado.escolhaTime as string;
  const outro = sorteado === "blue" ? "red" : "blue";
  await escolherLado(ctx.db, { salaNum: sala.salaNum, userId: usuarioDoLado(sorteado), lado: "red" });
  await escolherPickOrder(ctx.db, { salaNum: sala.salaNum, userId: usuarioDoLado(outro), ordem: "first" });
  const [salaDb] = await ctx.db.select().from(matches).where(eq(matches.id, sala.id));
  return { sala: salaDb };
}

/** Joga N turnos usando sempre o usuário do lado da vez. */
async function jogarTurnos(ctx: any, sala: any, n: number, prefixo = "Dk") {
  const usados: string[] = [];
  for (let i = 0; i < n; i++) {
    const draft = await lerDraft(ctx, sala.id, 1);
    if (!draft || draft.status !== "ongoing") break;
    const champ = `${prefixo}${i}`;
    const r = await acaoDraft(ctx, sala, draft.currentPhase as "ban" | "pick", usuarioDoLado(draft.currentTeam), champ);
    if (!r.ok) throw new Error(`turno ${i} falhou: ${r.erro}`);
    usados.push(champ);
  }
  return usados;
}

describe("draft da sala campeonato (passo 5)", () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = await setupDb();
    ctx.seed = await seed(ctx.db);
  });
  afterEach(async () => {
    await ctx.client.close();
  });

  test("camp_draft já nasce com o draft do jogo e a ordem pelo first pick", async () => {
    const { sala } = await paraCampDraft(ctx);
    const draft = await lerDraft(ctx, sala.id, 1);
    assert.ok(draft, "linha do draft criada");
    assert.equal(draft!.currentTurn, 0);
    assert.equal(draft!.currentPhase, "ban");

    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(draft!.currentTeam, ladoPrimeiroPick(estado), "primeiro ban é do lado com o first pick");

    const shape = await shapeSalaCampeonato(ctx.db, sala);
    assert.ok(shape.draft, "shape traz o draft");
    assert.equal(shape.draft.primeiro_pick, ladoPrimeiroPick(estado));
    assert.equal(shape.draft.regras.max_bans_por_lado, 5);
    assert.deepEqual(shape.draft.campeoes_travados, []);
  });

  test("20 turnos fecham o draft e a sala vai para camp_jogo (com erros de vez/repetido)", async () => {
    const { sala } = await paraCampDraft(ctx);

    // Lado errado não age; campeão repetido é recusado.
    const d0 = await lerDraft(ctx, sala.id, 1);
    const errado = await acaoDraft(ctx, sala, "ban", usuarioDoLado(d0.currentTeam === "blue" ? "red" : "blue"), "X1");
    assert.equal(errado.erro, "fora_do_turno");
    const b1 = await acaoDraft(ctx, sala, "ban", usuarioDoLado(d0.currentTeam), "Aatrox");
    assert.equal(b1.ok, true);
    const repetido = await acaoDraft(ctx, sala, "ban", usuarioDoLado(d0.currentTeam === "blue" ? "red" : "blue"), "Aatrox");
    assert.equal(repetido.erro, "campeao_indisponivel");

    const usados = ["Aatrox", ...(await jogarTurnos(ctx, sala, 19, "Dk"))];
    assert.equal(usados.length, 20, "20 valores aplicados");

    const draft = await lerDraft(ctx, sala.id, 1);
    assert.equal(draft!.status, "finished");
    const [salaDb] = await ctx.db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(salaDb.status, "camp_jogo", "sala vira camp_jogo quando o draft fecha");
    const picks = [...draft!.bluePicks, ...draft!.redPicks].filter(Boolean);
    const bans = [...draft!.blueBans, ...draft!.redBans].filter(Boolean);
    assert.equal(picks.length, 10, "5 picks por lado");
    assert.equal(bans.length, 10, "5 bans por lado");
  });

  test("ban vencido vira ban vazio e avança (catch-up)", async () => {
    const { sala } = await paraCampDraft(ctx);
    await ctx.db
      .update(matchDrafts)
      .set({ turnDeadlineAt: new Date(Date.now() - 45_000) })
      .where(eq(matchDrafts.matchId, sala.id));
    await ctx.db.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
      await avaliarDraftSalaCampeonato(tx, m);
    });
    const draft = await lerDraft(ctx, sala.id, 1);
    const vazios = [...draft!.blueBans, ...draft!.redBans].filter((c: any) => c === null);
    assert.ok(vazios.length >= 1, "ban vencido registrado como vazio");
    assert.ok(draft!.currentTurn >= 2, `catch-up avançou (turno ${draft!.currentTurn})`);
    assert.equal(draft!.status, "ongoing");
  });

  test("pick vencido TRAVA: não avança e a escolha atrasada continua valendo", async () => {
    const { sala } = await paraCampDraft(ctx);
    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    const ladoF = ladoPrimeiroPick(estado);
    await ctx.db
      .update(matchDrafts)
      .set({
        currentTurn: 6,
        currentPhase: "pick",
        currentTeam: ladoF,
        turnDeadlineAt: new Date(Date.now() - 60_000),
      })
      .where(eq(matchDrafts.matchId, sala.id));

    await ctx.db.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
      await avaliarDraftSalaCampeonato(tx, m);
    });
    const travado = await lerDraft(ctx, sala.id, 1);
    assert.equal(travado!.currentTurn, 6, "pick vencido NÃO avança (trava)");
    assert.equal(travado!.status, "ongoing");

    const tarde = await acaoDraft(ctx, sala, "pick", usuarioDoLado(ladoF), "Zed");
    assert.equal(tarde.ok, true, "escolha atrasada é aceita");
    const depois = await lerDraft(ctx, sala.id, 1);
    assert.equal(depois!.currentTurn, 7);
  });

  test("Fearless: picks do jogo 1 ficam travados no jogo 2", async () => {
    const { sala } = await paraCampDraft(ctx);
    await jogarTurnos(ctx, sala, 20, "Fh");
    const jogo1 = await lerDraft(ctx, sala.id, 1);
    const picksJogo1 = [...jogo1!.bluePicks, ...jogo1!.redPicks].filter(Boolean) as string[];
    assert.equal(picksJogo1.length, 10);

    // Motor registra o jogo 1 e a sala avança para o jogo 2 (PRONTOs zerados).
    await ctx.db.transaction(async (tx: any) => {
      await avancarSalaCampeonatoAposJogada(tx, { serieId: ctx.seed.serie.id, isBracket: false, jogadas: 1 });
    });
    const [estado2] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(estado2.jogo, 2);
    assert.equal(estado2.prontoBlue, false);

    const travados = await campeoesTravados(ctx.db, sala.id, 2);
    assert.deepEqual([...travados].sort(), [...picksJogo1].sort());

    // Jogo 2: cria o draft e tenta pickar um campeão do jogo 1 → recusado.
    await ctx.db.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
      await garantirDraftSalaCampeonato(tx, m, estado2);
    });
    await ctx.db
      .update(matchDrafts)
      .set({ currentTurn: 6, currentPhase: "pick", currentTeam: "blue", turnDeadlineAt: new Date(Date.now() + 30_000) })
      .where(eq(matchDrafts.matchId, sala.id));

    const bloqueado = await acaoDraft(ctx, sala, "pick", U(2), picksJogo1[0]);
    assert.equal(bloqueado.erro, "campeao_indisponivel", "pick do jogo 1 travado no jogo 2");
    const novo = await acaoDraft(ctx, sala, "pick", U(2), "NovoCampeao");
    assert.equal(novo.ok, true, "campeão inédito passa");
  });
});
