import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { users, userRoles } from "../../db/schema/identidade.js";
import { games, gameAccounts } from "../../db/schema/games.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { tournaments, tournamentTeams } from "../../db/schema/tournaments.js";
import { setupDb } from "./helpers.js";
import {
  identidadeAcessoCampeonato,
  acessoNoCampeonato,
  redigirCodigosDaSerie,
  resolverPermissaoSerie,
} from "../src/lib/tournament-access.js";

const U = (n: number) => `aaaaaaab-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbbb-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "dono-m7w@x.com", displayName: "Dono M7W" }, // dono do M7W
    { id: U(2), email: "membro@x.com", displayName: "Membro" }, // membro aceito do M7W
    { id: U(3), email: "convidado@x.com", displayName: "Convidado" }, // convidado no M7W via PUUID
    { id: U(4), email: "estranho@x.com", displayName: "Estranho" }, // fora (convite pendente)
    { id: U(5), email: "admin@x.com", displayName: "Admin" }, // cargo admin
    { id: U(6), email: "dono-bka@x.com", displayName: "Dono BKA" }, // dono do BKA (lado oposto)
    { id: U(7), email: "organizador@x.com", displayName: "Organizador" }, // organizador do campeonato
  ]);
  await db.insert(userRoles).values({ userId: U(5), role: "admin" });
  await db.insert(gameAccounts).values({
    userId: U(3),
    gameId: "lol",
    externalId: "PUUID_CONV",
    handle: "Conv#123",
    verified: true,
  });
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "M7W", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "BLACKSAILS", tag: "BKA", ownerId: U(6) },
  ]);
  await db.insert(teamMembers).values([
    { teamId: T(1), userId: U(2), roleSlot: "jungle", status: "accepted" },
    {
      teamId: T(1),
      userId: null,
      guestPuuid: "PUUID_CONV",
      guestRiotId: "Conv#123 ",
      roleSlot: "mid",
      status: "accepted",
    },
    { teamId: T(1), userId: U(4), roleSlot: "top", status: "pending" },
    { teamId: T(2), userId: U(6), roleSlot: "coach", status: "accepted" },
  ]);
  const [torneio] = await db
    .insert(tournaments)
    .values({
      gameId: "lol",
      slug: "acesso-teste",
      name: "Acesso Teste",
      format: "groups",
      status: "in_progress",
      organizerId: U(7),
    })
    .returning();
  await db.insert(tournamentTeams).values([
    { tournamentId: torneio.id, teamId: T(1), status: "approved" },
    { tournamentId: torneio.id, teamId: T(2), status: "approved" },
  ]);
  return { torneio };
}

const shapeFixture = () => ({
  criado_por: U(7),
  times_inscritos: [
    { id: T(1), tag: "M7W" },
    { id: T(2), tag: "BKA" },
    { id: "bbbbbbbb-0000-0000-0000-000000000003", tag: "ZZZ" },
  ],
  cronograma: [
    { timeA: "M7W", timeB: "BKA", codigo_partida: "BR-SERIE-1" },
    { timeA: "ZZZ", timeB: "M7W", codigo_partida: "BR-SERIE-2" },
    { timeA: null, timeB: null, codigo_partida: "BR-ORFA" },
  ],
  bracket_data: {
    upper: {
      qf: [
        { t1: "m7w", t2: "BKA", codigo_partida: "BR-BRACKET-1" },
        { t1: "ZZZ", t2: "ZZZ", codigo_partida: "BR-BRACKET-2" },
      ],
    },
    side: { grandFinal: { t1: "BKA", t2: "BKA", codigo_partida: "BR-BRACKET-3" } },
  },
});

describe("redigirCodigosDaSerie (sec.codigo-campeonato)", () => {
  test("staff recebe tudo intacto", () => {
    const s = shapeFixture();
    redigirCodigosDaSerie(s, { staff: true, teamIds: new Set() });
    assert.equal(s.cronograma[0].codigo_partida, "BR-SERIE-1");
    assert.equal(s.bracket_data.upper.qf[1].codigo_partida, "BR-BRACKET-2");
  });

  test("membro do M7W mantém só as séries do M7W (tags case-insensitive)", () => {
    const s = shapeFixture();
    redigirCodigosDaSerie(s, { staff: false, teamIds: new Set([T(1)]) });
    assert.equal(s.cronograma[0].codigo_partida, "BR-SERIE-1", "M7W x BKA: mantém");
    assert.equal(s.cronograma[1].codigo_partida, "BR-SERIE-2", "ZZZ x M7W: mantém (M7W joga)");
    assert.equal(s.cronograma[2].codigo_partida, null, "sem times: redige");
    assert.equal(s.bracket_data.upper.qf[0].codigo_partida, "BR-BRACKET-1", "tag minúscula casa");
    assert.equal(s.bracket_data.upper.qf[1].codigo_partida, null, "ZZZ x ZZZ: redige");
    assert.equal(s.bracket_data.side.grandFinal.codigo_partida, null, "BKA x BKA: redige para o M7W");
  });

  test("estranho não vê nenhum código", () => {
    const s = shapeFixture();
    redigirCodigosDaSerie(s, { staff: false, teamIds: new Set() });
    assert.equal(s.cronograma.every((j: any) => j.codigo_partida === null), true);
    assert.equal(s.bracket_data.upper.qf[0].codigo_partida, null);
    assert.equal(s.bracket_data.side.grandFinal.codigo_partida, null);
  });

  test("tag fora de times_inscritos é redigida (conservador)", () => {
    const s = shapeFixture();
    s.cronograma.push({ timeA: "DESCONHECIDO", timeB: null, codigo_partida: "BR-X" } as any);
    redigirCodigosDaSerie(s, { staff: false, teamIds: new Set([T(1)]) });
    assert.equal(s.cronograma[s.cronograma.length - 1].codigo_partida, null);
  });
});

describe("tournament-access (PGlite)", () => {
  let ctx: any;
  let torneioId = "";

  beforeEach(async () => {
    ctx = await setupDb();
    const { torneio } = await seed(ctx.db);
    torneioId = torneio.id;
  });
  afterEach(async () => {
    await ctx.client.close();
  });

  test("identidade: dono, membro aceito e convidado por PUUID entram; convite pendente não", async () => {
    const dono = await identidadeAcessoCampeonato(ctx.db, U(1));
    assert.equal(dono.teamIds.has(T(1)), true, "dono do time");

    const membro = await identidadeAcessoCampeonato(ctx.db, U(2));
    assert.equal(membro.teamIds.has(T(1)), true, "membro aceito");

    const convidado = await identidadeAcessoCampeonato(ctx.db, U(3));
    assert.equal(convidado.teamIds.has(T(1)), true, "vaga de convidado por PUUID (ADR-056)");

    const pendente = await identidadeAcessoCampeonato(ctx.db, U(4));
    assert.equal(pendente.teamIds.has(T(1)), false, "convite pendente não dá acesso");

    const admin = await identidadeAcessoCampeonato(ctx.db, U(5));
    assert.equal(admin.isStaffRole, true, "cargo global");
  });

  test("acessoNoCampeonato: organizador é staff do próprio campeonato", () => {
    const ident = { isStaffRole: false, teamIds: new Set<string>([T(1)]) };
    assert.equal(acessoNoCampeonato(ident, { userId: U(7), organizerId: U(7) }).staff, true);
    assert.equal(acessoNoCampeonato(ident, { userId: U(4), organizerId: U(7) }).staff, false);
    assert.equal(acessoNoCampeonato(null, { userId: null, organizerId: U(7) }).staff, false);
  });

  test("resolverPermissaoSerie: dono, membro, convidado e staff; estranho nega", async () => {
    const serie = { teamAId: null, teamBId: null, teamATag: "M7W", teamBTag: "BKA" };

    const dono = await resolverPermissaoSerie(ctx.db, { userId: U(1), organizerId: U(7), tournamentId: torneioId, serie });
    assert.deepEqual(dono, { isStaff: false, isParticipant: true });

    const membro = await resolverPermissaoSerie(ctx.db, { userId: U(2), organizerId: U(7), tournamentId: torneioId, serie });
    assert.equal(membro.isParticipant, true);

    const convidado = await resolverPermissaoSerie(ctx.db, { userId: U(3), organizerId: U(7), tournamentId: torneioId, serie });
    assert.equal(convidado.isParticipant, true, "convidado por PUUID pode iniciar a série");

    const estranho = await resolverPermissaoSerie(ctx.db, { userId: U(4), organizerId: U(7), tournamentId: torneioId, serie });
    assert.deepEqual(estranho, { isStaff: false, isParticipant: false });

    const organizador = await resolverPermissaoSerie(ctx.db, { userId: U(7), organizerId: U(7), tournamentId: torneioId, serie });
    assert.equal(organizador.isStaff, true);

    const admin = await resolverPermissaoSerie(ctx.db, { userId: U(5), organizerId: U(7), tournamentId: torneioId, serie });
    assert.equal(admin.isStaff, true);
  });

  test("resolverPermissaoSerie aceita teamAId/teamBId já resolvidos (dono do lado oposto)", async () => {
    const serie = { teamAId: T(1), teamBId: T(2), teamATag: null, teamBTag: null };
    const donoBka = await resolverPermissaoSerie(ctx.db, { userId: U(6), organizerId: U(7), tournamentId: torneioId, serie });
    assert.equal(donoBka.isParticipant, true);
    assert.equal(donoBka.isStaff, false);
  });
});
