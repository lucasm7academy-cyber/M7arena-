// src/types/recrutamento.ts
// Tipos, constantes e validadores do sistema de recrutamento

// ── Constantes ────────────────────────────────────────────────────────────────

export const ROLES_DISPONIVEIS = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;
export type RoleRecrutamento = typeof ROLES_DISPONIVEIS[number];

export const ELOS_ORDENADOS = [
  'Ferro',
  'Bronze',
  'Prata',
  'Ouro',
  'Platina',
  'Esmeralda',
  'Diamante',
  'Mestre',
  'Grão-Mestre',
  'Desafiante',
] as const;
export type EloRecrutamento = typeof ELOS_ORDENADOS[number];

/** Lista de elos para selects (alias legível) */
export const TIER_LIST: readonly string[] = ELOS_ORDENADOS;

/** Configuração visual de cada role para a UI de recrutamento */
export const RECRUITMENT_ROLES: { value: RoleRecrutamento; label: string; img: string }[] = [
  { value: 'TOP', label: 'Top',     img: '/lanes_brancas/Top_iconB.png' },
  { value: 'JG',  label: 'Jungle',  img: '/lanes_brancas/Jungle_iconB.png' },
  { value: 'MID', label: 'Mid',     img: '/lanes_brancas/Middle_iconB.png' },
  { value: 'ADC', label: 'ADC',     img: '/lanes_brancas/Bottom_iconB.png' },
  { value: 'SUP', label: 'Suporte', img: '/lanes_brancas/Support_iconB.png' },
];

// ── Tipos principais ──────────────────────────────────────────────────────────

/** Dados do time joinados na busca */
export interface TimeResumo {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from?: string;
  gradient_to?: string;
  ranking?: number;
  pdl?: number;
}

/** Post de recrutamento conforme retornado do banco */
export interface Recrutamento {
  id: number;
  time_id: string;
  criado_por: string;
  role: RoleRecrutamento;
  elo_min: EloRecrutamento;
  elo_max: EloRecrutamento;
  discord: string;
  descricao: string;
  horarios?: string | null;
  ativo: boolean;
  created_at: string;
  // join com times
  time?: TimeResumo;
}

/** Alias para compatibilidade com design anterior */
export type RecruitmentPost = Recrutamento;

/** Input de criação/atualização */
export interface RecrutamentoInput {
  time_id: string;
  role: RoleRecrutamento;
  elo_min: EloRecrutamento;
  elo_max: EloRecrutamento;
  discord: string;
  descricao: string;
  horarios?: string;
}

// ── Validadores ───────────────────────────────────────────────────────────────

/** Verifica se a role é válida */
export function isValidRole(role: string): role is RoleRecrutamento {
  return ROLES_DISPONIVEIS.includes(role as RoleRecrutamento);
}

/**
 * Verifica se o WhatsApp está no formato BR correto.
 * Aceita: (11) 91234-5678, (11) 1234-5678, 11912345678, 1112345678, etc.
 * Retorna apenas dígitos para comparação.
 */
export function normalizeWhatsapp(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** Valida WhatsApp BR: DDD (2 dígitos) + número (8 ou 9 dígitos, com o 9 obrigatório). */
export function isValidWhatsapp(whatsapp: string): boolean {
  const digits = normalizeWhatsapp(whatsapp);
  if (digits.length === 0) return false;
  // 11 dígitos = DDD(2) + 9 + 8 dígitos (celular com 9)
  // 10 dígitos = DDD(2) + 8 dígitos (fixo / celular antigo sem 9)
  return digits.length === 10 || digits.length === 11;
}

/**
 * Máscara visual para telefone BR.
 * Entrada: "11912345678" → "(11) 91234-5678"
 *          "1112345678"  → "(11) 1234-5678"
 */
export function maskWhatsapp(value: string): string {
  const d = normalizeWhatsapp(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Verifica se elo_min é menor ou igual a elo_max */
export function isValidEloRange(eloMin: string, eloMax: string): boolean {
  const idxMin = ELOS_ORDENADOS.indexOf(eloMin as EloRecrutamento);
  const idxMax = ELOS_ORDENADOS.indexOf(eloMax as EloRecrutamento);
  if (idxMin === -1 || idxMax === -1) return false;
  return idxMin <= idxMax;
}

/** Valida o input completo e retorna a lista de erros */
export function validarRecrutamentoInput(input: Partial<RecrutamentoInput>): string[] {
  const erros: string[] = [];

  if (!input.time_id) erros.push('Selecione um time.');
  if (!input.role || !isValidRole(input.role)) erros.push('Selecione uma posição válida.');
  if (!input.elo_min) erros.push('Selecione o elo mínimo.');
  if (!input.elo_max) erros.push('Selecione o elo máximo.');
  if (input.elo_min && input.elo_max && !isValidEloRange(input.elo_min, input.elo_max)) {
    erros.push('Elo mínimo deve ser menor ou igual ao elo máximo.');
  }
  if (!input.discord) {
    erros.push('Informe o WhatsApp para contato.');
  } else if (!isValidWhatsapp(input.discord)) {
    erros.push('WhatsApp inválido. Use o formato (DDD) 9XXXX-XXXX.');
  }
  if (!input.descricao || input.descricao.trim().length < 10) {
    erros.push('Descrição muito curta (mínimo 10 caracteres).');
  }
  if (input.descricao && input.descricao.trim().length > 500) {
    erros.push('Descrição muito longa (máximo 500 caracteres).');
  }

  return erros;
}
