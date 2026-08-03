// src/api/recrutamento.ts
// Funções de acesso ao banco para o sistema de recrutamento (SEM Realtime)

import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import {
  Recrutamento,
  RecrutamentoInput,
  RoleRecrutamento,
  validarRecrutamentoInput,
} from '../types/recrutamento';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIME_SELECT = 'id, nome, tag, logo_url, gradient_from, gradient_to, ranking, pdl';

const RECRUTAMENTO_SELECT = `
  id,
  time_id,
  criado_por,
  role,
  elo_min,
  elo_max,
  discord,
  descricao,
  horarios,
  ativo,
  created_at,
  time:times ( ${TIME_SELECT} )
`.trim();

function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

// ── Funções públicas ──────────────────────────────────────────────────────────

/** Busca todos os posts de recrutamento ativos dos últimos 7 dias. */
export async function fetchRecruitments(): Promise<Recrutamento[]> {
  const { data, error } = await supabase
    .from('recrutamentos')
    .select(RECRUTAMENTO_SELECT)
    .eq('ativo', true)
    .gte('created_at', cutoffDate())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[recrutamento] fetchRecruitments:', error.message);
    return [];
  }
  return (data ?? []) as unknown as Recrutamento[];
}

/** Busca posts de recrutamento ativos filtrando por posição (role). */
export async function fetchRecruitmentsByRole(role: RoleRecrutamento): Promise<Recrutamento[]> {
  const { data, error } = await supabase
    .from('recrutamentos')
    .select(RECRUTAMENTO_SELECT)
    .eq('ativo', true)
    .eq('role', role)
    .gte('created_at', cutoffDate())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[recrutamento] fetchRecruitmentsByRole:', error.message);
    return [];
  }
  return (data ?? []) as unknown as Recrutamento[];
}

/** Cria um novo post de recrutamento. */
export async function createRecruitment(
  input: RecrutamentoInput,
  userId: string,
): Promise<Recrutamento | null> {
  const erros = validarRecrutamentoInput(input);
  if (erros.length > 0) {
    throw new Error(erros.join(' | '));
  }

  const { data, error } = await supabase
    .from('recrutamentos')
    .insert({
      time_id:    input.time_id,
      criado_por: userId,
      role:       input.role,
      elo_min:    input.elo_min,
      elo_max:    input.elo_max,
      discord:    input.discord.trim(),
      descricao:  input.descricao.trim(),
      horarios:   input.horarios?.trim() ?? null,
      ativo:      true,
    })
    .select(RECRUTAMENTO_SELECT)
    .single();

  if (error) {
    console.error('[recrutamento] createRecruitment:', error.message);
    throw new Error(error.message);
  }
  return data as unknown as Recrutamento;
}

/** Atualiza um post de recrutamento existente (verifica owner). */
export async function updateRecruitment(
  id: number,
  input: RecrutamentoInput,
  userId: string,
): Promise<Recrutamento | null> {
  const erros = validarRecrutamentoInput(input);
  if (erros.length > 0) throw new Error(erros.join(' | '));

  const { data: existing, error: checkError } = await supabase
    .from('recrutamentos')
    .select('criado_por')
    .eq('id', id)
    .single();

  if (checkError || !existing) throw new Error('Post não encontrado.');
  if (existing.criado_por !== userId) throw new Error('Você não tem permissão para editar este post.');

  const { data, error } = await supabase
    .from('recrutamentos')
    .update({
      time_id:   input.time_id,
      role:      input.role,
      elo_min:   input.elo_min,
      elo_max:   input.elo_max,
      discord:   input.discord.trim(),
      descricao: input.descricao.trim(),
      horarios:  input.horarios?.trim() ?? null,
    })
    .eq('id', id)
    .eq('criado_por', userId)
    .select(RECRUTAMENTO_SELECT)
    .single();

  if (error) {
    console.error('[recrutamento] updateRecruitment:', error.message);
    throw new Error(error.message);
  }
  return data as unknown as Recrutamento;
}

/** Delete real do post (verifica owner via RLS + check extra). */
export async function deleteRecruitment(id: number, userId: string): Promise<boolean> {
  // Verifica ownership antes de deletar
  const { data: existing, error: checkError } = await supabase
    .from('recrutamentos')
    .select('criado_por')
    .eq('id', id)
    .single();

  if (checkError || !existing) throw new Error('Post não encontrado.');
  if (existing.criado_por !== userId) throw new Error('Você não tem permissão para remover este post.');

  const { error } = await supabase
    .from('recrutamentos')
    .delete()
    .eq('id', id)
    .eq('criado_por', userId);

  if (error) {
    console.error('[recrutamento] deleteRecruitment:', error.message);
    throw new Error(error.message);
  }
  return true;
}

/** Times do usuário para popular o select de "Selecione seu time". */
export interface TimeParaRecrutamento {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from?: string;
  gradient_to?: string;
}

export async function fetchMyTeamsForRecrutamento(userId: string): Promise<TimeParaRecrutamento[]> {
  const { memberships, teams } = await api.teams.byUser(userId);

  const timeIds = (memberships ?? []).map((m) => m.time_id);
  if (timeIds.length === 0) return [];

  const times = teams
    .filter((t) => timeIds.includes(t.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (times ?? []) as TimeParaRecrutamento[];
}
