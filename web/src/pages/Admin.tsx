// src/pages/Admin.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Trophy, Coins, Search, Check, X, AlertTriangle,
  RefreshCw, Ban, Users, Zap, GraduationCap, Mail, ChevronRight, Film,
  LayoutDashboard, Lock, Gamepad2, Sparkles, Newspaper, BookOpen, Plus,
  Pencil, Trash2, Eye, EyeOff, Star, ExternalLink, Swords,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePerfil } from '../contexts/PerfilContext';
import { ajustarSaldoAdmin } from '../api/wallet';
import { buscarElo, buscarJogadorCompleto } from '../api/riot';
import {
  type CargoAdmin,
  CARGO_LABELS, CARGO_COLORS,
  PERMISSOES_POR_CARGO, temPermissao,
} from '../config/adminPermissoes';
import { AbaCargos } from './AdminCargos';
import { AbaContatos } from './AdminContatos';
import { RevisaoPartidas } from '../components/admin/RevisaoPartidas';

// ── TIPOS ──────────────────────────────────────────
interface PartidaDisputa {
  id: number; salaId: number; vencedor: string; vencedorNome?: string;
  jogadores: Array<{ id: string; nome: string; isTimeA: boolean }>;
  createdAt: string; modo: string;
}
interface SalaAberta {
  id: number; nome: string; estado: string; criadorNome: string;
  modo: string; numJogadores: number; maxJogadores: number;
}
interface PartidaTravada {
  id: number; nome: string; estado: string; modo: string; criadorNome: string;
  timeANome?: string; timeBNome?: string;
  jogadores: Array<{ id: string; nome: string; isTimeA: boolean; role: string }>;
}
interface Jogador {
  userId: string; riotId: string; nome: string; iconId?: number; saldo: number;
}
type Aba = 'dashboard' | 'saldos' | 'ranking' | 'highlights' | 'noticias' | 'cargos' | 'contatos' | 'revisao';

interface Highlight {
  id: string; titulo: string; link: string;
  thumbnail_url: string | null; ativo: boolean; ordem: number; categoria: string;
}

interface NoticiaAdmin {
  id: string;
  titulo: string;
  slug?: string;
  resumo: string;
  conteudo?: string;
  categoria: string;
  thumbnail_url: string | null;
  autor?: string;
  publicado_em: string;
  destaque: boolean;
  ativo?: boolean;
  link_url?: string | null;
  link_texto?: string | null;
}

const NOTICIA_CATEGORIAS = [
  { value: 'Torneios', label: '🏆 Torneios & Campeonatos' },
  { value: 'Patch Notes', label: '🛠️ Patch Notes & Atualizações' },
  { value: 'Dicas', label: '💡 Dicas & Guias' },
  { value: 'Esportes', label: '⚡ Informa & Esportes' },
  { value: 'Anúncios', label: '📢 Anúncios Oficiais' },
  { value: 'Comunidade', label: '👥 Comunidade' },
  { value: 'Eventos', label: '🎉 Eventos Especiais' },
];

const INITIAL_NOTICIA_FORM = {
  titulo: '',
  resumo: '',
  conteudo: '',
  categoria: 'Torneios',
  thumbnail_url: '',
  link_url: '',
  link_texto: '',
  destaque: false,
  ativo: true,
};

const HIGHLIGHT_CATEGORIAS: { value: string; label: string }[] = [
  { value: 'highlight',    label: '🎬 Highlight Geral' },
  { value: 'clutch',       label: '🔥 Clutch' },
  { value: 'jogada',       label: '⚔️ Jogada Incrível' },
  { value: 'engracado',    label: '😂 Engraçado' },
  { value: 'top5',         label: '🏆 Top 5' },
  { value: 'compilacao',   label: '📽️ Compilação' },
  { value: 'semana',       label: '📅 Highlights da Semana' },
];

