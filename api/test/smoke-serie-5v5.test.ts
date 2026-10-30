/**
 * smoke-serie-5v5.test.ts — SMOKE TEST de ponta a ponta da sala 5v5 com
 * série (MD3) e draft por jogo.
 *
 * Reproduz o fluxo real que as rotas executam (join → confirmar → draft →
 * resultado via motor Riot → troca de jogador entre jogos → draft do jogo 2 →
 * fim da série com pote pago UMA vez), chamando as MESMAS funções de lib que
 * `matches.ts` / `matches-actions.ts` chamam, na mesma ordem — o que o front
 * dispara em produção.
 *
 * Cenários cobertos (o que o usuário pediu em 30/10):
 *   1. após o resultado do jogo 1, a sala volta para `confirmacao` (janela de
 *      5 min) com TODOS desconfirmados — dá para sair da vaga e outro entrar;
 *   2. o draft do jogo 2 abre limpo (bans/picks zerados) e a regra do MID
 *      (único que bane/escolhe) continua valendo;
 *   3. o código Riot é UM por série (não reatribuído entre jogos);
 *   4. o pote apostado é pago UMA única vez, só no fim da série.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, desc } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import {
  matches,
  matchPlayers,
  matchDrafts,
  matchCodes,
  matchResults,
  campeonatoSalaEstado,
} from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { platformRevenue, walletTransactions } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";
import { aplicarAcaoDraft } from "../src/lib/draft/index.js";
import { getTurnOrder } from "../src/lib/draft/regras.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";
import { CONFIRMACAO_SERIE_MS } from "../src/lib/serie-sala.js";
import { reservarEntrada, devolverEntrada } from "../src/lib/escrow.js";

const APOSTA = 100;
const TAXA = 8.99;

type Jogador = { id: string; nome: string; side: "blue" | "red"; role: string; puuid: string };

/** Cria um jogador com carteira e conta Riot vinculada (o motor exige PUUIDs). */
async function criaJogador(db: any, j: Jogador) {
  await db.insert(users).values({
    id: j.id,
    email: j.id + "@x.com",
    displayName: j.nome,
    riotId: j.nome.replace(/[^A-Za-z0-9]/g, "") + "#BR1",
  });
  await db.insert(userWallets).values({ userId: j.id, mc: 1000, mcReservado: 0 });
  await db.insert(gameAccounts).values({
    userId: j.id,
    gameId: "lol",
    externalId: j.puuid,
    handle: j.nome + "#BR1",
    verified: true,
  });
}

/** Espelha POST /api/matches/:id/join (guards + insert + avaliarTransicoes). */
async function entrarVaga(db: any, salaId: string, j: Jogador) {
  await db.transaction(async (tx: any) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, salaId)).limit(1).for("update");
    const trans = await avaliarTransicoes(tx, salaId);
    if (match.status !== "preenchendo") return { ok: false, erro: "estado_invalido", estado: trans.estado };
    const ocupada = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.side, j.side), eq(matchPlayers.roleSlot, j.role)));
    if (ocupada.some((p: any) => p.userId !== j.id)) return { ok: false, erro: "vaga_ocupada" };
    const [existing] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, j.id)));
    if (existing) {
      await tx
        .update(matchPlayers)
        .set({ side: j.side, roleSlot: j.role, confirmed: false })
        .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, j.id)));
    } else {
      await reservarEntrada(tx, j.id, APOSTA, salaId);
      await tx.insert(matchPlayers).values({
        matchId: salaId,
        userId: j.id,
        side: j.side,
        slot: j.side === "blue" ? 0 : 5,
        roleSlot: j.role,
        confirmed: false,
      });
    }
    await avaliarTransicoes(tx, salaId);
    return { ok: true };
  });
}

/** Espelha POST /api/matches/:id/confirm. */
async function confirmar(db: any, salaId: string, userId: string) {
  await db.transaction(async (tx: any) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, salaId)).limit(1).for("update");
    if (match.status !== "confirmacao") return { ok: false, erro: "estado_invalido" };
    await tx
      .update(matchPlayers)
      .set({ confirmed: true })
      .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, userId)));
    await avaliarTransicoes(tx, salaId);
    return { ok: true };
  });
}

