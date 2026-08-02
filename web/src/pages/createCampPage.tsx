import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Image as ImageIcon, Users, Trophy, Wallet, Calendar, 
  MapPin, Type, Layout, AlignLeft, ArrowLeft, Save, Globe,
  Upload, X, Gift, CheckCircle2, Settings2, ChevronRight,
  Check, AlertCircle, Play, MoreVertical, LayoutDashboard,
  Bell, Search, ShieldCheck, ExternalLink, Filter, History,
  CreditCard, Diamond, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';

interface TeamRegistration {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  tag: string;
  paid: boolean;
  discord?: string;
  whatsapp?: string;
  logo?: string;
}

interface Standing {
  rank: number;
  nome: string;
  tag: string;
  v: number;
  d: number;
  wo: number;
  j: number;
  cor?: string;
  logo?: string;
}

interface Tournament {
  id: string;
  titulo: string;
  frase?: string;
  formato: 'liga' | 'mata_mata';
  status: 'inscricoes_em_breve' | 'inscricoes_abertas' | 'em_andamento' | 'finalizado';
  vagas: number;
  timesPorGrupo?: number;
  classificadosPorGrupo?: number;
  tier: string;
  data: string;
  premiacao: string;
  taxa: string;
  outrosPremios?: string;
  temOutrosPremios?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  orgPhotoUrl?: string;
  organizacao?: string;
  regulamento?: string;
  themeColor?: string;
  timesInscritos: TeamRegistration[];
  classificacao?: Standing[];
}

const compressImageFromBase64 = (base64: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
};

const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      compressImageFromBase64(event.target?.result as string, maxWidth, maxHeight, quality)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const base64ToBlob = (base64: string): { blob: Blob; mime: string } => {
  const parts = base64.split(';base64,');
  const mime = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return { blob: new Blob([byteArray], { type: mime }), mime };
};

const uploadBase64ToStorage = async (base64Str: string, folderName: string, prefixName: string): Promise<string> => {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str; // Já é uma URL ou está vazio

  try {
    const { blob, mime } = base64ToBlob(base64Str);
    const extension = mime.split('/')[1] || 'jpeg';
    const fileName = `${prefixName}-${Date.now()}.${extension}`;

    // O bucket vira pasta no volume (public-images/) e folderName vira subpasta
    // (campeonatos/). O servidor devolve a URL pronta: /uploads/... (ADR-007).
    const file = new File([blob], fileName, { type: mime });
    const { url } = await api.upload(file, 'public-images', folderName);

    return url;
  } catch (err) {
    console.error('Falha ao enviar imagem para o servidor:', err);
    return base64Str; // Fallback para base64 em caso de erro
  }
};

