import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userRoles } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches, tournamentSeriesGames } from "../../db/schema/tournaments.js";
import { matches, matchPlayers, matchCodes, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import {
  criarSalaCampeonato,
  criarSalasCampeonatoPendentes,
  entrarNaVaga,
  sairDaVaga,
  marcarPronto,
  podeVerCodigoSalaCampeonato,
  avancarSalaCampeonatoAposJogada,
  encerrarSalaCampeonato,
} from "../src/lib/sala-campeonato.js";

const U = (n: number) => `aaaaaaad-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbbd-0000-0000-0000-00000000000${n}`;

/** Data/hora no formato do cronograma (fuso SP), daqui a N minutos. */
function daquiMinSP(min: number) {
  const d = new Date(Date.now() + min * 60000);
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return { data, hora };
}

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "org@x.com", displayName: "Organizador" }, // organizador/staff
    { id: U(2), email: "membro-a@x.com", displayName: "Membro A" }, // membro aceito do AAA
    { id: U(3), email: "coach-b@x.com", displayName: "Coach B" }, // coach aceito do BBB
    { id: U(4), email: "dono-b@x.com", displayName: "Dono B" }, // dono do BBB
    { id: U(5), email: "estranho@x.com", displayName: "Estranho" }, // fora dos times
  ]);
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "AAA", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "BLACKSAILS", tag: "BBB", ownerId: U(4) },
  ]);
  await db.insert(teamMembers).values([
    { teamId: T(1), userId: U(2), roleSlot: "mid", status: "accepted" },
    { teamId: T(2), userId: U(3), roleSlot: "coach", status: "accepted" },
  ]);
  await db.insert(matchCodes).values({ code: "BR-TEST-SALA-1", used: false });

  const [torneio] = await db
    .insert(tournaments)
    .values({
      gameId: "lol",
      slug: "sala-campeonato",
      name: "Sala Campeonato",
      format: "groups",
      status: "in_progress",
      organizerId: U(1),
    })
    .returning();

  const { data, hora } = daquiMinSP(5);
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
      displayDate: data,
      displayTime: hora,
    })
    .returning();

  return { torneio, serie };
}

async function novaSerie(db: any, torneioId: string, extra: any = {}) {
  const [serie] = await db
    .insert(tournamentMatches)
    .values({
      tournamentId: torneioId,
      phase: "group_stage",
      round: 0,
      teamAId: T(1),
      teamBId: T(2),
      teamATag: "AAA",
      teamBTag: "BBB",
      status: "confirmado",
      ...extra,
    })
    .returning();
  return serie;
}

async function preencherVagas(ctx: any, salaNum: number) {
  assert.equal((await entrarNaVaga(ctx.db, { salaNum, userId: U(2), side: "blue" })).ok, true);
  assert.equal((await entrarNaVaga(ctx.db, { salaNum, userId: U(4), side: "red" })).ok, true);
}

