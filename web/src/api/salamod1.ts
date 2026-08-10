// src/api/salamod1.ts
import { api, type ApiLegacySala, type ApiLegacySalaJogador } from '../lib/api';

export async function buscarsalas(salaId: number): Promise<ApiLegacySala | null> {
    try {
        return await api.matches.detail(salaId);
    } catch (error: any) {
        return null;
    }
}

export async function buscarJogadores(salaId: number): Promise<ApiLegacySalaJogador[]> {
    try {
        const sala = await api.matches.detail(salaId);
        return sala?.jogadores ?? [];
    } catch (error: any) {
        return [];
    }
}

// ════════════════════════════════════════════════════
// AÇÕES DA SALA — RPCs (servidor é a única autoridade)
// ════════════════════════════════════════════════════
// ⚠️ FASE 1: o cliente NÃO escreve mais em `salas` / `sala_jogadores`.
// Todas as RPCs identificam o usuário por auth.uid() no servidor —
// nunca enviamos user_id. Todas retornam jsonb { ok, erro, estado }.

export interface ResultadoSalaRpc {
    ok: boolean;
    erro: string | null;
    estado: string | null;
    mudou: boolean;
    /** `saldo_insuficiente` — quanto falta (design v3 §11). */
    faltam?: number;
    /** `ja_em_sala_apostada` — sala apostada ativa que segura a vaga do jogador. */
    salaNum?: number;
    /** `ja_em_sala_apostada` — modo da sala que segura a vaga (para montar `/sala/:modo/:id`). */
    salaModo?: string;
}

const IS_DEV = import.meta.env.DEV;

/** Normaliza o retorno da API para o contrato `{ ok, erro, estado, mudou }`. */
async function normalizarResultado(p: Promise<import('../lib/api').ApiSalaResultado>): Promise<ResultadoSalaRpc> {
    try {
        const r = await p;
        return {
            ok: r?.ok === true,
            erro: r?.erro ?? null,
            estado: r?.estado ?? null,
            mudou: r?.mudou === true,
            faltam: r?.faltam,
            salaNum: r?.sala_num,
            salaModo: r?.modo,
        };
    } catch (error: any) {
        if (IS_DEV) console.error(`❌ [Sala] ${error?.message}`);
        return { ok: false, erro: error?.message || 'rpc_falhou', estado: null, mudou: false };
    }
}

/** Entra (ou troca) de vaga. O servidor valida vaga ocupada / vínculo em outra
 *  sala E a senha quando a sala é privada (MORPH-001 — validação no servidor). */
export async function entrarNaVaga(salaId: number, role: string, isTimeA: boolean, senha?: string) {
    return normalizarResultado(api.matches.join(salaId, { roleSlot: role, is_time_a: isTimeA, senha }));
}

/** Confirma presença durante o estado `confirmacao`. */
export async function confirmarPresenca(salaId: number) {
    return normalizarResultado(api.matches.confirm(salaId));
}

/** Recusa a partida durante o estado `confirmacao` (reabre a sala). */
export async function recusarPresenca(salaId: number) {
    return normalizarResultado(api.matches.recusar(salaId));
}

/** Sai da vaga. O servidor decide se a saída é permitida. */
export async function sairDaVaga(salaId: number) {
    return normalizarResultado(api.matches.leave(salaId));
}

/**
 * Tick preguiçoso: pede ao servidor que reavalie os prazos da sala.
 * Idempotente — vários clientes podem chamar; o lock do servidor resolve.
 */
export async function tickSala(salaId: number) {
    return normalizarResultado(api.matches.tick(salaId));
}

