// src/pages/jogar.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, ChevronLeft, ChevronRight, Trophy, Users, Coins,
  Search, Lock, Zap, Crown, X, LogIn, Plus, SlidersHorizontal,
  Sword, Shield, Swords, Gem, Snowflake, Tv2, RefreshCw
} from 'lucide-react';
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
    bgImage: '/images/heroSlide1.png',
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
    bgImage: '/images/heroSlide2.png',
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
    bgImage: '/images/heroSlide3.png',
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
    bgImage: '/images/fundoCard5v5.png'
  },
  {
    modo: 'aram' as ModoJogo,
    titulo: 'ARAM',
    subtitulo: 'Howling Abyss',
    icone: Snowflake,
    cor: '#3b82f6',
    stats: 'Caótico • Diversão',
    bgImage: '/images/fundoCardAram.png'
  },
  {
    modo: '1v1' as ModoJogo,
    titulo: '1v1 DUELO',
    subtitulo: 'Howling Abyss',
    icone: Sword,
    cor: '#ef4444',
    stats: 'Individual • Habilidade',
    bgImage: '/images/fundoCard1v1.png'
  },
  {
    modo: 'time_vs_time' as ModoJogo,
    titulo: 'TIME vs TIME',
    subtitulo: 'Competitivo',
    icone: Trophy,
    cor: '#a855f7',
    stats: 'Clã • Ranking',
    bgImage: '/images/fundoCardTime.png'
  }
];

// ============================================
// MODAL SENHA
// ============================================