describe("sala-campeonato (ADR-076..085)", () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = await setupDb();
    ctx.seed = await seed(ctx.db);
  });
  afterEach(async () => {
    await ctx.client.close();
  });

  test("cria a sala da série com código, estado e vínculo; 2ª chamada devolve a existente", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    assert.equal(r.ok, true);
    assert.equal(r.criada, true);
    assert.equal(r.sala.mode, "campeonato");
    assert.equal(r.sala.status, "camp_vagas");
    assert.equal(r.sala.tournamentMatchId, serie.id);
    assert.equal(r.sala.timeATag, "AAA");
    assert.ok(r.sala.codigoPartida, "código copiado para a sala");

    const [serieDb] = await ctx.db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(serieDb.status, "em_andamento", "série marcada em andamento (equivale ao Iniciar Série)");
    assert.equal(serieDb.codigoPartida, r.sala.codigoPartida);

    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.equal(estado.jogo, 1);

    const r2: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    assert.equal(r2.ok, true);
    assert.equal(r2.criada, false);
    assert.equal(r2.sala.id, r.sala.id);
  });

  test("série finalizada não cria sala", async () => {
    const { torneio, serie } = ctx.seed;
    await ctx.db.update(tournamentMatches).set({ status: "finalizada" }).where(eq(tournamentMatches.id, serie.id));
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "serie_finalizada");
  });

  test("varredura T-10: cria só o jogo dentro da janela; 'A COMBINAR' fica manual", async () => {
    const { torneio, serie } = ctx.seed; // +5min
    const { data: dataLonge, hora: horaLonge } = daquiMinSP(40);
    const longe = await novaSerie(ctx.db, torneio.id, { displayDate: dataLonge, displayTime: horaLonge });
    const combinar = await novaSerie(ctx.db, torneio.id, { displayDate: "A COMBINAR", displayTime: "--:--" });

    const r = await criarSalasCampeonatoPendentes(ctx.db, new Date());
    assert.equal(r.criadas, 1, "só o jogo de +5min ganha sala");

    const sala = await ctx.db.select().from(matches).where(eq(matches.tournamentMatchId, serie.id));
    const salaLonge = await ctx.db.select().from(matches).where(eq(matches.tournamentMatchId, longe.id));
    const salaCombinar = await ctx.db.select().from(matches).where(eq(matches.tournamentMatchId, combinar.id));
    assert.equal(sala.length, 1);
    assert.equal(salaLonge.length, 0);
    assert.equal(salaCombinar.length, 0);

    // 2ª rodada não duplica.
    const r2 = await criarSalasCampeonatoPendentes(ctx.db, new Date());
    assert.equal(r2.criadas, 0);
  });

  test("entrar: membro e coach entram nos próprios lados; estranho e lado errado negados", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const salaNum = r.sala.salaNum;

    const estranho: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(5), side: "blue" });
    assert.equal(estranho.erro, "nao_e_do_time");

    const ladoErrado: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(2), side: "red" });
    assert.equal(ladoErrado.erro, "nao_e_do_time");

    const membro: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(2), side: "blue" });
    assert.equal(membro.ok, true);
    assert.equal(membro.estado, "camp_vagas", "1 vaga só → segue preenchendo");

    const vagaOcupada: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(1), side: "blue" }); // dono do AAA
    assert.equal(vagaOcupada.erro, "vaga_ocupada");

    const coach: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(3), side: "red" });
    assert.equal(coach.ok, true);
    assert.equal(coach.estado, "camp_prontos", "2ª vaga → aguardando PRONTOs");

    const donoOutroVez: any = await entrarNaVaga(ctx.db, { salaNum, userId: U(4), side: "red" });
    assert.equal(donoOutroVez.erro, "estado_invalido", "sala cheia (camp_prontos) não aceita novo join");
  });

  test("sair volta para camp_vagas e zera os PRONTOs", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const salaNum = r.sala.salaNum;
    await preencherVagas(ctx, salaNum);

    const pronto: any = await marcarPronto(ctx.db, { salaNum, userId: U(2) });
    assert.equal(pronto.ok, true);
    assert.equal(pronto.avancou, false);

    const saiu: any = await sairDaVaga(ctx.db, { salaNum, userId: U(2) });
    assert.equal(saiu.ok, true);
    assert.equal(saiu.estado, "camp_vagas");

    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.equal(estado.prontoBlue, false);
    assert.equal(estado.prontoRed, false);
  });

  test("os DOIS PRONTO → camp_lado com sorteio do jogo 1 persistido", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const salaNum = r.sala.salaNum;
    await preencherVagas(ctx, salaNum);

    const p1: any = await marcarPronto(ctx.db, { salaNum, userId: U(2) });
    assert.equal(p1.avancou, false);
    const p2: any = await marcarPronto(ctx.db, { salaNum, userId: U(4) });
    assert.equal(p2.ok, true);
    assert.equal(p2.avancou, true);
    assert.equal(p2.estado, "camp_lado");

    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.ok(["blue", "red"].includes(estado.sorteioVencedor), "sorteio persistido");
    assert.equal(estado.escolhaTime, estado.sorteioVencedor, "quem venceu o sorteio escolhe primeiro");

    const [salaDb] = await ctx.db.select().from(matches).where(eq(matches.id, r.sala.id));
    assert.equal(salaDb.status, "camp_lado");

    const repetido: any = await marcarPronto(ctx.db, { salaNum, userId: U(2) });
    assert.equal(repetido.erro, "estado_invalido", "PRONTO repetido após avançar não re-sorteia");
  });

  test("jogo 2+: o perdedor do jogo anterior escolhe o lado; sem resultado, trava", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const salaNum = r.sala.salaNum;
    await preencherVagas(ctx, salaNum);
    await ctx.db
      .update(campeonatoSalaEstado)
      .set({ jogo: 2 })
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));

    // Sem o resultado do jogo 1, o 2º PRONTO não avança.
    await marcarPronto(ctx.db, { salaNum, userId: U(2) });
    const semResultado: any = await marcarPronto(ctx.db, { salaNum, userId: U(4) });
    assert.equal(semResultado.erro, "resultado_anterior_pendente");

    // Motor registrou o jogo 1 com vitória do 'a' → perdedor 'b' (vermelho) escolhe.
    await ctx.db.insert(tournamentSeriesGames).values({
      matchId: serie.id,
      tournamentId: torneio.id,
      gameNumber: 1,
      winnerSide: "a",
      matchIdRiot: "BR1_TESTE_1",
    });
    const avancou: any = await marcarPronto(ctx.db, { salaNum, userId: U(4) });
    assert.equal(avancou.ok, true);
    assert.equal(avancou.estado, "camp_lado");
    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.equal(estado.escolhaTime, "red", "perdedor do jogo 1 (b=vermelho) escolhe");
  });

  test("gancho do motor: jogada avança o jogo e zera PRONTOs; encerrar fecha a sala", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const salaNum = r.sala.salaNum;
    await preencherVagas(ctx, salaNum);
    await marcarPronto(ctx.db, { salaNum, userId: U(2) });
    await marcarPronto(ctx.db, { salaNum, userId: U(4) });

    await ctx.db.transaction(async (tx: any) => {
      await avancarSalaCampeonatoAposJogada(tx, { serieId: serie.id, isBracket: false, jogadas: 1 });
    });
    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.equal(estado.jogo, 2, "jogo avançou");
    assert.equal(estado.prontoBlue, false);
    assert.equal(estado.prontoRed, false);
    assert.equal(estado.escolhaTime, null);
    const [salaDb] = await ctx.db.select().from(matches).where(eq(matches.id, r.sala.id));
    assert.equal(salaDb.status, "camp_prontos");

    // Idempotente: mesma contagem não regride nem avança de novo.
    await ctx.db.transaction(async (tx: any) => {
      await avancarSalaCampeonatoAposJogada(tx, { serieId: serie.id, isBracket: false, jogadas: 1 });
    });
    const [estado2] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, r.sala.id));
    assert.equal(estado2.jogo, 2);

    await ctx.db.transaction(async (tx: any) => {
      await encerrarSalaCampeonato(tx, { serieId: serie.id, isBracket: false });
    });
    const [final] = await ctx.db.select().from(matches).where(eq(matches.id, r.sala.id));
    assert.equal(final.status, "camp_finalizada");
  });

  test("código visível para membro, dono e staff; estranho não vê", async () => {
    const { torneio, serie } = ctx.seed;
    const r: any = await criarSalaCampeonato(ctx.db, { torneio, serie, isBracket: false });
    const sala = r.sala;

    assert.equal(await podeVerCodigoSalaCampeonato(ctx.db, U(2), sala), true, "membro do AAA");
    assert.equal(await podeVerCodigoSalaCampeonato(ctx.db, U(4), sala), true, "dono do BBB");
    assert.equal(await podeVerCodigoSalaCampeonato(ctx.db, U(1), sala), true, "organizador");
    assert.equal(await podeVerCodigoSalaCampeonato(ctx.db, U(5), sala), false, "estranho");

    await ctx.db.insert(userRoles).values({ userId: U(5), role: "streamer" });
    assert.equal(await podeVerCodigoSalaCampeonato(ctx.db, U(5), sala), true, "streamer (staff de sala)");
  });
});