/** Espelha POST /api/matches/:id/recusar (a forma de sair durante a confirmação). */
async function recusar(db: any, salaId: string, userId: string) {
  await db.transaction(async (tx: any) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, salaId)).limit(1).for("update");
    if (match.status !== "confirmacao") return { ok: false, erro: "estado_invalido" };
    const [jogador] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, userId)));
    if (!jogador || jogador.linked) return { ok: false, erro: "nao_pode_sair" };
    await devolverEntrada(tx, userId, APOSTA, salaId);
    await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, userId)));
    await tx.update(matchPlayers).set({ confirmed: false }).where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.confirmed, true)));
    await tx
      .update(matches)
      .set({ status: "preenchendo", confirmacaoExpiresAt: null, iniciandoPartidaAt: null, stateDeadlineAt: null })
      .where(eq(matches.id, salaId));
    await avaliarTransicoes(tx, salaId);
    return { ok: true };
  });
}

/** Espelha POST /api/matches/:id/leave (SÓ em preenchendo — fora disso é estado_invalido). */
async function sairLeave(db: any, salaId: string, userId: string) {
  return db.transaction(async (tx: any) => {
    const [match] = await tx.select().from(matches).where(eq(matches.id, salaId)).limit(1).for("update");
    const trans = await avaliarTransicoes(tx, salaId);
    if (match.status !== "preenchendo") return { ok: false, erro: "estado_invalido", estado: trans.estado };
    const [jogador] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, userId)));
    if (!jogador || jogador.confirmed || jogador.linked) return { ok: false, erro: "nao_pode_sair" };
    await devolverEntrada(tx, userId, APOSTA, salaId);
    await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, salaId), eq(matchPlayers.userId, userId)));
    await avaliarTransicoes(tx, salaId);
    return { ok: true };
  });
}

/**
 * Joga o draft INTEIRO do jogo corrente (20 turnos), com o MID de cada lado
 * agindo. Como as rotas fazem, roda `avaliarTransicoes` depois da última ação —
 * é ela que fecha o draft e leva a sala para `iniciando_partida`.
 */
async function jogarDraftCompleto(db: any, match: any, midBlueId: string, midRedId: string) {
  const ordem = getTurnOrder(match.mode);
  for (let i = 0; i < ordem.length; i++) {
    const turno = ordem[i];
    const ator = turno.team === "blue" ? midBlueId : midRedId;
    const champ = `${turno.phase === "ban" ? "BAN" : "PICK"}_${i}_${turno.team}`;
    const r = await aplicarAcaoDraft(db, match, ator, turno.phase, champ);
    assert.equal(r.ok, true, `turno ${i} (${turno.team} ${turno.phase}): ${r.erro}`);
  }
  await avaliarTransicoes(db, match.id);
}

/** Stub da Riot: partida completa com os 10 PUUIDs, code da série e vencedor por teamId. */
function partidaRiot(code: string, jogadores: Jogador[], teamVencedor: 100 | 200, jogoN: number) {
  return {
    metadata: { matchId: `BR1_SMOKE_JOGO_${jogoN}` },
    info: {
      tournamentCode: code,
      gameCreation: Date.now() - 30_000,
      endOfGameResult: "GameComplete",
      participants: jogadores.map((j) => ({
        puuid: j.puuid,
        teamId: j.side === "blue" ? 100 : 200,
        win: (j.side === "blue" ? 100 : 200) === teamVencedor,
      })),
      teams: [
        { teamId: 100, win: teamVencedor === 100 },
        { teamId: 200, win: teamVencedor === 200 },
      ],
    },
  };
}

function montarTime(side: "blue" | "red", sufixo: string): Jogador[] {
  const roles = ["TOP", "JG", "MID", "ADC", "SUP"];
  return roles.map((role) => ({
    id: crypto.randomUUID(),
    nome: `${side === "blue" ? "B" : "R"}_${role}_${sufixo}`,
    side,
    role,
    puuid: `PUUID_${side.toUpperCase()}_${role}_${sufixo}`,
  }));
}

