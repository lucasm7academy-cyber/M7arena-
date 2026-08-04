/**
 * match-shape.ts — reconstrói o shape legado de `salas` / `sala_jogadores`
 * que o fork do front consome 1:1 (ADR-005/010). A API devolve estes nomes
 * (snake_case, `mpoints`, `is_time_a`, ...) para o JSX não mudar uma linha.
 *
 * O id público da sala é `matches.sala_num` (integer, herdado de `salas.id`
 * bigint) — o fork navega em `/sala-mod1/:id`, faz `parseInt` e deriva o
 * código `#${String(id).padStart(6,'0')}`. O uuid de `matches.id` fica interno.
 */

export const ROLES_5V5 = ["TOP", "JG", "MID", "ADC", "SUP"] as const;

/** Ordem das roles no layout (mesma de SalaMod1.tsx). */
export function roleSlotToSlot(role: string): number {
  const idx = ROLES_5V5.indexOf(role as (typeof ROLES_5V5)[number]);
  return idx === -1 ? 5 : idx; // RES/desconhecido cai na sobra
}

/** Vencedor legado ('A' | 'B' | 'empate') → winner_side ('blue' | 'red' | 'draw'). Idempotente. */
export function winnerLegacyToSide(v: string | undefined | null): "blue" | "red" | "draw" {
  if (v === "A") return "blue";
  if (v === "B") return "red";
  if (v === "blue" || v === "red" || v === "draw") return v;
  return "draw";
}

/** winner_side → vencedor legado que as telas de salas finalizadas leem. */
export function winnerSideToLegacy(side: string | null | undefined): "A" | "B" | "empate" | null {
  if (side === "blue") return "A";
  if (side === "red") return "B";
  if (side === "draw") return "empate";
  return null;
}

/**
 * Linha legada de `sala_jogadores`. `user` é o usuário dono da vaga (join),
 * `isVip` o flag de VIP (vem de users.is_vip). A UI lê `is_time_a` (snake) e
 * `isVip` (camel) — entregamos os dois.
 */
export function toLegacyPlayer(p: any, user: any, isVip: boolean, salaNum: number) {
  const nome =
    user?.displayName && user.displayName.trim()
      ? user.displayName
      : user?.email?.split("@")[0] || "Jogador";
  return {
    id: `${p.matchId}-${p.userId}`,
    sala_id: salaNum,
    user_id: p.userId,
    nome,
    tag: "",
    elo: "Sem Elo",
    avatar: user?.avatarUrl || null,
    role: p.roleSlot || "RES",
    is_time_a: p.side === "blue",
    is_lider: p.slot === 0 && p.side === "blue",
    confirmado: p.confirmed,
    vinculado: p.linked,
    is_vip: isVip,
    isVip,
    // Momento em que o jogador entrou na vaga — base do aviso de kick por
    // ociosidade (30 min desde `createdAt`, design v3 §8; aviso aos 25 min).
    created_at: p.createdAt ?? null,
  };
}

/**
 * Shape legado de `salas`. `players` são as linhas de `match_players` já
 * enriquecidas com user + isVip pelo chamador. `criadorNome` vem do dono.
 * `printsRecebidos` é opcional (contagem de `match_prints` para o estado
 * `aguardando_revisao` — design v3 §6); só a rota de detalhe/painel envia.
 */
export function toLegacyMatch(m: any, players: any[], criadorNome: string, printsRecebidos = 0) {
  const jogadores = players.map((p) =>
    toLegacyPlayer(p, p.__user, !!p.__isVip, m.salaNum)
  );
  return {
    // Relógio do servidor no momento da resposta (epoch ms). O cliente usa
    // para corrigir o skew de relógio e alinhar os timers (ajustarsala F2).
    server_time: Date.now(),
    id: m.salaNum,
    nome: m.nome || "Sala",
    descricao: m.descricao || "",
    modo: m.mode,
    mpoints: m.entryMp || 0,
    tem_senha: !!m.temSenha,
    senha: m.senha ?? null,
    max_jogadores: m.maxJogadores ?? 10,
    elo_minimo: m.eloMinimo ?? null,
    estado: m.status,
    vencedor: winnerSideToLegacy(m.winnerSide),
    criador_id: m.createdBy,
    criador_nome: criadorNome || "Desconhecido",
    time_a_nome: m.timeANome ?? null,
    time_a_tag: m.timeATag ?? null,
    time_a_logo: m.timeALogo ?? null,
    time_b_nome: m.timeBNome ?? null,
    time_b_tag: m.timeBTag ?? null,
    time_b_logo: m.timeBLogo ?? null,
    codigo_partida: m.codigoPartida ?? null,
    confirmacao_expires_at: m.confirmacaoExpiresAt ?? null,
    iniciando_partida_at: m.iniciandoPartidaAt ?? null,
    created_at: m.createdAt,
    ended_at: m.endedAt ?? null,
    // ── Salas apostadas (design v3 §5/§11) — campos aditivos para o fork ──
    aposta_mc: m.apostaMc ?? 0,          // 0 = casual
    taxa_pct: m.taxaPct ?? 8.99,          // congelada na criação da sala
    match_id: m.id,                       // uuid interno (prints/disputas/revisão)
    revisao_desde: m.revisaoDesde ?? null, // SLA do estado aguardando_revisao
    prints_recebidos: printsRecebidos,
    prints_necessarios: 3,                // máx. 3 prints por partida (design v3 §6)
    // O fork conta jogadores em `sala.jogadores.length` na listagem.
    jogadores,
  };
}

export type LegacyMatch = ReturnType<typeof toLegacyMatch>;
export type LegacyPlayer = ReturnType<typeof toLegacyPlayer>;
