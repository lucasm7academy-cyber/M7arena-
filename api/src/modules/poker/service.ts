import { and, eq, or, desc, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users, userWallets } from "../../../../db/schema/identidade.js";
import { walletTransactions } from "../../../../db/schema/economia.js";
import { pokerRooms, pokerSessions } from "../../../../db/schema/poker.js";

/**
 * Mesa da Sala M7 (poker Texas Hold'em) — só o que precisa de autoridade do
 * servidor: buy-in debitado da essência (EA) e caixa devolvido ao encerrar.
 * A mesa em si roda no cliente (`web/src/features/salas/poker/domain`), então
 * o `stack` informado no cashout vem do cliente — ver README deste módulo.
 *
 * EA nunca se mistura com MC: nenhuma função daqui toca `mc`/`mc_reservado`,
 * não há saque e não há Pix. As funções recebem `tx` (transação da rota em
 * produção, o próprio `db` nos testes), como em `api/src/lib/withdrawals.ts`.
 */

/** Allowlist do servidor: o preço do buy-in é exato, o cliente não escolhe. */
export const BUY_IN_POR_SALA: Record<string, number> = {
  m7: 2000,
};

const MESAS_DA_CASA = [
  { id: "m7", name: "Sala M7", sb: 10, bb: 20, seats: 6 },
];
const BLINDS = [[5, 10], [10, 20], [25, 50], [50, 100]];

// Projeção explícita: nunca expor passwordHash (nem por spread do registro).
function roomShape(room: typeof pokerRooms.$inferSelect, ownerName: string, seated = 0) {
  return {
    id: room.id, name: room.name, sb: room.sb, bb: room.bb,
    buyIn: room.buyIn, seats: room.seats, seated,
    isPrivate: room.isPrivate, ownerName,
  };
}

export async function listarMesas(tx: any, userId?: string) {
  const ocupacao = await tx.select({ roomId: pokerSessions.roomId, seated: count() })
    .from(pokerSessions).where(eq(pokerSessions.status, "open")).groupBy(pokerSessions.roomId);
  const seated = new Map<string, number>(ocupacao.map((r: any) => [r.roomId, Number(r.seated)]));
  const rows = await tx.select({ room: pokerRooms, ownerName: users.displayName })
    .from(pokerRooms).innerJoin(users, eq(users.id, pokerRooms.ownerId))
    .where(and(eq(pokerRooms.status, "open"), userId
      ? or(eq(pokerRooms.isPrivate, false), eq(pokerRooms.ownerId, userId))
      : eq(pokerRooms.isPrivate, false)))
    .orderBy(desc(pokerRooms.createdAt));
  return [
    ...MESAS_DA_CASA.map((room) => ({
      ...room, buyIn: BUY_IN_POR_SALA[room.id], seated: seated.get(room.id) ?? 0,
      isPrivate: false, ownerName: "M7",
    })),
    ...rows.map((r: any) => roomShape(r.room, r.ownerName, seated.get(r.room.id) ?? 0)),
  ];
}

export async function criarMesa(tx: any, userId: string, body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 3 || name.length > 40) throw new ErroPoker("nome_invalido");
  if (!BLINDS.some(([sb, bb]) => sb === body?.sb && bb === body?.bb)) {
    throw new ErroPoker("blinds_invalidos");
  }
  const { sb, bb, seats, isPrivate, password, valendoEssencia } = body;
  if (typeof valendoEssencia !== "boolean") throw new ErroPoker("dados_invalidos");
  const buyIn = valendoEssencia ? 100 * bb : 0;
  if (!Number.isInteger(seats) || seats < 2 || seats > 6) throw new ErroPoker("lugares_invalidos");
  if (typeof isPrivate !== "boolean") throw new ErroPoker("dados_invalidos");
  if (isPrivate && (typeof password !== "string" || password.length < 4 || password.length > 32)) {
    throw new ErroPoker("senha_invalida");
  }
  const passwordHash = isPrivate ? await bcrypt.hash(password, 10) : null;
  const [room] = await tx.insert(pokerRooms)
    .values({ ownerId: userId, name, sb, bb, buyIn, seats, isPrivate, passwordHash }).returning();
  const [owner] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, userId));
  return roomShape(room, owner.name);
}

