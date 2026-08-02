/**
 * M7Arena API SDK Client (ADR-010 / ADR-011)
 * Cliente HTTP tipado para comunicação do front-end Vite com a API Node própria.
 * Substitui o cliente GoTrue / Supabase.
 */

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

export interface ApiTeamsSdk {
  list: (params?: { page?: number; limit?: number; search?: string; sort?: string; dir?: string }) => Promise<ApiTeamListResult>;
  detail: (id: string) => Promise<ApiLegacyTeamDetail>;
  batch: (ids: string[]) => Promise<ApiTeamBatchItem[]>;
  byUser: (userId: string) => Promise<ApiUserTeams>;
  members: (params: { user_ids?: string[]; guest_riot_ids?: string[] }) => Promise<ApiMemberRow[]>;
  create: (data: {
    nome: string;
    tag: string;
    logo_url?: string | null;
    gradient_from?: string;
    gradient_to?: string;
    whatsapp?: string | null;
    discord?: string | null;
  }) => Promise<ApiLegacyTeam>;
  update: (id: string, data: Partial<{
    nome: string;
    tag: string;
    logo_url: string | null;
    gradient_from: string | null;
    gradient_to: string | null;
    whatsapp: string | null;
    discord: string | null;
  }>) => Promise<ApiLegacyTeam>;
  leave: (id: string) => Promise<{ ok: boolean; deleted?: boolean }>;
  removeMemberships: () => Promise<{ ok: boolean }>;
  invites: () => Promise<ApiLegacyInvite[]>;
  createInvite: (data: {
    time_id: string;
    para_user_id?: string | null;
    riot_id?: string | null;
    role: string;
    mensagem?: string | null;
    tipo: string;
  }) => Promise<ApiLegacyInvite>;
  clearInvites: (ids: string[]) => Promise<{ ok: boolean }>;
  acceptInvite: (id: string) => Promise<{ ok: boolean }>;
  declineInvite: (id: string) => Promise<{ ok: boolean }>;
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

export interface ApiTournamentsSdk {
  list: (params?: { status?: string; criado_por?: string; ids?: string[]; sort?: string }) => Promise<ApiLegacyTournament[]>;
  detail: (id: string) => Promise<ApiLegacyTournament>;
  create: (data: Partial<ApiLegacyTournament>) => Promise<ApiLegacyTournament>;
  update: (id: string, data: Partial<ApiLegacyTournament>) => Promise<ApiLegacyTournament>;
  remove: (id: string) => Promise<{ ok: boolean }>;
  /** Inscreve um time (substitui RPC registrar_time_campeonato). */
  inscreverTime: (id: string, teamEntry: Record<string, unknown>) => Promise<ApiLegacyTournament>;
  /** Aprova/rejeita um time inscrito (substitui RPC aprovar_time_campeonato). */
  aprovarTime: (id: string, teamId: string, aprovar?: boolean) => Promise<ApiLegacyTournament>;
  /** Reabre o campeonato (substitui RPC reabrir_campeonato). */
  reabrir: (id: string) => Promise<ApiLegacyTournament>;
  /** Atualiza o cronograma inteiro (substitui RPC atualizar_cronograma_campeonato). */
  atualizarCronograma: (id: string, cronograma: any[]) => Promise<ApiLegacyTournament>;
  /** Merge atômico de jogos no cronograma (substitui RPC merge_jogos_cronograma). */
  mergeCronograma: (id: string, jogos: any[]) => Promise<ApiLegacyTournament>;
  /** Recalcula PDL global (substitui RPC recalcular_pdl_global). */
  recalcularPdl: (id: string) => Promise<{ ok: boolean }>;
}

/**
 * Shape legado de `salas` que as telas de Jogar/SalaMod1 consomem (ADR-005/010).
 * `id` é o `sala_num` público (numérico) — o fork navega em `/sala-mod1/:id`,
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
  jogadores: ApiLegacySalaJogador[];
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
  join: (id: number, data: { side?: string; slot?: number; roleSlot?: string; is_time_a?: boolean }) => Promise<ApiSalaResultado>;
  leave: (id: number) => Promise<ApiSalaResultado>;
  confirm: (id: number) => Promise<ApiSalaResultado>;
  recusar: (id: number) => Promise<ApiSalaResultado>;
  tick: (id: number) => Promise<ApiSalaResultado>;
  start: (id: number) => Promise<ApiSalaResultado>;
  finalizar: (id: number) => Promise<ApiSalaResultado>;
  reportResult: (id: number, data: { winnerSide: 'A' | 'B' | 'empate' | 'blue' | 'red' | 'draw' }) => Promise<ApiSalaResultado>;
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

  auth: {
    login: (email: string, password: string) =>
      api.post<{ user: ApiUser }>("/auth/login", { email, password }),
    register: (data: { email: string; password: string; displayName: string }) =>
      api.post<{ user: ApiUser }>("/auth/register", data),
    logout: () => api.post<{ success: boolean }>("/auth/logout"),
    me: () => api.get<{ user: ApiUser | null }>("/auth/me"),
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
    join: (id: number, data: { side?: string; slot?: number; roleSlot?: string; is_time_a?: boolean }) =>
      api.post<ApiSalaResultado>(`/matches/${id}/join`, data),
    leave: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/leave`),
    confirm: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/confirm`),
    recusar: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/recusar`),
    tick: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/tick`),
    start: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/start`),
    finalizar: (id: number) => api.post<ApiSalaResultado>(`/matches/${id}/finalizar`),
    reportResult: (id: number, data: { winnerSide: 'A' | 'B' | 'empate' | 'blue' | 'red' | 'draw' }) =>
      api.post<ApiSalaResultado>(`/matches/${id}/report-result`, data),
  } as ApiMatchesSdk,
};