// ── HELPERS ────────────────────────────────────────
function BadgeCargo({ cargo }: { cargo: CargoAdmin }) {
  const c = CARGO_COLORS[cargo];
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${c.text} ${c.bg} ${c.border}`}>{CARGO_LABELS[cargo]}</span>;
}
function CardStyle() {
  return { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' };
}

// ── ABA: DISPUTAS ──────────────────────────────────
function AbaSaldos({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Jogador[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<Jogador | null>(null);
  const [valor, setValor] = useState('');
  const [operacao, setOperacao] = useState<'adicionar' | 'remover'>('adicionar');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const podeMexer = temPermissao(adminCargo, 'gerenciarSaldos');

  const buscarJogadores = useCallback(async () => {
    if (busca.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    // ✅ Schema novo: lê de `wallets` (mc) em vez de `saldos`; contas via API própria.
    const [riotData, balances] = await Promise.all([
      api.players.search(busca.trim()),
      api.wallet.adminBalances(),
    ]);
    const saldoMap = Object.fromEntries((balances ?? []).map((w: any) => [w.userId, w.mc]));
    if (riotData) setResultados(riotData.map((r: any) => ({ userId: r.user_id, riotId: r.riot_id ?? '—', nome: (r.riot_id ?? '—').split('#')[0], iconId: r.profile_icon_id, saldo: saldoMap[r.user_id] ?? 0 })));
    setBuscando(false);
  }, [busca]);

  useEffect(() => { const t = setTimeout(buscarJogadores, 350); return () => clearTimeout(t); }, [buscarJogadores]);

  const aplicarSaldo = async () => {
    if (!selecionado || !valor || !podeMexer) return;
    const qtd = parseInt(valor, 10);
    if (isNaN(qtd) || qtd <= 0) return;
    setSalvando(true);
    // 🔒 Fase 0: `incrementar_saldo` virou exclusiva de service_role.
    // O painel usa `admin_ajustar_saldo`, que valida o cargo dentro do banco
    // (proprietario/admin em platform_roles) e devolve os saldos já atualizados.
    const delta = operacao === 'adicionar' ? qtd : -qtd;
    const r = await ajustarSaldoAdmin(
      selecionado.userId,
      delta,                          // MC — é a coluna que esta aba lê/exibe
      0,                              // MP — inalterado por esta tela
      motivo.trim() || 'ajuste_admin',
    );
    if (r.ok) {
      // Fonte da verdade é o retorno da RPC, não um cálculo local.
      setSelecionado({ ...selecionado, saldo: r.mc });
      setResultados(prev => prev.map(j => j.userId === selecionado.userId ? { ...j, saldo: r.mc } : j));
      setValor(''); setMotivo('');
      setPopup({ tipo: 'sucesso', msg: `${operacao === 'adicionar' ? '+' : '-'}${qtd} MP aplicado.` });
    } else if (r.erro === 'nao_autorizado') {
      setPopup({ tipo: 'erro', msg: 'Sem permissão: seu cargo precisa ser admin ou proprietario em platform_roles.' });
    } else {
      setPopup({ tipo: 'erro', msg: 'Erro ao atualizar saldo.' });
    }
    setSalvando(false);
    setTimeout(() => setPopup(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-black text-white uppercase">Saldos MPoints</h2><p className="text-white/30 text-xs mt-1">{podeMexer ? 'Adicione ou remova MPoints.' : 'Sem permissão.'}</p></div>
      <AnimatePresence>{popup && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${popup.tipo === 'sucesso' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{popup.tipo === 'sucesso' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}{popup.msg}</motion.div>}</AnimatePresence>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-6 space-y-4" style={CardStyle()}>
          <p className="text-white/40 text-xs font-black uppercase">Buscar Jogador</p>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" /><input type="text" value={busca} onChange={e => { setBusca(e.target.value); setSelecionado(null); }} placeholder="Nick#TAG..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none placeholder:text-white/20" />{buscando && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin" />}</div>
          {resultados.length > 0 && <div className="space-y-2 max-h-64 overflow-y-auto">{resultados.map(j => <button key={j.userId} onClick={() => setSelecionado(j)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left ${selecionado?.userId === j.userId ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}><div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0">{j.iconId ? <img src={`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${j.iconId}.png`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-black">{j.nome[0]}</div>}</div><div className="flex-1 min-w-0"><p className="text-white font-black text-sm truncate">{j.riotId}</p><p className="text-white/40 text-xs">{j.saldo.toLocaleString('pt-BR')} MP</p></div>{selecionado?.userId === j.userId && <Check className="w-4 h-4 text-primary shrink-0" />}</button>)}</div>}
        </div>
        <div className="rounded-2xl p-6 space-y-5" style={CardStyle()}>
          {!selecionado ? <div className="flex flex-col items-center justify-center h-full py-12"><Users className="w-8 h-8 text-white/10 mb-3" /><p className="text-white/20 text-sm font-black uppercase">Selecione um jogador</p></div>
          : <>
            <div className="flex items-center gap-3 pb-4 border-b border-white/5"><div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden shrink-0">{selecionado.iconId ? <img src={`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/profileicon/${selecionado.iconId}.png`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 font-black">{selecionado.nome[0]}</div>}</div><div><p className="text-white font-black">{selecionado.riotId}</p><div className="flex items-center gap-1.5 mt-0.5"><Coins className="w-3.5 h-3.5 text-primary" /><span className="text-primary font-black text-sm">{selecionado.saldo.toLocaleString('pt-BR')} MP</span></div></div></div>
            {podeMexer && <>
              <div className="flex gap-2">{(['adicionar', 'remover'] as const).map(op => <button key={op} onClick={() => setOperacao(op)} className={`flex-1 py-2 rounded-xl font-black text-sm uppercase border ${operacao === op ? (op === 'adicionar' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400') : 'bg-white/5 border-white/5 text-white/30'}`}>{op === 'adicionar' ? '+ Adicionar' : '− Remover'}</button>)}</div>
              <div><label className="text-white/30 text-[10px] font-black uppercase block mb-2">Quantidade (MP)</label><input type="number" min="1" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 500" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none placeholder:text-white/20" /></div>
              <button onClick={aplicarSaldo} disabled={salvando || !valor || parseInt(valor) <= 0} className={`w-full py-3 rounded-xl font-black text-sm uppercase disabled:opacity-30 ${operacao === 'adicionar' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>{salvando ? 'Aplicando...' : `${operacao === 'adicionar' ? 'Adicionar' : 'Remover'} ${valor || '—'} MP`}</button>
            </>}
          </>}
        </div>
      </div>
    </div>
  );
}

// ── ABA: RANKING PDL ──────────────────────────────
interface TimePDL { id: string; nome: string; tag: string; logo_url: string | null; pdl: number; wins: number; games_played: number; winrate: number; ranking: number; }

function AbaRanking({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [times, setTimes] = useState<TimePDL[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<TimePDL | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  // Campos de ajuste individuais
  const [deltaPdl, setDeltaPdl]       = useState('');
  const [opPdl, setOpPdl]             = useState<'adicionar' | 'remover'>('adicionar');
  const [deltaWins, setDeltaWins]     = useState('');
  const [opWins, setOpWins]           = useState<'adicionar' | 'remover'>('adicionar');
  const [deltaLosses, setDeltaLosses] = useState('');
  const [opLosses, setOpLosses]       = useState<'adicionar' | 'remover'>('adicionar');
  const podeMexer = temPermissao(adminCargo, 'gerenciarSaldos');

  const carregarTimes = useCallback(async () => {
    setCarregando(true);
    try {
      const { teams: data } = await api.teams.list({ sort: 'ranking', dir: 'asc', limit: 1000 });
      setTimes(data as TimePDL[]);
    } catch {
      setTimes([]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregarTimes(); }, [carregarTimes]);

  const timesFiltrados = times.filter(t =>
    !busca.trim() ||
    t.nome.toLowerCase().includes(busca.toLowerCase()) ||
    t.tag.toLowerCase().includes(busca.toLowerCase())
  );

  const aplicarAjuste = async () => {
    if (!selecionado || !podeMexer) return;
    const pdlQtd  = parseInt(deltaPdl,   10) || 0;
    const winsQtd = parseInt(deltaWins,  10) || 0;
    const lossQtd = parseInt(deltaLosses,10) || 0;
    if (pdlQtd === 0 && winsQtd === 0 && lossQtd === 0) return;
    setSalvando(true);
    const dPdl  = opPdl    === 'adicionar' ?  pdlQtd  : -pdlQtd;
    const dWins = opWins   === 'adicionar' ?  winsQtd : -winsQtd;
    const dLoss = opLosses === 'adicionar' ?  lossQtd : -lossQtd;
    try {
      await api.teams.adjustStats(selecionado.tag, { p_delta_pdl: dPdl, p_delta_wins: dWins, p_delta_losses: dLoss });
      setDeltaPdl(''); setDeltaWins(''); setDeltaLosses('');
      const parts: string[] = [];
      if (pdlQtd  > 0) parts.push(`${dPdl  > 0 ? '+' : ''}${dPdl} PDL`);
      if (winsQtd > 0) parts.push(`${dWins > 0 ? '+' : ''}${dWins} V`);
      if (lossQtd > 0) parts.push(`${dLoss > 0 ? '+' : ''}${dLoss} D`);
      setPopup({ tipo: 'sucesso', msg: `${parts.join(' · ')} aplicado para ${selecionado.nome}.` });
      carregarTimes();
      // Atualiza o card selecionado localmente
      setSelecionado(prev => prev ? {
        ...prev,
        pdl:          Math.max(0, prev.pdl + dPdl),
        wins:         Math.max(0, prev.wins + dWins),
        games_played: Math.max(0, prev.games_played + dWins + dLoss),
      } : null);
    } catch (error: any) {
      console.error('❌ Erro ao ajustar stats:', error.message);
      setPopup({ tipo: 'erro', msg: `Falha ao ajustar stats: ${error.message || 'erro'}` });
    }
    setSalvando(false);
    setTimeout(() => setPopup(null), 3500);
  };

  const losses = selecionado ? Math.max(0, selecionado.games_played - selecionado.wins) : 0;
  const temAlgo = (parseInt(deltaPdl)||0) > 0 || (parseInt(deltaWins)||0) > 0 || (parseInt(deltaLosses)||0) > 0;

  const ToggleOp = ({ op, setOp }: { op: 'adicionar'|'remover'; setOp: (v:'adicionar'|'remover')=>void }) => (
    <div className="flex gap-1">
      {(['adicionar','remover'] as const).map(o => (
        <button key={o} type="button" onClick={() => setOp(o)}
          className={`flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase border transition-all ${op === o ? (o === 'adicionar' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400') : 'bg-white/5 border-white/5 text-white/20'}`}>
          {o === 'adicionar' ? '+' : '−'}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Ranking — Times</h2>
        <p className="text-white/30 text-xs mt-1">{podeMexer ? 'Ajuste PDL, vitórias e derrotas manualmente.' : 'Sem permissão para editar.'}</p>
      </div>
      <AnimatePresence>
        {popup && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${popup.tipo === 'sucesso' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {popup.tipo === 'sucesso' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {popup.msg}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lista de times */}
        <div className="rounded-2xl p-6 space-y-4" style={CardStyle()}>
          <p className="text-white/40 text-xs font-black uppercase">Times ({times.length})</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou TAG..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none placeholder:text-white/20" />
          </div>
          {carregando ? (
            <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 text-white/20 animate-spin" /></div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {timesFiltrados.map(t => (
                <button key={t.id} onClick={() => { setSelecionado(t); setDeltaPdl(''); setDeltaWins(''); setDeltaLosses(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${selecionado?.id === t.id ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                  <span className="text-white/20 font-black text-xs w-6 text-center shrink-0">#{t.ranking}</span>
                  <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                    {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-cover" alt="" /> : <ShieldCheck className="w-4 h-4 text-white/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm truncate">{t.nome} <span className="text-white/30 text-[10px]">[{t.tag}]</span></p>
                    <p className="text-white/40 text-xs">{t.pdl.toLocaleString('pt-BR')} PDL · {t.wins}V {Math.max(0, t.games_played - t.wins)}D</p>
                  </div>
                  {selecionado?.id === t.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}
              {timesFiltrados.length === 0 && <p className="text-white/20 text-sm text-center py-8">Nenhum time encontrado.</p>}
            </div>
          )}
        </div>
        {/* Painel de ajuste */}
        <div className="rounded-2xl p-6 space-y-5" style={CardStyle()}>
          {!selecionado ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
              <Trophy className="w-8 h-8 text-white/10" />
              <p className="text-white/20 text-sm font-black uppercase">Selecione um time</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                  {selecionado.logo_url ? <img src={selecionado.logo_url} className="w-full h-full object-cover" alt="" /> : <ShieldCheck className="w-6 h-6 text-white/20" />}
                </div>
                <div>
                  <p className="text-white font-black">{selecionado.nome} <span className="text-white/30 text-xs">[{selecionado.tag}]</span></p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-primary font-black text-sm">{selecionado.pdl.toLocaleString('pt-BR')} PDL</span>
                    <span className="text-white/20 text-xs">· #{selecionado.ranking}</span>
                  </div>
                </div>
              </div>
              {/* Stats atuais */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Vitórias', value: selecionado.wins, color: '#00FF41' },
                  { label: 'Derrotas', value: losses,           color: '#FF3131' },
                  { label: 'Win Rate', value: `${selecionado.winrate}%`, color: '#FFB700' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>
              {podeMexer && (
                <>
                  {/* Linha PDL */}
                  <div className="space-y-1.5">
                    <label className="text-white/30 text-[10px] font-black uppercase tracking-widest">PDL</label>
                    <div className="flex gap-2">
                      <ToggleOp op={opPdl} setOp={setOpPdl} />
                      <input type="number" min="1" value={deltaPdl} onChange={e => setDeltaPdl(e.target.value)} placeholder="Qtd."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none placeholder:text-white/20" />
                    </div>
                  </div>
                  {/* Linha Vitórias */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#00FF4166' }}>Vitórias</label>
                    <div className="flex gap-2">
                      <ToggleOp op={opWins} setOp={setOpWins} />
                      <input type="number" min="1" value={deltaWins} onChange={e => setDeltaWins(e.target.value)} placeholder="Qtd."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none placeholder:text-white/20" />
                    </div>
                  </div>
                  {/* Linha Derrotas */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#FF313166' }}>Derrotas</label>
                    <div className="flex gap-2">
                      <ToggleOp op={opLosses} setOp={setOpLosses} />
                      <input type="number" min="1" value={deltaLosses} onChange={e => setDeltaLosses(e.target.value)} placeholder="Qtd."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none placeholder:text-white/20" />
                    </div>
                  </div>
                  <button onClick={aplicarAjuste} disabled={salvando || !temAlgo}
                    className="w-full py-3 rounded-xl font-black text-sm uppercase bg-white text-black hover:bg-white/90 disabled:opacity-30 transition-all">
                    {salvando ? 'Aplicando...' : `Aplicar ajuste em ${selecionado.tag}`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ABA: HIGHLIGHTS ────────────────────────────────
function AbaHighlights({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [list, setList] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ titulo: '', link: '', thumbnail_url: '', categoria: 'highlight' });
  const [salvando, setSalvando] = useState(false);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const podeMexer = temPermissao(adminCargo, 'gerenciarSaldos');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.content.highlights({ all: true });
      setList(data);
    } catch {
      setPopup({ tipo: 'erro', msg: 'Erro ao carregar highlights.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.link.trim()) return;
    setSalvando(true);
    try {
      await api.content.highlightsCreate({
        titulo: form.titulo.trim(),
        link: form.link.trim(),
        thumbnail_url: form.thumbnail_url.trim() || null,
        categoria: form.categoria,
      });
      setForm({ titulo: '', link: '', thumbnail_url: '', categoria: 'highlight' });
      setPopup({ tipo: 'sucesso', msg: 'Highlight adicionado!' });
      carregar();
    } catch {
      setPopup({ tipo: 'erro', msg: 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
    setTimeout(() => setPopup(null), 3000);
  };

  const toggleAtivo = async (h: Highlight) => {
    await api.content.highlightsUpdate(h.id, { ativo: !h.ativo });
    setList(prev => prev.map(x => x.id === h.id ? { ...x, ativo: !x.ativo } : x));
  };

  const deletar = async (id: string) => {
    if (!window.confirm('Remover este highlight?')) return;
    await api.content.highlightsDelete(id);
    setList(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Highlights da Comunidade</h2>
        <p className="text-white/30 text-xs mt-1">Clipes que aparecem no Lobby quando não há lives ativas. As lives sempre aparecem primeiro.</p>
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border font-black text-sm ${popup.tipo === 'sucesso' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {popup.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulário de adição */}
      {podeMexer && (
        <div className="rounded-2xl p-6 space-y-3" style={CardStyle()}>
          <h3 className="text-white/50 text-[10px] font-black uppercase tracking-widest">Adicionar Clipe</h3>
          <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
            placeholder="Título  (ex: Top 5 jogadas da semana)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 placeholder:text-white/20" />
          <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
            placeholder="Link do clipe  (twitch.tv/channel/clip/...)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 placeholder:text-white/20" />
          <input value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))}
            placeholder="URL da thumbnail  (opcional — imagem de capa do card)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 placeholder:text-white/20" />
          <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20">
            {HIGHLIGHT_CATEGORIAS.map(c => (
              <option key={c.value} value={c.value} className="bg-[#111]">{c.label}</option>
            ))}
          </select>
          <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.link.trim()}
            className="w-full py-3 rounded-xl bg-[#FFB700]/20 border border-[#FFB700]/40 text-[#FFB700] font-black text-sm uppercase tracking-widest hover:bg-[#FFB700]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {salvando ? 'Salvando...' : '+ Adicionar Highlight'}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[#FFB700] border-t-transparent" /></div>
      ) : list.length === 0 ? (
        <p className="text-white/20 text-sm text-center py-8 uppercase tracking-widest">Nenhum highlight cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {list.map(h => (
            <div key={h.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${h.ativo ? 'border-white/10' : 'border-white/5 opacity-40'}`} style={CardStyle()}>
              {h.thumbnail_url ? (
                <img src={h.thumbnail_url} alt={h.titulo} className="w-24 h-14 object-cover rounded-lg shrink-0 bg-white/5" />
              ) : (
                <div className="w-24 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-white/20" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm truncate">{h.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#9146FF]/20 text-[#9146FF] border border-[#9146FF]/20">
                    {HIGHLIGHT_CATEGORIAS.find(c => c.value === h.categoria)?.label ?? h.categoria}
                  </span>
                  <p className="text-white/30 text-xs truncate">{h.link}</p>
                </div>
              </div>
              {podeMexer && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleAtivo(h)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition-all ${h.ativo ? 'border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20' : 'border-white/10 text-white/30 hover:bg-white/5'}`}>
                    {h.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => deletar(h.id)}
                    className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ABA: NOTÍCIAS & CARDS (Informa & Esportes) ───────
function AbaNoticias({ adminCargo }: { adminCargo: CargoAdmin }) {
  const { perfil } = usePerfil();
  const [list, setList] = useState<NoticiaAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(INITIAL_NOTICIA_FORM);
  const [salvando, setSalvando] = useState(false);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const podeMexer = temPermissao(adminCargo, 'gerenciarSaldos') || adminCargo === 'organizador';

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.content.news({ all: true });
      setList(data);
    } catch {
      setPopup({ tipo: 'erro', msg: 'Erro ao carregar notícias.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resetForm = () => {
    setForm(INITIAL_NOTICIA_FORM);
    setEditandoId(null);
    setMostrarForm(false);
  };

  const iniciarEdicao = (n: NoticiaAdmin) => {
    setEditandoId(n.id);
    setForm({
      titulo: n.titulo || '',
      resumo: n.resumo || '',
      conteudo: n.conteudo || '',
      categoria: n.categoria || 'Torneios',
      thumbnail_url: n.thumbnail_url || '',
      link_url: n.link_url || '',
      link_texto: n.link_texto || '',
      destaque: !!n.destaque,
      ativo: n.ativo !== false,
    });
    setMostrarForm(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const salvar = async () => {
    if (!form.titulo.trim() || !form.resumo.trim()) {
      setPopup({ tipo: 'erro', msg: 'Preencha ao menos o Título e o Resumo da notícia.' });
      return;
    }
    setSalvando(true);

    const slug = form.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const payload: any = {
      titulo: form.titulo.trim(),
      slug,
      resumo: form.resumo.trim(),
      conteudo: form.conteudo.trim() || null,
      categoria: form.categoria,
      thumbnail_url: form.thumbnail_url.trim() || null,
      link_url: form.link_url.trim() || null,
      link_texto: form.link_texto.trim() || null,
      destaque: form.destaque,
      ativo: form.ativo,
      autor: perfil?.nome || perfil?.riotId || 'M7 Staff',
    };

    try {
      if (editandoId) {
        await api.content.newsUpdate(editandoId, payload);
      } else {
        payload.publicado_em = new Date().toISOString();
        await api.content.newsCreate(payload);
      }
      setPopup({ tipo: 'sucesso', msg: editandoId ? 'Notícia atualizada com sucesso!' : 'Notícia publicada com sucesso!' });
      resetForm();
      carregar();
    } catch (err: any) {
      setPopup({ tipo: 'erro', msg: 'Erro ao salvar notícia: ' + (err?.message || 'erro desconhecido') });
    } finally {
      setSalvando(false);
    }
    setTimeout(() => setPopup(null), 3500);
  };

  const toggleAtivo = async (n: NoticiaAdmin) => {
    const novoStatus = !(n.ativo ?? true);
    await api.content.newsUpdate(n.id, { ativo: novoStatus });
    setList(prev => prev.map(x => (x.id === n.id ? { ...x, ativo: novoStatus } : x)));
  };

  const toggleDestaque = async (n: NoticiaAdmin) => {
    const novoDestaque = !n.destaque;
    await api.content.newsUpdate(n.id, { destaque: novoDestaque });
    setList(prev => prev.map(x => (x.id === n.id ? { ...x, destaque: novoDestaque } : x)));
  };

  const deletar = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta notícia?')) return;
    await api.content.newsDelete(id);
    setList(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#00F0FF]" />
            Gerenciar Informa & Esportes (Notícias da Home)
          </h2>
          <p className="text-white/40 text-xs mt-1">
            Publique novidades, regras de campeonatos, patch notes e avisos que aparecem nos cards da página inicial.
          </p>
        </div>
        {podeMexer && (
          <button
            onClick={() => {
              if (mostrarForm && editandoId) {
                resetForm();
              } else {
                setMostrarForm(!mostrarForm);
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] font-black text-xs uppercase tracking-widest hover:bg-[#00F0FF]/20 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {mostrarForm ? 'Fechar Formulário' : '+ Nova Notícia'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border font-black text-sm ${
              popup.tipo === 'sucesso'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {popup.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulário de Adição/Edição */}
      {podeMexer && mostrarForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-2xl p-6 space-y-4 border border-[#00F0FF]/20 bg-[#00F0FF]/[0.02]"
          style={CardStyle()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-[#00F0FF] text-xs font-black uppercase tracking-widest flex items-center gap-2">
              {editandoId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editandoId ? `Editar Notícia #${editandoId}` : 'Criar Nova Notícia / Card'}
            </h3>
            {editandoId && (
              <button onClick={resetForm} className="text-xs text-white/40 hover:text-white underline">
                Cancelar Edição
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
                Título da Notícia *
              </label>
              <input
                value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Grande Torneio M7 de Final de Semana"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
                Categoria
              </label>
              <select
                value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50"
              >
                {NOTICIA_CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
              Resumo curto (Aparece no Card da Home) *
            </label>
            <input
              value={form.resumo}
              onChange={e => setForm(p => ({ ...p, resumo: e.target.value }))}
              placeholder="Ex: Premiação recorde em Pix, inscrições abertas para todos os elos..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
              Conteúdo Completo (Texto da Matéria ao clicar no card)
            </label>
            <textarea
              rows={4}
              value={form.conteudo}
              onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
              placeholder="Escreva a matéria detalhada ou aviso completo aqui..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
                URL da Imagem de Capa
              </label>
              <input
                value={form.thumbnail_url}
                onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
                Link do Botão (Opcional)
              </label>
              <input
                value={form.link_url}
                onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                placeholder="https://... ou /campeonatos"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">
                Texto do Botão
              </label>
              <input
                value={form.link_texto}
                onChange={e => setForm(p => ({ ...p, link_texto: e.target.value }))}
                placeholder="Ex: Inscreva-se Agora, Ver Regulamento"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F0FF]/50 placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={e => setForm(p => ({ ...p, destaque: e.target.checked }))}
                className="w-4 h-4 accent-[#FFB700] rounded"
              />
              <span className="text-xs font-bold text-white/80">Destacar na Home</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))}
                className="w-4 h-4 accent-[#00F0FF] rounded"
              />
              <span className="text-xs font-bold text-white/80">Ativo / Publicado</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={salvar}
              disabled={salvando || !form.titulo.trim() || !form.resumo.trim()}
              className="flex-1 py-3 rounded-xl bg-[#00F0FF] text-black font-black text-xs uppercase tracking-widest hover:bg-[#00D8E6] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar Notícia' : '🚀 Publicar Notícia'}
            </button>
            {editandoId && (
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-xs uppercase hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Lista de Notícias */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#00F0FF] border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.01]">
          <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm font-bold uppercase tracking-wider">
            Nenhuma notícia cadastrada no banco.
          </p>
          <p className="text-white/20 text-xs mt-1">
            Clique no botão acima para adicionar a primeira notícia que aparecerá no site.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(n => (
            <div
              key={n.id}
              className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all ${
                n.ativo !== false ? 'border-white/10' : 'border-white/5 opacity-50 bg-black/40'
              }`}
              style={CardStyle()}
            >
              <div className="flex items-start gap-4">
                {n.thumbnail_url ? (
                  <img
                    src={n.thumbnail_url}
                    alt={n.titulo}
                    className="w-24 h-20 object-cover rounded-lg shrink-0 bg-black"
                  />
                ) : (
                  <div className="w-24 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-white/20" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#FFB700]/20 text-[#FFB700] border border-[#FFB700]/30">
                      {n.categoria}
                    </span>
                    {n.destaque && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        ⭐ Destaque
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-white/30 ml-auto">
                      {new Date(n.publicado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <h4 className="text-white font-black text-sm line-clamp-1">{n.titulo}</h4>
                  <p className="text-white/40 text-xs line-clamp-2 mt-0.5 leading-relaxed">{n.resumo}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAtivo(n)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-all flex items-center gap-1 ${
                      n.ativo !== false
                        ? 'border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20'
                        : 'border-white/10 text-white/30 hover:bg-white/5'
                    }`}
                  >
                    {n.ativo !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {n.ativo !== false ? 'Ativa' : 'Inativa'}
                  </button>

                  <button
                    onClick={() => toggleDestaque(n)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-all flex items-center gap-1 ${
                      n.destaque
                        ? 'border-[#FFB700]/40 text-[#FFB700] bg-[#FFB700]/10 hover:bg-[#FFB700]/20'
                        : 'border-white/10 text-white/30 hover:bg-white/5'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    {n.destaque ? 'Destaque' : 'Normal'}
                  </button>
                </div>

                {podeMexer && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => iniciarEdicao(n)}
                      className="p-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                      title="Editar Notícia"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletar(n.id)}
                      className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                      title="Excluir Notícia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── STATS GLOBAIS DA PLATAFORMA ────────────────────
interface PlatformStats {
  jogadores: number;
  salasAtivas: number;
  times: number;
  mpDistribuido: number;
}

function StatsCards() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Salas ativas vêm da API própria (lista ativa); saldo agregado e
      // contagem de jogadores seguem nos domínios carteira/identidade.
      const [jog, salas, timesCount, wallets] = await Promise.all([
        api.players.count(),
        api.matches.list({ status: 'ativas', limit: 200 }).catch(() => []),
        api.teams.list({ limit: 1 }),
        api.wallet.adminBalances(),
      ]);
      if (cancelled) return;
      const totalMP = (wallets ?? []).reduce((acc: number, w: any) => acc + (w.mc || 0), 0);
      setStats({
        jogadores: jog?.count ?? 0,
        salasAtivas: Array.isArray(salas) ? salas.length : 0,
        times: timesCount.total ?? 0,
        mpDistribuido: totalMP,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label: 'Jogadores',      value: stats?.jogadores,    icon: Users,    color: '#9146FF' },
    { label: 'Salas Ativas',   value: stats?.salasAtivas,  icon: Gamepad2, color: '#00FF41' },
    { label: 'Times',          value: stats?.times,        icon: Trophy,   color: '#FFB700' },
    { label: 'MP em Circulação', value: stats?.mpDistribuido, icon: Coins,  color: '#FF3131' },
  ];

  const fmt = (v?: number) => {
    if (v === undefined) return '—';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v.toLocaleString('pt-BR');
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-2xl p-4 lg:p-5" style={CardStyle()}>
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
          </div>
          {stats === null ? (
            <div className="h-8 w-20 bg-white/5 rounded-md animate-pulse mb-1" />
          ) : (
            <p className="text-2xl lg:text-3xl font-black text-white tracking-tighter" style={{ color }}>
              {fmt(value)}
            </p>
          )}
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── ABA: DASHBOARD (visão geral) ────────────────────
function AbaDashboard({ onNavigate, adminCargo }: { onNavigate: (a: Aba) => void; adminCargo: CargoAdmin }) {
  const permissoes = PERMISSOES_POR_CARGO[adminCargo];
  const atalhos = [
    { id: 'saldos' as Aba,     label: 'Saldos',     icon: Coins,         color: '#FFB700', desc: 'Gerenciar MPoints', bloqueada: !permissoes.gerenciarSaldos },
    { id: 'ranking' as Aba,    label: 'Ranking',    icon: Trophy,        color: '#9146FF', desc: 'Ajustar PDL / W·L', bloqueada: !permissoes.gerenciarSaldos },
    { id: 'noticias' as Aba,   label: 'Notícias',   icon: Newspaper,     color: '#00F0FF', desc: 'Informa & Esportes (Home)', bloqueada: !permissoes.gerenciarSaldos },
    { id: 'highlights' as Aba, label: 'Highlights', icon: Film,          color: '#FF3131', desc: 'Clipes da comunidade', bloqueada: !permissoes.gerenciarSaldos },
    { id: 'cargos' as Aba,     label: 'Cargos',     icon: GraduationCap, color: '#4DABFF', desc: 'Funções de usuários', bloqueada: !permissoes.gerenciarCargos },
    { id: 'contatos' as Aba,   label: 'Contatos',   icon: Mail,          color: '#A78BFA', desc: 'WhatsApp e Discord', bloqueada: adminCargo !== 'admin' && adminCargo !== 'proprietario' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Bem-vindo ao painel</h2>
        <p className="text-white/30 text-xs mt-1">Atalhos rápidos e visão geral da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {atalhos.map(a => (
          <button
            key={a.id}
            onClick={() => !a.bloqueada && onNavigate(a.id)}
            disabled={a.bloqueada}
            className="group relative flex items-center gap-4 p-5 rounded-2xl text-left transition-all hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={CardStyle()}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${a.color}15`, border: `1px solid ${a.color}30` }}>
              <a.icon className="w-5 h-5" style={{ color: a.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm uppercase tracking-wide">{a.label}</p>
              <p className="text-white/40 text-xs mt-0.5">{a.desc}</p>
            </div>
            {a.bloqueada ? (
              <Lock className="w-4 h-4 text-white/20 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6 flex items-center gap-4" style={{ ...CardStyle(), borderColor: 'rgba(145,70,255,0.15)', background: 'rgba(145,70,255,0.04)' }}>
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-white font-black text-sm">M7 Arena — Painel Administrativo</p>
          <p className="text-white/40 text-xs mt-0.5">
            Você está logado como <span className="text-primary font-black">{CARGO_LABELS[adminCargo]}</span>.
            Use as abas acima para navegar pelas seções disponíveis.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ───────────────────────────────
export default function Admin() {
  const { perfil } = usePerfil();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dashboard');

  if (!perfil) {
    return (
      <div className="flex-1 bg-[#050505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const adminCargo = (perfil.cargo as CargoAdmin) || 'jogador';
  if (adminCargo === 'jogador') {
    return (
      <div className="flex-1 bg-[#050505] flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-white font-black text-xl uppercase">Acesso Restrito</h1>
        <p className="text-white/30 text-sm text-center max-w-xs">Você não tem permissão.</p>
      </div>
    );
  }

  const permissoes = PERMISSOES_POR_CARGO[adminCargo];
  const isAdminOuProprietario = adminCargo === 'admin' || adminCargo === 'proprietario';

  const abas: { id: Aba; label: string; icon: React.ElementType; bloqueada: boolean }[] = [
    { id: 'dashboard',  label: 'Visão',      icon: LayoutDashboard, bloqueada: false },
    { id: 'saldos',     label: 'Saldos',     icon: Coins,           bloqueada: !permissoes.gerenciarSaldos },
    { id: 'ranking',    label: 'Ranking',    icon: Trophy,          bloqueada: !permissoes.gerenciarSaldos },
    { id: 'noticias',   label: 'Notícias',   icon: Newspaper,       bloqueada: !permissoes.gerenciarSaldos },
    { id: 'highlights', label: 'Highlights', icon: Film,            bloqueada: !permissoes.gerenciarSaldos },
    { id: 'cargos',     label: 'Cargos',     icon: GraduationCap,   bloqueada: !permissoes.gerenciarCargos && adminCargo !== 'proprietario' },
    { id: 'contatos',   label: 'Contatos',   icon: Mail,            bloqueada: !isAdminOuProprietario },
    { id: 'revisao',    label: 'Revisão',    icon: Swords,          bloqueada: false },
  ];

  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      {/* ── HEADER (gradient + glow) ─────────────── */}
      <div className="relative border-b border-white/5 bg-gradient-to-b from-primary/[0.04] via-white/[0.01] to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(145,70,255,0.08),transparent_70%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-8 lg:py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(145,70,255,0.15)]">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter">Painel Admin</h1>
                  <BadgeCargo cargo={adminCargo} />
                </div>
                <p className="text-white/40 text-sm font-medium mt-1">M7 Arena · gerenciamento da plataforma</p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <p className="text-white font-black text-sm">{perfil.riotId || perfil.nome}</p>
              <p className="text-white/30 text-[10px] uppercase tracking-widest">Logado como admin</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
        {/* ── STATS CARDS ────────────────────────── */}
        <StatsCards />

        {/* ── TABS ────────────────────────────────── */}
        <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/5 overflow-x-auto">
          {abas.map(({ id, label, icon: Icon, bloqueada }) => (
            <button
              key={id}
              onClick={() => !bloqueada && setAbaAtiva(id)}
              disabled={bloqueada}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${
                abaAtiva === id
                  ? 'bg-white text-black shadow-lg shadow-white/10'
                  : bloqueada
                  ? 'text-white/15 cursor-not-allowed'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {bloqueada && <Lock className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {/* ── CONTEÚDO DA ABA ─────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={abaAtiva}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {abaAtiva === 'dashboard'  && <AbaDashboard onNavigate={setAbaAtiva} adminCargo={adminCargo} />}
            {abaAtiva === 'saldos'     && <AbaSaldos adminCargo={adminCargo} />}
            {abaAtiva === 'ranking'    && <AbaRanking adminCargo={adminCargo} />}
            {abaAtiva === 'noticias'   && <AbaNoticias adminCargo={adminCargo} />}
            {abaAtiva === 'highlights' && <AbaHighlights adminCargo={adminCargo} />}
            {abaAtiva === 'cargos'     && <AbaCargos adminCargo={adminCargo} />}
            {abaAtiva === 'contatos'   && <AbaContatos adminCargo={adminCargo} />}
            {abaAtiva === 'revisao'    && <RevisaoPartidas />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}