/**
 * M7Arena API SDK Client (ADR-010 / ADR-011)
 * Cliente HTTP tipado para comunicação do front-end Vite com a API Node própria.
 * Substitui o cliente GoTrue / Supabase.
 */

import type {
  ApiLegacyNews,
  ApiLegacyHighlight,
  ApiNewsRow,
  ApiHighlightRow,
  ApiPlayerStats,
} from "./api-content.js";
import { toLegacyNews, toApiNews, toLegacyHighlight, toApiHighlight } from "./api-content.js";

export type {
  ApiLegacyNews,
  ApiLegacyHighlight,
  ApiNewsRow,
  ApiHighlightRow,
  ApiPlayerStats,
} from "./api-content.js";

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  isVip: boolean;
  roles: string[];
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

/**
 * Shape legado que as telas do fork já consomem (ADR-005/ADR-010). A API de
 * times devolve exatamente estes nomes (snake_case, `time_membros` aninhado)
 * para o JSX não mudar uma linha — mesmo padrão do AuthContext, que mantém
 * `user_metadata` porque é isso que as telas leem.
 */
export interface ApiLegacyTeam {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from: string;
  gradient_to: string;
  pdl: number;
  winrate: number;
  ranking: number;
  wins: number;
  games_played: number;
  dono_id: string;
  capitao_id?: string | null;
  whatsapp?: string | null;
  discord?: string | null;
  status?: string;
}

export interface ApiLegacyTeamDetail extends ApiLegacyTeam {
  time_membros: ApiLegacyMember[];
}

export interface ApiLegacyMember {
  id: string;
  time_id: string;
  user_id: string | null;
  tipo: string;
  lane: string;
  is_capitao: boolean;
  status: string;
  guest_riot_id?: string | null;
  guest_puuid?: string | null;
  guest_profile_icon_id?: number | null;
  guest_elo_cache?: string | null;
}

export interface ApiLegacyInvite {
  id: string;
  time_id: string;
  de_user_id: string;
  para_user_id?: string | null;
  riot_id?: string | null;
  role: string;
  mensagem?: string | null;
  tipo: 'solicitacao' | 'convite';
  status: 'pendente' | 'aceito' | 'recusado';
  criado_em: string;
}

export interface ApiTeamListResult {
  teams: ApiLegacyTeam[];
  total: number;
}

export interface ApiTeamBatchItem {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from: string;
  gradient_to: string;
}

export interface ApiUserTeams {
  memberships: { time_id: string; status: string }[];
  teams: ApiTeamBatchItem[];
}

export interface ApiMemberRow {
  user_id: string | null;
  time_id: string;
  guest_riot_id?: string | null;
}

/**
 * Shape legado de campeonato que o fork consome (ADR-014). A API devolve os
 * nomes snake_case do schema `campeonatos` antigo; os jsonb (times_inscritos,
 * cronograma, bracket_data, ...) passam como estão para o JSX não mudar.
 */
export interface ApiLegacyTournament {
  id: string;
  titulo: string;
  nome: string;
  criado_por: string;
  status: string;
  formato: string;
  frase?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  org_photo_url?: string | null;
  theme_color?: string;
  regulamento?: string | null;
  vagas: number;
  times_por_grupo?: number | null;
  classificados_por_grupo?: number | null;
  tier?: string | null;
  data?: string | null;
  premiacao?: string | null;
  taxa?: string | null;
  tem_outros_premios?: boolean;
  outros_premios?: string | null;
  organizacao?: string | null;
  times_inscritos: any[];
  cronograma: any[];
  bracket_data?: any;
  classificacao?: any[];
  grupos?: any;
  times_ordem_sorteio?: any[];
  grupos_sorteados?: any;
  chaves_sorteados?: any;
  registeredTeamsCount?: number;
  created_at: string;
  updated_at?: string;
}

/** Saldo de MP/MC no shape que as telas do fork consomem. */
export interface ApiWalletBalance {
  userId: string;
  mp: number;
  mc: number;
  /** MC travado em salas apostadas ativas (design v3 §11 — "em partida"). */
  mcReservado?: number;
  /** Salas apostadas ativas que seguram a reserva — valor vira link no perfil. */
  emPartida?: { salaNum: number; apostaMc: number; nome: string | null; modo?: string }[];
}

