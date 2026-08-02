// src/config/adminPermissoes.ts
// Definição de cargos e permissões da plataforma.
// Hierarquia: proprietario > admin > streamer > coach > jogador

// ─────────────────────────────────────────────────────────────────────────────
// CARGOS
// ─────────────────────────────────────────────────────────────────────────────

/** Hierarquia: proprietario > admin > organizador > streamer > coach > jogador (padrão) */
export type CargoAdmin = 'proprietario' | 'admin' | 'organizador' | 'streamer' | 'coach' | 'jogador';

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSÕES
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissoesAdmin {
  /** Pode gerenciar saldos de MPoints de jogadores */
  gerenciarSaldos: boolean;
  /** Pode votar no vencedor de partidas em disputa */
  resolverPartidas: boolean;
  /** Pode cancelar uma partida (sem declarar vencedor) */
  cancelarPartidas: boolean;
  /** Pode promover / rebaixar / remover admins, streamers e coaches */
  gerenciarCargos: boolean;
  /** Pode expulsar jogadores da plataforma */
  expulsarJogadores: boolean;
  /** Pode criar salas manualmente pelo painel */
  criarSalas: boolean;
  /** Pode ver todos os logs de ações administrativas */
  verTodosLogs: boolean;
  /** Pode ver o código da partida em aguardando_inicio */
  verCodigoPartida: boolean;
  /** Pode criar campeonatos e gerenciar OS PRÓPRIOS (organizador) */
  criarCampeonatos: boolean;
}

export const PERMISSOES_POR_CARGO: Record<CargoAdmin, PermissoesAdmin> = {
  proprietario: {
    gerenciarSaldos:   true,
    resolverPartidas:  true,
    cancelarPartidas:  true,
    gerenciarCargos:   true,
    expulsarJogadores: true,
    criarSalas:        true,
    verTodosLogs:      true,
    verCodigoPartida:  true,
    criarCampeonatos:  true,
  },
  admin: {
    gerenciarSaldos:   true,
    resolverPartidas:  true,
    cancelarPartidas:  true,
    gerenciarCargos:   false,
    expulsarJogadores: true,
    criarSalas:        true,
    verTodosLogs:      true,
    verCodigoPartida:  true,
    criarCampeonatos:  true,
  },
  // Organizador: gerencia APENAS os próprios campeonatos. Sem poderes de
  // plataforma (saldos, elo, cargos, salas, outros campeonatos).
  organizador: {
    gerenciarSaldos:   false,
    resolverPartidas:  false,
    cancelarPartidas:  false,
    gerenciarCargos:   false,
    expulsarJogadores: false,
    criarSalas:        false,
    verTodosLogs:      false,
    verCodigoPartida:  false,
    criarCampeonatos:  true,
  },
  streamer: {
    gerenciarSaldos:   false,
    resolverPartidas:  false,
    cancelarPartidas:  false,
    gerenciarCargos:   false,
    expulsarJogadores: false,
    criarSalas:        false,
    verTodosLogs:      false,
    verCodigoPartida:  true,
    criarCampeonatos:  false,
  },
  coach: {
    gerenciarSaldos:   false,
    resolverPartidas:  false,
    cancelarPartidas:  false,
    gerenciarCargos:   false,
    expulsarJogadores: false,
    criarSalas:        false,
    verTodosLogs:      false,
    verCodigoPartida:  true,
    criarCampeonatos:  false,
  },
  jogador: {
    gerenciarSaldos:   false,
    resolverPartidas:  false,
    cancelarPartidas:  false,
    gerenciarCargos:   false,
    expulsarJogadores: false,
    criarSalas:        false,
    verTodosLogs:      false,
    verCodigoPartida:  false,
    criarCampeonatos:  false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Verifica se um cargo tem determinada permissão. */
export function temPermissao(
  cargo: CargoAdmin | null | undefined,
  permissao: keyof PermissoesAdmin,
): boolean {
  if (!cargo) return false;
  return PERMISSOES_POR_CARGO[cargo]?.[permissao] ?? false;
}

/** Verifica se cargoA pode gerenciar cargoB (hierarquia). */
export function podeGerenciar(cargoA: CargoAdmin, cargoB: CargoAdmin): boolean {
  const ordem: CargoAdmin[] = ['jogador', 'coach', 'streamer', 'organizador', 'admin', 'proprietario'];
  return ordem.indexOf(cargoA) > ordem.indexOf(cargoB);
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS E CORES (para UI)
// ─────────────────────────────────────────────────────────────────────────────

export const CARGO_LABELS: Record<CargoAdmin, string> = {
  proprietario: 'Proprietário',
  admin:        'Admin',
  organizador:  'Organizador',
  streamer:     'Streamer',
  coach:        'Coach',
  jogador:      'Jogador',
};

export const CARGO_COLORS: Record<CargoAdmin, { text: string; bg: string; border: string }> = {
  proprietario: { text: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/20' },
  admin:        { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20'    },
  organizador:  { text: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20' },
  streamer:     { text: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20' },
  coach:        { text: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20'   },
  jogador:      { text: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/20'  },
};
