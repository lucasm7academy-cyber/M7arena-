import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { walletTransactions } from "../../db/schema/economia.js";
import { pokerSessions } from "../../db/schema/poker.js";
import { setupDb } from "./helpers.js";
import { ErroPoker, comprarEntrada, fecharMesa } from "../src/modules/poker/service.js";

const folder = fileURLToPath(new URL("../../db/migrations/", import.meta.url));
const MARKER = "-- GRANT_INICIAL_2000_EA";

/**
 * O grant inicial vive no SQL da migration incremental (não há serviço em
 * runtime). O teste lê o bloco marcado no arquivo real e o executa duas vezes,
 * provando que a concessão silenciosa é idempotente.
 */
function sqlDoGrant(): string {
  for (const nome of fs.readdirSync(folder).filter((n) => n.endsWith(".sql"))) {
    const texto = fs.readFileSync(path.join(folder, nome), "utf8");
    const inicio = texto.indexOf(MARKER);
    if (inicio >= 0) return texto.slice(inicio + MARKER.length);
  }
  throw new Error("Bloco do grant inicial não encontrado nas migrations");
}

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const U3 = "33333333-3333-3333-3333-333333333333";
const U4 = "44444444-4444-4444-4444-444444444444";
const U5 = "55555555-5555-5555-5555-555555555555";

async function criarJogador(db: any, id: string, ea: number | null, mc = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador " + id.slice(0, 2) });
  if (ea !== null) await db.insert(userWallets).values({ userId: id, ea, mc });
}

