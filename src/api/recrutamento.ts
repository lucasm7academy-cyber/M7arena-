import { Recrutamento, RecrutamentoInput, RoleRecrutamento } from '../types/recrutamento';

export interface TimeParaRecrutamento {
  id: string;
  nome: string;
  tag: string;
}

export async function fetchRecruitments(): Promise<Recrutamento[]> {
  try {
    const res = await fetch('/api/recrutamento');
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

export async function fetchRecruitmentsByRole(role: RoleRecrutamento): Promise<Recrutamento[]> {
  try {
    const res = await fetch(`/api/recrutamento?role=${role}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

export async function createRecruitment(input: RecrutamentoInput, userId: string): Promise<Recrutamento> {
  const res = await fetch('/api/recrutamento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });
  if (!res.ok) throw new Error('Erro ao criar vaga');
  return await res.json();
}

export async function updateRecruitment(id: string, input: RecrutamentoInput, userId: string): Promise<Recrutamento> {
  const res = await fetch(`/api/recrutamento/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar vaga');
  return await res.json();
}

export async function deleteRecruitment(id: string, userId: string): Promise<void> {
  const res = await fetch(`/api/recrutamento/${id}?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao remover vaga');
}

export async function fetchMyTeamsForRecrutamento(userId: string): Promise<TimeParaRecrutamento[]> {
  try {
    const res = await fetch(`/api/times?userId=${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.times || [];
  } catch {
    return [];
  }
}
