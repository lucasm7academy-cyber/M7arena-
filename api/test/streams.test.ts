import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { games } from "../../db/schema/games.js";
import { users, userRoles } from "../../db/schema/identidade.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches } from "../../db/schema/tournaments.js";
import { transmissoes, escalasTransmissao } from "../../db/schema/conteudo.js";
import { setupDb } from "./helpers.js";
import { encerrarTransmissoesDoJogo } from "../src/lib/transmissoes.js";
import {
  listarAgenda, pegarVaga, soltarVaga, entrarNoAr, listarVitrine, minhaTransmissao,
  instanteJogo, dataLabelSP, montarTituloJogo, dentroDaJanela, diaSP,
} from "../src/lib/streams.js";

describe("transmissões — encerramento automático", () => {
  let ctx: any;
  let db: any;
  before(async () => { ctx = await setupDb(); db = ctx.db; });
  after(async () => { await ctx.client.close(); });

  test("encerrarTransmissoesDoJogo desliga só as ativas do jogo", async () => {
    const u = crypto.randomUUID();
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "S" });
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `enc-${uid}`, name: "Camp", format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0, status: "finalizado",
      matchKey: `enc-${uid}`, phaseLabel: "Grupo A",
    }).returning();
    const [tx] = await db.insert(transmissoes).values({
      userId: u, twitchChannel: "canal", matchId: jogo.id, ativo: true, modo: "campeonato",
    }).returning();
    await encerrarTransmissoesDoJogo(db, jogo.id);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, tx.id));
    assert.equal(depois.ativo, false);
  });

  test("storeCronograma finalizado (W.O. do ADM) desliga a live vinculada", async () => {
    const u = crypto.randomUUID();
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "S" });
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `wo-${uid}`, name: "Camp", format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0, status: "em_andamento",
      matchKey: `wo-${uid}`, phaseLabel: "Grupo A", teamATag: "AAA", teamBTag: "BBB",
    }).returning();
    const [tx] = await db.insert(transmissoes).values({
      userId: u, twitchChannel: "canal", matchId: jogo.id, ativo: true, modo: "campeonato",
    }).returning();
    const { storeCronograma } = await import("../src/lib/tournament-store.js");
    await storeCronograma(camp.id, [{
      id: jogo.matchKey, fase: "Grupo A", timeA: "AAA", timeB: "BBB",
      status: "finalizado", data: "2026-12-03", hora: "20:00", placar: "2 - 0",
    }], true, db);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, tx.id));
    assert.equal(depois.ativo, false, "W.O. do ADM desliga a transmissão");
  });
});

