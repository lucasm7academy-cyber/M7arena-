/**
 * mappers.ts — conversão entre o shape legado da API (snake_case) e o shape de
 * UI (camelCase) do fork. Funções puras, tipadas (ADR-046).
 */
import type { Tournament } from "./types";

/** Shape de exibição: Tournament + campos computados derivados do payload. */
export interface TournamentView extends Tournament {
  subtitulo: string;
  descricao: string;
  premio: string;
  org: string;
  regras: string[];
}

export function mapFromDb(row: any): TournamentView {
  return {
    id: row.id,
    titulo: row.titulo,
    frase: row.frase,
    formato: row.formato || 'mata_mata',
    status: row.status || 'inscricoes_em_breve',
    vagas: row.vagas || 16,
    timesPorGrupo: row.times_por_grupo,
    classificadosPorGrupo: row.classificados_por_grupo,
    tier: row.tier || 'Free Elo',
    data: row.data || '—',
    premiacao: row.premiacao || '',
    taxa: row.taxa || '',
    temOutrosPremios: row.tem_outros_premios || false,
    outrosPremios: row.outros_premios || '',
    logoUrl: row.logo_url || '',
    bannerUrl: row.banner_url || '',
    orgPhotoUrl: row.org_photo_url || '',
    regulamento: row.regulamento || '',
    themeColor: row.theme_color || '#FFB700',
    grupos: row.grupos || {},
    cronograma: row.cronograma || [],
    gruposSorteados: row.grupos_sorteados || false,
    chavesSorteados: row.chaves_sorteados || false,
    timesInscritos: row.times_inscritos || [],
    classificacao: row.classificacao || [],
    timesOrdemSorteio: row.times_ordem_sorteio || [],
    criadoPor: row.criado_por || null,
    organizacao: row.organizacao || '',
    // Computed display fields
    subtitulo: `Torneio de LoL ${row.vagas || 16}v${row.vagas || 16}`,
    descricao: row.frase || 'Vagas limitadas, premiação em Pix e o melhor do competitivo de LoL. Monte seu time e garanta sua vaga.',
    premio: (row.premiacao || '') + (row.tem_outros_premios ? ' + Outros Prêmios' : ''),
    org: row.organizacao || 'M7 ARENA',
    regras: [
      'Respeito absoluto entre os jogadores.',
      'Proibido o uso de qualquer software de auxílio.',
      'Atraso máximo de 10 minutos por partida.',
      'Conexão estável é de responsabilidade do jogador.',
    ],
  };
}

export function toDbPayload(updated: Tournament): Record<string, any> {
  return {
    titulo: updated.titulo,
    frase: updated.frase,
    formato: updated.formato,
    status: updated.status,
    vagas: Number(updated.vagas) || 16,
    times_por_grupo: updated.timesPorGrupo ?? null,
    classificados_por_grupo: updated.classificadosPorGrupo ?? null,
    tier: updated.tier,
    data: updated.data,
    premiacao: updated.premiacao,
    taxa: updated.taxa,
    tem_outros_premios: updated.temOutrosPremios || false,
    outros_premios: updated.outrosPremios,
    logo_url: updated.logoUrl,
    banner_url: updated.bannerUrl,
    org_photo_url: updated.orgPhotoUrl,
    organizacao: updated.organizacao ?? null,
    regulamento: updated.regulamento,
    theme_color: updated.themeColor || '#FFB700',
    grupos: updated.grupos || {},
    cronograma: updated.cronograma || [],
    grupos_sorteados: updated.gruposSorteados || false,
    chaves_sorteados: updated.chavesSorteados || false,
    times_inscritos: updated.timesInscritos || [],
    classificacao: updated.classificacao || [],
    times_ordem_sorteio: updated.timesOrdemSorteio || [],
  };
}
