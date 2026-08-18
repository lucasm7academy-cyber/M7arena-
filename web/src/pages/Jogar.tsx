// src/pages/jogar.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, ChevronLeft, ChevronRight, Trophy, Users, Coins,
  Search, Lock, Zap, Crown, X, LogIn, Plus, SlidersHorizontal,
  Sword, Shield, Swords, Gem, Snowflake, Tv2, RefreshCw, Trash2, Gamepad2
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import {
  MODOS_JOGO, OPCOES_ELO, OPCOES_MPOINTS, getModoInfo, getMPointsInfo,
  getMaxJogadoresPorModo, type ModoJogo, type Sala,
} from '../api/salamod1';
import { criarSala, traduzirErroSala } from '../api/salamod1';
import { api } from '../lib/api';
import { guardarSenhaSala } from '../lib/salaSenhaStore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';
import {
  ModalLoginVitrine,
  ModalVincularConta,
  ModalSenhaSala,
} from '../components/partidas/ModaisElegibilidade';

// ⚡ OTIMIZAÇÃO: Cache em memória de 30s para lista de salas.
// Evita refetch quando usuário navega Lobby ↔ Jogar rapidamente.
const _SALAS_CACHE_TTL = 30_000;
let _salasCache: { data: any[]; ts: number } | null = null;

// ============================================
// TIPOS
// ============================================

interface UsuarioAtual {
  id: string;
  nome: string;
  tag?: string;
  elo: string;
  role: string;
  avatar?: string;
}

interface UserTeam {
  id: string;
  nome: string;
  tag: string;
  logo?: string;
}

interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  bgImage?: string
  actionText?: string;
  actionLink?: string;
}

// ============================================
// SLIDES DE MARKETING
// ============================================

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    title: "CRIE SUA",
    subtitle: "EQUIPE",
    description: "Monte seu time dos sonhos, recrute os melhores parceiros e dispute torneios com premiação em Pix",
    icon: Users,
    color: '#4ade80',
    bgGradient: 'from-green-500/20 via-green-500/5 to-transparent',
    bgImage: '/images/heroSlide1.webp',
    actionText: 'Criar Time',
    actionLink: '/times'
  },
  {
    id: 2,
    title: "BENEFÍCIOS",
    subtitle: "VIP",
    description: "Acesso a salas exclusivas, torneios premium e recompensas em dobro — o próximo nível do competitivo",
    icon: Crown,
    color: '#fbbf24',
    bgGradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent',
    bgImage: '/images/heroSlide2.webp',
    actionText: 'Seja VIP',
    actionLink: '/sejavip'
  },
  {
    id: 3,
    title: "JOGUE COM",
    subtitle: "RESPEITO",
    description: "Fair play, integridade e competitividade saudável. Jogue para vencer!",
    icon: Shield,
    color: '#3b82f6',
    bgGradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
    bgImage: '/images/heroSlide3.webp',
    actionText: 'Código de Conduta',
    actionLink: '/politicas'
  }
];

// ============================================
// CONFIGURAÇÃO DOS MODOS DE JOGO (CARDS)
// ============================================

const modosCards = [
  {
    modo: '5v5' as ModoJogo,
    titulo: '5v5 CLÁSSICO',
    subtitulo: 'Summoner\'s Rift',
    icone: Swords,
    cor: '#fbbf24',
    stats: 'Competitivo • Estratégia',
    bgImage: '/images/fundoCard5v5.webp'
  },
  {
    modo: 'aram' as ModoJogo,
    titulo: 'ARAM',
    subtitulo: 'Howling Abyss',
    icone: Snowflake,
    cor: '#3b82f6',
    stats: 'Caótico • Diversão',
    bgImage: '/images/fundoCardAram.webp'
  },
  {
    modo: '1v1' as ModoJogo,
    titulo: '1v1 DUELO',
    subtitulo: 'Howling Abyss',
    icone: Sword,
    cor: '#ef4444',
    stats: 'Individual • Habilidade',
    bgImage: '/images/fundoCard1v1.webp'
  },
  {
    modo: 'time_vs_time' as ModoJogo,
    titulo: 'TIME vs TIME',
    subtitulo: 'Competitivo',
    icone: Trophy,
    cor: '#a855f7',
    stats: 'Clã • Ranking',
    bgImage: '/images/fundoCardTime.webp'
  }
];

// ============================================
// VITRINE PÚBLICA (design v3 §2.1/§11)
// ============================================