describe("SMOKE sala 5v5 MD3: criação → draft jogo 1 → troca de jogador → draft jogo 2 → fim da série", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
    await ctx.db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("fluxo completo com 10 jogadores, troca entre jogos e pote pago uma vez", async () => {
    const db = ctx.db;
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });

    // ── Criação (espelha POST /api/matches): md3, 10 vagas, preenchendo ──
    const [sala] = await db
      .insert(matches)
      .values({
        gameId: "lol",
        mode: "5v5",
        createdBy: dono,
        status: "preenchendo",
        apostaMc: APOSTA,
        entryMp: APOSTA,
        taxaPct: String(TAXA),
        maxJogadores: 10,
      })
      .returning();
    await db.insert(campeonatoSalaEstado).values({ matchId: sala.id, formato: "md3" });

    const azuis = montarTime("blue", "A");
    const vermelhos = montarTime("red", "A");
    const todos = [...azuis, ...vermelhos];
    for (const j of todos) await criaJogador(db, j);

    // ── 10 entradas: a 10ª dispara preenchendo → confirmacao ──
    for (const j of todos) await entrarVaga(db, sala.id, j);
    const [aposEntrar] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(aposEntrar.status, "confirmacao", "10ª vaga preenchida → confirmação");

    // 9 confirmam → continua em confirmacao; o 10º leva ao draft do JOGO 1.
    for (const j of todos.slice(0, 9)) await confirmar(db, sala.id, j.id);
    const [meioConfirm] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(meioConfirm.status, "confirmacao", "9/10 confirmados: ainda aguardando");
    await confirmar(db, sala.id, todos[9].id);

    const [noDraft1] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(noDraft1.status, "draft", "todos confirmaram → draft do jogo 1");
    const [draft1] = await db
      .select()
      .from(matchDrafts)
      .where(eq(matchDrafts.matchId, sala.id))
      .orderBy(desc(matchDrafts.jogo))
      .limit(1);
    assert.equal(draft1.jogo, 1);
    assert.equal(draft1.status, "ongoing");

    const midBlue = azuis.find((j) => j.role === "MID")!;
    const midRed = vermelhos.find((j) => j.role === "MID")!;
    const jgBlue = azuis.find((j) => j.role === "JG")!;

    // Regra do capitão: JG é recusado, MID age.
    const tentativaJg = await aplicarAcaoDraft(db, noDraft1, jgBlue.id, "ban", "Aatrox");
    assert.equal(tentativaJg.ok, false);
    assert.equal(tentativaJg.erro, "apenas_mid");

    await jogarDraftCompleto(db, noDraft1, midBlue.id, midRed.id);

    const [posDraft1] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(posDraft1.status, "iniciando_partida", "draft fechou → iniciando_partida");
    const codigoSerie = posDraft1.codigoPartida;
    assert.ok(codigoSerie && !codigoSerie.startsWith("SEM-CODIGO"), "código real do pool atribuído quando o draft fecha");

    // 90s de espera → partida_iniciada (prazo no passado).
    await db
      .update(matches)
      .set({ iniciandoPartidaAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(matches.id, sala.id));
    await avaliarTransicoes(db, sala.id);
    const [emJogo1] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(emJogo1.status, "partida_iniciada");

    // ── RESULTADO do jogo 1 (azul vence) → série continua, todos desconfirmados ──
    const r1 = await verificarPartida(db, sala.id, {
      agora: new Date(),
      buscarIds: async () => [`BR1_SMOKE_JOGO_1`],
      buscarMatch: async () => partidaRiot(emJogo1.codigoPartida, todos, 100, 1) as any,
    });
    assert.equal(r1.ok, true);
    assert.equal("motivo" in r1 && r1.motivo, "serie_avancou", "série continua após o jogo 1");
    assert.equal("estado" in r1 && r1.estado, "confirmacao");

    const [st1] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.deepEqual([st1.jogo, st1.placarA, st1.placarB], [2, 1, 0], "placar 1-0 e jogo 2");

    const [salaJ2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(salaJ2.status, "confirmacao", "voltou para confirmação do jogo 2");
    const janela = new Date(salaJ2.confirmacaoExpiresAt).getTime() - Date.now();
    assert.ok(janela > CONFIRMACAO_SERIE_MS - 10_000, `janela de 5 min (veio ${janela}ms)`);
    assert.equal(salaJ2.codigoPartida, codigoSerie, "código da série preservado");

    const jogadoresJ2 = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.equal(jogadoresJ2.length, 10);
    assert.ok(
      jogadoresJ2.every((p: any) => p.confirmed === false && p.linked === false),
      "todos desconfirmados e desvinculados entre jogos"
    );

    // Nenhum resultado/pagamento ainda — o pote espera o fim da série.
    assert.equal((await db.select().from(matchResults).where(eq(matchResults.matchId, sala.id))).length, 0);
    assert.equal((await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, sala.id))).length, 0);

    // Guards do estado: `leave` (só preenchendo) e confirmar antes de reabrir.
    const leaveNaConfirmacao = await sairLeave(db, sala.id, jgBlue.id);
    assert.equal(leaveNaConfirmacao.ok, false);
    assert.equal(leaveNaConfirmacao.erro, "estado_invalido");

    // ── A PERGUNTA DO USUÁRIO: sair da vaga e outro entrar entre jogos ──
    const adcBlueAntigo = azuis.find((j) => j.role === "ADC")!;
    const [carteiraAntes] = await db.select().from(userWallets).where(eq(userWallets.userId, adcBlueAntigo.id));
    assert.equal(carteiraAntes.mc, 900, "100 MC reservados na entrada");
    await recusar(db, sala.id, adcBlueAntigo.id);

    const [aposRecusa] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(aposRecusa.status, "preenchendo", "recusar reabre a sala");
    const [carteiraSaiu] = await db.select().from(userWallets).where(eq(userWallets.userId, adcBlueAntigo.id));
    assert.equal(carteiraSaiu.mc, 1000, "escrow devolvido a quem saiu");

    // Novo jogador ocupa a vaga ADC do azul.
    const adcNovo: Jogador = {
      id: crypto.randomUUID(),
      nome: "B_ADC_NOVO",
      side: "blue",
      role: "ADC",
      puuid: "PUUID_BLUE_ADC_NOVO",
    };
    await criaJogador(db, adcNovo);
    const azuisComNovo = [...azuis.filter((j) => j.id !== adcBlueAntigo.id), adcNovo];
    const todosComNovo = [...azuisComNovo, ...vermelhos];
    await entrarVaga(db, sala.id, adcNovo);

    const [salaJ2Reaberta] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(salaJ2Reaberta.status, "confirmacao", "vaga reocupada → confirmação de novo");
    const janela2 = new Date(salaJ2Reaberta.confirmacaoExpiresAt).getTime() - Date.now();
    assert.ok(janela2 > CONFIRMACAO_SERIE_MS - 10_000, "janela de 5 min no jogo 2");

    // Todos confirmam → draft do JOGO 2 (limpo, MID segue no comando).
    for (const j of todosComNovo) await confirmar(db, sala.id, j.id);
    const [noDraft2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(noDraft2.status, "draft", "draft do jogo 2");

    const draftsApos2 = await db
      .select()
      .from(matchDrafts)
      .where(eq(matchDrafts.matchId, sala.id))
      .orderBy(matchDrafts.jogo);
    assert.equal(draftsApos2.length, 2, "draft do jogo 1 preservado + draft do jogo 2");
    const draft2 = draftsApos2[1];
    assert.equal(draft2.jogo, 2);
    assert.equal(draft2.status, "ongoing");
    assert.deepEqual(draft2.blueBans, [], "bans do jogo 2 zerados");
    assert.deepEqual(draft2.bluePicks, [], "picks do jogo 2 zerados");
    assert.equal(draft2.currentTurn, 0, "turno reiniciado");

    // MID-only vale no jogo 2 também (JG vermelho negado no turno do vermelho).
    await aplicarAcaoDraft(db, noDraft2, midBlue.id, "ban", "BAN_0_blue"); // turno 0: azul
    const jgRed = vermelhos.find((j) => j.role === "JG")!;
    const tentaJgRed = await aplicarAcaoDraft(db, noDraft2, jgRed.id, "ban", "BAN_1_red");
    assert.equal(tentaJgRed.ok, false);
    assert.equal(tentaJgRed.erro, "apenas_mid");
    const midRedBan = await aplicarAcaoDraft(db, noDraft2, midRed.id, "ban", "BAN_1_red");
    assert.equal(midRedBan.ok, true);

    // Restante do draft do jogo 2 (turnos 2..19).
    const ordem = getTurnOrder("5v5");
    for (let i = 2; i < ordem.length; i++) {
      const turno = ordem[i];
      const ator = turno.team === "blue" ? midBlue.id : midRed.id;
      const champ = `${turno.phase === "ban" ? "BAN" : "PICK"}_${i}_${turno.team}`;
      const r = await aplicarAcaoDraft(db, noDraft2, ator, turno.phase, champ);
      assert.equal(r.ok, true, `jogo 2 turno ${i}: ${r.erro}`);
    }
    await avaliarTransicoes(db, sala.id); // fecha o draft → iniciando_partida

    const [posDraft2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(posDraft2.status, "iniciando_partida");
    assert.equal(posDraft2.codigoPartida, codigoSerie, "MESMO código — um por série");
    const [codeRow] = await db.select().from(matchCodes).where(eq(matchCodes.code, codigoSerie));
    assert.equal(codeRow.used, true, "código continua reservado para a série");

    // ── RESULTADO do jogo 2 (vermelho vence) → 1-1, jogo 3 ──
    await db
      .update(matches)
      .set({ iniciandoPartidaAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(matches.id, sala.id));
    await avaliarTransicoes(db, sala.id);
    const [emJogo2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(emJogo2.status, "partida_iniciada");

    const r2 = await verificarPartida(db, sala.id, {
      agora: new Date(),
      buscarIds: async () => [`BR1_SMOKE_JOGO_2`],
      buscarMatch: async () => partidaRiot(emJogo2.codigoPartida, todosComNovo, 200, 2) as any,
    });
    assert.equal(r2.ok, true);
    assert.equal("motivo" in r2 && r2.motivo, "serie_avancou");
    const [st2] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.deepEqual([st2.jogo, st2.placarA, st2.placarB], [3, 1, 1], "1-1 e jogo 3");
    assert.equal(
      (await db.select().from(matchResults).where(eq(matchResults.matchId, sala.id))).length,
      0,
      "ainda sem resultado — série não fechou"
    );

    // ── Jogo 3: todos confirmam, draft, azul vence 2-1 → SÉRIE FECHA ──
    for (const j of todosComNovo) await confirmar(db, sala.id, j.id);
    const [noDraft3] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(noDraft3.status, "draft", "draft do jogo 3");
    await jogarDraftCompleto(db, noDraft3, midBlue.id, midRed.id);
    await db
      .update(matches)
      .set({ iniciandoPartidaAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(matches.id, sala.id));
    await avaliarTransicoes(db, sala.id);
    const [emJogo3] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(emJogo3.status, "partida_iniciada");

    const r3 = await verificarPartida(db, sala.id, {
      agora: new Date(),
      buscarIds: async () => [`BR1_SMOKE_JOGO_3`],
      buscarMatch: async () => partidaRiot(emJogo3.codigoPartida, todosComNovo, 100, 3) as any,
    });
    assert.equal(r3.ok, true);
    assert.equal("estado" in r3 && r3.estado, "encerrada", "2-1: série encerrada");

    const [salaFinal] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(salaFinal.status, "encerrada");
    assert.equal(salaFinal.winnerSide, "blue");

    const [stFinal] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.deepEqual([stFinal.placarA, stFinal.placarB], [2, 1], "placar final 2-1");

    const resultados = await db.select().from(matchResults).where(eq(matchResults.matchId, sala.id));
    assert.equal(resultados.length, 1, "resultado gravado UMA vez");

    // ── Pote pago UMA vez: 5 azuis recebem o prêmio, 5 vermelhos perdem a reserva ──
    // pote 1000, taxa ceil(89,9)=90, líquido 910, porVencedor floor(910/5)=182.
    for (const j of azuisComNovo) {
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, j.id));
      assert.equal(w.mc, 1082, `${j.nome}: 1000-100 reservados + 182 do prêmio`);
      assert.equal(w.mcReservado, 0);
    }
    for (const j of vermelhos) {
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, j.id));
      assert.equal(w.mc, 900, `${j.nome}: perdeu só a reserva`);
      assert.equal(w.mcReservado, 0);
    }
    const [carteiraQuemSaiu] = await db.select().from(userWallets).where(eq(userWallets.userId, adcBlueAntigo.id));
    assert.equal(carteiraQuemSaiu.mc, 1000, "quem saiu entre jogos não paga nem recebe");

    const receita = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, sala.id));
    assert.equal(receita.length, 1, "taxa cobrada uma vez");
    assert.equal(receita[0].mcFee, 90);

    const premios = await db
      .select()
      .from(walletTransactions)
      .where(and(eq(walletTransactions.refId, sala.id), eq(walletTransactions.kind, "match_prize")));
    assert.equal(premios.length, 5, "5 prêmios de vencedor — pagamento único");

    const [codeFinal] = await db.select().from(matchCodes).where(eq(matchCodes.code, codigoSerie));
    assert.equal(codeFinal.used, false, "código devolvido ao pool no fim da série");
    assert.equal(codeFinal.matchId, null);

    // Drafts históricos preservados: 3 linhas (uma por jogo).
    const draftsFinais = await db
      .select()
      .from(matchDrafts)
      .where(eq(matchDrafts.matchId, sala.id))
      .orderBy(matchDrafts.jogo);
    assert.deepEqual(
      draftsFinais.map((d: any) => d.jogo),
      [1, 2, 3],
      "um draft por jogo, preservados"
    );
    assert.ok(draftsFinais.every((d: any) => d.status === "finished"), "todos os drafts fechados");
  });
});