/** Traduz os códigos de erro das RPCs para mensagens em português. */
const ERROS_SALA: Record<string, string> = {
    nao_autenticado: 'Você precisa estar logado para fazer isso.',
    sala_nao_encontrada: 'Sala não encontrada.',
    estado_invalido: 'A sala mudou de estado. Tente novamente.',
    vaga_ocupada: 'Essa vaga já foi preenchida.',
    ja_em_outra_sala: 'Você já está em uma partida em andamento — finalize ou saia dela primeiro.',
    nao_esta_na_sala: 'Você não está nesta sala.',
    ja_confirmado: 'Você já confirmou presença nesta sala.',
    nao_pode_sair: 'A partida já começou — você não pode sair agora.',
    senha_incorreta: 'Senha incorreta. Verifique e tente novamente.',
    rpc_falhou: 'Falha de comunicação com o servidor. Tente novamente.',
    // ── Elegibilidade de salas apostadas (design v3 §2.1) ──
    saldo_insuficiente: 'Saldo insuficiente.',
    riot_id_obrigatorio: 'Você precisa vincular seu Riot ID para jogar valendo MC.',
    ja_em_sala_apostada: 'Você já está em uma sala apostada.',
    termos_nao_aceitos: 'Você precisa aceitar os Termos de Uso antes de jogar valendo MC.',
    conta_banida: 'Sua conta foi banida — você não pode jogar partidas casuais nem apostadas.',
    conta_nao_encontrada: 'Conta não encontrada.',
    motivo_invalido: 'O motivo da contestação precisa ter pelo menos 5 caracteres.',
    ja_contestou: 'Você já contestou o resultado desta partida.',
    limite_prints: 'Limite de 3 prints por partida atingido.',
    nao_confirmado: 'Você precisa estar confirmado na sala para enviar print.',
    nao_participante: 'Você não é participante desta partida.',
    sala_casual: 'Esta sala não é uma partida apostada.',
};

export function traduzirErroSala(codigo: string | null | undefined): string {
    if (!codigo) return 'Ocorreu um erro inesperado. Tente novamente.';
    return ERROS_SALA[codigo] ?? 'Ocorreu um erro inesperado. Tente novamente.';
}

// ── CRIAR SALA ──────────────────────────────────────
export async function criarSala(
    dados: {
        nome: string;
        descricao: string;
        modo: string;
        mpoints: number;
        temSenha: boolean;
        senha?: string;
        maxJogadores: number;
        eloMinimo?: string;
        timeANome?: string;
        timeATag?: string;
        timeALogo?: string;
    },
    usuario: { id: string; nome: string; tag?: string; elo: string; role: string }
) {
    try {
        const data = await api.matches.create({
            mode: dados.modo,
            entryMp: dados.mpoints,
            nome: dados.nome,
            descricao: dados.descricao,
            temSenha: dados.temSenha,
            senha: dados.temSenha ? dados.senha : undefined,
            maxJogadores: dados.maxJogadores,
            eloMinimo: dados.eloMinimo,
            timeANome: dados.timeANome,
            timeATag: dados.timeATag,
            timeALogo: dados.timeALogo,
        });

        return {
            ...data,
            codigo: `#${String(data.id).padStart(6, '0')}`,
            jogadores: [],
            criadorId: data.criador_id,
            criadorNome: data.criador_nome,
            timeANome: data.time_a_nome,
            timeBNome: data.time_b_nome,
            temSenha: data.tem_senha,
            mpoints: data.mpoints,
            modo: data.modo,
            estado: data.estado,
            nome: data.nome,
            descricao: data.descricao || '',
            maxJogadores: data.max_jogadores,
            eloMinimo: data.elo_minimo,
            vencedor: data.vencedor,
            createdAt: new Date(data.created_at),
        };
    } catch (error: any) {
        // Nunca engola erro: o chamador traduz o código do servidor (ex.:
        // saldo_insuficiente, riot_id_obrigatorio) para o usuário.
        if (IS_DEV) console.error(`❌ [CriarSala] ${error?.message}`);
        throw error;
    }
}

// ============================================================
// TIPOS
// ============================================================

export interface Sala {
  id: number;
  modo: ModoJogo;
  nome: string;
  descricao?: string;
  codigo?: string;
  temSenha: boolean;
  senha?: string;
  estado: string;
  vencedor?: string | null;
  criadorId: string;
  criadorNome: string;
  maxJogadores: number;
  eloMinimo?: string;
  mpoints: number;
  jogadores?: any[];
  timeANome?: string;
  timeBNome?: string;
}

// ============================================================
// CONFIGURAÇÕES CENTRALIZADAS
// ============================================================

