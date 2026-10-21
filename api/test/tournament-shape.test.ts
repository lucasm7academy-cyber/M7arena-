import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams } from "../../db/schema/teams.js";
import { tournaments, tournamentTeams, tournamentMatches, bracketMatches } from "../../db/schema/tournaments.js";
import { setupDb } from "./helpers.js";
import {
  toLegacyTournament,
  toLegacyTournamentCard,
  toLegacyTournamentShell,
  toLegacyTournamentSection,
  buildTimesInscritosResumo,
} from "../src/lib/tournament-shape.js";
import { redigirCodigosDaSerie } from "../src/lib/tournament-access.js";

const U = (n: number) => `cccccccc-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `dddddddd-0000-0000-0000-00000000000${n}`;

/**
 * Contrato da otimização de /campeonatos: o detalhe abre pelo shell e cada aba
 * carrega só a sua seção. Se alguém voltar a montar o documento completo dentro
 * do shell (ou juntar seções), estes testes quebram — o ganho de payload vira
 * regressão silenciosa sem eles.
 */
describe("campeonato: shell e seções sob demanda", () => {
  let client: any;
  let db: any;
  let torneioId: string;

  before(async () => {
    const setup = await setupDb();
    client = setup.client;
    db = setup.db;

    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: U(1), email: "organizador-shape@x.com", displayName: "Organizador" });
    await db.insert(teams).values([
      { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "M7W", ownerId: U(1) },
      { id: T(2), gameId: "lol", name: "BLACKSAILS", tag: "BKA", ownerId: U(1) },
    ]);

    const [torneio] = await db
      .insert(tournaments)
      .values({
        gameId: "lol",
        slug: "shape-teste",
        name: "Shape Teste",
        format: "groups",
        status: "in_progress",
        organizerId: U(1),
        vagas: 8,
        themeColor: "#FFB700",
      })
      .returning();
    torneioId = torneio.id;

    await db.insert(tournamentTeams).values([
      { tournamentId: torneioId, teamId: T(1), status: "approved" },
      { tournamentId: torneioId, teamId: T(2), status: "approved" },
    ]);
    await db.insert(tournamentMatches).values({
      tournamentId: torneioId,
      phase: "group_stage",
      round: 0,
      teamAId: T(1),
      teamBId: T(2),
      teamATag: "M7W",
      teamBTag: "BKA",
      displayDate: "20/10/2026",
      displayTime: "20:00",
      scoreDisplay: "0 - 0",
      status: "confirmado",
      codigoPartida: "BR-SERIE-CRONOGRAMA",
    });
    await db.insert(bracketMatches).values({
      tournamentId: torneioId,
      section: "upper",
      round: "qf",
      slot: 0,
      teamAId: T(1),
      teamBId: T(2),
      teamATag: "M7W",
      teamBTag: "BKA",
      codigoPartida: "BR-SERIE-CHAVE",
    });
  });

  after(async () => {
    await client?.close?.();
  });

  test("shell traz escalares e times inscritos, sem nenhuma seção pesada", async () => {
    const shell: any = await toLegacyTournamentShell(torneioId, db);
    assert.ok(shell);
    assert.equal(shell.titulo, "Shape Teste");
    assert.equal(shell.times_inscritos.length, 2);
    assert.deepEqual(
      shell.times_inscritos.map((t: any) => t.tag).sort(),
      ["BKA", "M7W"]
    );
    assert.equal(shell.registeredTeamsCount, 2);
    for (const pesada of ["cronograma", "bracket_data", "classificacao", "grupos"]) {
      assert.equal(shell[pesada], undefined, `shell não deve conter ${pesada}`);
    }
  });

  test("shell não expõe org_photo_url (base64 pesado), mas mantém o banner do hero", async () => {
    const shell: any = await toLegacyTournamentShell(torneioId, db);
    assert.equal(shell.org_photo_url, undefined);
    // banner e regulamento são pequenos e o detalhe renderiza os dois.
    assert.equal(shell.banner_url, null);
    assert.equal(shell.regulamento, null);
  });

  test("cada seção devolve só a sua chave", async () => {
    const cronograma: any = await toLegacyTournamentSection(torneioId, "cronograma", db);
    assert.deepEqual(Object.keys(cronograma), ["cronograma"]);
    assert.equal(cronograma.cronograma.length, 1);

    const classificacao: any = await toLegacyTournamentSection(torneioId, "classificacao", db);
    assert.deepEqual(Object.keys(classificacao), ["classificacao"]);

    const grupos: any = await toLegacyTournamentSection(torneioId, "grupos", db);
    assert.deepEqual(Object.keys(grupos), ["grupos"]);

    const chaves: any = await toLegacyTournamentSection(torneioId, "chaves", db);
    assert.deepEqual(Object.keys(chaves), ["bracket_data"]);
    assert.ok(chaves.bracket_data);
  });

  test("seção de chaves e cronograma carregam o código da série para redação", async () => {
    const cronograma: any = await toLegacyTournamentSection(torneioId, "cronograma", db);
    assert.equal(cronograma.cronograma[0].codigo_partida, "BR-SERIE-CRONOGRAMA");

    const chaves: any = await toLegacyTournamentSection(torneioId, "chaves", db);
    const serializado = JSON.stringify(chaves.bracket_data);
    assert.ok(serializado.includes("BR-SERIE-CHAVE"));
  });

  test("redação usa as tags da seção: estranho não vê código, dono do time vê", async () => {
    const secao: any = await toLegacyTournamentSection(torneioId, "cronograma", db);
    const comTags = { ...secao, times_inscritos: [{ id: T(1), tag: "M7W" }, { id: T(2), tag: "BKA" }] };

    const estranho = redigirCodigosDaSerie(structuredClone(comTags), { staff: false, teamIds: new Set() });
    assert.equal(estranho.cronograma[0].codigo_partida, null);

    const participante = redigirCodigosDaSerie(structuredClone(comTags), { staff: false, teamIds: new Set([T(1)]) });
    assert.equal(participante.cronograma[0].codigo_partida, "BR-SERIE-CRONOGRAMA");
  });

  test("card da listagem não carrega nenhuma seção pesada", async () => {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, torneioId)).limit(1);
    const card: any = toLegacyTournamentCard(t, 2);
    assert.equal(card.titulo, "Shape Teste");
    assert.equal(card.registeredTeamsCount, 2);
    for (const pesado of [
      "cronograma",
      "bracket_data",
      "classificacao",
      "grupos",
      "times_inscritos",
      "regulamento",
      "banner_url",
      "org_photo_url",
    ]) {
      assert.equal(card[pesado], undefined, `card não deve conter ${pesado}`);
    }
  });

  test("resumo de times da agenda só expõe identidade visual", async () => {
    const teamRows = await db
      .select()
      .from(teams)
      .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, torneioId));
    const resumo: any[] = buildTimesInscritosResumo({ teamRows });
    assert.equal(resumo.length, 2);
    for (const time of resumo) {
      assert.ok(time.id && time.name && time.tag);
      for (const privado of ["paid", "discord", "whatsapp"]) {
        assert.equal(time[privado], undefined, `agenda não deve conter ${privado}`);
      }
    }
  });

  test("endpoint completo continua devolvendo o documento inteiro", async () => {
    const completo: any = await toLegacyTournament(torneioId, db);
    assert.ok(completo);
    assert.ok(Array.isArray(completo.times_inscritos));
    assert.ok(Array.isArray(completo.cronograma));
    assert.ok(completo.bracket_data);
    assert.ok(Array.isArray(completo.classificacao));
    assert.equal(typeof completo.grupos, "object");
    assert.ok(completo.grupos);
    assert.equal(completo.cronograma[0].codigo_partida, "BR-SERIE-CRONOGRAMA");
  });
});