export const STACK_MAX = 2_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ErroPoker extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/** Garante a linha da carteira antes do lock (usuário pode ainda não ter uma). */
async function carteiraBloqueada(tx: any, userId: string) {
  await tx.insert(userWallets).values({ userId, ea: 0 }).onConflictDoNothing();
  const [carteira] = await tx
    .select()
    .from(userWallets)
    .where(eq(userWallets.userId, userId))
    .limit(1)
    .for("update");
  if (!carteira) throw new ErroPoker("carteira_indisponivel");
  return carteira;
}

/** POST /api/poker/buyin — valida a mesa, debita EA e abre a sessão. */
export async function comprarEntrada(tx: any, userId: string, body: any) {
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  let esperado: number;
  if (Object.prototype.hasOwnProperty.call(BUY_IN_POR_SALA, roomId)) {
    esperado = BUY_IN_POR_SALA[roomId];
  } else {
    if (!UUID.test(roomId)) throw new ErroPoker("mesa_invalida");
    const [room] = await tx.select().from(pokerRooms)
      .where(and(eq(pokerRooms.id, roomId), eq(pokerRooms.status, "open"))).limit(1);
    if (!room) throw new ErroPoker("mesa_invalida");
    esperado = room.buyIn;
    if (room.isPrivate && (typeof body?.password !== "string" ||
      body.password.length > 32 || !room.passwordHash ||
      !(await bcrypt.compare(body.password, room.passwordHash)))) {
      throw new ErroPoker("senha_invalida");
    }
  }
  const buyIn = body?.buyIn;
  if (typeof buyIn !== "number" || !Number.isInteger(buyIn) || buyIn !== esperado) {
    throw new ErroPoker("valor_invalido");
  }

  const carteira = await carteiraBloqueada(tx, userId);
  if (carteira.ea < buyIn) throw new ErroPoker("saldo_insuficiente");

  const novoEa = carteira.ea - buyIn;
  if (buyIn > 0) await tx
    .update(userWallets)
    .set({ ea: novoEa, updatedAt: new Date() })
    .where(eq(userWallets.userId, userId));

  const [sessao] = await tx
    .insert(pokerSessions)
    .values({ userId, roomId, buyIn, status: "open" })
    .returning();

  if (buyIn > 0) await tx.insert(walletTransactions).values({
    userId,
    currency: "ea",
    amount: -buyIn,
    kind: "poker_buyin",
    refType: "poker_session",
    refId: sessao.id,
    balanceAfter: novoEa,
  });

  return { sessionId: sessao.id, ea: novoEa };
}

/**
 * POST /api/poker/cashout — devolve o stack à EA e fecha a sessão uma única vez.
 * Sessão de outro usuário/inexistente = 404; já encerrada = 400
 * `sessao_encerrada`, sem creditar de novo.
 */
export async function fecharMesa(tx: any, userId: string, body: any) {
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!UUID.test(sessionId)) throw new ErroPoker("sessao_nao_encontrada", 404);

  const stack = body?.stack;
  if (typeof stack !== "number" || !Number.isInteger(stack) || stack < 0 || stack > STACK_MAX) {
    throw new ErroPoker("dados_invalidos");
  }

  const carteira = await carteiraBloqueada(tx, userId);

  const [sessao] = await tx
    .select()
    .from(pokerSessions)
    .where(eq(pokerSessions.id, sessionId))
    .limit(1)
    .for("update");
  if (!sessao || sessao.userId !== userId) throw new ErroPoker("sessao_nao_encontrada", 404);
  if (sessao.status !== "open") throw new ErroPoker("sessao_encerrada");

  // Fichas de treino não se convertem em essência no encerramento.
  const payout = sessao.buyIn === 0 ? 0 : stack;
  const novoEa = carteira.ea + payout;
  if (sessao.buyIn > 0) await tx
    .update(userWallets)
    .set({ ea: novoEa, updatedAt: new Date() })
    .where(eq(userWallets.userId, userId));

  await tx
    .update(pokerSessions)
    .set({ status: "closed", payout, closedAt: new Date() })
    .where(and(eq(pokerSessions.id, sessionId), eq(pokerSessions.status, "open")));

  if (sessao.buyIn > 0) await tx.insert(walletTransactions).values({
    userId,
    currency: "ea",
    amount: payout,
    kind: "poker_cashout",
    refType: "poker_session",
    refId: sessionId,
    balanceAfter: novoEa,
  });

  return { ea: novoEa, payout };
}