describe("essência (EA) e mesa de poker", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("grant de 2.000 EA credita cadastrados, cria carteira ausente e é idempotente", async () => {
    const db = ctx.db;
    await db.insert(users).values([
      { id: U1, email: "a@x.com", displayName: "Cadastrado" },
      { id: U2, email: "b@x.com", displayName: "Sem carteira" },
    ]);
    await db.insert(userWallets).values({ userId: U1, mc: 5000 });

    const sql = sqlDoGrant();
    await ctx.client.exec(sql);
    await ctx.client.exec(sql);

    const [w1] = await db.select().from(userWallets).where(eq(userWallets.userId, U1));
    const [w2] = await db.select().from(userWallets).where(eq(userWallets.userId, U2));
    assert.equal(w1.ea, 2000);
    assert.equal(w1.mc, 5000, "grant não toca MC");
    assert.equal(w2.ea, 2000);

    const lancamentos = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "poker_grant"));
    assert.equal(lancamentos.length, 2, "uma linha de ledger por jogador, mesmo rodando o SQL duas vezes");
    for (const lancamento of lancamentos) {
      assert.equal(lancamento.currency, "ea");
      assert.equal(lancamento.amount, 2000);
      assert.equal(lancamento.balanceAfter, 2000);
      assert.equal(lancamento.refId, "grant_inicial_2000_ea");
      assert.equal(lancamento.refType, "poker_grant");
    }
  });

  test("buy-in debita EA, grava ledger com balance_after e abre sessão sem tocar MC", async () => {
    const db = ctx.db;
    await criarJogador(db, U3, 5000, 7000);

    const resultado = await comprarEntrada(db, U3, { roomId: "m7", buyIn: 2000 });
    assert.equal(resultado.ea, 3000);

    const [sessao] = await db.select().from(pokerSessions).where(eq(pokerSessions.id, resultado.sessionId));
    assert.equal(sessao.userId, U3);
    assert.equal(sessao.roomId, "m7");
    assert.equal(sessao.buyIn, 2000);
    assert.equal(sessao.status, "open");
    assert.equal(sessao.payout, 0);

    const [lancamento] = await db
      .select()
      .from(walletTransactions)
      .where(and(eq(walletTransactions.userId, U3), eq(walletTransactions.kind, "poker_buyin")));
    assert.equal(lancamento.currency, "ea");
    assert.equal(lancamento.amount, -2000);
    assert.equal(lancamento.balanceAfter, 3000);
    assert.equal(lancamento.refId, resultado.sessionId);

    const [carteira] = await db.select().from(userWallets).where(eq(userWallets.userId, U3));
    assert.equal(carteira.ea, 3000);
    assert.equal(carteira.mc, 7000, "buy-in nunca usa MC");
    assert.equal(carteira.mcReservado, 0);
  });

  test("buy-in recusa saldo insuficiente, mesa fora da allowlist e valor divergente", async () => {
    const db = ctx.db;
    await criarJogador(db, U4, 100);

    await assert.rejects(
      () => comprarEntrada(db, U4, { roomId: "m7", buyIn: 2000 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "saldo_insuficiente"
    );
    await assert.rejects(
      () => comprarEntrada(db, U4, { roomId: "vip", buyIn: 2000 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "mesa_invalida"
    );
    await assert.rejects(
      () => comprarEntrada(db, U4, { roomId: "m7", buyIn: 500 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "valor_invalido"
    );

    const [carteira] = await db.select().from(userWallets).where(eq(userWallets.userId, U4));
    assert.equal(carteira.ea, 100);
    const sessoes = await db.select().from(pokerSessions).where(eq(pokerSessions.userId, U4));
    assert.equal(sessoes.length, 0);
  });

  test("cashout credita o stack uma vez, fecha a sessão e recusa a repetição", async () => {
    const db = ctx.db;
    await criarJogador(db, U5, 3000);

    const { sessionId } = await comprarEntrada(db, U5, { roomId: "m7", buyIn: 2000 });
    const caixa = await fecharMesa(db, U5, { sessionId, stack: 1750 });
    assert.equal(caixa.payout, 1750);
    assert.equal(caixa.ea, 1000 + 1750);

    const [sessao] = await db.select().from(pokerSessions).where(eq(pokerSessions.id, sessionId));
    assert.equal(sessao.status, "closed");
    assert.equal(sessao.payout, 1750);
    assert.ok(sessao.closedAt instanceof Date);

    const [lancamento] = await db
      .select()
      .from(walletTransactions)
      .where(and(eq(walletTransactions.userId, U5), eq(walletTransactions.kind, "poker_cashout")));
    assert.equal(lancamento.currency, "ea");
    assert.equal(lancamento.amount, 1750);
    assert.equal(lancamento.balanceAfter, 2750);

    await assert.rejects(
      () => fecharMesa(db, U5, { sessionId, stack: 1750 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "sessao_encerrada"
    );

    const [carteiraFinal] = await db.select().from(userWallets).where(eq(userWallets.userId, U5));
    assert.equal(carteiraFinal.ea, 2750, "segunda chamada não credita de novo");
    const cashouts = await db
      .select()
      .from(walletTransactions)
      .where(and(eq(walletTransactions.userId, U5), eq(walletTransactions.kind, "poker_cashout")));
    assert.equal(cashouts.length, 1);
  });

  test("cashout recusa sessão inexistente/de outro jogador e stack fora da faixa", async () => {
    const db = ctx.db;
    await criarJogador(db, "66666666-6666-6666-6666-666666666666", 2000);
    const { sessionId } = await comprarEntrada(db, U5, { roomId: "m7", buyIn: 2000 });

    await assert.rejects(
      () => fecharMesa(db, "66666666-6666-6666-6666-666666666666", { sessionId, stack: 500 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "sessao_nao_encontrada" && erro.status === 404
    );
    await assert.rejects(
      () => fecharMesa(db, U5, { sessionId, stack: -1 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "dados_invalidos"
    );
    await assert.rejects(
      () => fecharMesa(db, U5, { sessionId: "nao-e-uuid", stack: 500 }),
      (erro: any) => erro instanceof ErroPoker && erro.code === "sessao_nao_encontrada"
    );

    const [sessao] = await db.select().from(pokerSessions).where(eq(pokerSessions.id, sessionId));
    assert.equal(sessao.status, "open", "nenhuma recusa fecha a sessão");
  });
});