describe("transmissões — agenda de jogos", () => {
  let ctx: any;
  let db: any;
  before(async () => { ctx = await setupDb(); db = ctx.db; });
  after(async () => { await ctx.client.close(); });

  async function criaStreamer() {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id, email: id + "@x.com", displayName: "Streamer", socials: { twitch: "canal_teste" },
    });
    await db.insert(userRoles).values({ userId: id, role: "streamer" });
    return id;
  }

  async function criaJogo(opts: {
    status?: string; data?: string | null; hora?: string | null; codigo?: string | null;
  } = {}) {
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `camp-streams-${uid}`, name: "Copa Teste",
      format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0,
      status: opts.status ?? "confirmado",
      displayDate: opts.data ?? null, displayTime: opts.hora ?? null,
      phaseLabel: "Grupo A", matchKey: `streams-${uid}`,
      teamATag: "AAA", teamBTag: "BBB", codigoPartida: opts.codigo ?? null,
    }).returning();
    return { camp, jogo };
  }

  test("helpers: instante em SP, título e label", () => {
    assert.equal(instanteJogo("2026-12-01", "20:00")?.toISOString(), "2026-12-01T23:00:00.000Z");
    assert.equal(instanteJogo("A COMBINAR", "--:--"), null);
    assert.equal(montarTituloJogo("Copa Teste", "AAA", "BBB"), "Copa Teste\nAAA x BBB");
    assert.equal(diaSP(new Date("2026-12-01T23:30:00.000Z")), "2026-12-01");
    assert.equal(dataLabelSP("2026-12-01", new Date("2026-12-01T15:00:00.000Z")), "HOJE");
    assert.equal(dataLabelSP("2026-12-02", new Date("2026-12-01T15:00:00.000Z")), "AMANHÃ");
    assert.equal(
      dentroDaJanela(
        { status: "confirmado", displayDate: "2026-12-01", displayTime: "20:00" },
        new Date("2026-12-01T22:40:00.000Z")
      ),
      true,
      "20 min antes abre a janela"
    );
  });

  test("pegarVaga: cria, bloqueia o segundo e é idempotente para o dono", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ data: "2026-12-02", hora: "20:00" });
    assert.equal((await pegarVaga(db, jogo.id, s1)).ok, true);
    assert.deepEqual(await pegarVaga(db, jogo.id, s2), { ok: false, erro: "vaga_ocupada" });
    assert.equal((await pegarVaga(db, jogo.id, s1)).ok, true);
    const rows = await db.select().from(escalasTransmissao).where(eq(escalasTransmissao.matchId, jogo.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userId, s1);
  });

  test("entrarNoAr: fora da janela recusa; na janela cria live vinculada; idempotente", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ data: "2026-12-03", hora: "20:00", codigo: "BR-TEST-CODIGO" });
    await pegarVaga(db, jogo.id, s);

    const fora = await entrarNoAr(db, jogo.id, s, { agora: new Date("2026-12-01T12:00:00.000Z") });
    assert.deepEqual(fora, { ok: false, erro: "fora_da_janela" });

    const agora = new Date("2026-12-03T23:00:00.000Z"); // 20:00 BRT
    const r = await entrarNoAr(db, jogo.id, s, { agora });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.transmissao.titulo, "Copa Teste\nAAA x BBB");
      assert.equal(r.transmissao.matchId, jogo.id);
      assert.equal(r.transmissao.modo, "campeonato");
      assert.equal(r.transmissao.expiraEm, null);
      assert.equal(r.codigo_partida, "BR-TEST-CODIGO");
    }
    const r2 = await entrarNoAr(db, jogo.id, s, { agora });
    assert.equal(r2.ok, true);
    if (r2.ok && r.ok) assert.equal(r2.transmissao.id, r.transmissao.id, "idempotente");

    const vitrine = await listarVitrine(db, agora);
    assert.equal(vitrine.length, 1);
    assert.equal((await minhaTransmissao(db, s, agora))?.matchId, jogo.id);

    const agenda = await listarAgenda(db, { userId: s, agora });
    assert.equal(agenda.length, 1);
    assert.equal(agenda[0].meu, true);
    assert.equal(agenda[0].ao_vivo, true);
    assert.equal(agenda[0].transmissao_id, r.ok ? r.transmissao.id : null);
    assert.equal(agenda[0].pode_entrar_no_ar, true);
  });

  test("entrarNoAr: não-dono da vaga recusa", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s1);
    assert.deepEqual(await entrarNoAr(db, jogo.id, s2), { ok: false, erro: "nao_e_o_streamer" });
  });

  test("entrarNoAr: sem twitch recusa", async () => {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email: id + "@x.com", displayName: "Sem Twitch" });
    await db.insert(userRoles).values({ userId: id, role: "streamer" });
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, id);
    assert.deepEqual(await entrarNoAr(db, jogo.id, id), { ok: false, erro: "sem_twitch_no_perfil" });
  });

  test("soltarVaga: dono solta; com live no ar recusa; outro recusa", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s1);
    assert.deepEqual(await soltarVaga(db, jogo.id, s2), { ok: false, erro: "nao_e_o_streamer" });

    await entrarNoAr(db, jogo.id, s1);
    assert.deepEqual(await soltarVaga(db, jogo.id, s1), { ok: false, erro: "live_no_ar" });

    await db.update(transmissoes).set({ ativo: false }).where(eq(transmissoes.matchId, jogo.id));
    assert.equal((await soltarVaga(db, jogo.id, s1)).ok, true);
    const rows = await db.select().from(escalasTransmissao).where(eq(escalasTransmissao.matchId, jogo.id));
    assert.equal(rows.length, 0);
  });

  test("entrarNoAr encerra outra live ativa do mesmo streamer (uma live por vez)", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    const [livre] = await db.insert(transmissoes).values({
      userId: s, twitchChannel: "canal_teste", ativo: true, modo: "padrao",
      expiraEm: new Date(Date.now() + 3600_000),
    }).returning();
    await pegarVaga(db, jogo.id, s);
    const r = await entrarNoAr(db, jogo.id, s);
    assert.equal(r.ok, true);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, livre.id));
    assert.equal(depois.ativo, false);
  });

  test("vitrine/minha: live de jogo finalizado não aparece e é desativada na leitura", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s);
    const r = await entrarNoAr(db, jogo.id, s);
    assert.equal(r.ok, true);
    // finaliza direto no banco (caminho que não passa pelo helper de escrita)
    await db.update(tournamentMatches).set({ status: "finalizado" }).where(eq(tournamentMatches.id, jogo.id));
    const vitrine = await listarVitrine(db);
    assert.ok(!vitrine.some((t: any) => t.matchId === jogo.id), "live do jogo finalizado some da vitrine");
    assert.equal(await minhaTransmissao(db, s), null);
    const [tx] = await db.select().from(transmissoes).where(eq(transmissoes.matchId, jogo.id));
    assert.equal(tx.ativo, false, "minhaTransmissao faz lazy cleanup");
  });

  test("agenda exclui 'A COMBINAR' e jogo finalizado; inclui confirmado futuro", async () => {
    const s = await criaStreamer();
    const { jogo: futuro } = await criaJogo({ data: "2026-12-10", hora: "20:00" });
    const { jogo: combinando } = await criaJogo({ status: "combinando" });
    const { jogo: antigo } = await criaJogo({ data: "2026-12-11", hora: "20:00", status: "finalizado" });
    const agenda = await listarAgenda(db, { userId: s, agora: new Date("2026-12-01T12:00:00.000Z") });
    const ids = agenda.map((a: any) => a.match_id);
    assert.ok(ids.includes(futuro.id));
    assert.ok(!ids.includes(combinando.id));
    assert.ok(!ids.includes(antigo.id));
  });
});