// Rótulo + cor do estado de cada sala na vitrine (visitante vê o estado antes
// de criar conta — a sala cheia de gente apostando é o marketing).
const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  preenchendo: { label: 'Aberta', cls: 'text-green-400 border-green-400/30 bg-green-400/10' },
  confirmacao: { label: 'Confirmando', cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  iniciando_partida: { label: 'Iniciando', cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  partida_iniciada: { label: 'Em jogo', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
  aguardando_revisao: { label: 'Em análise', cls: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' },
  encerrada: { label: 'Encerrada', cls: 'text-white/40 border-white/10 bg-white/5' },
  cancelada: { label: 'Cancelada', cls: 'text-red-400 border-red-400/30 bg-red-400/10' },
};

// ============================================
// MODAL CRIAR SALA (Design Cut-Edge M7 Arena)
// ============================================

const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_INNER = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_BUTTON = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';

const ModalCriarSala = ({ onClose, onCreate, usuarioAtual, userTeam, modoInicial }: any) => {
  const [modo, setModo] = useState<ModoJogo>(modoInicial || '5v5');
  const [mpoints, setMpoints] = useState(0);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [temSenha, setTemSenha] = useState(false);
  const [senha, setSenha] = useState('');
  const [eloMinimo, setEloMinimo] = useState('');
  const [loading, setLoading] = useState(false);

  const modoInfo = getModoInfo(modo);
  const mpInfo = getMPointsInfo(mpoints);

  const handleSubmit = async () => {
    setLoading(true);
    const maxJogadores = getMaxJogadoresPorModo(modo);
    
    const nomePadrao: Record<string, string> = {
      '5v5': '5x5 Personalizada',
      'aram': 'ARAM Personalizada',
      '1v1': '1v1 Personalizada',
      'time_vs_time': 'Time vs Time Personalizada',
    };

    const dados: any = {
      modo,
      mpoints,
      nome: nome || nomePadrao[modo] || 'Sala Personalizada',
      descricao: descricao || MODOS_JOGO[modo].descricao,
      temSenha,
      senha: temSenha ? senha : undefined,
      maxJogadores,
      eloMinimo: eloMinimo || undefined,
    };

    await onCreate(dados);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 12, opacity: 0 }}
        className="relative p-[1.5px] w-full max-w-md shadow-2xl transition-all max-h-[90vh] flex flex-col"
        style={{
          clipPath: CUT_FRAME,
          background: `linear-gradient(135deg, ${modoInfo.cor} 0%, ${modoInfo.cor}88 60%, color-mix(in srgb, ${modoInfo.cor} 30%, #000000) 100%)`,
          boxShadow: `0 0 45px -10px ${modoInfo.cor}45, 0 25px 50px -12px rgba(0,0,0,0.9)`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full bg-[#09090c] p-5 sm:p-6 relative overflow-y-auto overflow-x-hidden custom-scrollbar flex-1"
          style={{ clipPath: CUT_INNER }}
        >
          {/* Luz ambiente no topo */}
          <div
            className="absolute -top-12 -right-12 w-48 h-48 pointer-events-none opacity-20 blur-3xl"
            style={{ background: modoInfo.cor }}
          />

          {/* Botão fechar estilo botão cortado */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className="absolute top-4 right-4 p-[1px] bg-white/10 hover:bg-white/20 transition-colors z-20 cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
            title="Fechar"
          >
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 bg-[#141418] hover:bg-[#202028] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
              style={{ clipPath: CUT_BUTTON }}
            >
              <X className="w-4 h-4" />
            </div>
          </motion.button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5 pr-8">
            <div
              className="relative p-[1px] shrink-0"
              style={{
                clipPath: CUT_BUTTON,
                background: `linear-gradient(135deg, ${modoInfo.cor}, transparent)`
              }}
            >
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-[#121217]"
                style={{ clipPath: CUT_BUTTON }}
              >
                <Plus className="w-6 h-6" style={{ color: modoInfo.cor }} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <span
                className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-1"
                style={{ clipPath: CUT_BADGE, background: modoInfo.cor }}
              >
                {modoInfo.nome}
              </span>
              <h2
                className="text-[#EDEDEE] uppercase tracking-tight text-xl sm:text-2xl leading-none truncate select-none"
                style={{
                  fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  letterSpacing: '0.02em'
                }}
              >
                Criar Sala
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">Nome da Sala</label>
              <input
                type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder={`Ex: 5x5 Personalizada`}
                className="w-full bg-[#111116] border border-white/10 p-3 text-zinc-100 text-sm focus:outline-none focus:border-[#FFB700] transition-all font-bold"
                style={{ clipPath: CUT_BADGE }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">Valor da Partida (M7 Coins)</label>
              <div className="grid grid-cols-3 gap-2">
                {OPCOES_MPOINTS.map((op) => (
                  <button
                    key={op.valor}
                    onClick={() => setMpoints(op.valor)}
                    className="p-2.5 text-center transition-all relative p-[1px] cursor-pointer"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: mpoints === op.valor ? `linear-gradient(135deg, ${op.cor}, #FFE082)` : 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <div
                      className="w-full h-full py-1.5 px-2 flex items-center justify-center"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: mpoints === op.valor ? `${op.cor}25` : '#121217',
                        color: mpoints === op.valor ? op.cor : 'rgba(255,255,255,0.6)'
                      }}
                    >
                      <p className="text-xs font-black uppercase tracking-wider">
                        {op.valor === 0 ? 'Casual' : `💰 ${op.valor} MC`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">Modo de Jogo</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(MODOS_JOGO) as [ModoJogo, typeof MODOS_JOGO[ModoJogo]][]).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setModo(key)}
                    className="p-[1px] text-left transition-all relative cursor-pointer"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: modo === key ? `linear-gradient(135deg, ${value.cor}, #FFE082)` : 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <div
                      className="w-full h-full p-2.5 relative overflow-hidden"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: modo === key ? `${value.cor}25` : '#121217',
                      }}
                    >
                      {value.bgImage && (
                        <div
                          className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-300 ${modo === key ? 'opacity-30' : 'opacity-10'}`}
                          style={{ backgroundImage: `url(${value.bgImage})` }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2 mb-1">
                        <span className="text-base">{value.icone}</span>
                        <span className="text-xs font-black uppercase tracking-tight text-zinc-100">{value.nome}</span>
                      </div>
                      <p className="relative z-10 text-[9px] font-bold text-zinc-400 leading-tight uppercase tracking-wider">{value.descricao}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">Descrição</label>
              <textarea
                value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Duo mid, jogamos todos os dias às 20h"
                className="w-full bg-[#111116] border border-white/10 p-3 text-zinc-200 text-xs resize-none h-16 focus:outline-none focus:border-[#FFB700] transition-all font-bold"
                style={{ clipPath: CUT_BADGE }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">ELO Mínimo</label>
                <select
                  value={eloMinimo} onChange={(e) => setEloMinimo(e.target.value)}
                  disabled={modo === 'time_vs_time'}
                  className="w-full bg-[#111116] border border-white/10 p-2.5 text-zinc-200 text-xs font-bold focus:outline-none"
                  style={{ clipPath: CUT_BADGE }}
                >
                  {OPCOES_ELO.map(elo => (
                    <option key={elo.valor} value={elo.valor} className="bg-[#09090c]">{elo.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black">Privacidade</label>
                <button
                  onClick={() => setTemSenha(!temSenha)}
                  className={`w-full p-2.5 text-xs font-black uppercase tracking-wider transition-all border ${temSenha ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-[#111116] border-white/10 text-zinc-400'}`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  {temSenha ? '🔒 Privada' : '🔓 Pública'}
                </button>
              </div>
            </div>

            {temSenha && (
              <input
                type="text" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha"
                className="w-full bg-[#111116] border border-white/10 p-3 text-zinc-200 text-xs font-mono focus:outline-none"
                style={{ clipPath: CUT_BADGE }}
              />
            )}

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit} disabled={loading}
                className="w-full relative p-[1px] cursor-pointer shadow-lg disabled:opacity-50"
                style={{
                  clipPath: CUT_BUTTON,
                  background: `linear-gradient(135deg, ${modoInfo.cor}, #FFE082, ${modoInfo.cor})`,
                  boxShadow: `0 0 25px -5px ${modoInfo.cor}60`
                }}
              >
                <div
                  className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black transition-all"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: modoInfo.cor
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>{loading ? 'Criando...' : 'Criar Sala'}</span>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const Jogar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeHero, setActiveHero] = useState(0);
  const gamesRef = useRef<HTMLDivElement>(null);
  const finalizadasRef = useRef<HTMLDivElement>(null);
  const finalizadasScrollRef = useRef<HTMLDivElement>(null);
  
  // Estados do usuário
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioAtual | null>(null);
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  
  // Estados das salas
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loadingSalas, setLoadingSalas] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroModo, setFiltroModo] = useState<ModoJogo | 'todos'>('todos');

  // Estados das salas finalizadas (LAZY)
  const [salasFinalizadas, setSalasFinalizadas] = useState<Sala[]>([]);
  const [loadingSalasFinalizadas, setLoadingSalasFinalizadas] = useState(false);
  const [carregouFinalizadas, setCarregouFinalizadas] = useState(false);
  
  // Modais
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [modoSelecionado, setModoSelecionado] = useState<ModoJogo>('5v5');
  const [showSenhaModal, setShowSenhaModal] = useState<{ salaId: number; nome: string } | null>(null);
  const [erroSenha, setErroSenha] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── CARREGAMENTO LEVE DO USUÁRIO ──────────────────
  const { perfil } = usePerfil();

  useEffect(() => {
    if (!user) return;

    // Usa o perfil com nick#tag quando disponível, fallback para email
    setUsuarioAtual({
      id: user.id,
      nome: perfil?.nome || user.email?.split('@')[0] || 'Jogador',
      tag: perfil?.tag?.replace('#', '') || '',
      elo: perfil?.elo || 'Sem Elo',
      role: 'RES',
      avatar: perfil?.avatar,
    });
  }, [user, perfil]);

  // ── CARREGAR SALAS (SEM JOIN PESADO) ──────────────
  const carregarSalasLista = useCallback(async (forcar = false) => {
    // ⚡ Cache: usa dados em memória se ainda dentro do TTL (30s).
    if (!forcar && _salasCache && Date.now() - _salasCache.ts < _SALAS_CACHE_TTL) {
      setSalas(_salasCache.data);
      setLoadingSalas(false);
      return;
    }

    // ✅ Busca SEM join com sala_jogadores (a API já entrega a contagem)
    try {
      const data = await api.matches.list({ status: 'ativas', limit: 100 });

      // Montar objeto Sala com jogadores vazio (só contagem)
      const salasLeves = data.map(sala => ({
        ...sala,
        codigo: `#${String(sala.id).padStart(6, '0')}`,
        jogadores: Array(sala.jogadores?.length || 0).fill({}),
        maxJogadores: sala.max_jogadores,
        criadorId: sala.criador_id,
        criadorNome: sala.criador_nome || 'Desconhecido',
        timeANome: sala.time_a_nome,
        timeBNome: sala.time_b_nome,
        temSenha: sala.tem_senha || false,
        mpoints: sala.mpoints || 0,
        modo: sala.modo as ModoJogo,
        estado: sala.estado,
        descricao: sala.descricao || '',
        nome: sala.nome,
        id: sala.id,
        createdAt: new Date(sala.created_at),
      }));

      setSalas(salasLeves);
      _salasCache = { data: salasLeves, ts: Date.now() };
    } catch (error: any) {
      // Nunca engole erro: derruba silencioso mas loga para diagnóstico.
      console.error('[Jogar] falha ao listar salas:', error?.message);
    }
    setLoadingSalas(false);
  }, []);

  // ── CARREGAR SALAS FINALIZADAS (LAZY) ──────────────
  const carregarFinalizadas = useCallback(async () => {
    if (carregouFinalizadas) return;
    setLoadingSalasFinalizadas(true);

    try {
      const data = await api.matches.list({ status: 'encerrada', limit: 20 });
      const salasLeves = data.map(sala => ({
        ...sala,
        codigo: `#${String(sala.id).padStart(6, '0')}`,
        jogadores: [],
        maxJogadores: sala.max_jogadores,
        criadorId: sala.criador_id,
        criadorNome: sala.criador_nome || 'Desconhecido',
        timeANome: sala.time_a_nome,
        timeBNome: sala.time_b_nome,
        temSenha: sala.tem_senha || false,
        mpoints: sala.mpoints || 0,
        modo: sala.modo as ModoJogo,
        estado: sala.estado,
        descricao: sala.descricao || '',
        nome: sala.nome,
        id: sala.id,
        vencedor: sala.vencedor,
        createdAt: new Date(sala.created_at),
      }));
      setSalasFinalizadas(salasLeves);
    } catch (error: any) {
      console.error('[Jogar] falha ao listar salas finalizadas:', error?.message);
    }
    setLoadingSalasFinalizadas(false);
    setCarregouFinalizadas(true);
  }, [carregouFinalizadas]);

  // ── LOAD SALAS ON MOUNT ────────────────────────────
  useEffect(() => {
    carregarSalasLista();
  }, []);

  // ── LAZY LOAD FINALIZADAS AO SCROLLAR ──────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !carregouFinalizadas) {
          carregarFinalizadas();
        }
      },
      { rootMargin: '200px' }
    );

    if (finalizadasRef.current) {
      observer.observe(finalizadasRef.current);
    }

    return () => observer.disconnect();
  }, [carregouFinalizadas, carregarFinalizadas]);


  // Scroll para finalizadas se view=finalizadas
  useEffect(() => {
    if (searchParams.get('view') === 'finalizadas' && finalizadasRef.current) {
      const tid = setTimeout(() => {
        finalizadasRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      return () => clearTimeout(tid);
    }
  }, [searchParams]);

  // ── FILTROS ────────────────────────────────────────
  const salasFiltradas = salas.filter(sala => {
    const matchBusca = sala.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       (sala.descricao || '').toLowerCase().includes(busca.toLowerCase()) ||
                       (sala.codigo || '').includes(busca.toUpperCase());
    const matchModo = filtroModo === 'todos' || sala.modo === filtroModo;
    return matchBusca && matchModo;
  });

  const salasFinalizadasFiltradas = salasFinalizadas.filter(sala => {
    const matchBusca = sala.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       (sala.descricao || '').toLowerCase().includes(busca.toLowerCase()) ||
                       (sala.codigo || '').includes(busca.toUpperCase());
    const matchModo = filtroModo === 'todos' || sala.modo === filtroModo;
    return matchBusca && matchModo;
  });

  // ── AÇÕES ──────────────────────────────────────────
  // A sala é pública (ADR: visitante assiste, mas não ocupa vaga — o aviso de
  // login aparece ao clicar na vaga, dentro da sala /:modo/:id). A senha de sala
  // privada é guardada para o POST /join reutilizar — a VALIDAÇÃO acontece no
  // servidor (MORPH-001), nunca aqui no cliente.
  const entrarNaSala = (sala: Sala, senha?: string) => {
    if (user && sala.temSenha && senha) {
      guardarSenhaSala(sala.id, senha);
    }
    navigate(`/${sala.modo}/${sala.id}`);
    setShowSenhaModal(null);
    setErroSenha('');
  };

  const handleCriarSala = async (dados: any) => {
    if (!usuarioAtual) {
      setShowLoginModal(true);
      return;
    }

    try {
      const nova = await criarSala(dados, usuarioAtual);
      if (nova) {
        setShowCriarModal(false);
        navigate(`/${nova.modo}/${nova.id}`);
      }
    } catch (error: any) {
      // Nunca engole erro: traduz o código do servidor para o usuário.
      const codigo = error?.message;
      // Sem conta Riot vinculada (ou termos não aceitos): abre o aviso com
      // botão de vincular em vez de só um toast efêmero.
      if (codigo === 'riot_id_obrigatorio' || codigo === 'termos_nao_aceitos') {
        setShowCriarModal(false);
        setShowVincularModal(true);
        return;
      }
      toast.error(traduzirErroSala(codigo));
    }
  };

  const abrirModalCriar = (modo: ModoJogo) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    // Sem conta Riot vinculada, a criação de sala vai falhar no servidor —
    // avisa antes e oferece o botão de vincular.
    if (!perfil?.contaVinculada) {
      setShowVincularModal(true);
      return;
    }
    setModoSelecionado(modo);
    setShowCriarModal(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Botão de refresh ignora o cache em memória
    await carregarSalasLista(true);
    setRefreshing(false);
  };

  // ── EXCLUSÃO ADMINISTRATIVA (admin/proprietário) ──
  // Cargo vem do PerfilContext (perfil.cargo). A validação REAL roda no
  // servidor (DELETE /api/matches/:id); aqui só exibimos o botão p/ quem tem.
  const ehAdminOuProprietario = perfil?.cargo === 'admin' || perfil?.cargo === 'proprietario';

  const excluirSala = async (sala: Sala) => {
    if (!ehAdminOuProprietario) return;
    const confirmou = window.confirm(
      `Excluir a sala "${sala.nome}" permanentemente? As reservas dos jogadores serão devolvidas.`
    );
    if (!confirmou) return;
    try {
      await api.matches.excluir(sala.id);
      toast.success('Sala excluída.');
      // Invalida o cache em memória e recarrega a lista sem ele.
      _salasCache = null;
      await carregarSalasLista(true);
    } catch (e: any) {
      toast.error(traduzirErroSala(e?.message));
    }
  };

  // Visitante deslogado: a vitrine renderiza normal (o usuário é opcional).
  const currentSlide = heroSlides[activeHero];
  const SlideIcon = currentSlide.icon;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-6 md:p-10 overflow-x-hidden relative">
      
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />

      <div className="max-w-[1400px] mx-auto space-y-10 relative z-10">
        
        {/* ============================================ */}
        {/* HERO BANNER */}
        {/* ============================================ */}
        <div className="relative w-full p-[1px] bg-white/10 shadow-2xl group" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
          <div className="relative w-full h-full bg-black overflow-hidden" style={{ clipPath: 'polygon(17.4px 0, 100% 0, 100% calc(100% - 17.4px), calc(100% - 17.4px) 100%, 0 100%, 0 17.4px)' }}>
          <div className="relative w-full p-8 md:p-14 flex items-center justify-between min-h-[320px]">
            {currentSlide.bgImage && (
              <motion.div
                key={`bg-${activeHero}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${currentSlide.bgImage})` }}
              />
            )}
            <motion.div
              key={`gradient-${activeHero}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className={`absolute inset-0 bg-gradient-to-r ${currentSlide.bgGradient} z-0`}
            />

            <motion.div
              key={`content-${activeHero}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="z-10 max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${currentSlide.color}20` }}>
                  <SlideIcon className="w-6 h-6" style={{ color: currentSlide.color }} />
                </div>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">LOL TEAMS</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-white uppercase leading-[0.9] tracking-tighter italic mb-4">
                {currentSlide.title}<br />
                <span style={{ color: currentSlide.color }}>{currentSlide.subtitle}</span>
              </h1>
              <p className="text-lg md:text-xl text-white/60 mb-8 max-w-md font-medium leading-snug">{currentSlide.description}</p>
              {currentSlide.actionText && (
                <button
                  onClick={() => {
                    if (!currentSlide.actionLink) return;
                    if (currentSlide.actionLink === '/sejavip') {
                      window.dispatchEvent(new Event('m7:open-vip'));
                      return;
                    }
                    navigate(currentSlide.actionLink);
                  }}
                  className="px-6 py-3 rounded-xl font-black text-sm uppercase text-black transition-all hover:scale-105"
                  style={{ background: currentSlide.color }}
                >
                  {currentSlide.actionText} →
                </button>
              )}
            </motion.div>
          </div>

          <button onClick={() => setActiveHero(prev => prev === 0 ? heroSlides.length - 1 : prev - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center border border-white/10 transition-all opacity-0 group-hover:opacity-100 z-20">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveHero(prev => (prev + 1) % heroSlides.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center border border-white/10 transition-all opacity-0 group-hover:opacity-100 z-20">
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {heroSlides.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveHero(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === activeHero ? 'w-8 bg-[#FFB700]' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* CARDS DE MODO */}
        {/* ============================================ */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#FFB700]" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Escolha seu Modo de Jogo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {modosCards.map((card) => {
              const Icon = card.icone;
              return (
                <button
                  key={card.modo}
                  onClick={() => abrirModalCriar(card.modo)}
                  className="w-full bg-black rounded-xl p-6 flex flex-col items-center text-center border border-white/10 hover:border-[#FFB700]/50 hover:bg-white/5 transition-all shadow-lg group cursor-pointer relative overflow-hidden"
                >
                  {card.bgImage && (
                    <div className="absolute inset-0 z-0 bg-cover bg-center opacity-20 group-hover:opacity-40 transition-opacity"
                      style={{ backgroundImage: `url(${card.bgImage})` }} />
                  )}
                  <div className="absolute inset-0 z-0 opacity-50"
                    style={{ background: `linear-gradient(to bottom, transparent, ${card.cor}20)` }} />
                  <div className="relative z-10 w-16 h-16 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${card.cor}15`, border: `1px solid ${card.cor}30` }}>
                    <Icon className="w-8 h-8" style={{ color: card.cor }} />
                  </div>
                  <h3 className="relative z-10 text-white font-black text-lg uppercase tracking-tight mb-1 group-hover:text-[#FFB700]">{card.titulo}</h3>
                  <p className="relative z-10 text-white/40 text-xs uppercase tracking-widest mb-2">{card.subtitulo}</p>
                  <div className="relative z-10 flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: card.cor }}>{card.stats}</span>
                  </div>
                  <div className="relative z-10 mt-4 text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-[#FFB700]">
                    Clique para criar sala →
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================ */}
        {/* BARRA DE BUSCA E FILTROS */}
        {/* ============================================ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Search className="w-4 h-4 text-[#FFB700]" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Salas Disponíveis</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loadingSalas}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:border-[#FFB700]/50 hover:text-[#FFB700] transition-all disabled:opacity-50"
                title="Atualizar salas"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <select
                value={filtroModo}
                onChange={(e) => setFiltroModo(e.target.value as ModoJogo | 'todos')}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-bold uppercase tracking-wider"
              >
                <option value="todos" className="bg-black">Todos Modos</option>
                <option value="5v5" className="bg-black">5v5 Clássico</option>
                <option value="aram" className="bg-black">ARAM</option>
                <option value="1v1" className="bg-black">1v1</option>
                <option value="time_vs_time" className="bg-black">Time vs Time</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input
              type="text"
              placeholder="BUSCAR POR NOME OU CÓDIGO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FFB700]/50 uppercase font-bold"
            />
          </div>
        </div>

        {/* ============================================ */}
        {/* CARROSSEL DE SALAS */}
        {/* ============================================ */}
        <div className="relative group">
          <div ref={gamesRef} className="flex gap-5 overflow-x-auto hide-scrollbar pb-4 snap-x snap-mandatory">
            {loadingSalas ? (
              <div className="w-full text-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB700] border-t-transparent mx-auto mb-4" />
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Buscando salas ativas...</p>
              </div>
            ) : salasFiltradas.length === 0 ? (
              <div className="w-full text-center py-20 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/30 font-black uppercase tracking-widest">Nenhuma sala encontrada</p>
                <p className="text-white/20 text-xs uppercase mt-2">Seja o primeiro — crie uma sala nos cards acima e defina o valor!</p>
              </div>
            ) : (
              salasFiltradas.map((sala) => {
                const modoInfo = getModoInfo(sala.modo);
                const mpInfo = getMPointsInfo(sala.mpoints);
                const estaCheia = (sala.jogadores || []).length >= sala.maxJogadores;
                const jaEsta = usuarioAtual
                  ? (sala.jogadores || []).some((j: any) => j.id === usuarioAtual.id)
                  : false;
                const estadoInfo = ESTADO_LABEL[sala.estado] ?? { label: sala.estado, cls: 'text-white/40 border-white/10 bg-white/5' };

                return (
                  <div
                    key={sala.id}
                    onClick={() => {
                      // Sala é pública: visitante assiste sem login (o aviso de
                      // login aparece ao clicar na vaga dentro da sala).
                      if (user && sala.temSenha && !jaEsta) {
                        setShowSenhaModal({ salaId: sala.id, nome: sala.nome });
                      } else {
                        entrarNaSala(sala);
                      }
                    }}
                    className="flex-none w-full sm:w-[380px] h-[320px] rounded-xl overflow-hidden relative cursor-pointer border border-white/10 hover:border-[#FFB700]/50 transition-all snap-start group/card bg-black"
                  >
                    {modoInfo.bgImage && (
                      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover/card:opacity-50 transition-opacity"
                        style={{ backgroundImage: `url(${modoInfo.bgImage})` }} />
                    )}
                    <div className="absolute inset-0 opacity-50 z-0"
                      style={{ background: `linear-gradient(135deg, ${modoInfo.cor}40, transparent)` }} />
                    
                    <div className="relative z-10 p-5 h-full flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black text-white/40 border border-white/10 px-2 py-1 rounded bg-black/50">
                            {sala.codigo}
                          </span>
                          {sala.temSenha && <Lock className="w-3.5 h-3.5 text-yellow-400" />}
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${estadoInfo.cls}`}>
                            {estadoInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white/60 text-[10px] font-black px-2.5 py-1.5 rounded border border-white/10">
                          <Users className="w-3 h-3" />
                          {(sala.jogadores || []).length}/{sala.maxJogadores}
                        </div>
                        {/* Excluir sala — só admin/proprietário (validação real no servidor) */}
                        {ehAdminOuProprietario && (
                          <button
                            onClick={(e) => { e.stopPropagation(); excluirSala(sala); }}
                            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                            title="Excluir sala"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1 line-clamp-1">{sala.nome}</h3>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-3 line-clamp-2">{sala.descricao}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2 py-1 rounded text-[10px] font-black uppercase"
                          style={{ background: `${modoInfo.cor}20`, color: modoInfo.cor, border: `1px solid ${modoInfo.cor}40` }}>
                          {modoInfo.icone} {modoInfo.nome}
                        </span>
                        <span className="px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"
                          style={{ background: `${mpInfo.cor}20`, color: mpInfo.cor, border: `1px solid ${mpInfo.cor}40` }}>
                          <Coins className="w-3 h-3" />{sala.mpoints} MP
                        </span>
                        {sala.eloMinimo && (
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-white/5 border border-white/10 text-white/40">Mín: {sala.eloMinimo}</span>
                        )}
                      </div>
                      
                      <div className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-4">
                        Criador: {sala.criadorNome}
                        {sala.timeANome && <span className="ml-2 text-blue-400">• {sala.timeANome}</span>}
                      </div>
                      
                      <button
                        onClick={() => {
                          // Sala pública: visitante navega (aviso de login na vaga).
                          if (user && sala.temSenha && !jaEsta) {
                            setShowSenhaModal({ salaId: sala.id, nome: sala.nome });
                          } else {
                            entrarNaSala(sala);
                          }
                        }}
                        className={`mt-auto w-full py-3 rounded-lg font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                          jaEsta
                            ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                            : estaCheia
                            ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                            : 'bg-[#FFB700] hover:bg-[#e0a000] text-black'
                        }`}
                      >
                        <LogIn className="w-4 h-4" />
                        {jaEsta ? 'REENTRAR' : estaCheia ? 'SALA CHEIA' : 'ENTRAR'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {salasFiltradas.length > 2 && (
            <>
              <button onClick={() => gamesRef.current?.scrollBy({ left: -450, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 w-10 h-10 rounded-lg bg-black text-white/60 hover:text-white flex items-center justify-center border border-white/20 hover:border-[#FFB700]/50 transition-all opacity-0 group-hover:opacity-100 z-10 shadow-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => gamesRef.current?.scrollBy({ left: 450, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 w-10 h-10 rounded-lg bg-black text-white/60 hover:text-white flex items-center justify-center border border-white/20 hover:border-[#FFB700]/50 transition-all opacity-0 group-hover:opacity-100 z-10 shadow-lg">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* ============================================ */}
        {/* SALAS FINALIZADAS (LAZY) */}
        {/* ============================================ */}
        <div ref={finalizadasRef} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#FFB700]" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Partidas Finalizadas</h2>
          </div>

          {carregouFinalizadas ? (
            <div className="relative group">
              <div ref={finalizadasScrollRef} className="flex gap-5 overflow-x-auto hide-scrollbar pb-4">
              {loadingSalasFinalizadas ? (
                <div className="w-full text-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB700] border-t-transparent mx-auto mb-4" />
                </div>
              ) : salasFinalizadasFiltradas.length === 0 ? (
                <div className="w-full text-center py-10 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                  <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 font-black uppercase tracking-widest">Nenhuma sala finalizada</p>
                </div>
              ) : (
                salasFinalizadasFiltradas.map((sala) => {
                  const modoInfo = getModoInfo(sala.modo);
                  const mpInfo = getMPointsInfo(sala.mpoints);
                  const vencedorInfo =
                    sala.vencedor === 'A'
                      ? { label: '🏆 Vitória Azul', cor: '#3b82f6' }
                      : sala.vencedor === 'B'
                      ? { label: '🏆 Vitória Vermelho', cor: '#ef4444' }
                      : sala.vencedor === 'empate'
                      ? { label: '⚖️ Empate', cor: '#fbbf24' }
                      : { label: '⚔️ Disputa', cor: '#a855f7' };
                  return (
                    <div
                      key={sala.id}
                      onClick={() => navigate(`/${sala.modo}/${sala.id}`)}
                    className="flex-none w-full sm:w-[380px] h-[320px] rounded-xl overflow-hidden relative cursor-pointer border border-white/10 hover:border-[#FFB700]/50 transition-all snap-start group/card bg-black"
                    >
                      {modoInfo.bgImage && (
                        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30 group-hover/card:opacity-50 transition-opacity grayscale"
                          style={{ backgroundImage: `url(${modoInfo.bgImage})` }} />
                      )}
                      <div className="absolute inset-0 opacity-40 z-0"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent)' }} />

                      <div className="relative z-10 p-5 h-full flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[10px] font-mono font-black text-white/40 border border-white/10 px-2 py-1 rounded bg-black/50">
                            {sala.codigo}
                          </span>
                          <span className="px-2 py-1 rounded text-[9px] font-black uppercase border"
                            style={{ background: `${vencedorInfo.cor}20`, color: vencedorInfo.cor, border: `1px solid ${vencedorInfo.cor}40` }}>
                            {vencedorInfo.label}
                          </span>
                        </div>

                        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1 line-clamp-1">{sala.nome}</h3>
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-3 line-clamp-2">{sala.descricao}</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase"
                            style={{ background: `${modoInfo.cor}20`, color: modoInfo.cor, border: `1px solid ${modoInfo.cor}40` }}>
                            {modoInfo.icone} {modoInfo.nome}
                          </span>
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"
                            style={{ background: `${mpInfo.cor}20`, color: mpInfo.cor, border: `1px solid ${mpInfo.cor}40` }}>
                            <GiTwoCoins className="w-3 h-3" />{sala.mpoints} {sala.mpoints > 0 ? 'MC' : 'MP'}
                          </span>
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-white/5 border border-white/10 text-white/40">
                            Finalizada
                          </span>
                        </div>

                        {sala.resultado_riot && (
                          <div className="flex items-center justify-center gap-3 mb-4 px-3 py-2 rounded-xl bg-black/60 border border-white/10">
                            <span className="text-sm font-black text-blue-400 tabular-nums">{sala.resultado_riot.placar.blue.kills}</span>
                            <span className="text-[9px] font-black uppercase text-white/30 tracking-widest">
                              {sala.resultado_riot.duracao_s > 0 ? `${Math.floor(sala.resultado_riot.duracao_s / 60)}min` : 'Placar'}
                            </span>
                            <span className="text-sm font-black text-red-400 tabular-nums">{sala.resultado_riot.placar.red.kills}</span>
                          </div>
                        )}

                        <div className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-4">
                          Criador: {sala.criadorNome}
                          {sala.timeANome && <span className="ml-2 text-blue-400">• {sala.timeANome}</span>}
                          {sala.timeBNome && <span className="ml-2 text-red-400">• {sala.timeBNome}</span>}
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider">
                            {new Date((sala as any).createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#FFB700] group-hover/card:text-white transition-colors">
                            Ver resultado →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              </div>

              {salasFinalizadasFiltradas.length > 2 && (
                <>
                  <button onClick={() => finalizadasScrollRef.current?.scrollBy({ left: -450, behavior: 'smooth' })}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 w-10 h-10 rounded-lg bg-black text-white/60 hover:text-white flex items-center justify-center border border-white/20 hover:border-[#FFB700]/50 transition-all opacity-0 group-hover:opacity-100 z-10 shadow-lg">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => finalizadasScrollRef.current?.scrollBy({ left: 450, behavior: 'smooth' })}
                    className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 w-10 h-10 rounded-lg bg-black text-white/60 hover:text-white flex items-center justify-center border border-white/20 hover:border-[#FFB700]/50 transition-all opacity-0 group-hover:opacity-100 z-10 shadow-lg">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-10 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
              <p className="text-white/20 text-xs uppercase">Continue descendo para ver as partidas já disputadas</p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* MODAIS */}
      {/* ============================================ */}
      <AnimatePresence>
        {showCriarModal && (
          <ModalCriarSala
            onClose={() => setShowCriarModal(false)}
            onCreate={handleCriarSala}
            usuarioAtual={usuarioAtual}
            userTeam={userTeam}
            modoInicial={modoSelecionado}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSenhaModal && (
          <ModalSenhaSala
            nome={showSenhaModal.nome}
            onClose={() => { setShowSenhaModal(null); setErroSenha(''); }}
            onConfirm={(senha: string) => {
              const sala = salas.find(s => s.id === showSenhaModal.salaId);
              if (sala) entrarNaSala(sala, senha);
            }}
            erro={erroSenha}
          />
        )}
      </AnimatePresence>

      {/* Modal de login/cadastro da vitrine pública (design v3 §11) */}
      <AnimatePresence>
        {showLoginModal && <ModalLoginVitrine onClose={() => setShowLoginModal(false)} />}
      </AnimatePresence>

      {/* Aviso: criar sala exige conta Riot vinculada — botão leva a /vincular */}
      <AnimatePresence>
        {showVincularModal && (
          <ModalVincularConta onClose={() => setShowVincularModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Jogar;