describe("SMOKE sala 5v5 MD1: primeiro resultado encerra na hora", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
    await ctx.db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("MD1: jogo 1 com vitória vermelha → encerrada direto, sem jogo 2", async () => {
    const db = ctx.db;
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [sala] = await db
      .insert(matches)
      .values({ gameId: "lol", mode: "5v5", createdBy: dono, status: "preenchendo", apostaMc: 0, taxaPct: "8.99", maxJogadores: 10 })
      .returning();
    await db.insert(campeonatoSalaEstado).values({ matchId: sala.id, formato: "md1" });

    const azuis = montarTime("blue", "M1");
    const vermelhos = montarTime("red", "M1");
    const todos = [...azuis, ...vermelhos];
    for (const j of todos) await criaJogador(db, j);
    for (const j of todos) await entrarVaga(db, sala.id, j);
    for (const j of todos) await confirmar(db, sala.id, j.id);
    const [noDraft] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(noDraft.status, "draft");
    await jogarDraftCompleto(db, noDraft, azuis.find((j) => j.role === "MID")!.id, vermelhos.find((j) => j.role === "MID")!.id);
    const [posDraft] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(posDraft.status, "iniciando_partida", "draft fechou → iniciando_partida");
    await db
      .update(matches)
      .set({ iniciandoPartidaAt: new Date(Date.now() - 2 * 60_000), codigoPartida: "BR-SMOKE-MD1" })
      .where(eq(matches.id, sala.id));
    await avaliarTransicoes(db, sala.id);

    const [emJogo] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(emJogo.status, "partida_iniciada");
    const r = await verificarPartida(db, sala.id, {
      agora: new Date(),
      buscarIds: async () => ["BR1_SMOKE_MD1"],
      buscarMatch: async () => partidaRiot("BR-SMOKE-MD1", todos, 200, 1) as any,
    });
    assert.equal(r.ok, true);
    assert.equal("estado" in r && r.estado, "encerrada", "MD1 fecha no primeiro jogo");
    const [st] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.deepEqual([st.jogo, st.placarA, st.placarB], [1, 0, 1]);
  });
});
