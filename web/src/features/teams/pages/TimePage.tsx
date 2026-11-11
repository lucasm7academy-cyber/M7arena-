import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Crown, Trophy, Wallet, Users,
  ShieldCheck, LogOut, Paintbrush,
  UserPlus, Check, RefreshCw, X,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePerfil } from '../../../contexts/PerfilContext';
import { buildProfileIconUrl } from '../../../api/riot';
import { opGgUrl } from '../../../lib/opgg';
import { useSound } from '../../../hooks/useSound';
import { AnimatePresence as AP } from 'motion/react';
import {
  type Role,
  TIER_MAP,
} from '../../../components/players/playerMeta';
import TeamRoster from '../components/TeamRoster';
import { Membro, TimeData } from '../roster';
import { ModalBase, CUT_FRAME, CUT_FRAME_INNER } from '../components/modals/ModalBase';
import { InvitePlayerModal } from '../components/modals/InvitePlayerModal';
import { ManageLineupModal } from '../components/modals/ManageLineupModal';
import { EditTeamModal } from '../components/modals/EditTeamModal';
import { ConfirmLeaveModal } from '../components/modals/ConfirmLeaveModal';

// ── tipos ─────────────────────────────────────────────────────────────────────
// Polígonos Oficiais Cut-Edge
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── componente ────────────────────────────────────────────────────────────────
export default function TimePage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { playSound } = useSound();
  const { user } = useAuth();
  const { perfil } = usePerfil();

  const [time,    setTime]    = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'leader' | 'member' | 'visitor'>('visitor');


  const [modalConvidar, setModalConvidar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalLineup, setModalLineup] = useState(false);
  const [modalSair, setModalSair] = useState(false);
  const [notCapSidebar, setNotCapSidebar] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ✅ Cache: evita requisições desnecessárias quando volta pra aba
  const lastLoadedIdRef = useRef<string | null>(null);

  // ── carregar ────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!id) return;

    // ✅ Se já carregou esse time, não recarrega (evita requisições em Alt+Tab)
    if (lastLoadedIdRef.current === id) return;
    lastLoadedIdRef.current = id;

    const uid = user?.id ?? null;
    setCurrentUserId(uid);

    // ✅ Schema novo: time_membros enxuto (tipo, lane, is_capitao).
    // Dados pesados (riot_id, elo, balance, ícone) vêm via JOIN com contas_riot + wallets.
    // A API devolve o mesmo shape legado (times + time_membros).
    let t: any;
    try {
      t = await api.teams.detail(id);
    } catch {
      setLoading(false);
      return;
    }

    if (!t) { setLoading(false); return; }

    const membrosRaw: Membro[] = ((t.time_membros ?? []) as any[])
      .filter((m: any) => m.status !== 'saiu')
      .map((m: any) => ({
        userId:   m.user_id,
        riotId:   m.guest_riot_id || 'Jogador',
        role:     (m.lane || 'TOP') as Role,
        cargo:    m.tipo || 'jogador',
        isLeader: !!m.is_capitao,
        elo:      m.guest_elo_cache || '',
        balance:  0,
        iconeId:  m.guest_profile_icon_id ?? 1,
        puuid:    m.guest_puuid ?? undefined,
      }));

    // Buscar dados Riot de todos os membros
    const userIds = membrosRaw.map(m => m.userId).filter(Boolean);
    if (userIds.length > 0) {
      const contas = await api.players.byIds(userIds);

      const contaMap: Record<string, any> = {};
      (contas ?? []).forEach((c: any) => { contaMap[c.user_id] = c; });

      membrosRaw.forEach(m => {
        if (m.userId) {
          const c = contaMap[m.userId];
          if (c) {
            m.riotId  = c.riot_id ?? 'Jogador';
            m.iconeId = c.profile_icon_id ?? 1;
            m.nivel   = c.level ?? 1;
            m.puuid   = c.puuid ?? undefined;
            const solo = c.elo_cache?.soloQ;
            if (solo?.tier) m.elo = TIER_MAP[solo.tier] ?? solo.tier;
          }
        }
      });
    }

    let role: 'leader' | 'member' | 'visitor' = 'visitor';
    if (uid) {
      // Líder = capitão (is_capitao) OU dono do time (dono_id).
      // O dono NUNCA perde acesso de edição, mesmo se não estiver como capitão
      // (ex: se colocou a si mesmo como reserva).
      const membro = membrosRaw.find(m => m.userId === uid);
      const isDono = t.dono_id === uid;
      const isProprietario = perfil?.cargo === 'proprietario';
      if (membro?.isLeader || isDono || isProprietario) {
        role = 'leader';
      } else if (membro) {
        role = 'member';
      }
    }
    setUserRole(role);

    setTime({
      id:           t.id,
      nome:         t.nome,
      tag:          t.tag,
      logoUrl:      t.logo_url ?? undefined,
      gradientFrom: t.gradient_from || '#FFB700',
      gradientTo:   t.gradient_to   || '#FF6600',
      pdl:          t.pdl           || 0,
      winrate:      t.winrate       || 0,
      ranking:      t.ranking       || 999,
      wins:         t.wins          || 0,
      gamesPlayed:  t.games_played  || 0,
      donoId:       t.dono_id,
      whatsapp:     t.whatsapp      ?? undefined,
      discord:      t.discord       ?? undefined,
      membros:      membrosRaw,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id, user]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUpdateTeam = async (updated: Partial<TimeData>) => {
    if (!time) return;
    try {
      await api.teams.update(String(time.id), {
        nome: updated.nome,
        tag: updated.tag,
        gradient_from: updated.gradientFrom,
        gradient_to: updated.gradientTo,
        logo_url: updated.logoUrl ?? null,
        whatsapp: updated.whatsapp ?? null,
        discord: updated.discord ?? null,
      });
    } catch {
      console.error('❌ Erro ao salvar time (teams.update):');
      return;
    }
    // Otimização: atualizar apenas os campos modificados no estado, sem recarregar tudo
    setTime((prev: TimeData | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        nome: updated.nome ?? prev.nome,
        tag: updated.tag ?? prev.tag,
        gradientFrom: updated.gradientFrom ?? prev.gradientFrom,
        gradientTo: updated.gradientTo ?? prev.gradientTo,
        logoUrl: updated.logoUrl ?? prev.logoUrl,
        whatsapp: updated.whatsapp ?? prev.whatsapp,
        discord: updated.discord ?? prev.discord,
      };
    });
  };

  const handleUpdatePlayers = async (membros: Membro[]): Promise<{ ok: boolean; error?: string }> => {
    if (!time) return { ok: false, error: 'Time não carregado.' };

    // A API substitui o lineup inteiro numa ÚNICA transação (substitui a RPC).
    // Se qualquer insert falhar, ROLLBACK — o time NUNCA fica zerado.
    try {
      await api.teams.saveLineup(time.id, membros.map(m => ({
        user_id:               m.userId || null,
        lane:                  m.role,
        is_capitao:            m.isLeader || false,
        cargo:                 m.cargo || 'jogador',
        guest_riot_id:         m.userId ? null : m.riotId,
        guest_puuid:           m.userId ? null : m.puuid,
        guest_profile_icon_id: m.userId ? null : m.iconeId,
        guest_elo_cache:       m.userId ? null : m.elo,
      })));
    } catch (error: any) {
      console.error('❌ Erro ao salvar lineup:', error.message, error);
      return { ok: false, error: error?.message || 'Erro ao salvar o lineup.' };
    }

    // Atualiza apenas membros no estado, sem recarregar o time inteiro
    setTime((prev: TimeData | null) => {
      if (!prev) return prev;
      return { ...prev, membros };
    });
    return { ok: true };
  };

  const handleSairTime = async () => {
    if (!currentUserId || !time) return;
    // ✅ A saga inteira (promoção de capitão, dissolução do time, remoção do
    // membro) roda no servidor em POST /api/teams/:id/leave — regra de negócio
    // não mora no navegador.
    try {
      const result = await api.teams.leave(String(time.id));
      if (result?.deleted) {
        navigate('/times');
        return;
      }
    } catch (err: any) {
      console.error('❌ Erro ao sair do time:', err?.message, err);
    }
    navigate('/times');
  };

  const handleSidebarLineup = () => {
    if (userRole === 'leader' || userRole === 'member') {
      playSound('click');
      setModalLineup(true);
    } else {
      playSound('click');
      setNotCapSidebar(true);
      setTimeout(() => setNotCapSidebar(false), 3000);
    }
  };

  // Cargo proprietário DO SITE (não do time): habilita a coroa no Gerenciar
  // Lineup para qualquer membro, inclusive convidado sem conta (ADR-089).
  const isProprietario = perfil?.cargo === 'proprietario';

  // ── abrir OP.GG do jogador em nova aba ───────────────────────────────────────
  // Em vez do card padrão, leva direto pro perfil do player no OP.GG.
  // Ex: "One Lucks#BR1" -> https://op.gg/pt/lol/summoners/br/One%20Lucks-br1
  const handlePlayerClick = (m: Membro) => {
    const url = opGgUrl(m.riotId);
    if (!url) return;
    playSound('click');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8 w-full max-w-[1400px] mx-auto space-y-6">
        {/* Voltar skeleton */}
        <div className="h-8 w-24 bg-white/5 animate-pulse" style={{ clipPath: CUT_BUTTON }} />

        {/* Hero Banner skeleton */}
        <div
          className="relative p-[1.5px] shadow-2xl animate-pulse"
          style={{ clipPath: CUT_FRAME, background: 'rgba(255,255,255,0.08)' }}
        >
          <div className="bg-[#08080a] p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6" style={{ clipPath: CUT_FRAME_INNER }}>
            <div className="w-24 h-24 bg-white/5 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-48 bg-white/5" />
              <div className="h-4 w-24 bg-white/5" />
              <div className="h-3 w-64 bg-white/5" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="relative p-[1px] animate-pulse"
              style={{ clipPath: CUT_FRAME, background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="bg-[#08080a] p-4" style={{ clipPath: CUT_FRAME_INNER }}>
                <div className="h-3 w-16 bg-white/5 mb-2" />
                <div className="h-7 w-12 bg-white/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Members skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="relative p-[1px] animate-pulse"
              style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="bg-[#08080a] p-4 flex items-center gap-4" style={{ clipPath: CUT_BUTTON_INNER }}>
                <div className="w-10 h-10 bg-white/5 shrink-0" style={{ clipPath: CUT_BADGE }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/5" />
                  <div className="h-3 w-20 bg-white/5" />
                </div>
                <div className="h-6 w-16 bg-white/5" style={{ clipPath: CUT_BADGE }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!time) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Time não encontrado</p>
        <button
          onClick={() => navigate('/times')}
          className="px-6 py-3 font-black text-xs uppercase tracking-widest bg-primary text-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          style={{ clipPath: CUT_BUTTON }}
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Equipes
        </button>
      </div>
    );
  }

  const lider = time.membros.find(m => m.isLeader);

  return (
    <>
      {/* Lightbox de Logo */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out p-4"
          >
            <div
              className="p-[1.5px] rounded-2xl max-w-[min(480px,90vw)] max-h-[80vh] shadow-2xl overflow-hidden"
              style={{
                background: time.gradientFrom
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] rounded-[14.5px] flex items-center justify-center overflow-hidden"
              >
                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  src={lightboxUrl}
                  alt="Logo do time"
                  className="max-w-full max-h-[75vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen p-4 md:p-8 w-full max-w-[1400px] mx-auto space-y-6 font-sans text-white">
        {/* Voltar */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/times')}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all text-xs font-black uppercase tracking-wider cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para Equipes</span>
        </motion.button>

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-[2px] shadow-2xl overflow-hidden"
          style={{
            clipPath: CUT_FRAME,
            background: time.gradientFrom,
            boxShadow: `0 0 50px -10px ${time.gradientFrom}4D`
          }}
        >
          <div
            className="w-full bg-[#08080a] relative overflow-hidden p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-center gap-6 justify-between"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Imagem de Fundo e Gradientes */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src="/images/fundo fanaticaaa.webp"
                alt=""
                className="w-full h-full object-cover opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/80 to-[#08080a]/60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/90 via-transparent to-transparent" />
            </div>

            {/* Glow de fundo */}
            <div
              className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-[120px] opacity-25 pointer-events-none z-0"
              style={{ background: time.gradientFrom }}
            />

            {/* Logo */}
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 p-[2px] rounded-2xl flex items-center justify-center shrink-0 relative z-10 shadow-2xl cursor-pointer"
              style={{
                background: time.gradientFrom,
                boxShadow: `0 0 35px -5px ${time.gradientFrom}80`
              }}
              onClick={time.logoUrl ? () => setLightboxUrl(time.logoUrl!) : undefined}
            >
              <div
                className="w-full h-full bg-[#08080a] rounded-[14.5px] flex items-center justify-center overflow-hidden"
              >
                {time.logoUrl ? (
                  <img src={time.logoUrl} alt={time.nome} className="w-full h-full object-cover cursor-zoom-in" loading="lazy" width={120} height={120} />
                ) : (
                  <span className="font-black text-2xl sm:text-3xl tracking-widest" style={{ color: time.gradientFrom }}>
                    {time.tag}
                  </span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left min-w-0 relative z-10">
              <div className="flex items-center gap-3 justify-center sm:justify-start mb-1 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight truncate">{time.nome}</h1>
                {userRole === 'leader' && <Crown className="w-5 h-5 shrink-0" style={{ color: time.gradientFrom }} />}
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-3">
                <div
                  className="p-[1px] shrink-0"
                  style={{
                    clipPath: CUT_BADGE,
                    background: `${time.gradientFrom}80`,
                  }}
                >
                  <div
                    className="px-2.5 py-0.5 text-[10px] font-black tracking-widest bg-[#08080a]"
                    style={{
                      clipPath: CUT_BADGE_INNER,
                      color: time.gradientFrom,
                    }}
                  >
                    #{time.tag}
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-md border border-white/10 bg-[#08080a] text-white/40 text-[10px] font-black uppercase tracking-wider">
                  Ranking #{time.ranking}
                </div>
              </div>
            </div>

            {/* Espaços para Troféus da Equipe */}
            <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0 mt-2 sm:mt-0 relative z-10">
              <div className="flex items-center gap-2 sm:gap-2.5">
                {[...Array(4)].map((_, idx) => (
                  <div
                    key={idx}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.02] flex items-center justify-center relative group/trophy hover:border-white/35 transition-all shadow-inner"
                    title={`Espaço de Troféu ${idx + 1}`}
                  >
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white/10 group-hover/trophy:text-white/20 transition-colors" />
                  </div>
                ))}
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                Troféus
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── GRID: LINEUP + INFO ─────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* LINEUP */}
          <TeamRoster membros={time.membros} gradientFrom={time.gradientFrom} onPlayerClick={handlePlayerClick} />

          {/* COLUNA DIREITA */}
          <div className="md:row-span-2 flex flex-col gap-4">
            {/* Capitão */}
            {lider && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-white/10 bg-[#08080a] p-5 shadow-2xl"
              >
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Capitão</p>
                <div
                  className="rounded-xl border border-white/10 hover:border-white/20 bg-[#0c0c10] p-3 flex items-center gap-3 cursor-pointer transition-all"
                  onClick={() => handlePlayerClick(lider)}
                >
                  {lider.iconeId ? (
                    <div
                      className="w-10 h-10 rounded-lg overflow-hidden border shrink-0 bg-[#08080a] flex items-center justify-center"
                      style={{ borderColor: `${time.gradientFrom}80` }}
                    >
                      <img
                        src={buildProfileIconUrl(lider.iconeId)}
                        alt={lider.riotId}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={40}
                        height={40}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 shrink-0 border border-white/10"
                    >
                      <Crown className="w-5 h-5" style={{ color: time.gradientFrom }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white font-black text-xs truncate">{lider.riotId.split('#')[0]}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: time.gradientFrom }}>Capitão</p>
                  </div>
                  <Crown className="w-4 h-4 ml-auto shrink-0" style={{ color: time.gradientFrom }} />
                </div>
              </motion.div>
            )}

            {/* Gerenciar */}
            {(userRole === 'leader' || userRole === 'member') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="rounded-2xl border border-white/10 bg-[#08080a] p-5 space-y-2 shadow-2xl"
              >
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Gerenciar</p>
                {[
                  { icon: UserPlus,    label: 'Adicionar Jogador', action: () => { playSound('click'); setModalConvidar(true); } },
                  { icon: Paintbrush, label: 'Editar Time',       action: () => { playSound('click'); setModalEditar(true); }   },
                  { icon: Users,      label: 'Gerenciar Lineup',  action: handleSidebarLineup },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer group"
                  >
                    <Icon className="w-4 h-4 transition-transform group-hover:scale-110" style={{ color: time.gradientFrom }} />
                    <span>{label}</span>
                  </button>
                ))}
                {notCapSidebar && (
                  <p className="text-yellow-400/80 text-[10px] font-bold text-center py-1 uppercase tracking-wider">
                    Apenas o capitão pode gerenciar o lineup
                  </p>
                )}
                <div className="pt-2 mt-2 border-t border-white/5" />
                <button
                  onClick={() => { playSound('click'); setModalSair(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer group"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                  <span>Sair da Equipe</span>
                </button>
              </motion.div>
            )}

            {/* Histórico */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-white/10 bg-[#08080a] p-5 shadow-2xl flex-1 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-white/20" />
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Histórico</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                <p className="text-white/30 text-xs font-bold uppercase tracking-wider">Em breve</p>
                <span className="text-[9px] text-white/40 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 mt-2 font-bold uppercase tracking-widest">
                  Campeonatos
                </span>
              </div>
            </motion.div>

          </div>

          {/* STATUS DO TIME */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="md:col-span-2 rounded-2xl border border-white/10 bg-[#08080a] p-6 shadow-2xl"
          >
            <div className="border-b border-white/5 pb-4 mb-5 flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: time.gradientFrom }} />
              <h2 className="text-white font-black text-xs uppercase tracking-widest">Status do Time</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: 'PDL',      val: time.pdl.toLocaleString('pt-BR'), icon: ShieldCheck },
                { label: 'Win Rate', val: `${time.winrate}%`, icon: RefreshCw },
                { label: 'Vitórias', val: `${time.wins}/${time.gamesPlayed}`, icon: Check },
                { label: 'Torneio',  val: time.torneio ?? 'Nenhum', icon: Trophy },
                { label: 'Rating',   val: `#${time.ranking}`, icon: Crown },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-[#0c0c10] p-3 flex flex-col items-center sm:items-start"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <s.icon className="w-3 h-3 text-white/30" />
                    <p className="text-white/40 text-[9px] font-black uppercase tracking-wider">{s.label}</p>
                  </div>
                  <p className="font-black text-base sm:text-lg text-white leading-none">{s.val}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Modais */}
      {modalConvidar && <InvitePlayerModal membros={time.membros} gradientFrom={time.gradientFrom} onClose={() => setModalConvidar(false)} onAddPlayer={handleUpdatePlayers} />}
      {modalEditar && (
        <EditTeamModal team={time} onClose={() => setModalEditar(false)} onSave={handleUpdateTeam} />
      )}
      {modalLineup && (
        <ManageLineupModal
          membrosIniciais={time.membros}
          gradientFrom={time.gradientFrom}
          onClose={() => setModalLineup(false)}
          onUpdateTeam={handleUpdatePlayers}
          isProprietario={isProprietario}
          podeRemover={userRole === 'leader'}
          podePromover={userRole === 'leader'}
        />
      )}
      {modalSair && (
        <ConfirmLeaveModal onClose={() => setModalSair(false)} onConfirm={handleSairTime} />
      )}
    </>
  );
}
