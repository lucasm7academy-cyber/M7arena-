import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { useRole } from "../contexts/RoleContext";
import { usePerfilSafe } from "../contexts/PerfilContext";
import { useAuth } from "../contexts/AuthContext";
import {
  History,
  Eye,
  Trophy,
  Users,
  Calendar,
  Coins,
  ShieldCheck,
  ChevronLeft,
  List,
  GitBranch,
  MessageSquare,
  AlertCircle,
  FileText,
  X,
  Settings,
  Clock,
  CreditCard,
  UserCheck,
  Share2,
  Target,
  Swords,
  Sparkles,
  Ticket,
  Zap,
  Diamond,
  MessageCircle,
  Phone,
  Edit2,
  Check,
  CheckCircle2,
  Plus,
  Minus,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { api } from '../lib/api';

import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../components/campeonatos/cut-edge";
import { getIcon } from "../components/campeonatos/icons";
import { formatDayOfWeek, formatFullDate, formatDate } from "../components/campeonatos/dates";
import { GroupStage } from "../components/campeonatos/GroupStage";
import { DoubleSideBracket } from "../components/campeonatos/DoubleSideBracket";
import { DoubleEliminationBracket } from "../components/campeonatos/DoubleEliminationBracket";
import { VisaoGeral } from "../components/campeonatos/VisaoGeral";
import { Grupos } from "../components/campeonatos/Grupos";
import { Cronograma } from "../components/campeonatos/Cronograma";
import { Chaves } from "../components/campeonatos/Chaves";
import { Historico } from "../components/campeonatos/Historico";
import { RegrasModal } from "../features/campeonatos/components/modals/RegrasModal";
import { BracketModal } from "../features/campeonatos/components/modals/BracketModal";

const CampeonatoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isBracketModalOpen, setIsBracketModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isScheduleEditModalOpen, setIsScheduleEditModalOpen] = useState(false);
  const [isAdminMatchModalOpen, setIsAdminMatchModalOpen] = useState(false);
  const [isPendingMatchesOpen, setIsPendingMatchesOpen] = useState(false);
  const [isAllPendingOpen, setIsAllPendingOpen] = useState(true);
  const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(
    null,
  );
  const [jogoStatusAtStart, setJogoStatusAtStart] = useState<string | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState({
    data: "",
    hora: "",
    action: "propose" as "propose" | "counter" | "accept" | "finish",
    placar: "",
  });
  const [adminMatchData, setAdminMatchData] = useState({
    timeA: "",
    timeB: "",
    fase: "Cronograma", // fase fixa — sem divisão de grupos/desempate/mata-mata
  });
  const [registrationData, setRegistrationData] = useState({
    teamId: "",
    discord: "",
    whatsapp: "",
  });
  const [isRegistered, setIsRegistered] = useState(false);
  const { role, cargo } = useRole();
  const { myTeam: perfilMyTeam } = usePerfilSafe();
  const { user } = useAuth();
  const isPlatformAdmin = role === "admin"; // proprietário/admin: manda em tudo
  // Fallback: time carregado diretamente quando perfilMyTeam ainda não chegou
  const [fallbackMyTeam, setFallbackMyTeam] = useState<any>(null);
  const isPlayer = role === "player";
  const effectiveRole = role;
  const currentTeamName = null;

  const testTeams: any[] = [];

  // Carregamento dos dados do campeonato
  const [campeonato, setCampeonato] = useState<any>(null);
  const [campeonatoLoading, setCampeonatoLoading] = useState(true);

  // Organizador é "admin" APENAS do campeonato que ele mesmo criou.
  const isOrganizerOwner =
    cargo === "organizador" && !!user && !!campeonato?.criadoPor && campeonato.criadoPor === user.id;
  // isAdmin do campeonato = admin da plataforma OU organizador-dono deste camp.
  const isAdmin = isPlatformAdmin || isOrganizerOwner;

  // Helper: map DB row → local tournament shape
  const mapFromDb = (row: any) => ({
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
  });

  // Helper: save tournament fields to Supabase (fire-and-forget)
  const saveToSupabase = (updated: any) => {
    const payload: any = {
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
    api.tournaments.update(updated.id, payload)
      .catch((error: any) => {
        console.error('Erro ao salvar campeonato:', error);
        // Feedback visível ao admin — antes só caía no console silencioso.
        if (typeof window !== 'undefined') {
          alert(
            `Falha ao salvar alterações do campeonato. ` +
            `Verifique sua conexão e tente novamente.\n\nDetalhe: ${error.message || error}`
          );
        }
      });
  };

  // Helper: save bracket to Supabase — agora reporta erros ao admin.
  const saveBracketToSupabase = (bracket: any) => {
    api.tournaments.update(id, { bracket_data: bracket })
      .catch((error: any) => {
        console.error('Erro ao salvar bracket:', error);
        if (typeof window !== 'undefined') {
          alert(
            `Falha ao salvar o chaveamento no servidor. ` +
            `Recarregue a página e tente novamente.\n\nDetalhe: ${error.message || error}`
          );
        }
      });
  };

  const INITIAL_BRACKET_DATA = {
    upper: {
      r64: Array(32)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r32: Array(16)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r16: Array(8)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      qf: Array(4)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      sf: Array(2)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      final: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null }],
    },
    lower: {
      r1: Array(16)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r2: Array(16)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r3: Array(8)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r4: Array(8)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r5: Array(4)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r6: Array(4)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      r7: Array(2)
        .fill(null)
        .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
      final: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null }],
    },
    preFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
    grandFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
    side: {
      left: {
        r64: Array(16)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `L_R64_${i}`,
          })),
        r32: Array(8)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `L_R32_${i}`,
          })),
        r16: Array(4)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `L_R16_${i}`,
          })),
        qf: Array(2)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `L_QF_${i}`,
          })),
        sf: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null, id: `L_SF_0` }],
      },
      right: {
        r64: Array(16)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `R_R64_${i}`,
          })),
        r32: Array(8)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `R_R32_${i}`,
          })),
        r16: Array(4)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `R_R16_${i}`,
          })),
        qf: Array(2)
          .fill(null)
          .map((_, i) => ({
            t1: "",
            t2: "",
            s1: 0,
            s2: 0,
            winner: null,
            id: `R_QF_${i}`,
          })),
        sf: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null, id: `R_SF_0` }],
      },
      grandFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
    },
  };

  const migrateBracketData = (data: any) => {
    if (!data) return INITIAL_BRACKET_DATA;
    const newData = JSON.parse(JSON.stringify(INITIAL_BRACKET_DATA));

    // Deep merge existing data into new structure
    const merge = (target: any, source: any) => {
      if (!source) return;
      Object.keys(source).forEach((key) => {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else if (Array.isArray(source[key])) {
          if (!target[key]) target[key] = [];
          source[key].forEach((item: any, i: number) => {
            if (target[key][i]) {
              if (item && typeof item === "object") {
                target[key][i] = { ...target[key][i], ...item };
              } else {
                target[key][i] = item;
              }
            }
          });
        } else {
          target[key] = source[key];
        }
      });
    };

    merge(newData, data);
    return newData;
  };

  // Estado para os jogos das chaves
  const [bracketData, setBracketData] = useState<any>(INITIAL_BRACKET_DATA);

  // --- Global Synchronization Logic ---
  const syncMatchToHistory = (
    matchData: any,
    type: "group" | "bracket" | "schedule",
  ) => {
    try {
      const saved = localStorage.getItem("m7_match_history");
      const history = (saved && saved !== "undefined") ? JSON.parse(saved) : [];
      const matchId =
        matchData.id ||
        `${id}-${type}-${matchData.t1 || matchData.timeA}-${matchData.t2 || matchData.timeB}-${matchData.timestamp || Date.now()}`;

      const newMatchRecord = {
        id: matchId,
        tournamentId: id,
        tournamentTitle: campeonato.titulo,
        t1: matchData.t1 || matchData.timeA,
        t2: matchData.t2 || matchData.timeB,
        s1:
          matchData.s1 !== undefined
            ? matchData.s1
            : parseInt(matchData.placar?.split(" - ")[0] || "0"),
        s2:
          matchData.s2 !== undefined
            ? matchData.s2
            : parseInt(matchData.placar?.split(" - ")[1] || "0"),
        winner:
          matchData.winner ||
          (matchData.status === "finalizado"
            ? parseInt(matchData.placar?.split(" - ")[0]) >
              parseInt(matchData.placar?.split(" - ")[1])
              ? matchData.timeA
              : matchData.timeB
            : null),
        type,
        fase: matchData.fase || matchData.round || "N/A",
        timestamp: new Date().toISOString(),
      };

      const existingIndex = history.findIndex((m: any) => m.id === matchId);
      if (existingIndex >= 0) {
        history[existingIndex] = newMatchRecord;
      } else {
        history.push(newMatchRecord);
      }

      localStorage.setItem("m7_match_history", JSON.stringify(history));
      updateGlobalTeamStats();
    } catch (e) {
      console.error("Error syncing match:", e);
    }
  };

  const updateGlobalTeamStats = () => {
    try {
      const saved = localStorage.getItem("m7_match_history");
      const history = (saved && saved !== "undefined") ? JSON.parse(saved) : [];
      const stats: any = {};

      history.forEach((match: any) => {
        [match.t1, match.t2].forEach((t) => {
          if (t && t !== "TBD" && !stats[t]) {
            stats[t] = {
              wins: 0,
              losses: 0,
              draws: 0,
              gp: 0,
              gc: 0,
              matches: 0,
            };
          }
        });

        if (!match.t1 || !match.t2 || match.t1 === "TBD" || match.t2 === "TBD")
          return;

        stats[match.t1].matches++;
        stats[match.t2].matches++;
        stats[match.t1].gp += match.s1;
        stats[match.t1].gc += match.s2;
        stats[match.t2].gp += match.s2;
        stats[match.t2].gc += match.s1;

        // Cada ponto no placar conta como vitória/derrota individual
        stats[match.t1].wins += match.s1;
        stats[match.t1].losses += match.s2;
        stats[match.t2].wins += match.s2;
        stats[match.t2].losses += match.s1;

        if (match.s1 === match.s2 && match.type === "group" && match.s1 === 0) {
          stats[match.t1].draws++;
          stats[match.t2].draws++;
        }
      });

      localStorage.setItem("m7_team_stats", JSON.stringify(stats));
    } catch (e) {
      console.error("Error updating team stats:", e);
    }
  };

  const sortStandings = (a: any, b: any) => {
    // 1. Saldo de vitórias (V − D) — Mais importante.
    //    Mais justo que vitórias brutas quando os times jogam números
    //    diferentes de partidas: um time eliminado que jogou mais (mais V e
    //    mais D) não fura a fila só por acumular vitórias.
    const saldoA = (a.v || 0) - (a.d || 0);
    const saldoB = (b.v || 0) - (b.d || 0);
    if (saldoB !== saldoA) return saldoB - saldoA;
    // 2. Menos Derrotas (quando o saldo empata, equivale a maior taxa de vitória)
    if (a.d !== b.d) return a.d - b.d;
    // 3. Mais Jogos (Participação)
    if (b.matches !== a.matches) return b.matches - a.matches;
    // 4. Alfabetico
    return (a.nome || "").localeCompare(b.nome || "");
  };

  const getDynamicStandings = () => {
    let baseClassificacao = campeonato.classificacao || [];

    const stats: any = {};
    const teams = (campeonato.timesInscritos || []).filter(
      (t: any) => t.status === "approved",
    );

    // If there are no approved teams, fallback to baseClassificacao completely
    if (teams.length === 0 && baseClassificacao.length > 0) {
      return baseClassificacao;
    }

    // Initialize all teams at 0 points
    teams.forEach((t: any) => {
      stats[t.tag] = {
        rank: 0,
        nome: t.name,
        tag: t.tag,
        logo: t.logo,
        v: 0,
        d: 0,
        j: 0,
        matches: 0,
        cor: t.cor || "#FFB700",
        icone: t.icone || "ShieldCheck",
      };
    });

    // Processar apenas do cronograma do torneio para ter sincronia perfeita
    let anyMatches = false;
    (campeonato.cronograma || []).forEach((jogo: any) => {
      if (jogo.status !== "finalizado") return;
      // A chave (bracket) é só visual: jogos "MATA-MATA (CHAVEAMENTO)" não
      // contam na classificação. Só o que é lançado no cronograma conta.
      if (jogo.fase === "MATA-MATA (CHAVEAMENTO)") return;
      anyMatches = true;

      const scores = (jogo.placar || "0 - 0").split(" - ");
      const s1 = parseInt(scores[0]) || 0;
      const s2 = parseInt(scores[1]) || 0;

      const teamAData = teams.find((t: any) =>
        t.tag === jogo.timeA || t.name === jogo.timeA || t.nome === jogo.timeA
      );
      const teamBData = teams.find((t: any) =>
        t.tag === jogo.timeB || t.name === jogo.timeB || t.nome === jogo.timeB
      );

      const tA = teamAData?.tag || jogo.timeA;
      const tB = teamBData?.tag || jogo.timeB;

      if (stats[tA]) {
        stats[tA].matches++;
        if (campeonato.formato === 'liga') {
          // Liga: conta partidas individuais (mapas) — 2-1 = 2V + 1D para o vencedor
          stats[tA].v += s1;
          stats[tA].d += s2;
          stats[tA].j += s1 + s2; // J = total de partidas/mapas jogados
        } else {
          // Mata-mata: conta resultado da série — quem vence a série ganha 1V
          stats[tA].j++;
          if (s1 > s2) {
            stats[tA].v++; // V = série vencida
          } else if (s1 < s2) {
            stats[tA].d++; // D = série perdida
          }
        }
      }
      if (stats[tB]) {
        stats[tB].matches++;
        if (campeonato.formato === 'liga') {
          // Liga: conta partidas individuais (mapas) — 2-1 = 1V + 2D para o perdedor
          stats[tB].v += s2;
          stats[tB].d += s1;
          stats[tB].j += s1 + s2;
        } else {
          // Mata-mata: conta resultado da série
          stats[tB].j++;
          if (s2 > s1) {
            stats[tB].v++;
          } else if (s2 < s1) {
            stats[tB].d++;
          }
        }
      }
    });

    const sorted = Object.values(stats)
      .sort(sortStandings)
      .map((t: any, i: number) => ({ ...t, rank: i + 1 }));

    // Se for mata_mata e houver classificação manual sem cronograma
    if (
      campeonato.formato === "mata_mata" &&
      !anyMatches &&
      baseClassificacao.length > 0
    ) {
      return baseClassificacao;
    }

    return sorted;
  };

  const checkAndAddTiebreakers = (
    currentCampeonato: any,
    groupName: string,
  ) => {
    // Only for group stages or similar formats where ties matter for advancement
    if (
      !groupName ||
      groupName === "Fase Final" ||
      groupName.includes("Chaves") ||
      groupName.includes("DESEMPATE")
    )
      return currentCampeonato;

    let groupTeamsRaw = [];
    if (Array.isArray(currentCampeonato.grupos)) {
      groupTeamsRaw =
        currentCampeonato.grupos.find((g: any) => g.name === groupName)
          ?.teams || [];
    } else if (
      typeof currentCampeonato.grupos === "object" &&
      currentCampeonato.grupos !== null
    ) {
      groupTeamsRaw = currentCampeonato.grupos[groupName] || [];
    }

    if (!groupTeamsRaw || groupTeamsRaw.length === 0) return currentCampeonato;

    // Ensure all regular matches in the group are finished before adding tiebreaker
    const allRegularMatchesFinished = (
      currentCampeonato.cronograma || []
    ).every((jogo: any) => {
      if (jogo.fase === groupName) {
        return jogo.status === "finalizado";
      }
      return true;
    });

    if (!allRegularMatchesFinished) return currentCampeonato;

    // Getcurrent standings for THIS group ONLY
    const groupStats: any = {};
    groupTeamsRaw.forEach((t: any) => {
      const tag = typeof t === "string" ? t : t.tag;
      const team = (currentCampeonato.timesInscritos || []).find(
        (ti: any) => ti.tag === tag,
      );
      if (team) {
        groupStats[team.tag] = {
          tag: team.tag,
          name: team.name,
          v: 0,
          d: 0,
          matches: 0,
          j: 0,
        };
      }
    });

    (currentCampeonato.cronograma || []).forEach((jogo: any) => {
      if (jogo.fase !== groupName || jogo.status !== "finalizado") return;
      const scores = (jogo.placar || "0 - 0").split(" - ");
      const s1 = parseInt(scores[0]) || 0;
      const s2 = parseInt(scores[1]) || 0;

      if (groupStats[jogo.timeA]) {
        groupStats[jogo.timeA].matches++;
        groupStats[jogo.timeA].v += s1;
        groupStats[jogo.timeA].d += s2;
        groupStats[jogo.timeA].j =
          groupStats[jogo.timeA].v + groupStats[jogo.timeA].d;
      }
      if (groupStats[jogo.timeB]) {
        groupStats[jogo.timeB].matches++;
        groupStats[jogo.timeB].v += s2;
        groupStats[jogo.timeB].d += s1;
        groupStats[jogo.timeB].j =
          groupStats[jogo.timeB].v + groupStats[jogo.timeB].d;
      }
    });

    const sorted = Object.values(groupStats).sort(
      (a: any, b: any) => b.v - a.v || a.d - b.d || a.matches - b.matches,
    );

    // Threshold for qualification (usually 1 or 2 per group)
    const classificadosThreshold =
      currentCampeonato.formato === "grupos_16_4_2" ? 2 : 1;

    // Check if there is a tie at the threshold boundary
    // For example, if 2 qualify, check if rank 2 and rank 3 have the same wins
    if (sorted.length > classificadosThreshold) {
      const lastQualifier = sorted[classificadosThreshold - 1] as any;
      const firstNonQualifier = sorted[classificadosThreshold] as any;

      if (lastQualifier.v === firstNonQualifier.v) {
        // We have a tie! Add a desempate match
        // But only if they don't already have a pending or finished "DESEMPATE" match
        const desempateExists = currentCampeonato.cronograma.some(
          (j: any) =>
            j.fase === `DESEMPATE - ${groupName}` &&
            ((j.timeA === lastQualifier.tag &&
              j.timeB === firstNonQualifier.tag) ||
              (j.timeB === lastQualifier.tag &&
                j.timeA === firstNonQualifier.tag)),
        );

        if (!desempateExists) {
          const tiebreakerMatch = {
            timeA: lastQualifier.tag,
            timeB: firstNonQualifier.tag,
            fase: `DESEMPATE - ${groupName}`,
            status: "combinando",
            data: "A COMBINAR",
            hora: "--:--",
            proposedBy: "ORGANIZAÇÃO",
            placar: "",
          };

          return {
            ...currentCampeonato,
            cronograma: [...currentCampeonato.cronograma, tiebreakerMatch],
          };
        }
      }
    }

    return currentCampeonato;
  };

  const advanceTeamsInBracket = (currentBracket: any, match: any, type: string, round: string, index: number, side?: string, teamsCount?: number) => {
    const next = JSON.parse(JSON.stringify(currentBracket));
    const bracketTeams = teamsCount || 16;
    const loser = match.winner === match.t1 ? match.t2 : match.t1;

    if (type === "upper") {
      const roundSequences: any = { r64: "r32", r32: "r16", r16: "qf", qf: "sf", sf: "final" };
      const nextRound = roundSequences[round];
      if (nextRound) {
        const nextIdx = Math.floor(index / 2);
        const slot = index % 2 === 0 ? "t1" : "t2";
        if (next.upper[nextRound] && next.upper[nextRound][nextIdx]) {
          next.upper[nextRound][nextIdx][slot] = match.winner;
        }
      } else if (round === "final") {
        if (next.grandFinal) next.grandFinal.t1 = match.winner;
      }

      // Logic for dropping to Lower based on standard Double Elimination flow
      if (next.lower) {
        let targetRound = "";
        let targetIdx = Math.floor(index / 2);
        let targetSlot: "t1" | "t2" = index % 2 === 0 ? "t1" : "t2";

        if (bracketTeams === 32) {
          const mappings: any = { r32: "r1", r16: "r3", qf: "r5", sf: "r7", final: "final" };
          targetRound = mappings[round];
          if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
          if (round === "final") targetSlot = "t1";
        } else if (bracketTeams === 16) {
          const mappings: any = { r16: "r1", qf: "r3", sf: "r5", final: "final" };
          targetRound = mappings[round];
          if (round === "qf") { targetIdx = index; targetSlot = "t2"; }
          if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
          if (round === "final") targetSlot = "t1";
        } else if (bracketTeams === 8) {
          const mappings: any = { qf: "r1", sf: "r3", final: "final" };
          targetRound = mappings[round];
          if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
          if (round === "final") targetSlot = "t2";
        }

        if (targetRound && next.lower[targetRound] && next.lower[targetRound][targetIdx]) {
          next.lower[targetRound][targetIdx][targetSlot] = loser;
        }
      }
    } else if (type === "lower") {
      const lowerSequences: any = { r1: "r2", r2: "r3", r3: "r4", r4: "r5", r5: "r6", r6: "r7", r7: "final" };
      const nextRound = lowerSequences[round];
      if (nextRound) {
        const currentCount = next.lower[round].length;
        const nextCount = next.lower[nextRound].length;
        if (currentCount === nextCount) {
          if (next.lower[nextRound][index]) next.lower[nextRound][index].t1 = match.winner;
        } else {
          const nextIdx = Math.floor(index / 2);
          const slot = index % 2 === 0 ? "t1" : "t2";
          if (next.lower[nextRound][nextIdx]) next.lower[nextRound][nextIdx][slot] = match.winner;
        }
      } else if (round === "final") {
        if (next.grandFinal) next.grandFinal.t2 = match.winner;
      }
    } else if (type === "side") {
      if (side !== "final") {
        const sequences: any = { r64: "r32", r32: "r16", r16: "qf", qf: "sf" };
        const nextRound = sequences[round];
        if (nextRound) {
            const nextIdx = (round === "qf") ? 0 : Math.floor(index / 2);
            const slot = index % 2 === 0 ? "t1" : "t2";
            if (next.side[side][nextRound] && next.side[side][nextRound][nextIdx]) {
                next.side[side][nextRound][nextIdx][slot] = match.winner;
            }
        } else if (round === "sf") {
            const slot = side === "left" ? "t1" : "t2";
            if (next.side.grandFinal) next.side.grandFinal[slot] = match.winner;
        }
      }
    }

    return next;
  };

  const handleBracketScoreChange = (
    type: string,
    side: string,
    round: string,
    index: number,
    teamSlot: "s1" | "s2" | "winner" | "t1" | "t2",
    delta: any,
  ) => {
    if (!isAdmin) return;

    // Usa cópia direta (não functional updater) para poder sincronizar com cronograma
    const next = JSON.parse(JSON.stringify(bracketData));
    let match: any;

    try {
      if (type === "grandFinal") match = next.grandFinal;
      else if (type === "side" && round === "grandFinal") match = next.side.grandFinal;
      else if (type === "side") match = next.side[side][round][index];
      else match = next[type][round][index];
    } catch (e) {
      console.error("Bracket update error", e);
      return;
    }

    if (!match) return;

    // Ajuste manual do time da vaga (admin trocando quem está na chave).
    // Reseta placar/vencedor para a vaga ficar limpa e não disparar avanço automático.
    if (teamSlot === "t1" || teamSlot === "t2") {
      match[teamSlot] = delta; // delta = tag do time (ou "" para esvaziar)
      match.s1 = 0;
      match.s2 = 0;
      match.winner = null;
      match.status = undefined;
      match.pdl_aplicado = false;
      saveBracketToSupabase(next);
      setBracketData(next);
      return;
    }

    if (teamSlot === "winner") {
      match.winner = delta;
    } else {
      match[teamSlot] = Math.max(0, (match[teamSlot] || 0) + delta);
      // MD3 para todas as rodadas, MD5 apenas na Grande Final
      const isFinal = type === "grandFinal" || round === "grandFinal";
      const threshold = isFinal ? 3 : 2;
      if (match.s1 >= threshold) match.winner = match.t1;
      else if (match.s2 >= threshold) match.winner = match.t2;
      else match.winner = null; // Bug 2 fix: limpa winner se score caiu abaixo do threshold
    }

    // ⚠️ CHAVE É APENAS VISUAL. Sem PDL, sem Histórico, sem Cronograma e sem
    // contar vitória/derrota em lugar nenhum. O organizador marca o vencedor só
    // para exibição. TODO o vínculo de vitórias/derrotas é feito pelo Cronograma.
    const temPlacar = (match.s1 || 0) > 0 || (match.s2 || 0) > 0;
    if (match.winner && temPlacar) {
      match.status = "finalizado"; // só estado visual do card
    } else {
      // 0-0 ou abaixo do MD: sem vencedor visual.
      match.status = undefined;
      match.winner = null;
    }

    saveBracketToSupabase(next);
    setBracketData(next);
  };

  // Refs e lógica para Drag-to-Scroll nas chaves
  const bracketRef = useRef<HTMLDivElement>(null);
  const modalBracketRef = useRef<HTMLDivElement>(null);

  const [bracketScale, setBracketScale] = useState(0.8);
  const [modalBracketScale, setModalBracketScale] = useState(0.8);

  const createDragHandlers = (
    ref: React.RefObject<HTMLDivElement>,
    setScale: React.Dispatch<React.SetStateAction<number>>,
  ) => {
    let isDown = false;
    let startX: number;
    let startY: number;
    let scrollLeft: number;
    let scrollTop: number;

    return {
      onMouseDown: (e: React.MouseEvent) => {
        if (!ref.current) return;
        isDown = true;
        ref.current.style.cursor = "grabbing";
        startX = e.pageX - ref.current.offsetLeft;
        startY = e.pageY - ref.current.offsetTop;
        scrollLeft = ref.current.scrollLeft;
        scrollTop = ref.current.scrollTop;
      },
      onMouseLeave: () => {
        isDown = false;
        if (ref.current) ref.current.style.cursor = "grab";
      },
      onMouseUp: () => {
        isDown = false;
        if (ref.current) ref.current.style.cursor = "grab";
      },
      onMouseMove: (e: React.MouseEvent) => {
        if (!isDown || !ref.current) return;
        e.preventDefault();
        const x = e.pageX - ref.current.offsetLeft;
        const y = e.pageY - ref.current.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        ref.current.scrollLeft = scrollLeft - walkX;
        ref.current.scrollTop = scrollTop - walkY;
      },
      onWheel: (e: React.WheelEvent) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.02 : 0.02;
        setScale((prev) => Math.min(Math.max(prev + delta, 0.4), 2.5));
      },
    };
  };

  const bracketHandlers = createDragHandlers(bracketRef, setBracketScale);
  const modalBracketHandlers = createDragHandlers(
    modalBracketRef,
    setModalBracketScale,
  );

  // Time do usuário — usa perfilMyTeam (do contexto) ou fallbackMyTeam (query direta)
  const myTeams = React.useMemo(() => {
    const team = perfilMyTeam || fallbackMyTeam;
    if (!team) return [];
    return [{
      id: team.id,
      nome: team.nome || team.name,
      tag: team.tag,
      logo: team.logoUrl || team.logo_url || null,
      cor: team.cor || team.gradientFrom || team.gradient_from || '#FFB700',
      gradientFrom: team.gradientFrom || team.gradient_from,
      gradientTo: team.gradientTo || team.gradient_to,
    }];
  }, [perfilMyTeam, fallbackMyTeam]);

  // Times disponíveis para o admin atribuir manualmente às vagas da chave.
  // Usa os times inscritos aprovados; grava sempre a tag (identificador canônico).
  const bracketAvailableTeams = React.useMemo(() => {
    const inscritos = (campeonato?.timesInscritos || []).filter(
      (t: any) => !t.status || t.status === "approved",
    );
    return inscritos
      .map((t: any) => ({
        tag: t.tag,
        nome: t.name || t.nome || t.tag,
        logo: t.logo || t.logo_url || t.logoUrl || "",
      }))
      .filter((t: any) => t.tag);
  }, [campeonato]);

  // 🔧 Chave é APENAS visual: nada de sincronizar com cronograma, PDL ou histórico.
  // O vínculo de vitórias/derrotas é 100% pelo Cronograma.

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setCampeonatoLoading(true);

    api.tournaments.detail(id)
      .then(async (data) => {
        if (cancelled) return;
        const mapped = mapFromDb(data);
        setCampeonato(mapped);
        if (data.bracket_data) {
          setBracketData(migrateBracketData(data.bracket_data));
        }
        setCampeonatoLoading(false);

        // Busca informações atualizadas dos times (logo, nome, cor) diretamente da tabela 'times'
        const teamIds = (mapped.timesInscritos || []).map((t: any) => t.id).filter(Boolean);
        if (teamIds.length > 0) {
          const dbTeams = await api.teams.batch(teamIds);

          if (dbTeams && dbTeams.length > 0 && !cancelled) {
            setCampeonato((prev: any) => {
              if (!prev) return prev;
              
              const updatedTimesInscritos = (prev.timesInscritos || []).map((t: any) => {
                const dbT = dbTeams.find((dt: any) => dt.id === t.id);
                if (dbT) {
                  return {
                    ...t,
                    name: dbT.nome || t.name,
                    tag: dbT.tag || t.tag,
                    logo: dbT.logo_url || t.logo,
                    cor: dbT.gradient_from || t.cor
                  };
                }
                return t;
              });

              const updatedClassificacao = (prev.classificacao || []).map((t: any) => {
                const dbT = dbTeams.find((dt: any) => dt.id === t.id || dt.tag === t.tag);
                if (dbT) {
                  return {
                    ...t,
                    nome: dbT.nome || t.nome,
                    tag: dbT.tag || t.tag,
                    logo: dbT.logo_url || t.logo,
                    cor: dbT.gradient_from || t.cor
                  };
                }
                return t;
              });

              return {
                ...prev,
                timesInscritos: updatedTimesInscritos,
                classificacao: updatedClassificacao
              };
            });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCampeonatoLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  // Detecta se o time do usuário já está inscrito (persiste entre reloads)
  useEffect(() => {
    if (!campeonato || !perfilMyTeam) return;
    const jaInscrito = (campeonato.timesInscritos || []).some(
      (t: any) => t.id === perfilMyTeam.id
    );
    setIsRegistered(jaInscrito);
  }, [campeonato, perfilMyTeam]);

  // Fallback: carrega time do usuário direto do Supabase quando perfilMyTeam ainda
  // não está disponível (ex: usuário sem Riot account vinculada, contexto ainda carregando)
  useEffect(() => {
    if (!campeonato || !user || perfilMyTeam) return; // só roda se não tiver via contexto
    const inscritosIds = (campeonato.timesInscritos || [])
      .map((t: any) => t.id)
      .filter(Boolean);
    if (inscritosIds.length === 0) return;

    api.teams.byUser(user.id)
      .then(({ memberships }) => {
        const membership = (memberships || []).find((m: any) => inscritosIds.includes(m.time_id));
        const data = membership ? { time_id: membership.time_id } : null;
        if (data?.time_id) {
          const team = (campeonato.timesInscritos || []).find(
            (t: any) => t.id === data.time_id
          );
          if (team) setFallbackMyTeam(team);
        }
      });
  }, [campeonato, user, perfilMyTeam]);

  // Pré-seleciona o primeiro time do usuário ao abrir o modal de inscrição
  useEffect(() => {
    if (isRegistrationModalOpen && myTeams.length > 0) {
      setRegistrationData((prev) => ({
        ...prev,
        teamId: myTeams[0].id,
      }));
    }
  }, [isRegistrationModalOpen, myTeams]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isTeamValid = registrationData.teamId !== "";

    if (
      !isTeamValid ||
      !registrationData.discord ||
      !registrationData.whatsapp
    ) {
      alert("Por favor, preencha todos os campos obrigatórios!");
      return;
    }

    const team = myTeams.find((t) => t.id === registrationData.teamId);
    if (!team) {
      alert("Selecione um time para se inscrever!");
      return;
    }

    // Bloqueia inscrição duplicada do mesmo time
    const jaInscrito = (campeonato?.timesInscritos || []).some(
      (t: any) => t.id === registrationData.teamId
    );
    if (jaInscrito) {
      alert("Este time já está inscrito neste campeonato!");
      return;
    }

    const teamEntry = {
      id: registrationData.teamId,
      name: team.nome,
      tag: team.tag,
      logo: team.logo || null,
      cor: team.cor || '#FFB700',
      status: 'pending',
      paid: false,
      discord: registrationData.discord,
      whatsapp: registrationData.whatsapp,
    };

    // Salva via API própria (append atômico, substitui a RPC registrar_time_campeonato)
    try {
      await api.tournaments.inscreverTime(id, teamEntry);
    } catch (error: any) {
      alert(error.message || 'Erro ao enviar inscrição. Tente novamente.');
      return;
    }

    // Atualiza estado local para feedback imediato
    setCampeonato((prev: any) => {
      if (!prev) return prev;
      return { ...prev, timesInscritos: [...(prev.timesInscritos || []), teamEntry] };
    });
    setIsRegistered(true);
    setIsRegistrationModalOpen(false);
  };

  // Intercept bracket tab click to open modal (comportamento original)
  const handleTabClick = (tabId: string) => {
    if (tabId === "bracket") {
      setIsBracketModalOpen(true);
    } else {
      setActiveTab(tabId);
    }
  };

  const getStatsForTeamForCalculation = (
    teamName: string,
    cronograma: any[],
  ) => {
    let p = 0,
      v = 0,
      d = 0,
      matches = 0;
    (cronograma || []).forEach((m: any) => {
      const faseStr = (m.fase || m.grupo || "").toUpperCase();
      const isGroupMatch = faseStr.includes("GRUPO");
      const isTieBreaker = faseStr.includes("DESEMPATE");
      if (!isGroupMatch && !isTieBreaker) return;

      if (m.status !== "finalizado") return;
      if (m.timeA !== teamName && m.timeB !== teamName) return;

      matches++;
      const scores = (m.placar || "0 - 0").split(" - ");
      const s1 = parseInt(scores[0]) || 0;
      const s2 = parseInt(scores[1]) || 0;
      const isMatchA = m.timeA === teamName;
      const myScore = isMatchA ? s1 : s2;
      const oppScore = isMatchA ? s2 : s1;

      p += myScore;
      v += myScore;
      d += oppScore;
    });
    return { p, v, d, matches, j: v + d };
  };

  // (Removido) findNewlyFormedMatches: a chave é 100% visual e não cria mais
  // jogos no cronograma.

  const handleSortearGrupos = () => {
    if (!isAdmin) return;

    const shuffledTeams = [...(campeonato.timesInscritos || [])].sort(
      () => Math.random() - 0.5,
    );

    const timesPorGrupo = campeonato.timesPorGrupo || 4;
    // Fallback if not configured properly, but fallback to reasonable chunking
    const numGrupos = Math.ceil(shuffledTeams.length / timesPorGrupo) || 1;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const getGroupName = (idx: number) => {
      if (idx < 26) return alphabet[idx];
      return alphabet[Math.floor(idx / 26) - 1] + alphabet[idx % 26];
    };

    const groups: any = {};
    for (let i = 0; i < numGrupos; i++) {
      groups[`Grupo ${getGroupName(i)}`] = shuffledTeams.slice(
        i * timesPorGrupo,
        (i + 1) * timesPorGrupo,
      );
    }

    const cronograma: any[] = [];
    Object.entries(groups).forEach(([groupName, teams]: [any, any]) => {
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          cronograma.push({
            id: `${campeonato.id}-${groupName}-${i}-${j}`,
            timeA: teams[i].tag,
            timeB: teams[j].tag,
            fase: groupName,
            status: "combinando", // Changed from proposto to combinando as initial state
            data: "A COMBINAR",
            hora: "--:--",
            proposedBy: "", // No one has proposed yet
            placar: "",
          });
        }
      }
    });

    const updated = {
      ...campeonato,
      status: "em_andamento",
      grupos: groups,
      cronograma: cronograma,
      gruposSorteados: true,
      chavesSorteados: false, // Reset chaves when resetting groups
    };

    setCampeonato(updated);
    saveToSupabase(updated);
  };

  // Abre o chaveamento para preenchimento MANUAL (sem sorteio automático).
  // Apenas revela o bracket vazio — o organizador preenche os times pela edição
  // (lápis) de cada vaga. Não toca no cronograma.
  const handleAbrirChaveamento = () => {
    if (!isAdmin) return;
    const updated = { ...campeonato, chavesSorteados: true, status: "em_andamento" };
    setCampeonato(updated);
    saveToSupabase(updated);
    setActiveTab("bracket");
  };

  const handleSortearChaves = () => {
    if (!isAdmin) return;

    const parseVagas = (vStr: any) => {
      const s = String(vStr || "16");
      if (s.includes("/")) return parseInt(s.split("/")[1]) || 16;
      return parseInt(s) || 16;
    };

    // Defaults alinhados com o formulário de createCampPage (timesPorGrupo=4,
    // classificadosPorGrupo=2). Antes este lado usava 8/4, divergindo do
    // gerador da página admin e produzindo brackets diferentes dependendo
    // de qual tela o admin usasse para sortear chaves.
    const timesPorGrupo = campeonato.timesPorGrupo || 4;
    const classificados = campeonato.classificadosPorGrupo || 2;
    const totalParticipants = parseVagas(campeonato.vagas);

    let crossSeededTeams: any[] = [];
    let bracketTeams = 0;

    if (campeonato.formato === "liga") {
      const numGrupos = Math.ceil(totalParticipants / timesPorGrupo);
      bracketTeams = numGrupos * classificados;

      if (!campeonato.grupos) return;

      const qualifiedTeams: any[] = [];

      Object.entries(campeonato.grupos).forEach(
        ([groupName, teams]: [string, any]) => {
          const groupTeams = teams
            .map((t: any) => {
              return {
                ...t,
                ...getStatsForTeamForCalculation(t.tag, campeonato.cronograma),
              };
            })
            .sort((a: any, b: any) => {
              if (b.v !== a.v) return b.v - a.v;
              if (a.d !== b.d) return a.d - b.d;
              return b.p - a.p;
            });

          qualifiedTeams.push(...groupTeams.slice(0, classificados));
        },
      );

      // Cross-seed strategy: 1st of Group A vs 2nd of Group B, etc.
      if (classificados === 2 && numGrupos === 4) {
        // 8 teams total
        crossSeededTeams.push(
          qualifiedTeams[0], // 1A
          qualifiedTeams[3], // 2B
          qualifiedTeams[4], // 1C
          qualifiedTeams[7], // 2D
          qualifiedTeams[6], // 1D
          qualifiedTeams[5], // 2C
          qualifiedTeams[2], // 1B
          qualifiedTeams[1], // 2A
        );
      } else {
        crossSeededTeams.push(
          ...[...qualifiedTeams].sort(() => Math.random() - 0.5),
        );
      }
    } else {
      // Pure mata-mata
      bracketTeams = Math.pow(2, Math.ceil(Math.log2(totalParticipants)));
      const inputTeams = [...(campeonato.timesInscritos || [])].sort(
        () => Math.random() - 0.5,
      );
      crossSeededTeams = [...inputTeams];

      // Pad empty slots with 'TBD' logically if missing
      while (crossSeededTeams.length < bracketTeams) {
        crossSeededTeams.push({ tag: "TBD", name: "TBD" });
      }
    }

    const initialBracket = JSON.parse(JSON.stringify(INITIAL_BRACKET_DATA));

    const fillSide = (sideObj: any, teamsList: any[]) => {
      const startRound =
        bracketTeams >= 64
          ? "r64"
          : bracketTeams >= 32
            ? "r32"
            : bracketTeams >= 16
              ? "r16"
              : bracketTeams >= 8
                ? "qf"
                : "sf";
      const roundArray = sideObj[startRound];
      if (!roundArray) return;

      for (let i = 0; i < teamsList.length / 2; i++) {
        if (roundArray[i]) {
          // Prioridade: tag > name (tag é o identificador canônico)
          roundArray[i].t1 =
            teamsList[i * 2]?.tag || teamsList[i * 2]?.name || "";
          roundArray[i].t2 =
            teamsList[i * 2 + 1]?.tag || teamsList[i * 2 + 1]?.name || "";
        }
      }
    };

    // Seleciona estrutura de bracket baseada no número real de times classificados
    // ≤2 → Final direta (grandFinal)
    // 3–4 ou mata_mata → DoubleSideBracket (.side.left / .side.right / sf)
    // >4 liga → DoubleEliminationBracket (.upper)
    const useDoubleElimBracket = campeonato.formato === "liga" && bracketTeams > 4;
    if (bracketTeams <= 2) {
      // Final direta: os 2 times vão direto para a grande final
      initialBracket.side.grandFinal.t1 = crossSeededTeams[0]?.tag || crossSeededTeams[0]?.name || "";
      initialBracket.side.grandFinal.t2 = crossSeededTeams[1]?.tag || crossSeededTeams[1]?.name || "";
    } else if (useDoubleElimBracket) {
      fillSide(initialBracket.upper, crossSeededTeams);
    } else {
      const half = Math.ceil(crossSeededTeams.length / 2);
      fillSide(initialBracket.side.left, crossSeededTeams.slice(0, half));
      fillSide(initialBracket.side.right, crossSeededTeams.slice(half));
    }

    saveBracketToSupabase(initialBracket);
    setBracketData(initialBracket);

    // Chave é 100% VISUAL: não cria nenhum jogo no cronograma. Apenas remove
    // jogos da chave ("MATA-MATA (CHAVEAMENTO)") que tenham sobrado de versões
    // antigas. Todos os resultados que contam são lançados no cronograma.
    const newCronograma = (campeonato.cronograma || []).filter(
      (c: any) => c.fase !== "MATA-MATA (CHAVEAMENTO)",
    );

    const updated = {
      ...campeonato,
      chavesSorteados: true,
      status: "em_andamento",
      cronograma: newCronograma,
    };
    setCampeonato(updated);
    saveToSupabase(updated);
    // Salva cronograma via API própria (substitui a RPC atualizar_cronograma_campeonato)
    api.tournaments.atualizarCronograma(id, newCronograma)
      .catch((error: any) => console.error('Erro ao salvar cronograma do chaveamento:', error.message));


    setActiveTab("bracket");
  };

  const handleUpdateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMatchIndex === null) return;

    const newCronograma = [...campeonato.cronograma];
    const match = newCronograma[editingMatchIndex];

    if (!isAdmin && match.status === "confirmado") {
      const matchDateObj =
        match.data && match.hora && match.hora !== "--:--"
          ? new Date(`${match.data}T${match.hora}:00`)
          : null;
      const isWithin24Hours = matchDateObj
        ? matchDateObj.getTime() - new Date().getTime() <= 24 * 60 * 60 * 1000
        : false;
      if (isWithin24Hours) {
        alert(
          "Não é possível alterar a data quando faltam menos de 24 horas para o jogo. Apenas administradores podem fazer isto.",
        );
        return;
      }
    }

    // Determine acting team tag — sempre usa tag do time quando o usuário tem
    // um time nessa partida (inclusive admins que são jogadores)
    let actingTeamTag = "ADMIN";
    const myTeamInAction = myTeams.find(
      (t) => t.tag === match.timeA  || t.tag === match.timeB ||
             t.nome === match.timeA || t.nome === match.timeB
    );
    if (myTeamInAction) actingTeamTag = myTeamInAction.tag;

    if (editFormData.action === "accept") {
      match.status = "confirmado";
      match.lastActionBy = actingTeamTag;
    } else if (editFormData.action === "finish") {
      match.status = "finalizado";
      match.placar = editFormData.placar;
      // PDL/V/D são recalculados do cronograma após salvar (recalcular_pdl_global
      // no .then do merge abaixo). Editar o placar reverte/reaplica sozinho.
    } else {
      // Propose or Counter-propose
      match.data = editFormData.data;
      match.hora = editFormData.hora;
      match.status = "proposto";
      match.proposedBy = actingTeamTag;
    }

    let updatedCampeonato = { ...campeonato, cronograma: newCronograma };

    // --- Lógica de Desempate Automático ---
    if (match.status === "finalizado") {
      updatedCampeonato = checkAndAddTiebreakers(updatedCampeonato, match.fase);
    }
    // --------------------------------------

    // Sync to history if finished
    if (match.status === "finalizado") {
      if (!match.id) {
        match.id = `${id}-schedule-${match.timeA}-${match.timeB}-${match.data}`;
      }
      syncMatchToHistory(match, "schedule");
    }
    setCampeonato(updatedCampeonato);

    // ⚠️ RACE SAFETY: usa mergeCronograma com APENAS o jogo editado
    // em vez de enviar o cronograma inteiro. Dois times editando jogos
    // diferentes ao mesmo tempo agora não se sobrescrevem mais.
    // O merge no servidor faz lookup por `id` (com fallback timeA+timeB+fase)
    // e substitui só o jogo correspondente.
    api.tournaments.mergeCronograma(id, [match])
      .then(() => {
        // Jogo finalizado (ou placar editado) → recalcula PDL/V/D a partir dos
        // jogos finalizados do cronograma. Idempotente: corrige sozinho.
        if (match.status === "finalizado") {
          api.tournaments.recalcularPdl(id).catch((e: any) => console.error('Erro ao recalcular PDL:', e.message));
        }
      })
      .catch((error: any) => {
        console.error('Erro ao salvar cronograma:', error.message);
        alert(`Falha ao salvar o jogo. Recarregue a página.\n\nDetalhe: ${error.message}`);
      });

    // --- Lógica de Sincronização com Chaves ---
    if (match.status === "finalizado") {
      const scores = (match.placar || "0 - 0").split(" - ");
      const s1 = parseInt(scores[0]) || 0;
      const s2 = parseInt(scores[1]) || 0;
      const winner = s1 > s2 ? match.timeA : s2 > s1 ? match.timeB : null;

      if (winner) {
        setBracketData((prevBracket: any) => {
          if (!prevBracket) return prevBracket;
          const nextBracket = JSON.parse(JSON.stringify(prevBracket));
          let found = false;
          let targetType = "";
          let targetRound = "";
          let targetIdx = -1;
          let targetSide: any = undefined;

          // Remove !m.winner — permite re-editar resultado já existente na chave
          const searchAndUpdate = (m: any, type: string, round: string, idx: number, side?: any) => {
            if (found) return false;
            if ((m.t1 === match.timeA && m.t2 === match.timeB) || (m.t1 === match.timeB && m.t2 === match.timeA)) {
              m.s1 = m.t1 === match.timeA ? s1 : s2;
              m.s2 = m.t1 === match.timeA ? s2 : s1;
              m.winner = winner;
              m.status = "finalizado";
              found = true;
              targetType = type;
              targetRound = round;
              targetIdx = idx;
              targetSide = side;
              return true;
            }
            return false;
          };

          // Search
          if (nextBracket.side) {
            ["left", "right"].forEach(side => {
              if (found) return;
              Object.entries(nextBracket.side[side] || {}).forEach(([rKey, rMatches]: [string, any]) => {
                if (found) return;
                rMatches.forEach((m: any, idx: number) => searchAndUpdate(m, "side", rKey, idx, side));
              });
            });
            if (!found && nextBracket.side.grandFinal) searchAndUpdate(nextBracket.side.grandFinal, "side", "final", 0, "final");
          }

          if (!found && nextBracket.upper) {
            Object.entries(nextBracket.upper).forEach(([rKey, rMatches]: [string, any]) => {
              if (found) return;
              rMatches.forEach((m: any, idx: number) => searchAndUpdate(m, "upper", rKey, idx));
            });
          }

          if (found) {
            // Bug 1 fix: calcula o tamanho real do bracket para roteamento correto do lower
            const _parseVagasUS = (v: any) => { const s = String(v || "16"); return s.includes("/") ? parseInt(s.split("/")[1]) || 16 : parseInt(s) || 16; };
            const _totalUS = _parseVagasUS(campeonato.vagas);
            const _gruposUS = Math.ceil(_totalUS / (campeonato.timesPorGrupo || 8));
            const teamsCount = campeonato.formato === "liga"
              ? _gruposUS * (campeonato.classificadosPorGrupo || 4)
              : Math.pow(2, Math.ceil(Math.log2(Math.max((campeonato.timesInscritos || []).filter((t: any) => t.status === "approved").length, 2))));
            let matchInBracket;
            if (targetType === "side") {
               matchInBracket = targetRound === "final" ? nextBracket.side.grandFinal : nextBracket.side[targetSide][targetRound][targetIdx];
            } else {
               matchInBracket = nextBracket[targetType][targetRound][targetIdx];
            }
            
            const updated = advanceTeamsInBracket(nextBracket, matchInBracket, targetType, targetRound, targetIdx, targetSide, teamsCount);
            saveBracketToSupabase(updated);
            return updated;
          }
          return prevBracket;
        });
      }
    }
    // ------------------------------------------

    setIsScheduleEditModalOpen(false);
    setEditingMatchIndex(null);
  };

  const handleCreateAdminMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMatchData.timeA || !adminMatchData.timeB) return;

    // ⚠️ RACE SAFETY: garante `id` único no jogo recém-criado para que o
    // merge no servidor consiga identificá-lo unicamente. Sem id, jogos
    // criados manualmente (ex: amistosos extras) ficavam vulneráveis a
    // colisão em merge subsequente.
    const newMatch = {
      id: `manual-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      data: "A COMBINAR",
      hora: "--:--",
      fase: adminMatchData.fase,
      timeA: adminMatchData.timeA,
      iconeA: "ShieldCheck",
      timeB: adminMatchData.timeB,
      iconeB: "Swords",
      status: "proposto",
      proposedBy: isAdmin
        ? "ADMIN"
        : myTeams.find((t) => t.tag === adminMatchData.timeA)?.tag ||
          adminMatchData.timeA,
    };

    const newCronograma = [...campeonato.cronograma, newMatch];
    const updatedCampeonato = { ...campeonato, cronograma: newCronograma };
    setCampeonato(updatedCampeonato);

    // Envia só o jogo novo via merge atômico (substitui o write-all anterior)
    api.tournaments.mergeCronograma(id, [newMatch])
      .catch((error: any) => {
        console.error('Erro ao criar jogo:', error.message);
        alert(`Falha ao criar o jogo. Recarregue a página.\n\nDetalhe: ${error.message}`);
      });

    setIsAdminMatchModalOpen(false);
  };

  const dateOptions = [
    "10 MAI",
    "11 MAI",
    "12 MAI",
    "13 MAI",
    "14 MAI",
    "15 MAI",
    "16 MAI",
    "17 MAI",
    "18 MAI",
    "19 MAI",
    "20 MAI",
  ];

  const timeOptions = [
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
  ];

  const handleUpdateThemeColor = (color: string) => {
    const updatedCampeonato = { ...campeonato, themeColor: color };
    setCampeonato(updatedCampeonato);
    saveToSupabase(updatedCampeonato);
  };

  const tabs = React.useMemo(
    () => [
      { id: "overview", label: "Visão Geral", icon: Eye },
      ...(campeonato?.formato === "liga"
        ? [{ id: "groups", label: "Grupos", icon: List }]
        : []),
      { id: "schedule", label: "Cronograma", icon: Clock },
      { id: "bracket", label: "Chaves", icon: GitBranch },
      { id: "history", label: "Histórico", icon: History },
    ],
    [campeonato?.formato, isAdmin],
  );

  const handleAgreeMatch = (matchId: string) => {
    const updatedCronograma = (campeonato.cronograma || []).map((m: any) => {
      if (m.id === matchId) {
        return { ...m, status: "pendente" };
      }
      return m;
    });
    const updatedCampeonato = { ...campeonato, cronograma: updatedCronograma };
    setCampeonato(updatedCampeonato);
    saveToSupabase(updatedCampeonato);
  };

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const [selectedGroupFilter, setSelectedGroupFilter] = useState("Todos");

  const getMyTeamInMatch = (match: any) => {
    return myTeams.find((t) =>
      t.tag === match.timeA  || t.tag === match.timeB ||
      t.nome === match.timeA || t.nome === match.timeB
    );
  };

  // Ordenação e Filtragem por Role e Grupo
  const filteredCronograma = React.useMemo(() => {
    const raw = [...(campeonato?.cronograma || [])];

    const filtered = raw.filter((jogo: any) => {
      // Apenas jogos confirmados ou finalizados aparecem no cronograma público
      if (jogo.status !== "confirmado" && jogo.status !== "finalizado")
        return false;

      // Filtro de Grupo
      if (selectedGroupFilter !== "Todos" && jogo.fase !== selectedGroupFilter)
        return false;

      return true;
    });

    // Ordem: Confirmados primeiro, depois finalizados. Se ambos iguais, por data.
    return filtered.sort((a, b) => {
      const order: any = { confirmado: 0, finalizado: 1 };
      if (order[a.status] !== order[b.status])
        return order[a.status] - order[b.status];

      const dA =
        a.data && a.hora
          ? new Date(`${a.data}T${a.hora.replace("--:--", "00:00")}`)
          : new Date(0);
      const dB =
        b.data && b.hora
          ? new Date(`${b.data}T${b.hora.replace("--:--", "00:00")}`)
          : new Date(0);
      return dA.getTime() - dB.getTime();
    });
  }, [campeonato?.cronograma, selectedGroupFilter]);

  // Todos os jogos não finalizados/confirmados
  const pendingAll = (campeonato?.cronograma || []).filter(
    (jogo: any) => jogo.status !== "finalizado" && jogo.status !== "confirmado"
  );

  // Jogos onde o time do usuário participa (para qualquer um com time, inclusive admin-jogador)
  const myPendingMatches = pendingAll.filter((jogo: any) => !!getMyTeamInMatch(jogo));

  // Todos os jogos pendentes — apenas para admin, com botão "Arbitrar"
  const allPendingMatches = pendingAll;

  // Exclui um jogo do cronograma (controle manual do organizador).
  const handleDeleteMatch = (jogo: any) => {
    if (!isAdmin) return;
    const nomeA = jogo.timeA || "Time A";
    const nomeB = jogo.timeB || "Time B";
    if (!window.confirm(`Excluir o jogo ${nomeA} vs ${nomeB}? Ele deixará de existir.`)) return;
    const newCronograma = (campeonato.cronograma || []).filter((c: any) =>
      jogo.id ? c.id !== jogo.id : c !== jogo,
    );
    const updated = { ...campeonato, cronograma: newCronograma };
    setCampeonato(updated);
    api.tournaments.atualizarCronograma(id, newCronograma)
      .then(() => {
        toast.success("Jogo excluído com sucesso!");
      })
      .catch((err: any) => console.error("Erro ao excluir jogo:", err));
  };

  if (campeonatoLoading || !campeonato) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#FFB700' }} />
          <span className="text-xs font-black uppercase tracking-widest">
            Carregando campeonato...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans overflow-x-hidden relative">
      {/* Background Decor & Depth Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[10%] left-[20%] w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{ backgroundColor: `${campeonato.themeColor || '#FFB700'}0D` }}
        />
        <div className="absolute top-[35%] right-[10%] w-[500px] h-[500px] bg-[#9146FF]/5 rounded-full blur-[140px]" />
        <div className="absolute top-[65%] left-[15%] w-[550px] h-[550px] bg-[#00F0FF]/4 rounded-full blur-[150px]" />
      </div>

      {/* Bracket Modal (Full-Screen Popup) */}
      <BracketModal isOpen={isBracketModalOpen} onClose={() => setIsBracketModalOpen(false)} campeonato={campeonato} bracketData={bracketData} onScoreChange={handleBracketScoreChange} isAdmin={isAdmin} availableTeams={bracketAvailableTeams} modalBracketRef={modalBracketRef} modalBracketHandlers={modalBracketHandlers} modalBracketScale={modalBracketScale} />

      {/* Modal de Inscrição */}
      <AnimatePresence>
        {isRegistrationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="relative p-[1.5px] w-full max-w-lg shadow-2xl"
              style={{
                clipPath: CUT_FRAME,
                background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}40 50%, rgba(255,255,255,0.08) 100%)`,
                boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-8 space-y-6 sm:space-y-8"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Trophy
                          className="w-6 h-6"
                          style={{ color: campeonato.themeColor }}
                        />
                      </div>
                    </div>
                    <div>
                      <h2
                        className="text-xl font-black uppercase tracking-widest"
                        style={{ color: campeonato.themeColor }}
                      >
                        Inscrição de Time
                      </h2>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Garanta sua vaga na arena
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsRegistrationModalOpen(false)}
                    className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 cursor-pointer"
                    style={{ clipPath: CUT_BADGE }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!user ? (
                  <div className="text-center py-6 space-y-6">
                    <div
                      className="w-16 h-16 p-[1px] mx-auto flex items-center justify-center text-[#FFB700]"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #FFB700, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Users className="w-8 h-8" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tight">Login Necessário</h3>
                      <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto leading-relaxed">
                        Você precisa estar conectado à sua conta para inscrever um time no campeonato.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={() => {
                          setIsRegistrationModalOpen(false);
                          navigate("/login");
                        }}
                        className="flex-1 py-4 px-4 bg-[#FFB700] hover:bg-[#E6A600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Fazer Login
                      </button>
                    </div>
                  </div>
                ) : myTeams.length === 0 ? (
                  <div className="text-center py-6 space-y-6">
                    <div
                      className="w-16 h-16 p-[1px] mx-auto flex items-center justify-center text-[#00F0FF]"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00F0FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <ShieldCheck className="w-8 h-8" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tight">Nenhuma Equipe Encontrada</h3>
                      <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto leading-relaxed">
                        Você ainda não tem uma equipe cadastrada. Crie a sua agora e entre na disputa — leva menos de um minuto.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsRegistrationModalOpen(false);
                        navigate("/times?criar=true", { state: { openCreateModal: true } });
                      }}
                      className="w-full py-4 px-6 bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Criar Equipe Agora</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-6">
                    {/* Seleção de Time */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                          Selecione sua Equipe
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {myTeams.map((team) => (
                          <div
                            key={team.id}
                            onClick={() =>
                              setRegistrationData({
                                ...registrationData,
                                teamId: team.id,
                              })
                            }
                            className="relative p-[1px] transition-all cursor-pointer"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: registrationData.teamId === team.id
                                ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                                : 'rgba(255, 255, 255, 0.08)'
                            }}
                          >
                            <div
                              className={`w-full p-3.5 flex items-center justify-between transition-colors ${
                                registrationData.teamId === team.id ? 'bg-[#0e0e14]' : 'bg-[#08080a] hover:bg-[#0c0c10]'
                              }`}
                              style={{ clipPath: CUT_BUTTON_INNER }}
                            >
                              <div className="flex items-center gap-3.5">
                                <div
                                  className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0 overflow-hidden"
                                  style={{
                                    clipPath: CUT_BADGE,
                                    background: 'rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div
                                    className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                                    style={{ clipPath: CUT_BADGE_INNER }}
                                  >
                                    {team.logo ? (
                                      <img
                                        src={team.logo} loading="lazy"
                                        alt="Logo"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <ShieldCheck className="w-5 h-5 text-white/20" />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4
                                    className={`text-sm font-black uppercase tracking-tight ${registrationData.teamId === team.id ? "text-white" : "text-white/60"}`}
                                  >
                                    {team.nome}
                                  </h4>
                                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                    #{team.tag}
                                  </p>
                                </div>
                              </div>
                              <div
                                className="w-5 h-5 flex items-center justify-center"
                                style={{
                                  clipPath: CUT_BADGE,
                                  backgroundColor: registrationData.teamId === team.id
                                    ? (campeonato.themeColor || '#FFB700')
                                    : 'rgba(255,255,255,0.05)'
                                }}
                              >
                                {registrationData.teamId === team.id && (
                                  <ShieldCheck className="w-3 h-3 text-black font-black" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contatos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                          Discord do Capitão
                        </label>
                        <div
                          className="relative p-[1px]"
                          style={{
                            clipPath: CUT_BUTTON,
                            background: 'rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <div
                            className="relative flex items-center bg-[#0c0c10]"
                            style={{ clipPath: CUT_BUTTON_INNER }}
                          >
                            <MessageCircle className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                            <input
                              required
                              type="text"
                              placeholder="Ex: nick#1234"
                              value={registrationData.discord}
                              onChange={(e) =>
                                setRegistrationData({
                                  ...registrationData,
                                  discord: e.target.value,
                                })
                              }
                              className="w-full bg-transparent pl-10 pr-3 py-3 text-white text-xs font-bold focus:outline-none placeholder:text-white/20"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                          WhatsApp
                        </label>
                        <div
                          className="relative p-[1px]"
                          style={{
                            clipPath: CUT_BUTTON,
                            background: 'rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <div
                            className="relative flex items-center bg-[#0c0c10]"
                            style={{ clipPath: CUT_BUTTON_INNER }}
                          >
                            <Phone className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                            <input
                              required
                              type="text"
                              placeholder="Ex: (11) 99999-9999"
                              value={registrationData.whatsapp}
                              onChange={(e) =>
                                setRegistrationData({
                                  ...registrationData,
                                  whatsapp: e.target.value,
                                })
                              }
                              className="w-full bg-transparent pl-10 pr-3 py-3 text-white text-xs font-bold focus:outline-none placeholder:text-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 text-black font-black flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest shadow-xl mt-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        clipPath: CUT_BUTTON,
                        backgroundColor: campeonato.themeColor || '#FFB700',
                        boxShadow: `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}66`,
                      }}
                    >
                      <Trophy className="w-4 h-4" />
                      <span>CONFIRMAR INSCRIÇÃO</span>
                    </button>
                    <p className="text-[9px] text-center text-white/30 font-bold uppercase tracking-widest px-4 leading-relaxed">
                      Ao confirmar, sua equipe será pré-inscrita e aguardará a
                      aprovação manual dos administradores da M7 ARENA.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Regulamento */}
      <RegrasModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} campeonato={campeonato} />

      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 sm:py-10 relative z-10 space-y-6 sm:space-y-8">
        {/* Top Navigation */}
        <button
          onClick={() => navigate("/campeonatos")}
          className="group relative p-[1px] transition-all hover:scale-105 active:scale-95 cursor-pointer inline-block"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 bg-[#08080a] text-white/60 group-hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar para Campeonatos</span>
          </div>
        </button>

        {/* HERO SECTION */}
        <div
          className="relative p-[1.5px] w-full shadow-2xl transition-all"
          style={{
            clipPath: CUT_FRAME,
            background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}40 50%, rgba(255,255,255,0.08) 100%)`,
            boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
          }}
        >
          <div
            className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col justify-end min-h-[250px]"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Hero Image */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
              style={{
                backgroundImage: `url(${campeonato.bannerUrl || "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2070"})`,
              }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/60 to-transparent" />

            <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-end md:justify-between gap-8 pt-24 pb-6 md:py-10">
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px" style={{ backgroundColor: campeonato.themeColor || '#FFB700' }} />
                  <span className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em]" style={{ color: campeonato.themeColor || '#FFB700' }}>
                    CAMPEONATO OFICIAL • M7 ARENA
                  </span>
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.95] sm:leading-[0.85] text-white">
                  {campeonato.titulo || campeonato.nome || campeonato.name}
                </h1>

                {campeonato.descricao && (
                  <p className="text-white/60 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-2xl">
                    {campeonato.descricao}
                  </p>
                )}
              </div>

              <div className="hidden md:flex flex-col gap-4 w-full md:w-auto shrink-0 items-center">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setIsRulesModalOpen(true)}
                    className="relative p-[1px] group transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(255,183,0,0.15)]"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                    }}
                    title="Regulamento"
                  >
                    <div
                      className="w-14 h-14 bg-[#0c0c10] flex items-center justify-center"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      <FileText
                        className="w-6 h-6 group-hover:scale-110 transition-transform"
                        style={{ color: campeonato.themeColor }}
                      />
                    </div>
                  </button>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Regulamento
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Dynamic Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* CONTENT TABS */}
            <div
              className="relative p-[1px] w-full"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))'
              }}
            >
              <div
                className="w-full p-1.5 bg-[#08080a] flex items-center gap-1.5 overflow-x-auto no-scrollbar"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className="relative p-[1px] flex-none sm:flex-1 transition-all cursor-pointer"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: isActive
                          ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}80)`
                          : 'transparent'
                      }}
                    >
                      <div
                        className={`flex items-center justify-center gap-2 px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                          isActive
                            ? 'bg-[#08080a]'
                            : 'bg-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
                        }`}
                        style={{
                          clipPath: CUT_BUTTON_INNER,
                          color: isActive ? (campeonato.themeColor || '#FFB700') : undefined
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="tracking-wider whitespace-nowrap">{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "overview" && <VisaoGeral key="overview" campeonato={campeonato} getDynamicStandings={getDynamicStandings} getIcon={getIcon} />}

              {activeTab === "history" && <Historico key="history" campeonato={campeonato} getDynamicStandings={getDynamicStandings} expandedTeam={expandedTeam} setExpandedTeam={setExpandedTeam} />}

              {activeTab === "groups" && <Grupos campeonato={campeonato} />}

              {activeTab === "schedule" && (
                <Cronograma campeonato={campeonato} isAdmin={isAdmin} myPendingMatches={myPendingMatches} allPendingMatches={allPendingMatches} filteredCronograma={filteredCronograma} getMyTeamInMatch={getMyTeamInMatch} getIcon={getIcon} formatDayOfWeek={formatDayOfWeek} formatFullDate={formatFullDate} handleDeleteMatch={handleDeleteMatch} isPendingMatchesOpen={isPendingMatchesOpen} setIsPendingMatchesOpen={setIsPendingMatchesOpen} isAllPendingOpen={isAllPendingOpen} setIsAllPendingOpen={setIsAllPendingOpen} setEditingMatchIndex={setEditingMatchIndex} setJogoStatusAtStart={setJogoStatusAtStart} setEditFormData={setEditFormData} setIsScheduleEditModalOpen={setIsScheduleEditModalOpen} setAdminMatchData={setAdminMatchData} adminMatchData={adminMatchData} setIsAdminMatchModalOpen={setIsAdminMatchModalOpen} />
              )}

              {activeTab === "bracket" && <Chaves key="bracket" campeonato={campeonato} isAdmin={isAdmin} isBracketModalOpen={isBracketModalOpen} setIsBracketModalOpen={setIsBracketModalOpen} bracketRef={bracketRef} bracketHandlers={bracketHandlers} bracketScale={bracketScale} bracketData={bracketData} handleBracketScoreChange={handleBracketScoreChange} bracketAvailableTeams={bracketAvailableTeams} />}

              {activeTab === "admin_settings" && isAdmin && (
                <motion.div
                  key="admin_settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full space-y-8"
                >
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
                      Configurações da Arena
                    </h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-1">
                      Ajuste os detalhes e a identidade do seu campeonato
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Identidade Visual */}
                    <div
                      className="relative p-[1.5px] shadow-2xl transition-all"
                      style={{
                        clipPath: CUT_FRAME,
                        background: 'linear-gradient(135deg, rgba(0, 255, 212, 0.3), rgba(255,255,255,0.05) 100%)',
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 sm:p-8 space-y-6"
                        style={{ clipPath: CUT_FRAME_INNER }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: 'linear-gradient(135deg, #00FFD4, rgba(255,255,255,0.1))'
                            }}
                          >
                            <div
                              className="w-full h-full bg-[#08080a] flex items-center justify-center"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              <Sparkles
                                className="w-6 h-6"
                                style={{ color: "#00FFD4" }}
                              />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-lg uppercase tracking-wider text-white">
                              Identidade Visual
                            </h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                              Defina a cor tema que será aplicada em todo o
                              campeonato
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                            Cor Tema
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { name: "Amarelo", hex: "#FFB700" },
                              { name: "Roxo", hex: "#D500FF" },
                              { name: "Verde", hex: "#00FF41" },
                              { name: "Vermelho", hex: "#FF003C" },
                              { name: "Laranja", hex: "#FF4D00" },
                              { name: "Azul", hex: "#00FFFF" },
                            ].map((color) => (
                              <button
                                key={color.hex}
                                onClick={() => handleUpdateThemeColor(color.hex)}
                                className="relative p-[1px] transition-all cursor-pointer hover:scale-105 active:scale-95"
                                style={{
                                  clipPath: CUT_BADGE,
                                  background: campeonato.themeColor === color.hex
                                    ? `linear-gradient(135deg, ${color.hex}, rgba(255,255,255,0.2))`
                                    : 'rgba(255, 255, 255, 0.08)'
                                }}
                              >
                                <div
                                  className={`flex items-center gap-2 px-3.5 py-2 ${
                                    campeonato.themeColor === color.hex ? 'bg-[#0c0c10]' : 'bg-[#08080a]'
                                  }`}
                                  style={{ clipPath: CUT_BADGE_INNER }}
                                >
                                  <div
                                    className="w-2.5 h-2.5 shadow-sm"
                                    style={{
                                      clipPath: CUT_BADGE,
                                      backgroundColor: color.hex,
                                    }}
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                                    {color.name}
                                  </span>
                                  {campeonato.themeColor === color.hex && (
                                    <Check
                                      className="w-3 h-3"
                                      style={{ color: color.hex }}
                                    />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card: Gestão do Chaveamento */}
                    <div
                      className="relative p-[1.5px] shadow-2xl transition-all md:col-span-2"
                      style={{
                        clipPath: CUT_FRAME,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 sm:p-8 space-y-6"
                        style={{ clipPath: CUT_FRAME_INNER }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                            }}
                          >
                            <div
                              className="w-full h-full bg-[#08080a] flex items-center justify-center"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              <GitBranch className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-lg uppercase tracking-wider text-white">
                              Chaveamento Eliminatório
                            </h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                              {campeonato.chavesSorteados
                                ? "Chaveamento manual — preencha os times e avance pela edição (lápis) de cada vaga"
                                : "Abra o chaveamento e preencha os times manualmente quando quiser"}
                            </p>
                          </div>
                          {campeonato.chavesSorteados && (
                            <span
                              className="ml-auto text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20"
                              style={{ clipPath: CUT_BADGE }}
                            >
                              ✓ Gerado
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-4">
                          {!campeonato.chavesSorteados ? (
                            <button
                              onClick={handleAbrirChaveamento}
                              className="px-6 py-4 font-black uppercase tracking-widest text-xs text-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
                              style={{
                                clipPath: CUT_BUTTON,
                                backgroundColor: campeonato.themeColor || '#FFB700',
                                boxShadow: `0 8px 30px ${campeonato.themeColor || '#FFB700'}44`
                              }}
                            >
                              <GitBranch className="w-4 h-4" />
                              <span>Abrir Chaveamento (Manual)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (window.confirm("Resetar o chaveamento? Isso limpa todos os times preenchidos na chave.")) {
                                  const reset = { ...campeonato, chavesSorteados: false };
                                  setCampeonato(reset);
                                  saveToSupabase(reset);
                                  setBracketData(INITIAL_BRACKET_DATA);
                                  saveBracketToSupabase(INITIAL_BRACKET_DATA);
                                }
                              }}
                              className="px-5 py-3 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 cursor-pointer"
                              style={{ clipPath: CUT_BUTTON }}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Resetar Chave</span>
                            </button>
                          )}
                        </div>

                        {campeonato.chavesSorteados && (
                          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                            Preencha os times pela edição (lápis) de cada vaga. Defina o placar para finalizar — o vencedor não avança sozinho.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal de Agendamento */}
            <AnimatePresence>
              {isScheduleEditModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="relative p-[1.5px] w-full max-w-md shadow-2xl"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.08) 100%)`,
                      boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-6"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                            }}
                          >
                            <div
                              className="w-full h-full bg-[#08080a] flex items-center justify-center"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              <Clock
                                className="w-5 h-5"
                                style={{ color: campeonato.themeColor }}
                              />
                            </div>
                          </div>
                          <div>
                            <h3
                              className="text-base sm:text-lg font-black uppercase tracking-widest leading-tight"
                              style={{ color: campeonato.themeColor }}
                            >
                              {editFormData.action === "accept"
                                ? "Responder Proposta"
                                : editFormData.action === "finish"
                                  ? jogoStatusAtStart === "finalizado"
                                    ? "Editar Resultado"
                                    : "Finalizar Jogo"
                                  : "Propor Horário"}
                            </h3>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                              Defina o status e horário do jogo
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsScheduleEditModalOpen(false)}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form
                        onSubmit={handleUpdateSchedule}
                        className="pt-5 space-y-4"
                      >
                        {editFormData.action !== "finish" && (
                          <div
                            className="p-3.5 mb-2 flex items-center justify-center transition-all"
                            style={{
                              clipPath: CUT_BUTTON,
                              backgroundColor:
                                editFormData.action === "accept"
                                  ? "rgba(0, 255, 65, 0.1)"
                                  : `${campeonato.themeColor}1A`,
                              border: `1px solid ${editFormData.action === "accept" ? "rgba(0, 255, 65, 0.2)" : `${campeonato.themeColor}33`}`,
                            }}
                          >
                            <p
                              className="text-[10px] font-black leading-relaxed uppercase tracking-widest text-center"
                              style={{
                                color:
                                  editFormData.action === "accept"
                                    ? "#00FF41"
                                    : campeonato.themeColor,
                              }}
                            >
                              {editFormData.action === "accept"
                                ? "Aceite ou altere para enviar uma contra-proposta."
                                : "Selecione a data e o horário para o confronto."}
                            </p>
                          </div>
                        )}

                        {editFormData.action !== "finish" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                                Data do Confronto
                              </label>
                              <div
                                className="relative p-[1px]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'rgba(255, 255, 255, 0.1)'
                                }}
                              >
                                <input
                                  type="date"
                                  value={editFormData.data}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      data: e.target.value,
                                      action:
                                        editFormData.action === "accept"
                                          ? "propose"
                                          : editFormData.action,
                                    })
                                  }
                                  className="w-full bg-[#0c0c10] px-4 py-3.5 text-white focus:outline-none transition-all font-bold appearance-none [color-scheme:dark] text-xs"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                                Horário Previsto
                              </label>
                              <div
                                className="relative p-[1px]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'rgba(255, 255, 255, 0.1)'
                                }}
                              >
                                <input
                                  type="time"
                                  value={editFormData.hora}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      hora: e.target.value,
                                      action:
                                        editFormData.action === "accept"
                                          ? "propose"
                                          : editFormData.action,
                                    })
                                  }
                                  className="w-full bg-[#0c0c10] px-4 py-3.5 text-white focus:outline-none transition-all font-bold appearance-none [color-scheme:dark] text-xs"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                  required
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {editFormData.action === "finish" && isAdmin && (
                          <div className="space-y-5 py-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center block">
                              Resultado da Partida
                            </label>

                            <div className="flex items-center justify-center gap-6 sm:gap-8">
                              {/* Team A Score */}
                              <div className="flex flex-col items-center gap-3">
                                <div
                                  className="text-[11px] font-black text-white uppercase truncate w-28 text-center bg-white/5 py-1.5 px-2.5 border border-white/10"
                                  style={{ clipPath: CUT_BADGE }}
                                >
                                  {
                                    campeonato.cronograma[editingMatchIndex!]
                                      ?.timeA
                                  }
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const [sA, sB] = (
                                        editFormData.placar || "0 - 0"
                                      )
                                        .split(" - ")
                                        .map((s) => parseInt(s) || 0);
                                      if (sA > 0)
                                        setEditFormData({
                                          ...editFormData,
                                          placar: `${sA - 1} - ${sB}`,
                                        });
                                    }}
                                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-3xl sm:text-4xl font-black text-white w-10 text-center">
                                    {
                                      (editFormData.placar || "0 - 0").split(
                                        " - ",
                                      )[0]
                                    }
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const [sA, sB] = (
                                        editFormData.placar || "0 - 0"
                                      )
                                        .split(" - ")
                                        .map((s) => parseInt(s) || 0);
                                      setEditFormData({
                                        ...editFormData,
                                        placar: `${sA + 1} - ${sB}`,
                                      });
                                    }}
                                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-white/20 text-xl font-black italic">
                                VS
                              </div>

                              {/* Team B Score */}
                              <div className="flex flex-col items-center gap-3">
                                <div
                                  className="text-[11px] font-black text-white uppercase truncate w-28 text-center bg-white/5 py-1.5 px-2.5 border border-white/10"
                                  style={{ clipPath: CUT_BADGE }}
                                >
                                  {
                                    campeonato.cronograma[editingMatchIndex!]
                                      ?.timeB
                                  }
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const [sA, sB] = (
                                        editFormData.placar || "0 - 0"
                                      )
                                        .split(" - ")
                                        .map((s) => parseInt(s) || 0);
                                      if (sB > 0)
                                        setEditFormData({
                                          ...editFormData,
                                          placar: `${sA} - ${sB - 1}`,
                                        });
                                    }}
                                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-3xl sm:text-4xl font-black text-white w-10 text-center">
                                    {
                                      (editFormData.placar || "0 - 0").split(
                                        " - ",
                                      )[1]
                                    }
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const [sA, sB] = (
                                        editFormData.placar || "0 - 0"
                                      )
                                        .split(" - ")
                                        .map((s) => parseInt(s) || 0);
                                      setEditFormData({
                                        ...editFormData,
                                        placar: `${sA} - ${sB + 1}`,
                                      });
                                    }}
                                    className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2.5 pt-3">
                          {editFormData.action === "accept" && (
                            <button
                              type="button"
                              onClick={() => {
                                const match =
                                  campeonato.cronograma[editingMatchIndex!];
                                const isChanged =
                                  editFormData.data !== match.data ||
                                  editFormData.hora !== match.hora;

                                if (isChanged) {
                                  const form = document.querySelector("form");
                                  if (form) form.requestSubmit();
                                  return;
                                }

                                let actingTeamTag = "ADMIN";
                                const myTeamForAccept = myTeams.find(
                                  (t) =>
                                    t.tag === match.timeA ||
                                    t.tag === match.timeB ||
                                    t.nome === match.timeA ||
                                    t.nome === match.timeB,
                                );
                                if (myTeamForAccept) actingTeamTag = myTeamForAccept.tag;

                                match.status = "confirmado";
                                match.lastActionBy = actingTeamTag;
                                const updatedCampeonato = {
                                  ...campeonato,
                                  cronograma: [...campeonato.cronograma],
                                };
                                setCampeonato(updatedCampeonato);
                                api.tournaments.atualizarCronograma(id, updatedCampeonato.cronograma)
                                  .catch((error: any) => console.error('Erro ao aceitar:', error.message));
                                setIsScheduleEditModalOpen(false);
                              }}
                              className="w-full py-3.5 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                              style={{
                                clipPath: CUT_BUTTON,
                                backgroundColor: editFormData.data !==
                                  campeonato.cronograma[editingMatchIndex!]?.data ||
                                editFormData.hora !==
                                  campeonato.cronograma[editingMatchIndex!]?.hora
                                  ? "#FFB700"
                                  : "#00FF41",
                                color: "#000000",
                                boxShadow: editFormData.data !==
                                  campeonato.cronograma[editingMatchIndex!]?.data ||
                                editFormData.hora !==
                                  campeonato.cronograma[editingMatchIndex!]?.hora
                                  ? "0 0 25px rgba(255,183,0,0.3)"
                                  : "0 0 25px rgba(0,255,65,0.3)"
                              }}
                            >
                              {editFormData.data !==
                                campeonato.cronograma[editingMatchIndex!]?.data ||
                              editFormData.hora !==
                                campeonato.cronograma[editingMatchIndex!]?.hora
                                ? "Propor Novo Horário"
                                : "Aceitar Horário"}
                            </button>
                          )}

                          {editFormData.action !== "accept" && (
                            <button
                              type="submit"
                              className="w-full py-3.5 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                              style={{
                                clipPath: CUT_BUTTON,
                                backgroundColor: editFormData.action === "finish"
                                  ? "#00FF41"
                                  : (campeonato.themeColor || "#FFB700"),
                                color: "#000000",
                                boxShadow: editFormData.action === "finish"
                                  ? "0 0 25px rgba(0,255,65,0.3)"
                                  : `0 0 25px ${campeonato.themeColor || '#FFB700'}4D`
                              }}
                            >
                              {editFormData.action === "finish"
                                ? "Confirmar Resultado"
                                : jogoStatusAtStart === "proposto"
                                  ? "Enviar Contra-Proposta"
                                  : "Enviar Proposta de Horário"}
                            </button>
                          )}

                          {isAdmin && editingMatchIndex !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                const jogo = campeonato.cronograma[editingMatchIndex!];
                                if (jogo) {
                                  handleDeleteMatch(jogo);
                                  setIsScheduleEditModalOpen(false);
                                }
                              }}
                              className="w-full py-2.5 mt-1 font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1.5 border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 cursor-pointer"
                              style={{ clipPath: CUT_BUTTON }}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Excluir Jogo</span>
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal de Criação de Jogo (Admin) */}
            <AnimatePresence>
              {isAdminMatchModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="relative p-[1.5px] w-full max-w-sm shadow-2xl"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.08) 100%)`,
                      boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-6"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                            }}
                          >
                            <div
                              className="w-full h-full bg-[#08080a] flex items-center justify-center"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              <Swords
                                className="w-5 h-5"
                                style={{ color: campeonato.themeColor }}
                              />
                            </div>
                          </div>
                          <h3
                            className="text-base sm:text-lg font-black uppercase tracking-widest"
                            style={{ color: campeonato.themeColor }}
                          >
                            {isAdmin ? "Criar Confronto" : "Agendar Desafio"}
                          </h3>
                        </div>
                        <button
                          onClick={() => setIsAdminMatchModalOpen(false)}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form
                        onSubmit={handleCreateAdminMatch}
                        className="pt-5 space-y-4"
                      >
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                            {isAdmin ? "Time A" : "Seu Time"}
                          </label>
                          <div
                            className="relative p-[1px]"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: 'rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <select
                              value={adminMatchData.timeA}
                              onChange={(e) =>
                                setAdminMatchData({
                                  ...adminMatchData,
                                  timeA: e.target.value,
                                })
                              }
                              className={`w-full bg-[#0c0c10] px-4 py-3 text-white focus:outline-none transition-all font-black text-xs ${!isAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                              style={{ clipPath: CUT_BUTTON_INNER }}
                              required
                              disabled={!isAdmin && myTeams.length <= 1}
                            >
                              {isAdmin ? (
                                <>
                                  <option value="" className="bg-[#0A0A0A]">
                                    SELECIONE O TIME A
                                  </option>
                                  {(
                                    campeonato.timesInscritos ||
                                    campeonato.classificacao ||
                                    []
                                  )?.map((t: any) => (
                                    <option
                                      key={t.tag}
                                      value={t.tag}
                                      className="bg-[#0A0A0A]"
                                    >
                                      {t.name || t.nome} [{t.tag}]
                                    </option>
                                  ))}
                                </>
                              ) : (
                                myTeams.map((t: any) => (
                                  <option
                                    key={t.tag}
                                    value={t.tag}
                                    className="bg-[#0A0A0A]"
                                  >
                                    {t.nome || t.name} [{t.tag}]
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em] py-1">
                          VS
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                            Time Rival
                          </label>
                          <div
                            className="relative p-[1px]"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: 'rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <select
                              value={adminMatchData.timeB}
                              onChange={(e) =>
                                setAdminMatchData({
                                  ...adminMatchData,
                                  timeB: e.target.value,
                                })
                              }
                              className="w-full bg-[#0c0c10] px-4 py-3 text-white focus:outline-none transition-all font-black text-xs cursor-pointer"
                              style={{ clipPath: CUT_BUTTON_INNER }}
                              required
                            >
                              <option value="" className="bg-[#0A0A0A]">
                                SELECIONE O RIVAL
                              </option>
                              {(
                                campeonato.timesInscritos ||
                                campeonato.classificacao ||
                                []
                              )
                                ?.filter((t: any) => t.tag !== adminMatchData.timeA)
                                .map((t: any) => (
                                  <option
                                    key={t.tag}
                                    value={t.tag}
                                    className="bg-[#0A0A0A]"
                                  >
                                    {t.name || t.nome} [{t.tag}]
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 text-black font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] mt-4"
                          style={{
                            clipPath: CUT_BUTTON,
                            backgroundColor: campeonato.themeColor || '#FFB700',
                            boxShadow: `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}66`,
                          }}
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {isAdmin
                              ? "Criar Jogo Oficial"
                              : "Confirmar e Propor Horário"}
                          </span>
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Statistics & Info */}
          <div className="space-y-6">
            <div
              className="relative p-[1.5px] shadow-2xl transition-all sticky top-10"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 space-y-5"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">
                  Informações
                </h3>

                <div className="space-y-4">
                  {/* 1. Premiação */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Coins
                          className="w-5 h-5"
                          style={{ color: campeonato.themeColor || '#FFB700' }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Premiação Total
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {campeonato.premio}
                      </p>
                      {campeonato.temOutrosPremios && (
                        <p className="text-[9px] font-medium text-white/40 mt-1 leading-tight">
                          {campeonato.outrosPremios}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2. Taxa */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00D4FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <CreditCard
                          className="w-5 h-5"
                          style={{ color: "#00D4FF" }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Taxa de Inscrição
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {campeonato.taxa}
                      </p>
                    </div>
                  </div>

                  {/* 3. Data */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #FF6600, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Calendar
                          className="w-5 h-5"
                          style={{ color: "#FF6600" }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Data
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {formatFullDate(campeonato.data)}
                      </p>
                    </div>
                  </div>

                  {/* Tier */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00FFD4, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Diamond size={18} color="#00FFD4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Tier
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {(campeonato as any).tier || "Free Elo"}
                      </p>
                    </div>
                  </div>

                  {/* 4. Vagas */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #BF00FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Users className="w-5 h-5" style={{ color: "#BF00FF" }} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Vagas / Times
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {
                          (campeonato.timesInscritos || []).filter(
                            (t: any) => t.status === "approved" || !t.status,
                          ).length
                        }{" "}
                        / {campeonato.vagas}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Card */}
            <div
              className="relative p-[1.5px] shadow-2xl transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}40, rgba(255,255,255,0.03) 100%)`,
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 space-y-4"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">
                  Responsável
                </h3>

                <div className="flex flex-col items-center justify-center py-4 w-full">
                  {/* Organization Logo */}
                  <div
                    className="w-44 h-44 p-[1.5px] flex items-center justify-center mb-5 relative overflow-hidden group hover:scale-105 transition-transform"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#0c0c10] flex items-center justify-center overflow-hidden p-3"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      {campeonato.orgPhotoUrl ? (
                        <img
                          src={campeonato.orgPhotoUrl} loading="lazy"
                          alt="Logo Org"
                          className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                        />
                      ) : (
                        <img
                          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400" loading="lazy"
                          alt="Logo Default"
                          className="w-full h-full object-cover opacity-50"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <p className="text-lg font-black text-white uppercase tracking-widest leading-tight mb-2">
                      {campeonato.org}
                    </p>
                    <div
                      className="flex items-center gap-2 py-1.5 px-3 bg-white/5 border border-white/5 opacity-60"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <ShieldCheck
                        className="w-3.5 h-3.5"
                        style={{ color: "#00FF41" }}
                      />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                        Organizador Oficial
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Regulamento no Mobile */}
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="md:hidden w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
            >
              <FileText className="w-4 h-4 text-white/60" />
              <span>Regulamento Oficial</span>
            </button>

            {/* Ação de Inscrição */}
            {(role as string) !== "spectator" && (
              <div className="space-y-4">
                {isRegistered ? (
                  <div
                    className="w-full py-4.5 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 bg-[#00FF41]/10 border border-[#00FF41]/30"
                    style={{
                      clipPath: CUT_BUTTON,
                      color: "#00FF41",
                      boxShadow: '0 0 30px -5px rgba(0,255,65,0.2)'
                    }}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Time Inscrito</span>
                  </div>
                ) : campeonato.status === "abertas" ||
                  campeonato.status === "inscricoes_abertas" ? (
                  <button
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="w-full py-4.5 text-black font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      clipPath: CUT_BUTTON,
                      backgroundColor: campeonato.themeColor || '#FFB700',
                      boxShadow: `0 0 40px -5px ${campeonato.themeColor || '#FFB700'}66`,
                    }}
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Garantir Vaga Agora</span>
                  </button>
                ) : (
                  <div
                    className="w-full py-4.5 bg-white/5 border border-white/10 text-white/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 cursor-not-allowed"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {campeonato.status === "breve" ||
                      campeonato.status === "inscricoes_em_breve"
                        ? "Inscrições em Breve"
                        : "Inscrições Encerradas"}
                    </span>
                  </div>
                )}
                <p className="text-[9px] text-white/30 text-center uppercase font-bold px-4 leading-relaxed tracking-wider">
                  {isRegistered
                    ? "Sua inscrição está sendo processada pela organização. Acompanhe pelo seu perfil."
                    : "Vagas confirmadas pela organização. Sem custo surpresa: você vê a taxa antes de confirmar."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampeonatoDetalhes;