const ModalSenha = ({ nome, onClose, onConfirm, erro }: any) => {
  const [senha, setSenha] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(13, 13, 13, 0.8)',
          border: '2px solid #FFB700',
          boxShadow: '0 0 45px -10px rgba(255, 183, 0, 0.4)',
          backdropFilter: 'blur(16px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-black text-lg uppercase tracking-tight">Sala Privada</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-white/60 text-sm">Esta sala é privada. Digite a senha que o criador definiu para <span className="text-white font-bold">{nome}</span>:</p>
          <input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-yellow-500/50"
            autoFocus
          />
          {erro && <p className="text-red-400 text-xs">{erro}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10">Cancelar</button>
            <button onClick={() => onConfirm(senha)} className="flex-1 py-3 rounded-xl bg-yellow-500 text-black text-sm font-black hover:bg-yellow-400">Entrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

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

// Modal de cadastro/login com a sala ao fundo — visita vê a vitrine, clicar em
// qualquer ação cai aqui (o /jogar é rota pública; /login tem aba de cadastro).
const ModalLoginVitrine = ({ onClose }: any) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(13, 13, 13, 0.9)',
          border: '2px solid #FFB700',
          boxShadow: '0 0 45px -10px rgba(255, 183, 0, 0.4)',
          backdropFilter: 'blur(16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogIn className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-black text-lg uppercase tracking-tight">Crie sua conta para jogar</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-white/60 text-sm leading-relaxed">
            As salas valendo <span className="text-yellow-400 font-black">MC</span> são a vitrine da arena. Crie sua conta grátis e ocupe uma vaga antes que a sala encha.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl bg-yellow-500 text-black text-sm font-black hover:bg-yellow-400 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Criar conta gratuita
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Já tenho conta — entrar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// MODAL CRIAR SALA
// ============================================

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
    
    const dados: any = {
      modo,
      mpoints,
      nome: nome || `Sala ${MODOS_JOGO[modo].nome} de ${usuarioAtual.nome}`,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        style={{
          background: 'rgba(13, 13, 13, 0.9)',
          border: `2px solid ${modoInfo.cor}`,
          boxShadow: `0 0 45px -10px ${modoInfo.cor}60`,
          backdropFilter: 'blur(16px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {modoInfo.bgImage && (
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center opacity-10 pointer-events-none transition-all duration-500"
            style={{ backgroundImage: `url(${modoInfo.bgImage})` }}
          />
        )}
        <div className="absolute inset-0 z-0 opacity-50 pointer-events-none transition-all duration-500"
          style={{ background: `linear-gradient(to bottom, transparent, ${modoInfo.cor}20)` }}
        />

        <div className="relative z-10 px-6 py-4 border-b border-white/8 flex items-center justify-between sticky top-0 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5" style={{ color: modoInfo.cor }} />
            <h2 className="text-white font-black text-lg uppercase">Criar Sala • {modoInfo.nome}</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative z-10 p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Nome da Sala</label>
            <input
              type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder={`Ex: Sala de ${usuarioAtual.nome}${usuarioAtual.tag}`}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-3">
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Valor da Partida</label>
            <div className="grid grid-cols-3 gap-2">
              {OPCOES_MPOINTS.map((op) => {
                // Backend das salas apostadas completo (P1-P4): todas as faixas
                // ficam liberadas. A elegibilidade real roda no servidor.
                const isLocked = false;
                return (
                  <button
                    key={op.valor}
                    onClick={() => !isLocked && setMpoints(op.valor)}
                    disabled={isLocked}
                    className={`p-2.5 rounded-xl text-center transition-all border ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={
                      mpoints === op.valor && !isLocked
                        ? { borderColor: op.cor, background: `${op.cor}18`, color: op.cor }
                        : { borderColor: isLocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)',
                            background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                            color: isLocked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)' }
                    }
                  >
                    <p className="text-xs font-black uppercase">
                      {isLocked ? `🔒 Em breve` : `💰 ${op.valor} MC`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Modo de Jogo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MODOS_JOGO) as [ModoJogo, typeof MODOS_JOGO[ModoJogo]][]).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setModo(key)}
                  className="p-3 rounded-xl text-left transition-all border relative overflow-hidden group"
                  style={
                    modo === key
                      ? { borderColor: value.cor, background: `${value.cor}15`, color: 'white' }
                      : { borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }
                  }
                >
                  {value.bgImage && (
                    <div 
                      className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-300 ${modo === key ? 'opacity-30' : 'opacity-5 group-hover:opacity-15'}`}
                      style={{ backgroundImage: `url(${value.bgImage})` }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2 mb-1">
                    <span className="text-lg">{value.icone}</span>
                    <span className="text-xs font-black uppercase tracking-tighter">{value.nome}</span>
                  </div>
                  <p className="relative z-10 text-[9px] font-medium opacity-60 leading-tight uppercase tracking-widest">{value.descricao}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Descrição</label>
            <textarea
              value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Duo mid, jogamos todos os dias às 20h — só entra quem leva a sério"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">ELO Mínimo</label>
              <select
                value={eloMinimo} onChange={(e) => setEloMinimo(e.target.value)}
                disabled={modo === 'time_vs_time'}
                className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm ${modo === 'time_vs_time' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {OPCOES_ELO.map(elo => (
                  <option key={elo.valor} value={elo.valor} className="bg-[#0d0d0d]">{elo.label}</option>
                ))}
              </select>
              {modo === 'time_vs_time' && <p className="text-[9px] text-white/30 italic">Desativado para times</p>}
            </div>
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Senha</label>
              <button
                onClick={() => setTemSenha(!temSenha)}
                className={`w-full p-3 rounded-xl border transition-all ${temSenha ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-white/5 border-white/10 text-white/40'}`}
              >
                {temSenha ? '🔒 Privada' : '🔓 Pública'}
              </button>
            </div>
          </div>

          {temSenha && (
            <input
              type="text" value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm"
            />
          )}
        </div>

        <div className="relative z-10 p-6 border-t border-white/8 sticky bottom-0 bg-black/50 backdrop-blur-sm">
          <button
            onClick={handleSubmit} disabled={loading}
            className="w-full py-4 rounded-xl font-black text-sm uppercase text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${modoInfo.cor}, ${modoInfo.cor}dd)` }}
          >
            {loading ? 'Criando...' : 'Criar Sala'}
          </button>
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
  // Visitante deslogado vê a vitrine; qualquer ação cai no modal de login.
  // A senha de sala privada é guardada para o POST /join reutilizar — a
  // VALIDAÇÃO acontece no servidor (MORPH-001), nunca aqui no cliente.
  const entrarNaSala = (sala: Sala, senha?: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (sala.temSenha && senha) {
      guardarSenhaSala(sala.id, senha);
    }
    navigate(`/sala-mod1/${sala.id}`);
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
        navigate(`/sala-mod1/${nova.id}`);
      }
    } catch (error: any) {
      // Nunca engole erro: traduz o código do servidor para o usuário.
      toast.error(traduzirErroSala(error?.message));
    }
  };

  const abrirModalCriar = (modo: ModoJogo) => {
    if (!user) {
      setShowLoginModal(true);
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
        <div className="relative w-full rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl group">
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
                      if (!user) {
                        setShowLoginModal(true);
                        return;
                      }
                      if (sala.temSenha && !jaEsta) {
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
                          if (!user) {
                            setShowLoginModal(true);
                            return;
                          }
                          if (sala.temSenha && !jaEsta) {
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
            <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-4">
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
                  const vencedorInfo =
                    sala.vencedor === 'A'
                      ? { label: '🏆 Vitória Azul', cor: '#d4d4d4' }
                      : sala.vencedor === 'B'
                      ? { label: '🏆 Vitória Vermelho', cor: '#d4d4d4' }
                      : sala.vencedor === 'empate'
                      ? { label: '⚖️ Empate', cor: '#9ca3af' }
                      : { label: '⚔️ Disputa', cor: '#9ca3af' };
                  return (
                    <div
                      key={sala.id}
                      onClick={() => navigate(`/sala-mod1/${sala.id}`)}
                      className="flex-none w-full sm:w-[380px] h-[320px] rounded-xl overflow-hidden relative cursor-pointer border border-white/10 hover:border-white/40 transition-all snap-start group/card bg-black"
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
                          <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-white/5"
                            style={{ color: vencedorInfo.cor, borderColor: 'rgba(255,255,255,0.2)' }}>
                            {vencedorInfo.label}
                          </span>
                        </div>

                        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-1 line-clamp-1">{sala.nome}</h3>
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-3 line-clamp-2">{sala.descricao}</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-white/5 border border-white/10 text-white/50">
                            {modoInfo.icone} {modoInfo.nome}
                          </span>
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 bg-white/5 border border-white/10 text-white/50">
                            <Coins className="w-3 h-3" />{sala.mpoints} {sala.mpoints > 0 ? 'MC' : 'MP'}
                          </span>
                          <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-white/5 border border-white/10 text-white/40">
                            Finalizada
                          </span>
                        </div>

                        <div className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-4">
                          Criador: {sala.criadorNome}
                          {sala.timeANome && <span className="ml-2 text-white/40">• {sala.timeANome}</span>}
                          {sala.timeBNome && <span className="ml-2 text-white/40">• {sala.timeBNome}</span>}
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider">
                            {new Date((sala as any).createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover/card:text-white transition-colors">
                            Ver resultado →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
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
          <ModalSenha
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
    </div>
  );
};

export default Jogar;