const processTournamentImages = async (t: Tournament | any, id: string): Promise<Tournament | any> => {
  const logoUrl = await uploadBase64ToStorage(t.logoUrl || t.logo_url, 'campeonatos', `${id}-logo`);
  const bannerUrl = await uploadBase64ToStorage(t.bannerUrl || t.banner_url, 'campeonatos', `${id}-banner`);
  const orgPhotoUrl = await uploadBase64ToStorage(t.orgPhotoUrl || t.org_photo_url, 'campeonatos', `${id}-org`);
  return {
    ...t,
    logoUrl,
    logo_url: logoUrl,
    bannerUrl,
    banner_url: bannerUrl,
    orgPhotoUrl,
    org_photo_url: orgPhotoUrl,
  };
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('manage');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const { user } = useAuth();
  const { role, cargo, loadingRole } = useRole();
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Helper: map DB row → Tournament
  const mapFromDb = (row: any): Tournament => ({
    id: row.id,
    titulo: row.titulo,
    frase: row.frase || '',
    formato: row.formato || 'mata_mata',
    status: row.status || 'inscricoes_em_breve',
    vagas: row.vagas || 16,
    timesPorGrupo: row.times_por_grupo,
    classificadosPorGrupo: row.classificados_por_grupo,
    tier: row.tier || 'Free Elo',
    data: row.data || '',
    premiacao: row.premiacao || '',
    taxa: row.taxa || '',
    temOutrosPremios: row.tem_outros_premios || false,
    outrosPremios: row.outros_premios || '',
    logoUrl: row.logo_url || '',
    bannerUrl: row.banner_url || '',
    orgPhotoUrl: row.org_photo_url || '',
    organizacao: row.organizacao || '',
    regulamento: row.regulamento || '',
    themeColor: row.theme_color || '#FFB700',
    timesInscritos: row.times_inscritos || [],
    classificacao: row.classificacao || [],
    chavesSorteados: row.chaves_sorteados || false,
    grupos: row.grupos || {},
    cronograma: row.cronograma || [],
    gruposSorteados: row.grupos_sorteados || false,
    timesOrdemSorteio: row.times_ordem_sorteio || [],
  } as any);

  // Helper: Tournament → DB payload
  const toDbPayload = (t: Tournament | any) => ({
    titulo: t.titulo,
    frase: t.frase,
    formato: t.formato,
    status: t.status,
    vagas: Number(t.vagas) || 16,
    times_por_grupo: t.timesPorGrupo ?? null,
    classificados_por_grupo: t.classificadosPorGrupo ?? null,
    tier: t.tier,
    data: t.data,
    premiacao: t.premiacao,
    taxa: t.taxa,
    tem_outros_premios: t.temOutrosPremios || false,
    outros_premios: t.outrosPremios,
    logo_url: t.logoUrl,
    banner_url: t.bannerUrl,
    org_photo_url: t.orgPhotoUrl,
    organizacao: t.organizacao ?? null,
    regulamento: t.regulamento,
    theme_color: t.themeColor || '#FFB700',
    grupos: t.grupos || {},
    cronograma: t.cronograma || [],
    // bracket_data é gerenciado separadamente — NÃO incluir aqui para não sobrescrever com null
    grupos_sorteados: (t as any).gruposSorteados || false,
    chaves_sorteados: (t as any).chavesSorteados || false,
    times_inscritos: t.timesInscritos || [],
    classificacao: t.classificacao || [],
    times_ordem_sorteio: (t as any).timesOrdemSorteio || [],
  });

  // Estado para banner de erro de persistência (não-bloqueante mas visível)
  const [persistError, setPersistError] = useState<string | null>(null);

  // Helper: save one tournament to the API
  // Não é mais totalmente fire-and-forget: erros agora aparecem num banner
  // no topo da tela para o admin reagir (recarregar, tentar de novo).
  // Antes só caíam silenciosamente no console.error, então uma falha de
  // rede durante aprovação de time / sorteio de grupos deixava o estado
  // local desincronizado do banco sem aviso.
  const saveToDB = async (t: Tournament | any) => {
    const processed = await processTournamentImages(t, t.id);
    try {
      await api.tournaments.update(t.id, toDbPayload(processed));
      // Limpa banner de erro anterior quando um save dá certo
      setPersistError(prev => prev ? null : prev);
      // Sincroniza localmente com as URLs corretas do Storage
      setMyTournaments(prev => prev.map(item => item.id === t.id ? processed : item));
      if (selectedTournament?.id === t.id) {
        setSelectedTournament(processed);
      }
    } catch (error: any) {
      console.error('Erro ao salvar campeonato:', error);
      setPersistError(
        `Falha ao salvar alterações no campeonato "${t.titulo}". ` +
        `Suas mudanças locais não foram persistidas. ` +
        `Verifique sua conexão e recarregue a página. Detalhe: ${error?.message || error}`
      );
    }
  };

  const isPlatformAdmin = role === 'admin';
  const isOrganizador = cargo === 'organizador';

  // Bloqueia acesso de quem não é admin nem organizador
  React.useEffect(() => {
    if (loadingRole) return;
    if (!isPlatformAdmin && !isOrganizador) navigate('/campeonatos');
  }, [loadingRole, isPlatformAdmin, isOrganizador, navigate]);

    // Load tournaments from API
    React.useEffect(() => {
      if (loadingRole) return;
      let cancelled = false;
      setLoadingTournaments(true);
      const load = async () => {
        try {
          let data = await api.tournaments.list({ sort: "created_at" });
          // Organizador (não-admin) só enxerga/gerencia os campeonatos que ELE criou
          if (!isPlatformAdmin && isOrganizador && user) data = data.filter(t => t.criado_por === user.id);
          if (cancelled) return;
          const mapped = (data || []).map(mapFromDb);
        setMyTournaments(mapped);
        setLoadingTournaments(false);

        // AUTO-OPTIMIZER FOR GIANT BASE64 IMAGES -> UPLOAD TO STORAGE!
        mapped.forEach(t => {
          let needsUpdate = false;
          let updatedLogo = t.logoUrl;
          let updatedBanner = t.bannerUrl;

          const checkAndUpload = async () => {
            if (t.logoUrl && t.logoUrl.startsWith('data:image/')) {
              try {
                const compressed = t.logoUrl.length > 300000 
                  ? await compressImageFromBase64(t.logoUrl, 400, 400, 0.7)
                  : t.logoUrl;
                updatedLogo = await uploadBase64ToStorage(compressed, 'campeonatos', `${t.id}-logo`);
                needsUpdate = true;
              } catch (e) {
                console.error(e);
              }
            }
            if (t.bannerUrl && t.bannerUrl.startsWith('data:image/')) {
              try {
                const compressed = t.bannerUrl.length > 300000 
                  ? await compressImageFromBase64(t.bannerUrl, 1200, 600, 0.7)
                  : t.bannerUrl;
                updatedBanner = await uploadBase64ToStorage(compressed, 'campeonatos', `${t.id}-banner`);
                needsUpdate = true;
              } catch (e) {
                console.error(e);
              }
            }

            if (needsUpdate) {
              const updatedTournament = { ...t, logoUrl: updatedLogo, bannerUrl: updatedBanner };
              // Update local state
              setMyTournaments(prev => prev.map(item => item.id === t.id ? updatedTournament : item));
              // Update database
              saveToDB(updatedTournament);
            }
          };

          checkAndUpload();
        });
      } catch (error: any) {
        if (cancelled) return;
        console.error(error);
        setLoadingTournaments(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loadingRole, isPlatformAdmin, isOrganizador, user]);

  const [formData, setFormData] = useState({
    titulo: '',
    frase: '',
    formato: 'mata_mata' as Tournament['formato'],
    vagas: 16,
    timesPorGrupo: 4,
    classificadosPorGrupo: 2,
    tier: 'Free Elo',
    premiacao: '',
    taxa: '',
    data: '',
    temOutrosPremios: false,
    outrosPremios: '',
    logoUrl: '',
    bannerUrl: '',
    orgPhotoUrl: '',
    organizacao: '',
    regulamento: '',
    themeColor: '#FFB700',
  });

  const [files, setFiles] = useState<{ org: File | null; banner: File | null; orgPhoto: File | null }>({
    org: null,
    banner: null,
    orgPhoto: null
  });

  const orgInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const orgPhotoInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    
    // Se estiver editando, sincroniza com o torneio selecionado para preview imediato se necessário
    if (selectedTournament) {
      setSelectedTournament(prev => prev ? { 
        ...prev, 
        titulo: name === 'titulo' ? value : prev.titulo,
        frase: name === 'frase' ? value : prev.frase,
        data: name === 'data' ? value : prev.data,
        vagas: name === 'vagas' ? Number(value) : prev.vagas,
        timesPorGrupo: name === 'timesPorGrupo' ? Number(value) : prev.timesPorGrupo,
        classificadosPorGrupo: name === 'classificadosPorGrupo' ? Number(value) : prev.classificadosPorGrupo,
        tier: name === 'tier' ? value : prev.tier,
        regulamento: name === 'regulamento' ? value : prev.regulamento,
        premiacao: name === 'premiacao' ? value : prev.premiacao,
        taxa: name === 'taxa' ? value : prev.taxa,
        temOutrosPremios: name === 'temOutrosPremios' ? Boolean(val) : prev.temOutrosPremios,
        outrosPremios: name === 'outrosPremios' ? value : prev.outrosPremios,
      } : null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'org' | 'banner' | 'orgPhoto') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const maxWidth = type === 'banner' ? 1200 : 400;
        const maxHeight = type === 'banner' ? 600 : 400;
        const base64String = await compressImage(file, maxWidth, maxHeight, 0.7);
        
        setFiles(prev => ({ ...prev, [type]: file }));
        
        const fieldName = type === 'org' ? 'logoUrl' : type === 'banner' ? 'bannerUrl' : 'orgPhotoUrl';
        setFormData(prev => ({ ...prev, [fieldName]: base64String }));

        if (selectedTournament) {
          setSelectedTournament(prev => prev ? { ...prev, [fieldName]: base64String } : null);
        }
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = myTournaments.map(t => 
      t.id === selectedTournament?.id 
        ? { 
            ...t, 
            titulo: formData.titulo, 
            frase: formData.frase,
            formato: formData.formato,
            data: formData.data, 
            vagas: formData.vagas, 
            timesPorGrupo: formData.timesPorGrupo,
            classificadosPorGrupo: formData.classificadosPorGrupo,
            tier: formData.tier,
            premiacao: formData.premiacao,
            taxa: formData.taxa,
            temOutrosPremios: formData.temOutrosPremios,
            outrosPremios: formData.outrosPremios,
            logoUrl: formData.logoUrl,
            bannerUrl: formData.bannerUrl,
            orgPhotoUrl: formData.orgPhotoUrl,
            organizacao: formData.organizacao,
            themeColor: formData.themeColor
          } 
        : t
    );
    setMyTournaments(updated);
    const savedT = updated.find(t => t.id === selectedTournament?.id);
    if (savedT) saveToDB(savedT);

    // Update selected tournament state too
    if (selectedTournament) {
      setSelectedTournament(prev => prev ? {
        ...prev,
        titulo: formData.titulo,
        frase: formData.frase,
        formato: formData.formato,
        data: formData.data,
        vagas: formData.vagas,
        timesPorGrupo: formData.timesPorGrupo,
        classificadosPorGrupo: formData.classificadosPorGrupo,
        tier: formData.tier,
        premiacao: formData.premiacao,
        taxa: formData.taxa,
        temOutrosPremios: formData.temOutrosPremios,
        outrosPremios: formData.outrosPremios,
        logoUrl: formData.logoUrl,
        bannerUrl: formData.bannerUrl,
        orgPhotoUrl: formData.orgPhotoUrl,
        organizacao: formData.organizacao,
        themeColor: formData.themeColor
      } : null);
    }
    setIsEditModalOpen(false);
  };

  const openEditModal = () => {
    if (selectedTournament) {
      setFormData({
        titulo: selectedTournament.titulo,
        frase: selectedTournament.frase || '',
        formato: selectedTournament.formato || 'mata_mata',
        vagas: selectedTournament.vagas,
        timesPorGrupo: selectedTournament.timesPorGrupo || 4,
        classificadosPorGrupo: selectedTournament.classificadosPorGrupo || 2,
        tier: selectedTournament.tier || 'Free Elo',
        premiacao: selectedTournament.premiacao,
        taxa: selectedTournament.taxa,
        data: selectedTournament.data,
        temOutrosPremios: selectedTournament.temOutrosPremios || false,
        outrosPremios: selectedTournament.outrosPremios || '',
        logoUrl: selectedTournament.logoUrl || '',
        bannerUrl: selectedTournament.bannerUrl || '',
        orgPhotoUrl: selectedTournament.orgPhotoUrl || '',
        organizacao: selectedTournament.organizacao || '',
        themeColor: selectedTournament.themeColor || '#FFB700',
        regulamento: (selectedTournament as any).regulamento || '',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleApproveTeam = (tournamentId: string, teamId: string) => {
    // ⚠️ MUDANÇA DE RACE SAFETY:
    // Antes, esta função fazia saveToDB(t) com o payload INTEIRO da tabela
    // (incluindo times_inscritos completo). Se dois admins aprovassem times
    // diferentes ao mesmo tempo, um sobrescreveria a aprovação do outro.
    //
    // Agora chama RPC `aprovar_time_campeonato` (SECURITY DEFINER + FOR UPDATE),
    // que altera APENAS o status do time alvo sob lock de linha. Race-safe.
    // A atualização de estado local (setMyTournaments) continua para feedback
    // imediato, mas a fonte de verdade é o que a RPC fizer no banco.

    const updatedTournaments = (myTournaments as any[]).map(t => {
      if (t.id === tournamentId) {
        const teamToApprove = t.timesInscritos.find((team: any) => team.id === teamId);
        if (!teamToApprove) return t;

        const updatedTimesInscritos = t.timesInscritos.map((team: any) =>
          team.id === teamId ? { ...team, status: 'approved' as const } : team
        );

        // Adicionar à classificação apenas se não estiver lá
        const existingStanding = t.classificacao?.find((s: any) => s.nome === teamToApprove.name);
        let updatedClassificacao = t.classificacao || [];

        if (!existingStanding) {
          const newStanding: Standing = {
            rank: (t.classificacao?.length || 0) + 1,
            nome: teamToApprove.name,
            tag: teamToApprove.tag,
            v: 0,
            d: 0,
            wo: 0,
            j: 0,
            logo: teamToApprove.logo
          };
          updatedClassificacao = [...updatedClassificacao, newStanding];
        }

        return {
          ...t,
          timesInscritos: updatedTimesInscritos,
          classificacao: updatedClassificacao
        };
      }
      return t;
    });

    setMyTournaments(updatedTournaments);

    // ➜ Chamada atômica via API própria (substitui a RPC aprovar_time_campeonato)
    api.tournaments.aprovarTime(tournamentId, teamId, true)
      .catch((error: any) => {
        console.error('Erro ao aprovar time:', error);
        setPersistError(
          `Falha ao aprovar o time. Recarregue a página para sincronizar com o servidor. ` +
          `Detalhe: ${error.message || error}`
        );
      });

    if (selectedTournament?.id === tournamentId) {
      setSelectedTournament(prev => {
        if (!prev) return null;
        const teamToApprove = prev.timesInscritos.find(team => team.id === teamId);
        if (!teamToApprove) return prev;

        const updatedTimesInscritos = prev.timesInscritos.map(team => 
          team.id === teamId ? { ...team, status: 'approved' as const } : team
        );

        const existingStanding = prev.classificacao?.find(s => s.nome === teamToApprove.name);
        let updatedClassificacao = prev.classificacao || [];
        
        if (!existingStanding) {
          const newStanding: Standing = {
            rank: (prev.classificacao?.length || 0) + 1,
            nome: teamToApprove.name,
            tag: teamToApprove.tag,
            v: 0,
            d: 0,
            wo: 0,
            j: 0,
            logo: teamToApprove.logo
          };
          updatedClassificacao = [...updatedClassificacao, newStanding];
        }

        return {
          ...prev,
          timesInscritos: updatedTimesInscritos,
          classificacao: updatedClassificacao
        };
      });
    }
  };

  // NOTE: handleDrawGroups antigo foi removido (era código morto que exigia
  // rigidamente 16 times). O sorteio dinâmico de grupos/chaves agora é feito
  // exclusivamente em handleStatusChange quando o admin clica em "Iniciar
  // Campeonato" — ele respeita os valores configurados de vagas, timesPorGrupo
  // e classificadosPorGrupo, e funciona para 4, 8, 16 ou 32 times.

  const handleDeleteTournament = (id: string) => {
    setMyTournaments(prev => prev.filter(t => t.id !== id));
    setSelectedTournament(null);
    api.tournaments.remove(id)
      .catch((error: any) => console.error('Erro ao deletar campeonato:', error?.message || error));
  };

  const handleStatusChange = (tournamentId: string, newStatus: Tournament['status']) => {
    let finalUpdate: any = null;
    
    const updated = myTournaments.map(t => {
      if (t.id === tournamentId) {
        let updatedT = { ...t, status: newStatus };
        
        // AUTO-DRAW when starting (League or Knockout)
        if (newStatus === 'em_andamento' && !(t as any).gruposSorteados) {
          const approvedTeams = t.timesInscritos.filter(team => team.status === 'approved');
          const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
          
          if (t.formato === 'liga') {
            const numTeams = approvedTeams.length;
            const teamsPerGroup = (t as any).timesPorGrupo || 4;
            const numGroups = Math.ceil(numTeams / teamsPerGroup);
            
            const groups: any = {};
            for (let i = 0; i < numGroups; i++) {
              const groupName = `Grupo ${String.fromCharCode(65 + i)}`;
              groups[groupName] = shuffled.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
            }

            const newCronograma: any[] = [];
            Object.entries(groups).forEach(([groupName, teams]: [string, any]) => {
              for (let i = 0; i < (teams as any[]).length; i++) {
                for (let j = i + 1; j < (teams as any[]).length; j++) {
                  newCronograma.push({
                    id: `match-${groupName}-${i}-${j}-${Date.now()}`,
                    fase: groupName,
                    timeA: teams[i].tag || teams[i].name,
                    iconeA: teams[i].icone || 'ShieldCheck',
                    corA: teams[i].cor || '#FFB700',
                    timeB: teams[j].tag || teams[j].name,
                    iconeB: teams[j].icone || 'Swords',
                    corB: teams[j].cor || '#FFB700',
                    placar: '0 - 0',
                    status: 'combinando',
                    espelho: 'A definir',
                    transmissao: 'm7_oficial'
                  });
                }
              }
            });

            updatedT = {
              ...updatedT,
              grupos: groups,
              cronograma: newCronograma,
              gruposSorteados: true,
              timesOrdemSorteio: shuffled.map(team => team.id)
            } as any;
          } else if (t.formato === 'mata_mata') {
            // Sorteio de Chaves para Mata-Mata
            const numTeams = Number(t.vagas);
            
            // Inicializar estrutura de chaves
            const INITIAL_BRACKET = {
              side: {
                left: { 
                  r64: Array(16).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  r32: Array(8).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  r16: Array(4).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  qf: Array(2).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  sf: [{ t1: '', t2: '', s1: 0, s2: 0, winner: null }]
                },
                right: { 
                  r64: Array(16).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  r32: Array(8).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  r16: Array(4).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  qf: Array(2).fill(null).map((_, i) => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null })),
                  sf: [{ t1: '', t2: '', s1: 0, s2: 0, winner: null }]
                },
                grandFinal: { t1: '', t2: '', s1: 0, s2: 0, winner: null }
              }
            };

            // Distribuir times no round inicial correto dependendo das vagas
            const initialRoundKey = numTeams >= 64 ? 'r64' : numTeams >= 32 ? 'r32' : numTeams >= 16 ? 'r16' : numTeams >= 8 ? 'qf' : 'sf';
            const matchesInInitialRound = numTeams / 2;
            const matchesPerSide = matchesInInitialRound / 2;

            for (let i = 0; i < matchesInInitialRound; i++) {
              const side = i < matchesPerSide ? 'left' : 'right';
              const idx = i < matchesPerSide ? i : i - matchesPerSide;
              const t1 = shuffled[i * 2] ? shuffled[i * 2].name : 'TBD';
              const t2 = shuffled[i * 2 + 1] ? shuffled[i * 2 + 1].name : 'TBD';
              
              (INITIAL_BRACKET.side as any)[side][initialRoundKey][idx] = { t1, t2, s1: 0, s2: 0, winner: null };
            }

            api.tournaments.update(tournamentId, { bracket_data: INITIAL_BRACKET })
              .catch((error: any) => console.error('Erro ao salvar bracket:', error?.message || error));
            updatedT = { ...updatedT, gruposSorteados: true } as any;
          }
        }
        
        finalUpdate = updatedT;
        return updatedT;
      }
      return t;
    });

    setMyTournaments(updated as any);
    if (finalUpdate) saveToDB(finalUpdate as any);

    if (selectedTournament?.id === tournamentId) {
      setSelectedTournament(finalUpdate);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 md:py-6 sticky top-0 z-40 backdrop-blur-xl bg-white/80">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => {
                if (selectedTournament) {
                  setSelectedTournament(null);
                } else if (activeTab === 'create') {
                  setActiveTab('manage');
                } else {
                  navigate('/');
                }
              }}
              className="p-1.5 md:p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1 md:mx-2" />
            <h1 className="text-sm md:text-lg font-black tracking-tight text-slate-900 uppercase">
              {activeTab === 'create' ? 'Configurar Arena' : selectedTournament ? 'Gestão de Arena' : 'Meus Campeonatos'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full border border-teal-100">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">Acesso Administrativo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Banner de erro de persistência — aparece quando saveToDB falha */}
      {persistError && (
        <div className="max-w-6xl w-full mx-auto px-6 md:px-10 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest mb-1">Falha ao salvar no servidor</p>
                <p className="text-xs font-medium leading-relaxed">{persistError}</p>
              </div>
            </div>
            <button
              onClick={() => setPersistError(null)}
              className="w-8 h-8 rounded-lg hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="p-6 md:p-10 max-w-6xl w-full mx-auto">
        {/* Hidden File Inputs for Refs */}
        <input type="file" ref={orgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'org')} />
        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} />
        <input type="file" ref={orgPhotoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'orgPhoto')} />
        
        <AnimatePresence mode="wait">
          {activeTab === 'create' ? (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden"
            >
              <form 
                onSubmit={async (e) => { 
                  e.preventDefault(); 
                  const tempId = Math.random().toString(36).substring(2, 9);
                  const processed = await processTournamentImages({
                    logoUrl: formData.logoUrl,
                    bannerUrl: formData.bannerUrl,
                    orgPhotoUrl: formData.orgPhotoUrl,
                  }, tempId);

                  const newTournament: Tournament = {
                    id: tempId,
                    titulo: formData.titulo,
                    frase: formData.frase,
                    formato: formData.formato,
                    status: 'inscricoes_em_breve',
                    vagas: Number(formData.vagas),
                    timesPorGrupo: formData.formato === 'liga' ? Number(formData.timesPorGrupo) : undefined,
                    classificadosPorGrupo: formData.formato === 'liga' ? Number(formData.classificadosPorGrupo) : undefined,
                    tier: formData.tier,
                    data: formData.data || new Date().toISOString().split('T')[0],
                    premiacao: formData.premiacao,
                    taxa: formData.taxa,
                    temOutrosPremios: formData.temOutrosPremios,
                    outrosPremios: formData.outrosPremios,
                    logoUrl: processed.logoUrl,
                    bannerUrl: processed.bannerUrl,
                    orgPhotoUrl: processed.orgPhotoUrl,
                    organizacao: formData.organizacao,
                    regulamento: formData.regulamento,
                    themeColor: formData.themeColor || '#FFB700',
                    timesInscritos: []
                  };
                  const dbPayload = {
                    ...toDbPayload(newTournament),
                    criado_por: user?.id,
                  };
                  try {
                    // A API antiga reportava violação de RLS (42501) com dica de migration;
                    // a API nova joga o erro HTTP como exceção e a mensagem do servidor já
                    // explica o motivo.
                    const data = await api.tournaments.create(dbPayload);
                    if (data) setMyTournaments(prev => [mapFromDb(data), ...prev]);
                  } catch (error: any) {
                    console.error('Erro ao criar campeonato:', error);
                    setPersistError(`Falha ao criar campeonato: ${error?.message || error}`);
                  }
                  setActiveTab('manage');
                  setFormData({
                    titulo: '',
                    frase: '',
                    organizacao: '',
                    vagas: 16,
                    tier: 'Free Elo',
                    premiacao: '',
                    taxa: '',
                    data: '',
                    temOutrosPremios: false,
                    outrosPremios: '',
                    logoUrl: '',
                    bannerUrl: '',
                    orgPhotoUrl: '',
                    formato: 'mata_mata',
                    timesPorGrupo: 4,
                    classificadosPorGrupo: 2,
                    regulamento: '',
                    themeColor: '#FFB700',
                  });
                }} 
                className="p-6 md:p-12 space-y-10 md:space-y-12 text-slate-800"
              >
                
                {/* Seção 1: Identidade Visual */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Identidade do Evento</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capas e títulos oficiais</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-800">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Campeonato</label>
                      <input name="titulo" value={formData.titulo} onChange={handleInputChange} placeholder="Ex: Master League S1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base" required />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                      <input name="frase" value={formData.frase} onChange={handleInputChange} placeholder="Ex: O maior torneio de League of Legends do cenário" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base" />
                    </div>

                    <div className="space-y-4 md:col-span-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cor Tema do Campeonato</label>
                       <div className="flex flex-wrap gap-4 items-center">
                         {[
                           { name: 'Amarelo', hex: '#FFB700' },
                           { name: 'Roxo', hex: '#D500FF' },
                           { name: 'Verde', hex: '#00FF41' },
                           { name: 'Vermelho', hex: '#FF003C' },
                           { name: 'Laranja', hex: '#FF4D00' },
                           { name: 'Azul', hex: '#00FFFF' },
                         ].map(color => (
                           <button
                             key={color.hex}
                             type="button"
                             onClick={() => setFormData(prev => ({ ...prev, themeColor: color.hex }))}
                             className={`group flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                               formData.themeColor === color.hex 
                                 ? 'border-teal-500 bg-teal-50' 
                                 : 'border-slate-100 bg-slate-50 hover:border-teal-200'
                             }`}
                           >
                             <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: color.hex }} />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{color.name}</span>
                             {formData.themeColor === color.hex && <Check className="w-3 h-3 text-teal-600" />}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Regulamento do Campeonato</label>
                       <textarea 
                         name="regulamento" 
                         value={formData.regulamento} 
                         onChange={handleInputChange} 
                         placeholder="Cole aqui todas as regras, termos e condições do seu campeonato..." 
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base min-h-[150px] resize-y"
                       />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {/* Logo da Arena */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Logo Arena (Preview Card)</label>
                      <div 
                        onClick={() => orgInputRef.current?.click()} 
                        className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
                      >
                        {formData.logoUrl ? (
                          <>
                            <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Upload className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Principal</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Banner Card */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Banner Card</label>
                      <div 
                        onClick={() => bannerInputRef.current?.click()} 
                        className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
                      >
                        {formData.bannerUrl ? (
                          <>
                            <img src={formData.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imagem Banner</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Foto da Organização */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-teal-600">Foto Org (PNG Sugerida)</label>
                      <div 
                        onClick={() => orgPhotoInputRef.current?.click()} 
                        className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
                      >
                        {formData.orgPhotoUrl ? (
                          <>
                            <img src={formData.orgPhotoUrl} alt="Org" className="w-24 h-24 object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Users className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                              <Users className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Responsável</span>
                          </>
                        )}
                      </div>
                      <input
                        type="text"
                        name="organizacao"
                        value={formData.organizacao}
                        onChange={handleInputChange}
                        placeholder="Nome da organização (ex: M7 Academy)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 2: Logística e Arena */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                      <Diamond size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Configuração de Arena</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parâmetros técnicos e premiações</p>
                    </div>
                  </div>

                   <div className="space-y-4">
                    {/* Formato */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <Settings2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Formato do Torneio</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defina a estrutura da competição</p>
                        </div>
                      </div>
                      <select name="formato" value={formData.formato} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                        <option value="mata_mata">Mata-Mata (Eliminação Direta)</option>
                        <option value="liga">Liga (Grupos + Playoffs)</option>
                      </select>
                    </div>

                    {/* Vagas */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <Users size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Vagas (Equipes)</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacidade total de times</p>
                        </div>
                      </div>
                      <select name="vagas" value={formData.vagas} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                        <option value={4}>4 Times</option>
                        <option value={8}>8 Times</option>
                        <option value={16}>16 Times</option>
                        <option value={32}>32 Times</option>
                      </select>
                    </div>

                    {formData.formato === 'liga' && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4 pt-2"
                      >
                        <div className="bg-teal-50/30 border border-teal-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                              <Layout size={24} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Equipes por Grupo</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Divisão da fase inicial</p>
                            </div>
                          </div>
                          <select name="timesPorGrupo" value={formData.timesPorGrupo} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                            <option value={2}>2 Equipes</option>
                            <option value={4}>4 Equipes</option>
                            <option value={8}>8 Equipes</option>
                            <option value={16}>16 Equipes</option>
                          </select>
                        </div>

                        <div className="bg-teal-50/30 border border-teal-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                              <Trophy size={24} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Passam p/ Chaveamento</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipes classificadas p/ grupo</p>
                            </div>
                          </div>
                          <select name="classificadosPorGrupo" value={formData.classificadosPorGrupo} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                            <option value={1}>Top 1 (Apenas o Líder)</option>
                            <option value={2}>Top 2 (Líder e Vice)</option>
                            <option value={4}>Top 4</option>
                            <option value={8}>Top 8</option>
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {/* Tier */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <Diamond size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tier / Categoria</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nível de habilidade exigido</p>
                        </div>
                      </div>
                      <select name="tier" value={formData.tier} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                        <option value="Free Elo">Free Elo</option>
                        <option value="Tier I">Tier 1</option>
                        <option value="Tier II">Tier 2</option>
                        <option value="Tier III">Tier 3</option>
                        <option value="Tier IV">Tier 4</option>
                      </select>
                    </div>

                    {/* Data */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <Calendar size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Data Início</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início das competições</p>
                        </div>
                      </div>
                      <input type="date" name="data" value={formData.data} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
                    </div>

                    {/* Premiação Cash */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors border-l-4 border-l-teal-500">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <Wallet size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Prêmio em Dinheiro</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor principal do torneio</p>
                        </div>
                      </div>
                      <input name="premiacao" value={formData.premiacao} onChange={handleInputChange} placeholder="Ex: R$ 2.000" className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
                    </div>

                    {/* Inscrição */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                          <CreditCard size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Taxa de Inscrição</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo para participar</p>
                        </div>
                      </div>
                      <input name="taxa" value={formData.taxa} onChange={handleInputChange} placeholder="Ex: R$ 50" className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
                    </div>

                    {/* Prêmios Extras Option */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-6 hover:bg-slate-100/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                            <Gift size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Prêmios Adicionais</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Skins, MVP, Brindes...</p>
                          </div>
                        </div>
                        <div 
                          onClick={() => setFormData(prev => ({ ...prev, temOutrosPremios: !prev.temOutrosPremios }))}
                          className={`w-14 h-7 rounded-full cursor-pointer transition-all relative ${formData.temOutrosPremios ? 'bg-teal-600 shadow-[0_0_15px_rgba(13,148,136,0.4)]' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${formData.temOutrosPremios ? 'left-8' : 'left-1'}`} />
                        </div>
                      </div>
                      {formData.temOutrosPremios && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                          <textarea 
                            name="outrosPremios" 
                            value={formData.outrosPremios} 
                            onChange={handleInputChange} 
                            placeholder="Descreva aqui os prêmios extras (Ex: Skin Lendária para o MVP, MP Coins para Top 2...)" 
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-6 focus:outline-none focus:border-teal-500 font-bold text-sm h-32 resize-none shadow-sm"
                          />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex items-center justify-end gap-6 border-t border-slate-100">
                  <button type="button" onClick={() => setActiveTab('manage')} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 px-6">Cancelar</button>
                  <button type="submit" className="bg-teal-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20 hover:bg-teal-700 transition-all flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Publicar
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="manage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {selectedTournament ? (
                // MANAGEMENT VIEW
                <div className="space-y-8">
                  {/* Dashboard Header */}
                  <div className="bg-teal-600 rounded-[2rem] md:rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-teal-600/20 group min-h-[160px] flex flex-col justify-end">
                    {selectedTournament.bannerUrl ? (
                      <img src={selectedTournament.bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover opacity-40 transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 transition-transform group-hover:scale-110">
                        <Trophy className="w-24 h-24 md:w-32 md:h-32" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-teal-900 via-teal-900/60 to-transparent" />
                    
                    <div className="relative z-10 px-6 pb-6 md:px-10 md:pb-10 pt-12 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
                      <div className="flex items-start gap-6">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white p-1 shadow-2xl shrink-0 hidden sm:block">
                          <div className="w-full h-full rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                            {selectedTournament.logoUrl ? (
                              <img src={selectedTournament.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              <Trophy className="w-8 h-8 text-teal-600" />
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 md:space-y-3">
                          <button onClick={() => setSelectedTournament(null)} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">
                            <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" /> Voltar à lista
                          </button>
                          <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase leading-none">{selectedTournament.titulo}</h2>
                          <div className="flex flex-wrap items-center gap-4 md:gap-6 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="opacity-50 flex items-center justify-center">
                                <Diamond size={14} />
                              </span>
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{selectedTournament.tier || 'Free Elo'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-50" />
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{selectedTournament.timesInscritos.length} / {selectedTournament.vagas} Inscritos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-50" />
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{new Date(selectedTournament.data).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch md:items-end gap-3">
                        <button 
                          onClick={openEditModal}
                          className="w-full md:w-auto px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-2xl bg-white text-teal-600 font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                        >
                          <Settings2 className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
                    {/* Team List Column */}
                    <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 space-y-6 md:space-y-8">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-4 md:pb-6">
                        <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4 text-teal-600" /> Candidatos ao Trono
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {selectedTournament.timesInscritos.length === 0 ? (
                          <div className="py-16 md:py-20 flex flex-col items-center opacity-20">
                            <Users className="w-10 h-10 md:w-12 md:h-12 mb-4" />
                            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Aguardando guerreiros...</span>
                          </div>
                        ) : (
                          selectedTournament.timesInscritos.map(team => (
                            <div key={team.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white hover:border-teal-200 transition-all">
                              <div className="flex items-center gap-4 md:gap-6">
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden group-hover:bg-teal-600 transition-colors">
                                  {team.logo ? (
                                    <img src={team.logo} alt="Logo" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-black text-base md:text-lg text-white">{team.tag}</span>
                                  )}
                                </div>
                                <div>
                                  <h5 className="font-black text-slate-800 uppercase text-base md:text-lg leading-tight">{team.name}</h5>
                                  <div className="flex items-center gap-3 mt-1">
                                    {(team.discord || team.whatsapp) && (
                                      <div className="flex items-center gap-2">
                                        {team.discord && (
                                          <button 
                                            onClick={() => {
                                              navigator.clipboard.writeText(team.discord!);
                                              alert('Discord copiado: ' + team.discord);
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-md transition-all group/btn"
                                            title="Copiar Discord"
                                          >
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-indigo-400">Discord:</span>
                                            <span className="text-[9px] font-bold">{team.discord}</span>
                                            <Copy className="w-3 h-3 ml-0.5 opacity-40 group-hover/btn:opacity-100" />
                                          </button>
                                        )}
                                        {team.whatsapp && (
                                          <button 
                                            onClick={() => {
                                              navigator.clipboard.writeText(team.whatsapp!);
                                              alert('WhatsApp copiado: ' + team.whatsapp);
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-green-600 rounded-md transition-all group/btn"
                                            title="Copiar WhatsApp"
                                          >
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-green-400">Whats:</span>
                                            <span className="text-[9px] font-bold">{team.whatsapp}</span>
                                            <Copy className="w-3 h-3 ml-0.5 opacity-40 group-hover/btn:opacity-100" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 sm:gap-4 ml-[60px] sm:ml-0">
                                {team.status === 'pending' ? (
                                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                    <button 
                                      onClick={() => handleApproveTeam(selectedTournament.id, team.id)}
                                      className="h-10 md:h-12 px-6 md:px-8 rounded-xl bg-teal-600 text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20"
                                    >
                                      Aprovar
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const updatedTournaments = myTournaments.map(t => {
                                          if (t.id === selectedTournament.id) {
                                            return {
                                              ...t,
                                              timesInscritos: t.timesInscritos.filter(team_ => team_.id !== team.id)
                                            };
                                          }
                                          return t;
                                        });
                                        setMyTournaments(updatedTournaments);
                                        const updT = updatedTournaments.find(t => t.id === selectedTournament?.id);
                                        if (updT) saveToDB(updT);
                                        setSelectedTournament(prev => prev ? {
                                          ...prev,
                                          timesInscritos: prev.timesInscritos.filter(team_ => team_.id !== team.id)
                                        } : null);
                                      }}
                                      className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all"
                                      title="Excluir Candidato"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Aprovado</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Quick Info Sidebar */}
                    <div className="space-y-6">
                      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operações</h4>
                        <div className="space-y-3">
                          {selectedTournament.status === 'inscricoes_em_breve' && (
                            <button 
                              onClick={() => handleStatusChange(selectedTournament.id, 'inscricoes_abertas')}
                              className="w-full py-4 rounded-xl bg-teal-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-700 transition-all shadow-2xl shadow-teal-600/20 group"
                            >
                              <Plus className="w-4 h-4" /> Abrir Inscrições
                            </button>
                          )}
                          
                          {selectedTournament.status === 'inscricoes_abertas' && (
                            <>
                              {/*
                                Correção: só habilita "Iniciar Campeonato" quando o número
                                de aprovados é EXATAMENTE igual a vagas. Antes, qualquer
                                quantidade ≥ vagas habilitava o botão — o que permitia
                                iniciar com 17 aprovados num torneio de 16 vagas e
                                quebrava o sorteio (chaves esperam potência de 2 / múltiplo
                                de timesPorGrupo). Agora é estritamente igual.
                              */}
                              <button
                                disabled={selectedTournament.timesInscritos.filter(t => t.status === 'approved').length !== selectedTournament.vagas}
                                onClick={() => handleStatusChange(selectedTournament.id, 'em_andamento')}
                                className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                  selectedTournament.timesInscritos.filter(t => t.status === 'approved').length === selectedTournament.vagas
                                    ? 'bg-teal-600 text-white shadow-2xl shadow-teal-600/20 hover:bg-teal-700'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <Play className="w-4 h-4" /> Iniciar Campeonato ({selectedTournament.timesInscritos.filter(t => t.status === 'approved').length}/{selectedTournament.vagas})
                              </button>
                            </>
                          )}

                          {selectedTournament.status === 'em_andamento' && (
                            <>
                              {(() => {
                                const handleGerarBracket = async (t: any) => {
                                  // Busca dados frescos do banco — evita usar estado desatualizado
                                  // (o usuário pode ter editado jogos de grupo em outra página)
                                  const fresh = await api.tournaments.detail(t.id);
                                  const grupos     = fresh?.grupos          || t.grupos       || {};
                                  const cronograma = fresh?.cronograma      || t.cronograma   || [];
                                  const timesInsc  = fresh?.times_inscritos || t.timesInscritos || [];

                                  const id = (tm: any) => tm?.tag || tm?.name || 'TBD';

                                  // Calcula stats de um time nos jogos de GRUPO do cronograma
                                  const getStats = (tag: string, cronograma: any[]) => {
                                    let v = 0, d = 0, p = 0;
                                    (cronograma || []).forEach((m: any) => {
                                      const fase = (m.fase || m.grupo || '').toUpperCase();
                                      if (!fase.includes('GRUPO') && !fase.includes('DESEMPATE')) return;
                                      if (m.status !== 'finalizado') return;
                                      const isA = m.timeA === tag;
                                      const isB = m.timeB === tag;
                                      if (!isA && !isB) return;
                                      if (m.placar) {
                                        const [s1, s2] = m.placar.split('-').map((s: string) => parseInt(s.trim()) || 0);
                                        const myScore = isA ? s1 : s2;
                                        const opScore = isA ? s2 : s1;
                                        if (myScore > opScore) { v++; p += 3; } else { d++; }
                                      }
                                    });
                                    return { v, d, p };
                                  };

                                  // Para liga: usa classificação real dos grupos (dados frescos do banco)
                                  let teamsForBracket: any[] = [];
                                  // Defaults alinhados com o formulário (4/2). Antes
                                  // usava 8/4 aqui, divergindo do form e do gerador
                                  // do CampeonatoDetalhes.tsx.
                                  const classificados = t.classificadosPorGrupo || 2;
                                  const numGrupos = t.formato === 'liga'
                                    ? Math.ceil(Number(t.vagas) / (t.timesPorGrupo || 4))
                                    : 1;
                                  const bracketTeams = t.formato === 'liga'
                                    ? numGrupos * classificados
                                    : timesInsc.filter((tm: any) => tm.status === 'approved').length;

                                  if (t.formato === 'liga' && grupos && Object.keys(grupos).length > 0) {
                                    // Usa resultados reais dos grupos para seedar o bracket
                                    const qualifiedPerGroup: any[] = [];
                                    Object.entries(grupos).forEach(([, teams]: [string, any]) => {
                                      const ranked = (teams as any[])
                                        .map((tm: any) => ({ ...tm, ...getStats(id(tm), cronograma) }))
                                        .sort((a: any, b: any) => b.v !== a.v ? b.v - a.v : a.d !== b.d ? a.d - b.d : b.p - a.p);
                                      qualifiedPerGroup.push(...ranked.slice(0, classificados));
                                    });
                                    teamsForBracket = qualifiedPerGroup;
                                  } else {
                                    // Fallback: sorteia os aprovados
                                    const approved = timesInsc.filter((tm: any) => tm.status === 'approved');
                                    teamsForBracket = [...approved].sort(() => Math.random() - 0.5).slice(0, bracketTeams);
                                  }
                                  const roundKey = bracketTeams >= 64 ? 'r64' : bracketTeams >= 32 ? 'r32' : bracketTeams >= 16 ? 'r16' : bracketTeams >= 8 ? 'qf' : 'sf';
                                  const mkMatch = () => ({ t1: '', t2: '', s1: 0, s2: 0, winner: null });
                                  const bracket: any = {
                                    side: {
                                      left:  { r64: Array(16).fill(null).map(mkMatch), r32: Array(8).fill(null).map(mkMatch), r16: Array(4).fill(null).map(mkMatch), qf: Array(2).fill(null).map(mkMatch), sf: [mkMatch()] },
                                      right: { r64: Array(16).fill(null).map(mkMatch), r32: Array(8).fill(null).map(mkMatch), r16: Array(4).fill(null).map(mkMatch), qf: Array(2).fill(null).map(mkMatch), sf: [mkMatch()] },
                                      grandFinal: mkMatch()
                                    }
                                  };
                                  if (bracketTeams <= 2) {
                                    // Final direta: apenas 2 times se enfrentam na grande final
                                    bracket.side.grandFinal = { t1: id(teamsForBracket[0]), t2: id(teamsForBracket[1] || null), s1: 0, s2: 0, winner: null };
                                  } else if (roundKey === 'sf') {
                                    const half = Math.ceil(teamsForBracket.length / 2);
                                    const leftTeams  = teamsForBracket.slice(0, half);
                                    const rightTeams = teamsForBracket.slice(half);
                                    bracket.side.left.sf[0]  = { t1: id(leftTeams[0]),  t2: id(leftTeams[1]),  s1: 0, s2: 0, winner: null };
                                    bracket.side.right.sf[0] = { t1: id(rightTeams[0]), t2: id(rightTeams[1]), s1: 0, s2: 0, winner: null };
                                  } else {
                                    const half = Math.ceil(teamsForBracket.length / 2);
                                    const leftTeams  = teamsForBracket.slice(0, half);
                                    const rightTeams = teamsForBracket.slice(half);
                                    for (let i = 0; i < Math.floor(leftTeams.length / 2); i++)
                                      bracket.side.left[roundKey][i]  = { t1: id(leftTeams[i*2]),  t2: id(leftTeams[i*2+1]),  s1: 0, s2: 0, winner: null };
                                    for (let i = 0; i < Math.floor(rightTeams.length / 2); i++)
                                      bracket.side.right[roundKey][i] = { t1: id(rightTeams[i*2]), t2: id(rightTeams[i*2+1]), s1: 0, s2: 0, winner: null };
                                  }
                                  // Chave é 100% VISUAL: não cria jogos no cronograma. Apenas
                                  // remove jogos da chave ("MATA-MATA (CHAVEAMENTO)") que tenham
                                  // sobrado de versões antigas. Os resultados que contam são
                                  // lançados manualmente no cronograma.
                                  const newCronograma = cronograma.filter(
                                    (c: any) => c.fase !== 'MATA-MATA (CHAVEAMENTO)',
                                  );

                                  api.tournaments.update(t.id, { bracket_data: bracket, chaves_sorteados: true, cronograma: newCronograma })
                                    .then(() => {
                                      const updated = { ...t, chavesSorteados: true, cronograma: newCronograma };
                                      setSelectedTournament(updated as any);
                                      setMyTournaments((prev: any) => prev.map((mt: any) => mt.id === t.id ? updated : mt));
                                    })
                                    .catch((error: any) => { alert('Erro ao gerar chaveamento: ' + (error?.message || error)); });
                                };
                                return (selectedTournament as any).chavesSorteados ? (
                                  <div className="flex flex-col gap-2">
                                    <div className="w-full py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-default">
                                      <CheckCircle2 className="w-4 h-4" /> Chaveamento Criado
                                    </div>
                                    <button
                                      onClick={() => { if (window.confirm('Regerar o chaveamento? Os resultados atuais serão perdidos.')) handleGerarBracket(selectedTournament); }}
                                      className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                    >
                                      ↺ Regerar Chaveamento
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleGerarBracket(selectedTournament)}
                                    className="w-full py-4 rounded-xl bg-teal-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-700 transition-all shadow-2xl shadow-teal-600/20"
                                  >
                                    <Trophy className="w-4 h-4" /> Gerar Chaveamento
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => handleStatusChange(selectedTournament.id, 'finalizado')}
                                className="w-full py-4 rounded-xl border border-red-200 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
                              >
                                Encerrar Campeonato
                              </button>
                            </>
                          )}

                          {selectedTournament.status === 'finalizado' && (
                            <>
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campeonato Finalizado</span>
                              </div>
                              {/*
                                Botão de recovery: permite reabrir um campeonato finalizado
                                por engano sem precisar editar o banco manualmente.
                                Confirmação dupla evita cliques acidentais.
                                Usa RPC reabrir_campeonato (SECURITY DEFINER, apenas admin).
                              */}
                              <button
                                onClick={() => {
                                  if (!window.confirm('Tem certeza que deseja REABRIR este campeonato? Ele voltará ao status "em andamento" e poderá ser editado novamente.')) return;
                                  if (!window.confirm('Confirmação final: reabrir o campeonato "' + selectedTournament.titulo + '"?')) return;
                                  api.tournaments.reabrir(selectedTournament.id)
                                    .then((reopened: any) => {
                                      // Atualiza estado local
                                      const reopenedLocal = { ...selectedTournament, status: 'em_andamento' as const };
                                      setSelectedTournament(reopenedLocal);
                                      setMyTournaments(prev => prev.map(t => t.id === reopenedLocal.id ? reopenedLocal : t));
                                    })
                                    .catch((error: any) => {
                                      console.error('Erro ao reabrir campeonato:', error);
                                      setPersistError(`Falha ao reabrir o campeonato. ${error.message || error}`);
                                    });
                                }}
                                className="w-full py-4 rounded-xl border border-amber-300 text-amber-700 bg-amber-50/50 font-black text-[10px] uppercase tracking-widest hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                                title="Reabrir um campeonato encerrado por engano"
                              >
                                ↺ Reabrir Campeonato
                              </button>
                            </>
                          )}

                          {selectedTournament.status === 'inscricoes_em_breve' && (
                            <button 
                              onClick={() => handleDeleteTournament(selectedTournament.id)}
                              className="w-full py-4 rounded-xl border border-red-100 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" /> Excluir Campeonato
                            </button>
                          )}

                          <button className="w-full py-4 rounded-xl border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                            Exportar CSV
                          </button>
                        </div>
                      </div>

                      <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black text-teal-500 uppercase tracking-widest">Protocolo</span>
                          <AlertCircle className="w-4 h-4 opacity-50" />
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed text-white/50">
                          {selectedTournament.status === 'inscricoes_abertas' && selectedTournament.timesInscritos.length < selectedTournament.vagas
                            ? `Faltam ${selectedTournament.vagas - selectedTournament.timesInscritos.length} times para possibilitar o início do campeonato.`
                            : 'Gerenciamento de permissões e chaves ativo.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // TOURAMENT LIST VIEW
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Plus Card */}
                  <motion.div 
                    onClick={() => setActiveTab('create')}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="min-h-[280px] border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-teal-400 hover:bg-teal-50/10 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center transition-transform group-hover:scale-110">
                      <Plus className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-800 block mb-1">Novo Campeonato</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Build a new arena</span>
                    </div>
                  </motion.div>

                  {myTournaments.map(tournament => (
                    <motion.div 
                      key={tournament.id}
                      onClick={() => setSelectedTournament(tournament)}
                      className="bg-white border border-slate-200 rounded-[2.5rem] cursor-pointer relative group transition-all overflow-hidden"
                    >
                      {/* Banner area */}
                      <div className="h-40 relative bg-slate-900">
                        {tournament.logoUrl ? (
                          <img src={tournament.logoUrl} alt="Banner" className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 opacity-60" />
                        )}
                        
                        {/* Status Tag */}
                        <div className="absolute top-6 left-8 right-8 flex items-center justify-between">
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md shadow-xl ${
                            tournament.status === 'inscricoes_abertas' ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' : 
                            tournament.status === 'inscricoes_em_breve' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 
                            tournament.status === 'em_andamento' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-white border-slate-800'
                          }`}>
                            {tournament.status.replace('_', ' ')}
                          </div>

                          {tournament.status === 'inscricoes_em_breve' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Deseja realmente excluir este campeonato? Esta ação não pode ser desfeita.')) {
                                  handleDeleteTournament(tournament.id);
                                }
                              }}
                              className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all backdrop-blur-md border border-red-500/20 flex items-center justify-center"
                              title="Excluir Campeonato"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Logo Overlay */}
                        <div className="absolute -bottom-6 left-8">
                          <div className="w-16 h-16 rounded-2xl bg-white p-1 border-4 border-white shadow-xl">
                            <div className="w-full h-full rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                              {tournament.logoUrl ? (
                                <img src={tournament.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <Trophy className="w-6 h-6 text-teal-600" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 pt-12">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight truncate">
                            {tournament.titulo}
                          </h3>
                          <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-teal-600 transition-colors shrink-0" />
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Inscritos</span>
                            <div className="flex items-center gap-2 font-black text-sm text-slate-800">
                              <Users className="w-4 h-4 text-teal-600" />
                              {tournament.timesInscritos.length}/{tournament.vagas}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kick-off</span>
                            <div className="flex items-center gap-2 font-black text-sm text-slate-800">
                              <Calendar className="w-4 h-4 text-teal-600" />
                              {new Date(tournament.data).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal Overlay */}
        <AnimatePresence>
          {isEditModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10"
            >
              <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setIsEditModalOpen(false)}
              />
              
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-6 md:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/20 text-xl font-black">
                      <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">Configurações</h3>
                      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Ajuste os parâmetros</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-2 md:p-3 hover:bg-slate-200 rounded-xl md:rounded-2xl text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 custom-scrollbar text-slate-800">
                  {/* Identidade Grid */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Layout className="w-4 h-4 text-teal-600" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identidade Visual</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                        <input name="titulo" value={formData.titulo} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:border-teal-500 outline-none font-bold text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Slogan</label>
                        <input name="frase" value={formData.frase} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:border-teal-500 outline-none font-bold text-sm" />
                      </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Tema</label>
                       <div className="flex flex-wrap gap-2 items-center">
                         {[
                           { name: 'Amarelo', hex: '#FFB700' },
                           { name: 'Roxo', hex: '#D500FF' },
                           { name: 'Verde', hex: '#00FF41' },
                           { name: 'Vermelho', hex: '#FF003C' },
                           { name: 'Laranja', hex: '#FF4D00' },
                           { name: 'Azul', hex: '#00FFFF' },
                         ].map(color => (
                           <button
                             key={color.hex}
                             type="button"
                             onClick={() => setFormData(prev => ({ ...prev, themeColor: color.hex }))}
                             className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                               formData.themeColor === color.hex 
                                 ? 'border-teal-500 scale-110 shadow-lg' 
                                 : 'border-white'
                             }`}
                             style={{ backgroundColor: color.hex }}
                             title={color.name}
                           >
                             {formData.themeColor === color.hex && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div onClick={() => orgInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                        {formData.logoUrl ? (
                          <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-4 h-4 text-slate-400" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">LOGO</div>
                      </div>
                      <div onClick={() => bannerInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                        {formData.bannerUrl ? (
                          <img src={formData.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">BANNER</div>
                      </div>
                      <div onClick={() => orgPhotoInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                        {formData.orgPhotoUrl ? (
                          <img src={formData.orgPhotoUrl} alt="Org" className="w-full h-full object-contain p-2" />
                        ) : (
                          <Users className="w-4 h-4 text-slate-400" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">ORG PHOTO</div>
                      </div>
                    </div>
                  </div>

                  {/* Logística Grid */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Diamond size={16} color="#0d9488" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logística e Premiação</h4>
                    </div>
                    <div className="space-y-4">
                    {/* List-style rows for parameters */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Formato</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estrutura do torneio</p>
                      </div>
                      <select name="formato" value={formData.formato} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs appearance-none cursor-pointer">
                        <option value="mata_mata">Mata-Mata</option>
                        <option value="liga">Liga (Grupos)</option>
                      </select>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Vagas</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total de equipes</p>
                      </div>
                      <select name="vagas" value={formData.vagas} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs appearance-none cursor-pointer">
                        <option value={4}>4 Equipes</option>
                        <option value={8}>8 Equipes</option>
                        <option value={16}>16 Equipes</option>
                        <option value={32}>32 Equipes</option>
                      </select>
                    </div>

                    {formData.formato === 'liga' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-teal-50/30 border border-teal-100 rounded-2xl p-4 flex flex-col justify-between gap-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Times p/ Grupo</label>
                          <select name="timesPorGrupo" value={formData.timesPorGrupo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs cursor-pointer">
                            <option value={3}>3 Times</option>
                            <option value={4}>4 Times</option>
                            <option value={6}>6 Times</option>
                            <option value={8}>8 Times</option>
                          </select>
                        </div>
                        <div className="bg-teal-50/30 border border-teal-100 rounded-2xl p-4 flex flex-col justify-between gap-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classificados</label>
                          <select name="classificadosPorGrupo" value={formData.classificadosPorGrupo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs cursor-pointer">
                            <option value={1}>Top 1</option>
                            <option value={2}>Top 2</option>
                            <option value={4}>Top 4</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Tier</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nível de habilidade</p>
                      </div>
                      <select name="tier" value={formData.tier} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs appearance-none cursor-pointer">
                        <option value="Free Elo">Free Elo</option>
                        <option value="Tier I">Tier I</option>
                        <option value="Tier II">Tier II</option>
                        <option value="Tier III">Tier III</option>
                      </select>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Data de Início</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Calendário do evento</p>
                      </div>
                      <input type="date" name="data" value={formData.data} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs" />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-teal-500">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Premiação Cash</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Prêmio em dinheiro</p>
                      </div>
                      <input name="premiacao" value={formData.premiacao} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs text-teal-600" />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Premiações Extras</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Skins, MVP, brindes...</p>
                        </div>
                        <div 
                          onClick={() => setFormData(prev => ({ ...prev, temOutrosPremios: !prev.temOutrosPremios }))}
                          className={`w-10 h-5 rounded-full cursor-pointer transition-all relative ${formData.temOutrosPremios ? 'bg-teal-600 shadow-[0_0_10px_rgba(13,148,136,0.3)]' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.temOutrosPremios ? 'left-5.5' : 'left-0.5'}`} />
                        </div>
                      </div>
                      {formData.temOutrosPremios && (
                        <textarea 
                          name="outrosPremios" 
                          value={formData.outrosPremios} 
                          onChange={handleInputChange} 
                          placeholder="Ex: Skin épica para MVP, 500 Coins para o 2º lugar..." 
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500 font-bold text-xs h-24 resize-none shadow-sm"
                        />
                      )}
                    </div>
                  </div>

                  </div>

                  {/* Status Toggle Area */}
                  <div className="bg-slate-50 p-5 md:p-6 rounded-[2rem] border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Status da Arena</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Estágio atual do evento</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm gap-1 border border-slate-100 overflow-x-auto w-full sm:w-auto">
                      {(['inscricoes_em_breve', 'inscricoes_abertas', 'em_andamento', 'finalizado'] as const).map((st) => (
                        <button 
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(selectedTournament.id, st)}
                          className={`flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            selectedTournament.status === st ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {st === 'inscricoes_em_breve' ? 'Breve' : st === 'inscricoes_abertas' ? 'Aberta' : st === 'em_andamento' ? 'Arena' : 'End'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-10 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6">
                  <div>
                    {selectedTournament.status === 'inscricoes_em_breve' && (
                      <button 
                        onClick={() => {
                          setIsEditModalOpen(false);
                          handleDeleteTournament(selectedTournament.id);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" /> Excluir Torneio
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsEditModalOpen(false)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 order-2 sm:order-1"
                    >
                      Descartar Alterações
                    </button>
                    <button 
                      onClick={handleSaveEdit}
                      className="w-full sm:w-auto bg-teal-600 text-white px-8 md:px-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
                    >
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
