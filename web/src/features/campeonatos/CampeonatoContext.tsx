/**
 * CampeonatoContext.tsx — Provider dono do estado e das ações do detalhe de
 * campeonato (ADR-046, Task 6).
 *
 * O orquestrador (pages/CampeonatoDetalhes.tsx) concentrava ~15 `useState`, os
 * `useEffect` de carga, todos os handlers e o grosso das derivas. Aqui esse
 * estado vira propriedade do Provider e os componentes consomem via
 * `useCampeonato()` — removendo o prop-drilling e deixando a página como casca
 * fina. O corpo lógico foi movido verbatim; nada de comportamento novo aqui.
 *
 * Nota de tipos: o estado interno segue `any` como no orquestrador original.
 * A tipagem fina dos consumidores (abas, listagem) acontece nas Tasks 7/12.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import toast from "react-hot-toast";
import { useRole } from "../../contexts/RoleContext";
import { usePerfilSafe } from "../../contexts/PerfilContext";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import { mapFromDb } from "./mappers";
import { INITIAL_BRACKET_DATA, migrateBracketData, advanceTeamsInBracket } from "./domain/bracket";
import { History, Eye, List, Clock, GitBranch, type LucideIcon } from "lucide-react";

export interface CampeonatoContextType {
  id: string;
  campeonato: any;
  campeonatoLoading: boolean;
  activeTab: string;
  tabs: { id: string; label: string; icon: LucideIcon }[];
  isBracketModalOpen: boolean;
  isRegistrationModalOpen: boolean;
  isRulesModalOpen: boolean;
  isScheduleEditModalOpen: boolean;
  isAdminMatchModalOpen: boolean;
  isPendingMatchesOpen: boolean;
  isAllPendingOpen: boolean;
  editingMatchIndex: number | null;
  jogoStatusAtStart: string | null;
  editFormData: { data: string; hora: string; action: "propose" | "counter" | "accept" | "finish"; placar: string };
  adminMatchData: { timeA: string; timeB: string; fase: string };
  registrationData: { teamId: string; discord: string; whatsapp: string };
  isRegistered: boolean;
  isAdmin: boolean;
  isOrganizerOwner: boolean;
  bracketData: any;
  bracketScale: number;
  modalBracketScale: number;
  bracketAvailableTeams: any[];
  bracketRef: React.RefObject<HTMLDivElement>;
  modalBracketRef: React.RefObject<HTMLDivElement>;
  bracketHandlers: any;
  modalBracketHandlers: any;
  myTeams: any[];
  expandedTeam: string | null;
  selectedGroupFilter: string;
  filteredCronograma: any[];
  myPendingMatches: any[];
  allPendingMatches: any[];
  role: string | undefined;
  user: any;
  getMyTeamInMatch: (match: any) => any;
  setActiveTab: (t: string) => void;
  setIsBracketModalOpen: (v: boolean) => void;
  setIsRegistrationModalOpen: (v: boolean) => void;
  setIsRulesModalOpen: (v: boolean) => void;
  setIsScheduleEditModalOpen: (v: boolean) => void;
  setIsAdminMatchModalOpen: (v: boolean) => void;
  setIsPendingMatchesOpen: (v: boolean) => void;
  setIsAllPendingOpen: (v: boolean) => void;
  setEditingMatchIndex: (v: number | null) => void;
  setJogoStatusAtStart: (v: string | null) => void;
  setEditFormData: (v: any) => void;
  setAdminMatchData: (v: any) => void;
  setRegistrationData: (v: any) => void;
  setCampeonato: (v: any) => void;
  setBracketData: (v: any) => void;
  setExpandedTeam: (v: string | null) => void;
  setSelectedGroupFilter: (v: string) => void;
  saveToSupabase: (updated: any) => void;
  saveBracketToSupabase: (bracket: any) => void;
  handleRegisterSubmit: (e: React.FormEvent) => Promise<void>;
  handleTabClick: (tabId: string) => void;
  handleBracketScoreChange: (type: string, side: string, round: string, index: number, teamSlot: "s1" | "s2" | "winner" | "t1" | "t2", delta: any) => void;
  handleUpdateSchedule: (e: React.FormEvent) => void;
  handleCreateAdminMatch: (e: React.FormEvent) => void;
  handleUpdateThemeColor: (color: string) => void;
  handleAbrirChaveamento: () => void;
  handleSortearGrupos: () => void;
  handleSortearChaves: () => void;
  handleAgreeMatch: (matchId: string) => void;
  handleDeleteMatch: (jogo: any) => void;
  handleResetBracket: () => void;
}

export const CampeonatoContext = createContext<CampeonatoContextType | undefined>(undefined);

export function CampeonatoProvider({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { role, cargo } = useRole();
  const { myTeam: perfilMyTeam } = usePerfilSafe();
  const { user } = useAuth();
  const isPlatformAdmin = role === "admin"; // proprietário/admin: manda em tudo

  // Estado central do detalhe
  const [activeTab, setActiveTab] = useState("overview");
  const [isBracketModalOpen, setIsBracketModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isScheduleEditModalOpen, setIsScheduleEditModalOpen] = useState(false);
  const [isAdminMatchModalOpen, setIsAdminMatchModalOpen] = useState(false);
  const [isPendingMatchesOpen, setIsPendingMatchesOpen] = useState(false);
  const [isAllPendingOpen, setIsAllPendingOpen] = useState(true);
  const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null);
  const [jogoStatusAtStart, setJogoStatusAtStart] = useState<string | null>(null);
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

  // Fallback: time carregado diretamente quando perfilMyTeam ainda não chegou
  const [fallbackMyTeam, setFallbackMyTeam] = useState<any>(null);

  // Carregamento dos dados do campeonato
  const [campeonato, setCampeonato] = useState<any>(null);
  const [campeonatoLoading, setCampeonatoLoading] = useState(true);

  // Organizador é "admin" APENAS do campeonato que ele mesmo criou.
  const isOrganizerOwner =
    cargo === "organizador" && !!user && !!campeonato?.criadoPor && campeonato.criadoPor === user.id;
  // isAdmin do campeonato = admin da plataforma OU organizador-dono deste camp.
  const isAdmin = isPlatformAdmin || isOrganizerOwner;

  // Helper: save tournament fields (fire-and-forget)
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

  // Estado para os jogos das chaves
  const [bracketData, setBracketData] = useState<any>(INITIAL_BRACKET_DATA);

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

  // Aba "Chaves" renderiza o bracket inline no body; tela cheia fica no
  // botão "Ver em Tela Cheia" do próprio Chaves (decisão do usuário).
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
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

  // Reset de chave — limpa os times preenchidos e devolve o bracket inicial.
  const handleResetBracket = () => {
    if (!window.confirm("Resetar o chaveamento? Isso limpa todos os times preenchidos na chave.")) return;
    const reset = { ...campeonato, chavesSorteados: false };
    setCampeonato(reset);
    saveToSupabase(reset);
    setBracketData(INITIAL_BRACKET_DATA);
    saveBracketToSupabase(INITIAL_BRACKET_DATA);
  };

  const value: CampeonatoContextType = {
    id,
    campeonato,
    campeonatoLoading,
    activeTab,
    tabs,
    isBracketModalOpen,
    isRegistrationModalOpen,
    isRulesModalOpen,
    isScheduleEditModalOpen,
    isAdminMatchModalOpen,
    isPendingMatchesOpen,
    isAllPendingOpen,
    editingMatchIndex,
    jogoStatusAtStart,
    editFormData,
    adminMatchData,
    registrationData,
    isRegistered,
    isAdmin,
    isOrganizerOwner,
    bracketData,
    bracketScale,
    modalBracketScale,
    bracketAvailableTeams,
    bracketRef,
    modalBracketRef,
    bracketHandlers,
    modalBracketHandlers,
    myTeams,
    expandedTeam,
    selectedGroupFilter,
    filteredCronograma,
    myPendingMatches,
    allPendingMatches,
    role,
    user,
    getMyTeamInMatch,
    setActiveTab,
    setIsBracketModalOpen,
    setIsRegistrationModalOpen,
    setIsRulesModalOpen,
    setIsScheduleEditModalOpen,
    setIsAdminMatchModalOpen,
    setIsPendingMatchesOpen,
    setIsAllPendingOpen,
    setEditingMatchIndex,
    setJogoStatusAtStart,
    setEditFormData,
    setAdminMatchData,
    setRegistrationData,
    setCampeonato,
    setBracketData,
    setExpandedTeam,
    setSelectedGroupFilter,
    saveToSupabase,
    saveBracketToSupabase,
    handleRegisterSubmit,
    handleTabClick,
    handleBracketScoreChange,
    handleUpdateSchedule,
    handleCreateAdminMatch,
    handleUpdateThemeColor,
    handleAbrirChaveamento,
    handleSortearGrupos,
    handleSortearChaves,
    handleAgreeMatch,
    handleDeleteMatch,
    handleResetBracket,
  };

  return (
    <CampeonatoContext.Provider value={value}>
      {children}
    </CampeonatoContext.Provider>
  );
}

// ✅ Hook — use SEMPRE dentro do <CampeonatoProvider>.
export function useCampeonato() {
  const context = useContext(CampeonatoContext);
  if (context === undefined) {
    throw new Error('useCampeonato deve ser usado dentro de CampeonatoProvider');
  }
  return context;
}
