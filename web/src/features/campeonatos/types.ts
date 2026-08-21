/**
 * types.ts — tipos do domínio de campeonatos (ADR-046).
 *
 * Shape de UI (camelCase) que o fork consome. A API devolve o shape legado
 * (snake_case) e `mappers.ts` converte; este módulo é a fonte dos contratos
 * usados pelas páginas, Context, hooks e componentes.
 */

export interface TeamRegistration {
  id: string;
  name: string;
  tag: string;
  status: string;
  paid?: boolean;
  discord?: string;
  whatsapp?: string;
  logo?: string | null;
  cor?: string;
  icone?: string;
}

export interface CronogramaJogo {
  id?: string;
  fase: string;
  timeA: string;
  timeB: string;
  status: string;
  data: string;
  hora: string;
  placar: string;
  proposedBy?: string;
  iconeA?: string;
  iconeB?: string;
  lastActionBy?: string;
}

export interface ClassificacaoEntry {
  rank: number;
  nome: string;
  tag: string;
  logo?: string | null;
  v: number;
  d: number;
  wo?: number;
  j: number;
  matches: number;
  cor: string;
  icone: string;
}

export interface Tournament {
  id: string;
  titulo: string;
  nome?: string;
  frase?: string | null;
  formato: string;
  status: string;
  vagas: number;
  timesPorGrupo?: number | null;
  classificadosPorGrupo?: number | null;
  tier?: string | null;
  data?: string | null;
  premiacao?: string | null;
  taxa?: string | null;
  temOutrosPremios?: boolean;
  outrosPremios?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  orgPhotoUrl?: string | null;
  regulamento?: string | null;
  themeColor: string;
  organizacao?: string | null;
  grupos: any;
  cronograma: CronogramaJogo[];
  gruposSorteados: boolean;
  chavesSorteados: boolean;
  timesInscritos: TeamRegistration[];
  classificacao: ClassificacaoEntry[];
  timesOrdemSorteio: string[];
  criadoPor?: string | null;
}

export interface BracketCell {
  t1: string;
  t2: string;
  s1: number;
  s2: number;
  winner: string | null;
  id?: string;
}

export interface BracketData {
  upper: Record<string, BracketCell[]>;
  lower: Record<string, BracketCell[]>;
  preFinal: BracketCell;
  grandFinal: BracketCell;
  side: {
    left: Record<string, BracketCell[]>;
    right: Record<string, BracketCell[]>;
    grandFinal: BracketCell;
  };
}