/** Pacote de compra de MC vindo de GET /api/payments/packages (ADR-031). */
export interface ApiMcPackage {
  id: string;
  priceBrl: number;
  baseMc: number;
  bonusMc: number;
  totalMc: number;
  isPopular: boolean;
}

/** Resposta de POST /api/payments/mc/order (QR code PIX). */
export interface ApiMcOrderResult {
  paymentId: string;
  orderId: string;
  method: string;
  qrCode: string | null;
  brCode: string | null;
}

/** Resposta de GET /api/payments/:orderId/status. */
export interface ApiPaymentStatus {
  orderId: string;
  status: string;
}

/** Retorno do POST /api/wallet/admin/adjust (saldos finais calculados no servidor). */
export interface ApiWalletAdjustResult {
  ok: boolean;
  erro: string | null;
  mc: number;
  mp: number;
}

/** Retorno do POST /api/wallet/admin/adjust-mc (exclusivo do proprietário). */
export interface ApiWalletAdjustMcResult {
  ok: boolean;
  erro: string | null;
  mc: number;
}

/** Pedido de saque de MC via PIX (spec saque-mc-pix). */
export interface ApiWithdrawal {
  id: string;
  mcAmount: number;
  amountBrl: number;
  pixType: string;
  pixKey: string;
  pixName: string;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
  /** Presente apenas em GET /withdrawals/admin. */
  userId?: string;
  riotId?: string | null;
  displayName?: string;
}

/**
 * Shape legado de `salas` que as telas de Jogar/SalaMod1 consomem (ADR-005/010).
 * `id` é o `sala_num` público (numérico) — o fork navega em `/:modo/:id`,
 * faz parseInt e deriva o código `#${String(id).padStart(6,'0')}`.
 */
export interface ApiLegacySala {
  id: number;
  nome: string;
  descricao: string;
  modo: string;
  mpoints: number;
  tem_senha: boolean;
  senha?: string | null;
  max_jogadores: number;
  elo_minimo?: string | null;
  estado: string;
  vencedor?: 'A' | 'B' | 'empate' | null;
  criador_id: string;
  criador_nome: string;
  time_a_nome?: string | null;
  time_a_tag?: string | null;
  time_a_logo?: string | null;
  time_b_nome?: string | null;
  time_b_tag?: string | null;
  time_b_logo?: string | null;
  codigo_partida?: string | null;
  confirmacao_expires_at?: string | null;
  iniciando_partida_at?: string | null;
  created_at: string;
  ended_at?: string | null;
  server_time?: number | null;
  jogadores: ApiLegacySalaJogador[];
  // ── Salas apostadas (design v3 §5/§11) — campos aditivos do port ──
  aposta_mc?: number;
  taxa_pct?: string | number;
  match_id?: string;
  revisao_desde?: string | null;
  prints_recebidos?: number;
  prints_necessarios?: number;
}

export interface ApiLegacySalaJogador {
  id: string;
  sala_id: number;
  user_id: string;
  nome: string;
  tag: string;
  elo: string;
  avatar?: string | null;
  role: string;
  is_time_a: boolean;
  is_lider: boolean;
  confirmado: boolean;
  vinculado: boolean;
  is_vip: boolean;
  isVip: boolean;
}

/** Retorno das ações de sala `{ ok, erro, estado, mudou }` (códigos de ERROS_SALA). */
export interface ApiSalaResultado {
  ok: boolean;
  erro: string | null;
  estado: string | null;
  mudou: boolean;
  /** Presente no erro `saldo_insuficiente` — quanto falta para entrar (design v3 §11). */
  faltam?: number;
  /** Erro `ja_em_sala_apostada` — sala apostada ativa que segura a vaga do jogador. */
  sala_num?: number;
  /** Erro `ja_em_sala_apostada` — modo da sala que segura a vaga (rota `/sala/:modo/:id`). */
  modo?: string;
}

/** Print de prova de uma partida apostada (design v3 §6). */
export interface ApiPrint {
  id: string;
  matchId: string;
  userId: string;
  nomeJogador: string;
  /** URL autenticada — passa por GET /api/prints/:id/arquivo, nunca link direto. */
  url: string;
  createdAt: string;
}

/** Contestação de resultado (design v3 §6.1). */
export interface ApiDisputa {
  id: string;
  matchId: string;
  userId: string;
  nomeJogador: string;
  motivo: string;
  status: string;
  createdAt: string;
}

