/**
 * team-ownership.ts — ADR-089: quem tiver a coroa é o dono do time.
 *
 * Regra fechada com o usuário (2026-10-17): o PROPRIETÁRIO da plataforma pode
 * kitar o dono/capitão de qualquer time e passar a coroa para quem quiser. O
 * `teams.owner_id` segue a coroa — o dono anterior que perdeu a coroa (ou saiu
 * do lineup) deixa de ser dono; o membro coroado vira o dono.
 *
 * Exceções: coroa num CONVIDADO (guest sem conta) não troca o dono — owner_id
 * só muda para um user_id real. Se o dono não está mais no lineup, a coroa
 * cai para o primeiro membro com conta; sem nenhum, o time fica sem dono.
 */

export interface MembroGravado {
  userId: string | null;
  isCaptain: boolean;
}

/**
 * Decide o novo `owner_id` após salvar o lineup.
 *
 * @param membros membros gravados (pós-save) do time
 * @param ownerAtual owner_id antes do save
 * @returns o id do novo dono, ou null se não deve mudar
 */
export function resolverNovoDono(membros: MembroGravado[], ownerAtual: string | null): string | null {
  const coroado = membros.find((m) => m.isCaptain && m.userId);
  if (coroado?.userId) {
    return coroado.userId === ownerAtual ? null : coroado.userId;
  }

  // Ninguém coroado com conta: se o dono atual não está mais no time, a coroa
  // cai para o primeiro membro com conta (senão o time fica sem dono).
  const donoAindaNoTime = membros.some((m) => m.userId === ownerAtual);
  if (!donoAindaNoTime) {
    const primeiroComConta = membros.find((m) => m.userId);
    return primeiroComConta?.userId ?? null;
  }
  return null;
}
