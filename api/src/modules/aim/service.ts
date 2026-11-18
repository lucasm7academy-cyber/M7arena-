import { asc, desc, eq } from "drizzle-orm";
import { aimScores } from "../../../../db/schema/aim.js";
import { users } from "../../../../db/schema/identidade.js";

/**
 * Ranking geral do treino de mira — autoridade do servidor.
 *
 * A partida roda no cliente (motor em `web/src/features/aim/domain/engine.ts`),
 * mas a nota é recalculada aqui com a mesma curva e o leaderboard é lido desta
 * tabela: nada de ranking só em localStorage. As funções recebem `tx` (a
 * transação da rota em produção, o próprio `db` nos testes com PGlite), no
 * mesmo padrão de `api/src/lib/withdrawals.ts`.
 */

export const AIM_MODES = ["flick", "track", "precision"] as const;
export type AimMode = (typeof AIM_MODES)[number];
export type AimEscopo = AimMode | "all";

export const LIMITE_PADRAO = 25;
export const LIMITE_MAX = 100;

export class ErroAim extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * Curva de nota do servidor. É a única fonte da `grade` gravada: o cliente pode
 * enviar a dele, mas é ignorada. `accuracyPct` é o percentual inteiro (0..100)
 * efetivamente persistido, então nota e número exibido nunca divergem.
 */
export function notaDoScore(accuracyPct: number, score: number): string {
  if (accuracyPct >= 97 && score >= 9000) return "SS";
  if (accuracyPct >= 93) return "S";
  if (accuracyPct >= 86) return "A";
  if (accuracyPct >= 76) return "B";
  if (accuracyPct >= 62) return "C";
  return "D";
}

export interface AimEntrada {
  mode: AimMode;
  score: number;
  accuracyPct: number;
  apm: number;
  combo: number;
  durationMs: number;
  grade: string;
}

function numeroFinito(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function inteiroNoIntervalo(valor: unknown, min: number, max: number): number | null {
  const n = numeroFinito(valor);
  if (n === null || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** Valida o payload do POST /api/aim/scores e recalcula a nota no servidor. */
export function validarEntrada(body: any): AimEntrada {
  const modo = body?.mode;
  if (typeof modo !== "string" || !AIM_MODES.includes(modo as AimMode)) {
    throw new ErroAim("dados_invalidos");
  }

  const score = inteiroNoIntervalo(body?.score, 0, 200000);
  if (score === null) throw new ErroAim("dados_invalidos");

  const accuracy = numeroFinito(body?.accuracy);
  if (accuracy === null || accuracy < 0 || accuracy > 100) throw new ErroAim("dados_invalidos");
  const accuracyPct = Math.round(accuracy);

  const apm = inteiroNoIntervalo(body?.apm, 0, 600);
  if (apm === null) throw new ErroAim("dados_invalidos");

  const combo = inteiroNoIntervalo(body?.combo, 0, 10000);
  if (combo === null) throw new ErroAim("dados_invalidos");

  const durationMs = inteiroNoIntervalo(body?.durationMs, 10000, 180000);
  if (durationMs === null) throw new ErroAim("dados_invalidos");

  return {
    mode: modo as AimMode,
    score,
    accuracyPct,
    apm,
    combo,
    durationMs,
    grade: notaDoScore(accuracyPct, score),
  };
}

export function nomeExibicao(nome: string | null | undefined, email: string | null | undefined): string {
  const exibicao = (nome ?? "").trim();
  if (exibicao) return exibicao;
  const local = (email ?? "").split("@")[0]?.trim();
  return local || "Jogador";
}

function formaLinha(linha: any) {
  return {
    id: linha.id,
    name: nomeExibicao(linha.name, linha.email),
    mode: linha.mode,
    score: linha.score,
    // O banco guarda percentual inteiro; o contrato do SDK usa número com uma
    // casa (97 vira 97 no JSON — não existe 97.0 distinto em JSON numérico).
    accuracy: Number(Number(linha.accuracyPct).toFixed(1)),
    apm: linha.apm,
    grade: linha.grade,
    at: linha.createdAt instanceof Date ? linha.createdAt.toISOString() : new Date(linha.createdAt).toISOString(),
  };
}

/**
 * Uma linha por jogador: o melhor score dele no escopo. DISTINCT ON resolve o
 * melhor por `user_id`; a ordenação externa aplica o ranking (score desc,
 * createdAt asc) com `user_id` só como desempate estável.
 */
async function melhoresPorJogador(tx: any, escopo: AimEscopo, limite?: number) {
  const melhores = tx
    .selectDistinctOn([aimScores.userId], {
      id: aimScores.id,
      userId: aimScores.userId,
      mode: aimScores.mode,
      score: aimScores.score,
      accuracyPct: aimScores.accuracyPct,
      apm: aimScores.apm,
      grade: aimScores.grade,
      createdAt: aimScores.createdAt,
    })
    .from(aimScores)
    .where(escopo === "all" ? undefined : eq(aimScores.mode, escopo))
    .orderBy(asc(aimScores.userId), desc(aimScores.score), asc(aimScores.createdAt))
    .as("melhores_do_jogador");

  const consulta = tx
    .select({
      id: melhores.id,
      userId: melhores.userId,
      mode: melhores.mode,
      score: melhores.score,
      accuracyPct: melhores.accuracyPct,
      apm: melhores.apm,
      grade: melhores.grade,
      createdAt: melhores.createdAt,
      name: users.displayName,
      email: users.email,
    })
    .from(melhores)
    .innerJoin(users, eq(users.id, melhores.userId))
    .orderBy(desc(melhores.score), asc(melhores.createdAt), asc(melhores.userId));

  return limite ? consulta.limit(limite) : consulta;
}

/** GET /api/aim/leaderboard — público, um registro por jogador. */
export async function rankingAim(tx: any, escopo: AimEscopo, limite: number = LIMITE_PADRAO) {
  const linhas = await melhoresPorJogador(tx, escopo, limite);
  return linhas.map(formaLinha);
}

/**
 * POST /api/aim/scores — grava a partida e devolve `{ ok, row, position }`.
 * `position` é a posição 1-based do jogador no ranking daquele modo após a
 * inserção (o melhor score dele, não necessariamente a linha recém-gravada).
 */
export async function registrarScore(tx: any, userId: string, body: any) {
  const entrada = validarEntrada(body);

  const [gravada] = await tx
    .insert(aimScores)
    .values({
      userId,
      mode: entrada.mode,
      score: entrada.score,
      accuracyPct: entrada.accuracyPct,
      apm: entrada.apm,
      combo: entrada.combo,
      grade: entrada.grade,
      durationMs: entrada.durationMs,
    })
    .returning();

  const [usuario] = await tx
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const ranking = await melhoresPorJogador(tx, entrada.mode);
  const indice = ranking.findIndex((linha: any) => linha.userId === userId);

  return {
    row: formaLinha({ ...gravada, name: usuario?.displayName, email: usuario?.email }),
    position: indice >= 0 ? indice + 1 : null,
  };
}