/** Disputa em partida encerrada para o painel do admin (spec verificacao-partida-riot). */
export interface ApiDisputaAdmin {
  id: string;
  matchId: string;
  userId: string;
  motivo: string;
  contestacaoUrl: string | null;
  status: string;
  createdAt: string;
  nomeJogador: string;
  salaNum: number;
  mode: string;
  apostaMc: number;
  winnerSide: string | null;
  resultado: string | null;
}

/** Jogador da sala no painel de revisão. */
export interface ApiRevisaoJogador {
  userId: string;
  nome: string;
  side: 'blue' | 'red';
  confirmed: boolean;
}

/** Sala em `aguardando_revisao` com o que o painel precisa (prints + disputas embutidos). */
export interface ApiRevisaoSala {
  id: string;
  salaNum: number;
  mode: string;
  status: string;
  apostaMc: number;
  taxaPct: string;
  maxJogadores: number;
  timeANome?: string | null;
  timeATag?: string | null;
  timeALogo?: string | null;
  timeBNome?: string | null;
  timeBTag?: string | null;
  timeBLogo?: string | null;
  revisaoDesde?: string | null;
  createdAt: string;
  jogadores: ApiRevisaoJogador[];
  prints: ApiPrint[];
  disputas: ApiDisputa[];
}

/** Resultado da decisão do revisor (idempotente via decisionId, §4.3). */
export interface ApiDecisaoResultado {
  ok: boolean;
  erro?: string;
  estado?: string;
}

export interface ApiMatchesSdk {
  list: (params?: { status?: string; limit?: number }) => Promise<ApiLegacySala[]>;
  detail: (id: number | string) => Promise<ApiLegacySala>;
  create: (data: {
    mode: string;
    entryMp?: number;
    nome?: string;
    descricao?: string;
    temSenha?: boolean;
    senha?: string;
    eloMinimo?: string;
    maxJogadores?: number;
    timeANome?: string;
    timeATag?: string;
    timeALogo?: string;
  }) => Promise<ApiLegacySala>;
  join: (id: number, data: { side?: string; slot?: number; roleSlot?: string; is_time_a?: boolean; senha?: string }) => Promise<ApiSalaResultado>;
  leave: (id: number) => Promise<ApiSalaResultado>;
  confirm: (id: number) => Promise<ApiSalaResultado>;
  recusar: (id: number) => Promise<ApiSalaResultado>;
  tick: (id: number) => Promise<ApiSalaResultado>;
  start: (id: number) => Promise<ApiSalaResultado>;
  /** Registra voto num jogo (substitui RPC votar_jogo). */
  vote: (id: number | string, teamTag: string) => Promise<{ ok: boolean }>;
  /** Exclui a sala (admin/proprietário) — devolve reservas pendentes e remove tudo. */
  excluir: (id: number | string) => Promise<{ ok: boolean; id: string; salaNum: number }>;
  /** Dispara a verificação automática na hora (acelerador do polling). */
  verificar: (id: number) =>
    Promise<{ ok: boolean; estado: string; vencedor?: 'A' | 'B' | null; motivo?: string; matchIdRiot?: string | null }>;
}

/**
 * Shape legado de `contas_riot` que o fork consome (ADR-005/010). A API traduz
 * game_accounts (handle/externalId/metadata) de volta para esses nomes para o
 * JSX não mudar uma linha.
 */
export interface ApiLegacyRiotAccount {
  user_id: string;
  riot_id: string;
  puuid: string;
  summoner_id: string | null;
  level: number | null;
  profile_icon_id: number | null;
  elo_cache: any;
  champions_cache: any;
  stats_updated_at: string | null;
  verified_at: string | null;
  created_at?: string;
}

/** Atualização do cache Riot da PRÓPRIA conta (elo, champions, ícone, nível). */
export interface ApiRiotUpdate {
  elo_cache?: any;
  champions_cache?: any;
  stats_updated_at?: string;
  profile_icon_id?: number | null;
  level?: number | null;
  summoner_id?: string | null;
}

/** Perfil legado de `profiles` (lane, is_vip, redes, Pix) devolvido pela API. */
export interface ApiLegacyProfile {
  id: string;
  bio: string;
  lane_primaria: string | null;
  lane_secundaria: string | null;
  is_vip: boolean;
  instagram: string;
  twitch: string;
  youtube: string;
  discord: string;
  chave_pix: string;
  tipo_chave_pix: string;
  nome_pix: string;
}

