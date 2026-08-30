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
 *
 * `nome`/`tag` são derivados do Riot ID (game_accounts.handle, "Game#Tag") do
 * mesmo jeito que o legado gravava em `sala_jogadores`: split_part do riot_id
 * na RPC `sala_entrar` (nick em `nome`, tag em `tag`). Sem conta Riot vinculada
 * cai no displayName (ou prefixo do email), também como o legado fazia.
 */
export function toLegacyPlayer(p: any, user: any, isVip: boolean, salaNum: number) {
  const handle = user?.__riotHandle || null;
  let nome: string;
  let tag = "";
  if (handle) {
    const [nick, tagLine] = handle.split("#");
    nome = nick?.trim() || "Jogador";
    if (tagLine) tag = `#${tagLine}`;
  } else {
    nome =
      user?.displayName && user.displayName.trim()
        ? user.displayName
        : user?.email?.split("@")[0] || "Jogador";
  }
  return {
    id: `${p.matchId}-${p.userId}`,
    sala_id: salaNum,
    user_id: p.userId,
    nome,
    tag,
    elo: "Sem Elo",
    // PUUID da conta LoL vinculada — usado pelo front para cruzar os stats da
    // Riot (resultado_riot.participantes[].puuid) na partida finalizada.
    puuid: user?.__riotPuuid ?? null,
    // Avatar: prioriza o profile icon da conta LoL vinculada (mesma URL que o
    // front monta em buildProfileIconUrl) — é o "ícone do jogador" que o site
    // original mostrava. Sem conta vinculada, cai no avatar do email/URL.
    avatar: user?.__riotIconId
      ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${user.__riotIconId}.jpg`
      : user?.avatarUrl || null,
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
 * Resumo estruturado do match_results (payload da Riot) para as telas de
 * partida finalizada: vencedor real, duração e stats por time/jogador.
 * `payload` é o JSON v5 da Riot (matchResults.payload).
 *
 * `puuidToSide` (opcional) resolve o lado NUBA (blue/red) por puuid. Sem ele,
 * cai no teamId da Riot (100→blue, 200→red) — mas em custom games o teamId
 * não corresponde de forma confiável ao nosso lado, então o placar por teamId
 * sai invertido. Passar o mapa corrige a cluster de kills/ouro/vencedor.
 */
export function resumoRiot(payload: any, puuidToSide?: Map<string, "blue" | "red">) {
  if (!payload?.info?.teams || !payload?.info?.participants) return null;
  const info = payload.info;
  const times = new Map<number, any>(info.teams.map((t: any) => [t.teamId, t]));
  const ladoDe = (p: any): "blue" | "red" =>
    puuidToSide?.get(p.puuid) ?? (p.teamId === 100 ? "blue" : "red");
  const porLado = (lado: "blue" | "red") => info.participants.filter((p: any) => ladoDe(p) === lado);
  const kills = (lado: "blue" | "red") => porLado(lado).reduce((s: number, p: any) => s + (p.kills || 0), 0);
  const gold = (lado: "blue" | "red") => porLado(lado).reduce((s: number, p: any) => s + (p.goldEarned || 0), 0);
  const venceu = (lado: "blue" | "red") => {
    const parts = porLado(lado);
    if (parts.some((p: any) => p.win)) return true;
    if (parts.some((p: any) => p.win === false)) return false;
    // Sem win nos participants (partida abortada no 1v1), usa o teamId do time.
    return !!times.get(parts[0]?.teamId)?.win;
  };

  return {
    match_id_riot: payload.metadata?.matchId ?? null,
    vencedor: venceu("blue") ? "blue" : venceu("red") ? "red" : null,
    duracao_s: info.gameDuration ?? 0,
    game_version: info.gameVersion ?? null,
    placar: {
      blue: { kills: kills("blue"), gold: gold("blue"), venceu: venceu("blue") },
      red: { kills: kills("red"), gold: gold("red"), venceu: venceu("red") },
    },
    participantes: info.participants.map((p: any) => ({
      puuid: p.puuid,
      nome: p.summonerName ?? null,
      campeao: p.championName ?? null,
      champion_id: p.championId ?? null,
      side: ladoDe(p),
      venceu: !!p.win,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      ouro: p.goldEarned ?? 0,
      cs: (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0),
    })),
  };
}

/**
 * Shape legado de `salas`. `players` são as linhas de `match_players` já
 * enriquecidas com user + isVip pelo chamador. `criadorNome` vem do dono.
 * `printsRecebidos` é opcional (contagem de `match_prints` para o estado
 * `aguardando_revisao` — design v3 §6); só a rota de detalhe/painel envia.
 */
export function toLegacyMatch(m: any, players: any[], criadorNome: string, printsRecebidos = 0, resultadoRiot: any = null) {
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
    // Segurança (MORPH-001): a senha NUNCA é devolvida no shape. O cliente só
    // sabe que a sala é privada (tem_senha) e envia a senha no body do join —
    // a validação acontece no servidor. `null` preserva o shape legado.
    senha: null,
    max_jogadores: m.maxJogadores ?? 10,
    elo_minimo: m.eloMinimo ?? null,
    estado: m.status,
    vencedor: winnerSideToLegacy(m.winnerSide ?? m.resultado),
    criador_id: m.createdBy,
    criador_nome: criadorNome || "Desconhecido",
    time_a_nome: m.timeANome ?? null,
    time_a_tag: m.timeATag ?? null,
    time_a_logo: m.timeALogo ?? null,
    time_b_nome: m.timeBNome ?? null,
    time_b_tag: m.timeBTag ?? null,
    time_b_logo: m.timeBLogo ?? null,
    codigo_partida: m.codigoPartida ?? null,
    // Motivo da vitória no 1v1 (first_blood | 100_cs) — ADR-039. Só no modo 1v1.
    vitoria_motivo: m.vitoriaMotivo ?? null,
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
    // Dados reais da partida puxados da Riot (matchResults.payload) — só para
    // salas encerradas que foram verificadas. `null` quando não houver.
    resultado_riot: resultadoRiot,
  };
}

export type LegacyMatch = ReturnType<typeof toLegacyMatch>;
export type LegacyPlayer = ReturnType<typeof toLegacyPlayer>;