// MODOS DE JOGO
export type ModoJogo = '5v5' | 'aram' | '1v1' | 'time_vs_time';

export const MODOS_JOGO: Record<ModoJogo, {
  nome: string;
  icone: string;
  descricao: string;
  maxJogadores: number;
  bgImage?: string
  jogadoresPorTime: number;
  tipo: 'individual' | 'time';
  cor: string;
}> = {
  '5v5': {
    nome: '5v5 Clássico',
    icone: '🏆',
    descricao: 'Summoners Rift — o competitivo em sua forma mais pura',
    maxJogadores: 10,
    jogadoresPorTime: 5,
    tipo: 'individual',
    cor: '#fbbf24',
    bgImage: '/images/fundoCard5v5.png',
  },
  'aram': {
    nome: 'ARAM',
    icone: '🌉',
    descricao: 'Howling Abyss — partidas rápidas, ação do início ao fim',
    maxJogadores: 10,
    jogadoresPorTime: 5,
    tipo: 'individual',
    cor: '#3b82f6',
    bgImage: '/images/fundoCardAram.png',
  },
  '1v1': {
    nome: '1v1',
    icone: '⚔️',
    descricao: 'Howling Abyss — duelo individual, quem é o melhor?',
    maxJogadores: 2,
    jogadoresPorTime: 1,
    tipo: 'individual',
    cor: '#ef4444',
    bgImage: '/images/fundoCard1v1.png',
  },
  'time_vs_time': {
    nome: 'Time vs Time',
    icone: '🏅',
    descricao: 'Clã contra clã — disputa que vale ranking e orgulho',
    maxJogadores: 10,
    jogadoresPorTime: 5,
    tipo: 'time',
    cor: '#a855f7',
    bgImage: '/images/fundoCardTime.png',
  }
};

// M COINS — Sistema de apostas
export interface OpcaoMPoints {
  valor: number;
  label: string;
  cor: string;
}

export const OPCOES_MPOINTS: OpcaoMPoints[] = [
  { valor: 0,    label: 'Casual — sem aposta', cor: '#6b7280' },
  { valor: 100,  label: '100 MC',              cor: '#4ade80' },
  { valor: 200,  label: '200 MC',              cor: '#22d3ee' },
  { valor: 500,  label: '500 MC',              cor: '#a78bfa' },
  { valor: 1000, label: '1.000 MC',            cor: '#fbbf24' },
  { valor: 2000, label: '2.000 MC',            cor: '#f87171' },
];

export const getMPointsInfo = (valor: number): OpcaoMPoints =>
  OPCOES_MPOINTS.find(o => o.valor === valor) ?? OPCOES_MPOINTS[0];

// OPÇÕES DE ELO MÍNIMO
export const OPCOES_ELO = [
  { valor: '', label: 'Sem restrição' },
  { valor: 'Ferro', label: 'Ferro+' },
  { valor: 'Bronze', label: 'Bronze+' },
  { valor: 'Prata', label: 'Prata+' },
  { valor: 'Ouro', label: 'Ouro+' },
  { valor: 'Platina', label: 'Platina+' },
  { valor: 'Esmeralda', label: 'Esmeralda+' },
  { valor: 'Diamante', label: 'Diamante+' },
  { valor: 'Mestre', label: 'Mestre+' },
  { valor: 'Grão-Mestre', label: 'Grão-Mestre+' },
  { valor: 'Desafiante', label: 'Desafiante+' }
];

// ROLES
export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'RES';

export const ROLE_CONFIG: Record<Role, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png',           color: 'text-red-400',    bg: 'bg-red-400/10' },
  JG:  { label: 'JG',  img: '/lanes_brancas/Jungle_iconB.png',        color: 'text-green-400',  bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png',        color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png',        color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png',       color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  RES: { label: 'RES', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400',   bg: 'bg-gray-400/10' },
};

// FUNÇÕES UTILITÁRIAS
export const getMaxJogadoresPorModo = (modo: ModoJogo): number =>
  MODOS_JOGO[modo]?.maxJogadores || 10;

export const getModoInfo = (modo: ModoJogo | string) =>
  MODOS_JOGO[modo as ModoJogo] ?? MODOS_JOGO['5v5'];