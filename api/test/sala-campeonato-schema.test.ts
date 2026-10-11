import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq, and, lt } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches, bracketMatches } from "../../db/schema/tournaments.js";
import { matches, matchDrafts, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";

const U = (n: number) => `aaaaaaac-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbbc-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "org@x.com", displayName: "Organizador" },
    { id: U(2), email: "cap@x.com", displayName: "Capitao" },
  ]);
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "M7W", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "BLACKSAILS", tag: "BKA", ownerId: U(1) },
  ]);
  const [torneio] = await db
    .insert(tournaments)
    .values({
      gameId: "lol",
      slug: "schema-sala",
      name: "Schema Sala",
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
      status: "combinando",
    })
    .returning();
  return { torneio, serie };
}

async function criarSala(ctx: any, serieId: string, extra: any = {}) {
  const [sala] = await ctx.db
    .insert(matches)
    .values({
      gameId: "lol",
      mode: "campeonato",
      status: "camp_vagas",
      createdBy: U(1),
      maxJogadores: 2,
      tournamentMatchId: serieId,
      ...extra,
    })
    .returning();
  return sala;
}

describe("schema da sala campeonato (ADR-085)", () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = await setupDb();
    ctx.seed = await seed(ctx.db);
  });
  afterEach(async () => {
    await ctx.client.close();
  });

  test("sala vinculada à série + estado por jogo (PRONTO, sorteio e escolhas)", async () => {
    const { serie } = ctx.seed;
    const sala = await criarSala(ctx, serie.id);
    assert.equal(sala.tournamentMatchId, serie.id);
    assert.equal(sala.bracketMatchId, null);

    await ctx.db.insert(campeonatoSalaEstado).values({ matchId: sala.id });
    await ctx.db
      .update(campeonatoSalaEstado)
      .set({ prontoBlue: true, escolhaTime: "red", sorteioVencedor: "red" })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));

    const [estado] = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(estado.jogo, 1);
    assert.equal(estado.prontoBlue, true);
    assert.equal(estado.prontoRed, false);
    assert.equal(estado.escolhaTime, "red");
    assert.equal(estado.sorteioVencedor, "red");
    assert.equal(estado.ladoEscolhido, null);
    assert.equal(estado.pickOrderEscolhido, null);
  });

  test("draft por jogo: linhas de jogo 1 e 2 coexistem, PK bloqueia duplicata e Fearless deriva dos jogos anteriores", async () => {
    const { serie } = ctx.seed;
    const sala = await criarSala(ctx, serie.id, { status: "camp_draft" });

    const base = {
      currentTeam: "blue",
      currentPhase: "ban",
      turnDeadlineAt: new Date(Date.now() + 30_000),
    };
    await ctx.db.insert(matchDrafts).values({ ...base, matchId: sala.id, jogo: 1, bluePicks: ["Aatrox"] });
    await ctx.db.insert(matchDrafts).values({ ...base, matchId: sala.id, jogo: 2, bluePicks: ["Ahri"] });

    const [jogo2] = await ctx.db
      .select()
      .from(matchDrafts)
      .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, 2)));
    assert.deepEqual(jogo2.bluePicks, ["Ahri"]);

    let duplicou = false;
    try {
      await ctx.db.insert(matchDrafts).values({ ...base, matchId: sala.id, jogo: 2 });
    } catch {
      duplicou = true;
    }
    assert.equal(duplicou, true, "PK (match_id, jogo) bloqueia duplicata do mesmo jogo");

    // Fearless: campeões travados = picks dos drafts de jogos ANTERIORES.
    const anteriores = await ctx.db
      .select()
      .from(matchDrafts)
      .where(and(eq(matchDrafts.matchId, sala.id), lt(matchDrafts.jogo, 2)));
    const travados = anteriores
      .flatMap((d: any) => [...d.bluePicks, ...d.redPicks])
      .filter(Boolean);
    assert.deepEqual(travados, ["Aatrox"]);
  });

  test("check: sala não pode apontar para cronograma E chave ao mesmo tempo", async () => {
    const { torneio, serie } = ctx.seed;
    const [b] = await ctx.db
      .insert(bracketMatches)
      .values({
        tournamentId: torneio.id,
        section: "upper",
        round: "qf",
        slot: 0,
        teamATag: "M7W",
        teamBTag: "BKA",
      })
      .returning();

    let recusado = false;
    try {
      await criarSala(ctx, serie.id, { bracketMatchId: b.id });
    } catch {
      recusado = true;
    }
    assert.equal(recusado, true, "CHECK matches_campeonato_link_unico");
  });

  test("cascade: apagar a série derruba a sala e o estado dela", async () => {
    const { serie } = ctx.seed;
    const sala = await criarSala(ctx, serie.id);
    await ctx.db.insert(campeonatoSalaEstado).values({ matchId: sala.id });

    await ctx.db.delete(tournamentMatches).where(eq(tournamentMatches.id, serie.id));

    const salas = await ctx.db.select().from(matches).where(eq(matches.id, sala.id));
    const estados = await ctx.db
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(salas.length, 0, "sala sai junto com a série");
    assert.equal(estados.length, 0, "estado sai junto com a sala");
  });
});