export interface ApiProfileMe {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  roles: string[];
  /** Advertências manuais + ban (ADR-033) — "você tem X/3 advertências". */
  advertencias?: number;
  advertenciasMax?: number;
  status?: string;
  banMotivo?: string | null;
  banAutomatico?: boolean;
  suspensaAte?: string | null;
  termosAceitos?: boolean;
  profile: ApiLegacyProfile;
  riotAccount: ApiLegacyRiotAccount | null;
  discordAccount?: { providerAccountId?: string; discord_tag?: string | null } | null;
}

/** Resposta do estado OAuth do Discord (CSRF token, TTL 10min na API). */
export interface ApiDiscordStateResult {
  valid: boolean;
  reason?: string;
  userId?: string;
}

/** Ponto da série financeira do painel admin (ADR-032). Valores em R$. */
export interface ApiFinanceiroPonto {
  data: string;
  faturamento: number;
  saques: number;
  lucro: number;
}

/** Retorno de GET /api/admin/financeiro (ADR-032). */
export interface ApiFinanceiro {
  periodo: string;
  totais: {
    faturamento: number;
    saques: number;
    lucro: number;
    mcEmCirculacao: number;
    dinheiroNoProjeto: number;
  };
  serie: ApiFinanceiroPonto[];
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

const API_BASE_URL = "/api";

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type");
  let data: any = null;

  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = typeof data === "object" && data?.error ? data.error : `Erro HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),

  /**
   * Upload de imagem para o disco local (ADR-007), servido pelo Nginx em
   * /uploads/. Envia multipart com o arquivo, o bucket (viram pasta no volume:
   * team-logos/, public-images/) e um path opcional de subpasta (ex.:
   * 'campeonatos'). Devolve a URL pública pronta para gravar no banco.
   */
  upload: (file: File, bucket: string, path?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", bucket);
    if (path) form.append("path", path);
    return api.post<{ url: string; filename: string; ownerId: string }>("/upload", form);
  },

  auth: {
    login: (email: string, password: string) =>
      api.post<{ user: ApiUser }>("/auth/login", { email, password }),
    register: (data: { email: string; password: string; displayName: string }) =>
      api.post<{ user: ApiUser }>("/auth/register", data),
    logout: () => api.post<{ success: boolean }>("/auth/logout"),
    me: () => api.get<{ user: ApiUser | null }>("/auth/me"),
  },

  terms: {
    /** Registra o aceite dos Termos de Uso com declaração de 18+ (design v3 §2.1). */
    accept: () => api.post<{ ok: boolean; termos_aceitos_em?: string }>("/terms/accept"),
  },

  teams: {
    list: (params: { page?: number; limit?: number; search?: string; sort?: string; dir?: string } = {}) =>
      api.get<ApiTeamListResult>(
        `/teams${qs({ page: params.page, limit: params.limit, search: params.search, sort: params.sort, dir: params.dir })}`
      ),
    detail: (id: string) => api.get<ApiLegacyTeamDetail>(`/teams/${id}`),
    batch: (ids: string[]) => api.get<ApiTeamBatchItem[]>(`/teams/batch?ids=${ids.join(",")}`),
    byUser: (userId: string) => api.get<ApiUserTeams>(`/teams/by-user/${userId}`),
    members: (params: { user_ids?: string[]; guest_riot_ids?: string[] }) =>
      api.get<ApiMemberRow[]>(
        `/teams/members${qs({
          user_ids: params.user_ids?.join(","),
          guest_riot_ids: params.guest_riot_ids?.join(","),
        })}`
      ),
    create: (data: {
      nome: string;
      tag: string;
      logo_url?: string | null;
      gradient_from?: string;
      gradient_to?: string;
      whatsapp?: string | null;
      discord?: string | null;
    }) => api.post<ApiLegacyTeam>("/teams", data),
    update: (id: string, data: Partial<{
      nome: string;
      tag: string;
      logo_url: string | null;
      gradient_from: string | null;
      gradient_to: string | null;
      whatsapp: string | null;
      discord: string | null;
    }>) => api.put<ApiLegacyTeam>(`/teams/${id}`, data),
    leave: (id: string) => api.post<{ ok: boolean; deleted?: boolean }>(`/teams/${id}/leave`),
    removeMemberships: () => api.post<{ ok: boolean }>("/teams/memberships/remove"),
    invites: () => api.get<ApiLegacyInvite[]>("/teams/invites"),
    createInvite: (data: {
      time_id: string;
      para_user_id?: string | null;
      riot_id?: string | null;
      role: string;
      mensagem?: string | null;
      tipo: string;
    }) => api.post<ApiLegacyInvite>("/teams/invites", data),
    clearInvites: (ids: string[]) => api.post<{ ok: boolean }>("/teams/invites/clear", { ids }),
    acceptInvite: (id: string) => api.post<{ ok: boolean }>(`/teams/invites/${id}/accept`),
    declineInvite: (id: string) => api.post<{ ok: boolean }>(`/teams/invites/${id}/decline`),
    /** Substitui o lineup inteiro (substitui RPC salvar_lineup_time). */
    saveLineup: (id: string | number, membros: any[]) =>
      api.post<{ ok: boolean }>(`/teams/${id}/lineup`, { p_membros: membros }),
    /** Ajusta PDL/V/D de um time (substitui RPC ajustar_stats_time). */
    adjustStats: (id: string, deltas: { p_delta_pdl?: number; p_delta_wins?: number; p_delta_losses?: number }) =>
      api.post<{ ok: boolean }>(`/teams/${id}/stats/adjust`, deltas),
  },

  tournaments: {
    list: (params: { status?: string; criado_por?: string; ids?: string[]; sort?: string } = {}) => {
      const base = qs({ status: params.status, criado_por: params.criado_por, sort: params.sort });
      const ids = params.ids?.length ? `${base ? "&" : "?"}ids=${params.ids.join(",")}` : "";
      return api.get<ApiLegacyTournament[]>(`/tournaments${base}${ids}`);
    },
    detail: (id: string) => api.get<ApiLegacyTournament>(`/tournaments/${id}`),
    create: (data: Partial<ApiLegacyTournament>) => api.post<ApiLegacyTournament>("/tournaments", data),
    update: (id: string, data: Partial<ApiLegacyTournament>) => api.put<ApiLegacyTournament>(`/tournaments/${id}`, data),
    remove: (id: string) => api.delete<{ ok: boolean }>(`/tournaments/${id}`),
    inscreverTime: (id: string, teamEntry: Record<string, unknown>) =>
      api.post<ApiLegacyTournament>(`/tournaments/${id}/inscricoes`, teamEntry),
    aprovarTime: (id: string, teamId: string, aprovar = true) =>
      api.post<ApiLegacyTournament>(`/tournaments/${id}/inscricoes/${teamId}/aprovar`, { p_aprovar: aprovar }),
    reabrir: (id: string) =>
      api.post<ApiLegacyTournament>(`/tournaments/${id}/reabrir`),
    atualizarCronograma: (id: string, cronograma: any[]) =>
      api.put<ApiLegacyTournament>(`/tournaments/${id}/cronograma`, { cronograma }),
    mergeCronograma: (id: string, jogos: any[]) =>
      api.put<ApiLegacyTournament>(`/tournaments/${id}/cronograma/merge`, { jogos }),
    recalcularPdl: (id: string) =>
      api.post<{ ok: boolean }>(`/tournaments/${id}/recalcular-pdl`),
  },

  wallet: {
    balance: () => api.get<ApiWalletBalance>("/wallet/balance"),
    adminBalances: (userIds?: string[]) =>
      api.get<ApiWalletBalance[]>(
        `/wallet/admin/balances${userIds?.length ? `?userIds=${userIds.join(",")}` : ""}`
      ),
    adminAdjust: (userId: string, deltaMC: number, deltaMP: number, motivo?: string) =>
      api.post<ApiWalletAdjustResult>("/wallet/admin/adjust", {
        userId,
        deltaMC,
        deltaMP,
        motivo: motivo || "ajuste_admin",
      }),
    adminAdjustMc: (userId: string, deltaMC: number, motivo?: string) =>
      api.post<ApiWalletAdjustMcResult>("/wallet/admin/adjust-mc", {
        userId,
        deltaMC,
        motivo: motivo || "ajuste_admin",
      }),
  },

  payments: {
    /** Pacotes ativos de MC (fonte da verdade: servidor). */
    packages: () => api.get<ApiMcPackage[]>("/payments/packages"),
    /** Cria pedido PIX de MC (autenticado; cliente envia só o packageId). */
    createMcOrder: (packageId: string) =>
      api.post<ApiMcOrderResult>("/payments/mc/order", { packageId }),
    /** Status do pagamento pelo uuid nosso (paymentId). */
    status: (paymentId: string) =>
      api.get<ApiPaymentStatus>(`/payments/${paymentId}/status`),
  },

  withdrawals: {
    /** Cria solicitação de saque — cliente envia só o mcAmount (servidor converte). */
    create: (mcAmount: number) => api.post<ApiWithdrawal>('/withdrawals', { mcAmount }),
    /** Histórico do próprio jogador. */
    mine: () => api.get<ApiWithdrawal[]>('/withdrawals/mine'),
    /** Fila + histórico (admin). */
    admin: () => api.get<ApiWithdrawal[]>('/withdrawals/admin'),
    /** Admin decide: paid (paga fora e confirma) | rejected (devolve MC). */
    decide: (id: string, action: 'paid' | 'rejected', decisionId: string) =>
      api.post<{ ok: boolean } & ApiWithdrawal>(`/withdrawals/${id}/decide`, { action, decisionId }),
  },

  content: {
    news: (params: { all?: boolean } = {}) =>
      api.get<ApiNewsRow[]>(`/content/news${params.all ? "/all" : ""}`).then((rows) =>
        (rows || []).map(toLegacyNews)
      ),
    newsCreate: (data: Partial<ApiLegacyNews>) =>
      api.post<ApiNewsRow>("/content/news", toApiNews(data)).then(toLegacyNews),
    newsUpdate: (id: string, data: Partial<ApiLegacyNews>) =>
      api.put<ApiNewsRow>(`/content/news/${id}`, toApiNews(data)).then(toLegacyNews),
    newsDelete: (id: string) => api.delete<{ ok: boolean }>(`/content/news/${id}`),
    highlights: (params: { all?: boolean } = {}) =>
      api.get<ApiHighlightRow[]>(`/content/highlights${params.all ? "/all" : ""}`).then((rows) =>
        (rows || []).map(toLegacyHighlight)
      ),
    highlightsCreate: (data: Partial<ApiLegacyHighlight>) =>
      api.post<ApiHighlightRow>("/content/highlights", toApiHighlight(data)).then(toLegacyHighlight),
    highlightsUpdate: (id: string, data: Partial<ApiLegacyHighlight>) =>
      api.put<ApiHighlightRow>(`/content/highlights/${id}`, toApiHighlight(data)).then(toLegacyHighlight),
    highlightsDelete: (id: string) => api.delete<{ ok: boolean }>(`/content/highlights/${id}`),
    playerStats: (userId: string) =>
      api.get<ApiPlayerStats[]>(`/content/player-stats/${userId}`),
    recordPlayerStats: (data: { userId: string; modo: string; vitoria: boolean }) =>
      api.post<ApiPlayerStats>("/content/player-stats", data),
  },

  matches: {
    list: (params: { status?: string; limit?: number } = {}) =>
      api.get<ApiLegacySala[]>(`/matches${qs({ status: params.status, limit: params.limit })}`),
    detail: (id: number | string) => api.get<ApiLegacySala>(`/matches/${id}`),
    create: (data: {
      mode: string;
      entryMp?: number;
      nome?: string;
      descricao?: string;
      temSenha?: boolean;
      senha?: string;
      eloMinimo?: string;
      maxJogadores?: number;
      timeANome?: string;
      timeATag?: string;
      timeALogo?: string;
    }) => api.post<ApiLegacySala>("/matches", data),
    join: (id: number, data: { side?: string; slot?: number; roleSlot?: string; is_time_a?: boolean; senha?: string }) =>
      api.post<ApiSalaResultado>(`/matches/${id}/join`, data),
    leave: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/leave`),
    confirm: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/confirm`),
    recusar: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/recusar`),
    tick: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/tick`),
    /** Registra voto num jogo (substitui RPC votar_jogo). */
    vote: (id: number | string, teamTag: string) =>
      api.post<{ ok: boolean }>(`/matches/${id}/vote`, { p_team_tag: teamTag }),
    /** Exclui a sala (admin/proprietário) — devolve reservas pendentes e remove tudo. */
    excluir: (id: number | string) =>
      api.delete<{ ok: boolean; id: string; salaNum: number }>(`/matches/${id}`),
    verificar: (id: number) =>
      api.post<{ ok: boolean; estado: string; vencedor?: 'A' | 'B' | null; motivo?: string; matchIdRiot?: string | null }>(`/matches/${id}/verificar`),
  } as ApiMatchesSdk,

  profiles: {
    /** Perfil completo do usuário logado (roles + profile legado + riotAccount). */
    me: () => api.get<ApiProfileMe>("/profiles/me"),
    /** Perfil público de qualquer usuário (para cards de jogador). */
    get: (id: string) => api.get<ApiProfileMe>(`/profiles/${id}`),
    /** Atualiza campos legados do perfil (bio, lanes, redes sociais, Pix). */
    update: (data: Record<string, unknown>) =>
      api.put<{ id: string; profile: ApiLegacyProfile }>("/profiles/me", data),
    /** Conta Riot do usuário logado no shape legado de contas_riot. */
    getRiot: () => api.get<ApiLegacyRiotAccount | null>("/profiles/me/riot"),
    /** Vincula a conta Riot do usuário logado (upsert em game_accounts). */
    linkRiot: (data: Record<string, unknown>) =>
      api.post<ApiLegacyRiotAccount>("/profiles/me/riot", data),
    /** Atualiza o cache Riot (elo/champions) da própria conta. */
    updateRiot: (data: ApiRiotUpdate) => api.put<ApiLegacyRiotAccount>("/profiles/me/riot", data),
    /** Desvincula a conta Riot do usuário logado. */
    unlinkRiot: () => api.delete<{ ok: boolean }>("/profiles/me/riot"),
    /** Discord vinculado do usuário logado (tag de exibição). */
    getDiscord: () => api.get<{ discord_tag: string | null }>("/profiles/me/discord"),
  },

  players: {
    /** Busca jogadores pelo Riot ID (parcial) — substitui a leitura de contas_riot. */
    search: (q: string) => api.get<ApiLegacyRiotAccount[]>(`/players/search?q=${encodeURIComponent(q)}`),
    /** Lote de contas Riot por user_id (lista de times/painel). */
    byIds: (ids: string[]) => api.get<ApiLegacyRiotAccount[]>(`/players/by-ids?ids=${ids.join(",")}`),
    /** Conta Riot por PUUID (público) — checa vínculo já existente. */
    byPuuid: (puuid: string) => api.get<ApiLegacyRiotAccount | null>(`/players/by-puuid/${puuid}`),
    /** Total de contas Riot vinculadas (dashboard admin). */
    count: () => api.get<{ count: number }>("/players/count"),
    /** Grava elo_cache de contas exibidas (refresh de cache, autenticado). */
    refreshElo: (updates: { userId: string; eloCache: any }[]) =>
      api.post<{ ok: boolean }>("/players/refresh-elo", { updates }),
    /** Busca paginada com filtros (substitui RPC buscar_jogadores_filtrados). */
    filtrados: (params: { p_offset?: number; p_limit?: number; p_search?: string; p_elo_tier?: string; p_role_lane?: string } = {}) =>
      api.get<Array<ApiLegacyRiotAccount & { total_count: number; rank: number }>>(
        `/players/filtrados${qs({ p_offset: params.p_offset, p_limit: params.p_limit, p_search: params.p_search, p_elo_tier: params.p_elo_tier, p_role_lane: params.p_role_lane })}`
      ),
  },

  discord: {
    /** Gera um estado OAuth (CSRF token) para vincular Discord. */
    createState: () => api.post<{ state: string }>("/discord/state"),
    /** Valida o estado OAuth (não usado e dentro do TTL). */
    getState: (state: string) => api.get<ApiDiscordStateResult>(`/discord/state/${state}`),
    /** Vincula o Discord do usuário logado (identidade + tag). */
    link: (data: { state: string; discordId: string; discordTag: string }) =>
      api.post<{ ok: boolean }>("/discord/link", data),
  },

  adminCargos: {
    /** Lista usuários com cargo (substitui RPC listar_admins_com_email). */
    listar: () => api.get<Array<{ id: string; user_id: string; email: string; display_name: string; cargo: string }>>("/admin/cargos"),
    /** Atualiza cargo de um usuário (substitui RPC atualizar_cargo_usuario). */
    atualizar: (userId: string, cargo: string) =>
      api.put<{ ok: boolean }>(`/admin/cargos/${userId}`, { p_cargo: cargo }),
  },

  adminFinanceiro: {
    /** Visão financeira do painel (ADR-032): faturamento/saques/lucro/MC. */
    get: (periodo: 'today' | '7' | '30' | 'all' = '30') =>
      api.get<ApiFinanceiro>(`/admin/financeiro?periodo=${periodo}`),
  },

  adminPunicoes: {
    /** Busca usuários por email/nome/Riot ID (aba Punições). */
    buscarUsuarios: (q: string) =>
      api.get<Array<{
        id: string;
        email: string;
        displayName: string;
        riotId: string | null;
        status: string;
        avatarUrl?: string | null;
      }>>(`/admin/usuarios?q=${encodeURIComponent(q)}`),
    /** Lista advertências de um usuário (histórico). */
    listarAdvertencias: (userId: string) =>
      api.get<Array<{
        id: string;
        userId: string;
        criadoPor: string | null;
        matchId: string | null;
        motivo: string;
        createdAt: string;
        removidoPor: string | null;
        removidoEm: string | null;
      }>>(`/admin/advertencias/${userId}`),
    /** Aplica advertência (criado_por = admin). 3 ativas → ban automático. */
    aplicarAdvertencia: (userId: string, motivo: string) =>
      api.post<{ ok: boolean; advertencias: number; banido: boolean }>("/admin/advertencias", { userId, motivo }),
    /** Remove advertência (deixa de contar). Não desbana sozinho. */
    removerAdvertencia: (id: string) =>
      api.delete<{ ok: boolean; advertencias: number }>(`/admin/advertencias/${id}`),
    /** Ban manual (permanente até desbanir). */
    banir: (userId: string, motivo: string) =>
      api.post<{ ok: boolean }>(`/admin/usuarios/${userId}/ban`, { motivo }),
    /** Desban (única forma de sair do ban, inclusive o automático). */
    desbanir: (userId: string) =>
      api.post<{ ok: boolean }>(`/admin/usuarios/${userId}/unban`),
  },

  prints: {
    /** Envia o print de prova de uma partida apostada (bucket privado match-prints). */
    upload: (matchId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "match-prints");
      form.append("path", matchId);
      return api.post<{ url: string; printId: string }>("/upload", form);
    },
    /** Lista os prints da partida (participante ou revisor). */
    list: (matchId: string) => api.get<ApiPrint[]>(`/prints/${matchId}`),
    /** URL autenticada do arquivo — o <img> reenvia o cookie httpOnly. */
    file: (id: string) => `/api/prints/${id}/arquivo`,
  },

  disputas: {
    /** Abre contestação de resultado (1 por jogador por partida, §6.1). */
    abrir: (matchId: string, motivo: string, contestacaoUrl?: string) =>
      api.post<{ ok: boolean }>(`/disputas/${matchId}`, { motivo, contestacao_url: contestacaoUrl }),
    /** Lista as disputas da partida (participante ou revisor). */
    list: (matchId: string) => api.get<ApiDisputa[]>(`/disputas/${matchId}`),
  },

  revisao: {
    /** Fila de salas em `aguardando_revisao` por antiguidade (design v3 §6). */
    pendentes: () => api.get<ApiRevisaoSala[]>("/revisao/pendentes"),
    /** Decide a partida: 'blue' | 'red' | 'draw' | 'cancel', com decisionId idempotente. */
    decidir: (id: string, data: { winnerSide: 'blue' | 'red' | 'draw' | 'cancel'; decisionId: string }) =>
      api.post<ApiDecisaoResultado>(`/revisao/${id}/decidir`, data),
    /** Disputas abertas em partidas encerradas (spec verificacao-partida-riot). */
    disputas: () => api.get<ApiDisputaAdmin[]>("/revisao/disputas"),
    /** Decide uma contestação: procedente → estorna e cancela; improcedente → fecha. */
    decidirDisputa: (id: string, data: { procedente: boolean }) =>
      api.post<{ ok: boolean; procedente: boolean }>(`/revisao/disputas/${id}/decidir`, data),
  },
};
