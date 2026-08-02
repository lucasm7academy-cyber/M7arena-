// src/pages/Vincular.tsx
// NOVA VERSÃO - Design premium integrado ao estilo da plataforma

import React, { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, Timer, Unlink, User, Gamepad2, ArrowLeft, Shield, Lock, Key, Sparkles, MessageCircle } from 'lucide-react';
import { buscarJogadorCompleto, buscarSugestoes, buildProfileIconUrl } from '../api/riot';
import { motion, AnimatePresence } from 'motion/react';
import { useVerificacao } from '../contexts/VerificacaoContext';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';
import { useNavigate } from 'react-router-dom';
import { useSound } from '../hooks/useSound';
import { FaDiscord } from 'react-icons/fa';

const ICONES_PADRAO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function Vincular() {
  const navigate = useNavigate();
  const { playSound } = useSound();
  const { user } = useAuth();
  const { desvincular, refetch } = usePerfil();
  const [searchTerm, setSearchTerm] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invocador, setInvocador] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [passo, setPasso] = useState<'busca' | 'validando' | 'verificando' | 'sucesso' | 'ja_vinculada'>('busca');
  const [iconeRequerido, setIconeRequerido] = useState<number | null>(null);
  const [popup, setPopup] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [contaVinculada, setContaVinculada] = useState<any>(null);
  const [jaVinculadaInfo, setJaVinculadaInfo] = useState<{ riotId: string; email: string } | null>(null);
  const [desvinculando, setDesvinculando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [discordVinculado, setDiscordVinculado] = useState<string | null>(null);
  const [loadingDiscord, setLoadingDiscord] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const { verificacaoAtiva, cancelarVerificacao } = useVerificacao();

  const getIconeUrl = buildProfileIconUrl;

  // Auto-refresh após vinculação bem-sucedida
  useEffect(() => {
    const handleVerificacaoConcluida = () => {
      refetch();
    };

    window.addEventListener('verificacao_concluida', handleVerificacaoConcluida);
    return () => window.removeEventListener('verificacao_concluida', handleVerificacaoConcluida);
  }, [refetch]);

  // Notificação ao voltar do Discord (?discord=linked)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord') === 'linked') {
      setPopup({ type: 'success', message: '✅ Conta vinculada com sucesso!' });
      playSound('success');
      // Limpa o query param da URL sem recarregar
      window.history.replaceState({}, '', '/vincular');
    }
  }, []);

  // Carregar conta vinculada ao iniciar
  useEffect(() => {
    const carregarContaVinculada = async () => {
      try {
        if (user) {
          const data = await api.profiles.getRiot();

          if (data) {
            setContaVinculada(data);
            setInvocador({
              riotId: data.riot_id,
              puuid: data.puuid,
              summonerId: data.summoner_id,
              nivel: data.level,
              iconeId: data.profile_icon_id,
              iconeUrl: getIconeUrl(data.profile_icon_id)
            });

            // Verifica se já tem discord vinculado
            const dl = await api.profiles.getDiscord();

            if (dl?.discord_tag) {
              // Riot + Discord vinculados → validação concluída
              setDiscordVinculado(dl.discord_tag || 'Discord vinculado');
              setPasso('sucesso');
            } else {
              // Riot vinculado, mas Discord ainda não → validação fica pendente
              setPasso('validando');
            }

            setCarregandoInicial(false);
            return;
          }
        }

        // Fluxo antigo de verificação por ícone foi aposentado — limpa qualquer
        // estado remanescente para não reabrir a tela "Sincronizando Dados".
        localStorage.removeItem('verificacao_ativa');
      } catch (err) {
        console.error('❌ Erro ao carregar conta vinculada:', err);
      } finally {
        setCarregandoInicial(false);
      }
    };

    carregarContaVinculada();
  }, [user]);

  // Função para desvincular conta
  const handleDesvincular = async () => {
    setDesvinculando(true);

    try {
      // A sessão vem do AuthContext (cookie httpOnly, ADR-011) — o cliente não
      // consulta mais o GoTrue para descobrir quem está logado.
      if (user) {
        // Remover do time automaticamente antes de desvincular
        try {
          await api.teams.removeMemberships();
        } catch {
          // remoção de membros é best-effort; não impede a desvinculação
        }

        await api.profiles.unlinkRiot();

        setPopup({
          type: 'success',
          message: '✅ Conta desvinculada com sucesso!'
        });

        // Atualizar contexto global de perfil
        desvincular();

        // Resetar estados
        setContaVinculada(null);
        setInvocador(null);
        setPasso('busca');
        setSearchTerm('');
        setIconeRequerido(null);
      }
    } catch (error) {
      setPopup({
        type: 'error',
        message: '❌ Erro ao desvincular conta. Tente novamente.'
      });
    } finally {
      setDesvinculando(false);
    }
  };

  useEffect(() => {
    if (popup) {
      const timer = setTimeout(() => setPopup(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [popup]);

  // Fluxo antigo de verificação por ícone foi aposentado — se houver uma
  // verificação remanescente no contexto global, cancela em vez de abrir a
  // tela "Sincronizando Dados".
  useEffect(() => {
    if (verificacaoAtiva && verificacaoAtiva.status === 'verificando') {
      cancelarVerificacao();
    }
  }, [verificacaoAtiva]);

  useEffect(() => {
    const handleConcluida = async () => {
      try {
        if (user) {
          const data = await api.profiles.getRiot();
          if (data) {
            setContaVinculada(data);
            setPasso('sucesso');
            return;
          }
        }
      } catch (err) {
        console.error('❌ Erro ao carregar conta após verificação:', err);
      }
      // Chegou aqui = não conseguiu carregar a conta do banco
      setPopup({
        type: 'error',
        message: '❌ Conta verificada, mas houve um erro ao carregar os dados. Recarregue a página.'
      });
      setPasso('busca');
    };

    const handleErroSalvar = () => {
      setPopup({
        type: 'error',
        message: '❌ Falha ao salvar a conta no banco de dados. Verifique o ícone e tente novamente.'
      });
      setPasso('busca');
      setInvocador(null);
      setIconeRequerido(null);
    };

    const handleTimeout = () => {
      setPopup({
        type: 'error',
        message: '⏰ Tempo esgotado! Verifique se você trocou para o ícone correto e tente novamente.'
      });
      setPasso('busca');
      setInvocador(null);
      setIconeRequerido(null);
    };

    window.addEventListener('verificacao_concluida', handleConcluida as EventListener);
    window.addEventListener('verificacao_erro_salvar', handleErroSalvar as EventListener);
    window.addEventListener('verificacao_timeout', handleTimeout as EventListener);

    return () => {
      window.removeEventListener('verificacao_concluida', handleConcluida as EventListener);
      window.removeEventListener('verificacao_erro_salvar', handleErroSalvar as EventListener);
      window.removeEventListener('verificacao_timeout', handleTimeout as EventListener);
    };
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        buscarSugestoes(searchTerm).then(setSugestoes);
        setShowSuggestions(true);
      } else {
        setSugestoes([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelecionarJogador = async (riotId: string) => {
    setSearchTerm(riotId);
    setShowSuggestions(false);
    setLoading(true);
    setErro('');

    const resultado = await buscarJogadorCompleto(riotId);
    
    if (!resultado.success) {
      setErro((resultado as any).error);
      setLoading(false);
      return;
    }

    // Verifica se conta já está vinculada a outro usuário (API checa por PUUID)
    if (user) {
      const vinculoExistente = await api.players.byPuuid(resultado.data.puuid);
      if (vinculoExistente) {
        setJaVinculadaInfo({ riotId: vinculoExistente.riot_id, email: 'outro usuário' });
        setPasso('ja_vinculada');
        setLoading(false);
        return;
      }

      // Salva a conta Riot diretamente (sem verificação de ícone) — o user_id
      // vem da sessão na API (POST /api/profiles/me/riot), nunca do cliente.
      const contaData = {
        riot_id:         resultado.data.riotId,
        puuid:           resultado.data.puuid,
        summoner_id:     resultado.data.summonerId,
        level:           resultado.data.nivel,
        profile_icon_id: resultado.data.iconeId,
        nickname:        resultado.data.riotId.split('#')[0],
      };

      try {
        await api.profiles.linkRiot(contaData);
      } catch {
        setErro('Erro ao salvar conta. Tente novamente.');
        setLoading(false);
        return;
      }

      setContaVinculada(contaData);
      await refetch();
    }

    setInvocador({
      riotId: resultado.data.riotId,
      puuid: resultado.data.puuid,
      nivel: resultado.data.nivel,
      iconeId: resultado.data.iconeId,
      iconeUrl: resultado.data.iconeUrl,
    });
    setPasso('sucesso');
    setLoading(false);
  };

  const handleReiniciar = () => {
    cancelarVerificacao();
    setSearchTerm('');
    setInvocador(null);
    setJaVinculadaInfo(null);
    setPasso('busca');
    setErro('');
    setIconeRequerido(null);
  };

  const handleVincularDiscord = async () => {
    if (!user) return;
    setLoadingDiscord(true);
    // A API gera e guarda o state (CSRF token); o cliente só recebe e redireciona.
    const { state } = await api.discord.createState();
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const redirect = encodeURIComponent(`${window.location.origin}/auth/discord/callback`);
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=identify&state=${state}`;
  };

  return (
    <div className="min-h-screen text-white font-sans p-6 md:p-10 relative">
      
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />

      <div className="max-w-3xl mx-auto relative z-10">
        
        <AnimatePresence>
          {popup && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-md"
              style={{
                background: popup.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : popup.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                borderColor: popup.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : popup.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                color: popup.type === 'error' ? '#fca5a5' : popup.type === 'success' ? '#86efac' : '#93c5fd'
              }}
            >
              {popup.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {popup.type === 'success' && <CheckCircle className="w-5 h-5" />}
              <span className="font-bold text-sm">{popup.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================ */}
        {/* HEADER PREMIUM */}
        {/* ============================================ */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFB700]/20 to-transparent border border-[#FFB700]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,183,0,0.1)]">
              <ShieldCheck className="w-7 h-7 text-[#FFB700]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
                Vincular <span className="text-[#FFB700]">Conta Riot</span>
              </h1>
              <div className="h-1 w-20 bg-gradient-to-r from-[#FFB700] to-transparent mt-2 rounded-full" />
            </div>
          </div>
          <p className="text-white/40 text-sm font-medium max-w-lg ml-[72px]">
            Conecte sua identidade do League of Legends para desbloquear partidas ranqueadas e recompensas exclusivas.
          </p>
        </div>

        {/* Skeleton enquanto carrega estado inicial */}
        {carregandoInicial ? (
          <div className="rounded-2xl border border-white/10 p-8 animate-pulse" style={{ background: 'rgba(13,13,13,0.8)' }}>
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-7 w-48 bg-white/10 rounded" />
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-64 bg-white/10 rounded" />
              </div>
            </div>
            <div className="h-12 w-full bg-white/10 rounded-xl" />
          </div>
        ) : null}

        {/* ============================================ */}
        {/* ESTADO: CONTA JÁ VINCULADA (SUCESSO) */}
        {/* ============================================ */}
        {!carregandoInicial && passo === 'sucesso' && contaVinculada && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Card da conta vinculada */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#FFB700]/30"
              style={{
                background: 'rgba(13, 13, 13, 0.9)',
                boxShadow: '0 0 45px -10px rgba(255, 183, 0, 0.3)',
                backdropFilter: 'blur(16px)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFB700]/10 via-transparent to-transparent" />
              
              <div className="relative p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="w-5 h-5 text-[#FFB700]" />
                  <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Conta Vinculada</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-[#FFB700]/30 to-transparent" />
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#FFB700]/20 blur-2xl rounded-full" />
                    <div className="relative">
                      <img 
                        src={invocador?.iconeUrl || getIconeUrl(contaVinculada.profile_icon_id)} 
                        className="w-28 h-28 rounded-full border-3 border-[#FFB700] shadow-2xl" 
                        alt="Ícone" 
                      />
                      <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1.5 border-4 border-[#0D0D0D]">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center md:text-left">
                    <p className="text-3xl font-black text-white tracking-tight">{contaVinculada.riot_id}</p>
                    <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
                      <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white/60">
                        Nível {contaVinculada.level}
                      </span>
                      <span className="text-[10px] text-[#FFB700] font-black uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Verificado
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-3 uppercase tracking-widest">
                      Desde {new Date(contaVinculada.verified_at || contaVinculada.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Elo se existir */}
                {contaVinculada.elo && (
                  <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 mb-8 flex items-center justify-between">
                    <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Classificação Atual</span>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#FFB700] animate-pulse" />
                      <span className="text-[#FFB700] font-black text-xl italic uppercase tracking-tighter">{contaVinculada.elo}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      playSound('click');
                      navigate('/perfil');
                    }}
                    className="py-4 rounded-xl bg-white/5 border border-white/10 text-white font-black text-sm uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Editar Perfil
                  </button>

                  <button
                    onClick={handleDesvincular}
                    onMouseDown={() => playSound('click')}
                    disabled={desvinculando}
                    className="py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-sm uppercase hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {desvinculando ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Aguarde...</>
                    ) : (
                      <><Unlink className="w-4 h-4" /> Desvincular</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Card Discord ── */}
            <div
              className="relative rounded-2xl overflow-hidden border-2"
              style={{
                background: 'rgba(13,13,13,0.9)',
                borderColor: discordVinculado ? 'rgba(88,101,242,0.4)' : 'rgba(255,255,255,0.08)',
                boxShadow: discordVinculado ? '0 0 30px -10px rgba(88,101,242,0.4)' : 'none',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#5865F2]/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative p-8">
                <div className="flex items-center gap-3 mb-6">
                  <FaDiscord className="w-5 h-5 text-[#5865F2]" />
                  <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Vincular Discord</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-[#5865F2]/30 to-transparent" />
                  {discordVinculado && (
                    <span className="text-[10px] text-[#5865F2] font-black uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Vinculado
                    </span>
                  )}
                </div>

                {discordVinculado ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center">
                      <FaDiscord className="w-6 h-6 text-[#5865F2]" />
                    </div>
                    <div>
                      <p className="text-white font-black">{discordVinculado}</p>
                      <p className="text-white/30 text-xs">Conta Discord vinculada</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm mb-1">Conecte seu Discord</p>
                      <p className="text-white/40 text-xs">Vincule sua conta Discord para gerenciar times pelo bot e receber notificações.</p>
                    </div>
                    <button
                      onClick={handleVincularDiscord}
                      disabled={loadingDiscord}
                      className="shrink-0 px-8 py-4 rounded-xl font-black text-sm uppercase text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                      style={{ background: '#5865F2', boxShadow: '0 8px 20px -5px rgba(88,101,242,0.4)' }}
                    >
                      {loadingDiscord ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FaDiscord className="w-4 h-4" />}
                      Vincular Discord
                    </button>
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}

        {/* ============================================ */}
        {/* ESTADO: BUSCA DE NOVA CONTA */}
        {/* ============================================ */}
        {!carregandoInicial && passo === 'busca' && !contaVinculada && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-white/10"
            style={{
              background: 'rgba(13, 13, 13, 0.8)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div className="p-8">
              <div ref={searchRef} className="relative z-50">
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="text-white/30 w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Digite seu Riot ID (ex: Kami#BR1)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => sugestoes.length > 0 && setShowSuggestions(true)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFB700]/50 focus:ring-4 focus:ring-[#FFB700]/10 transition-all font-bold"
                  />
                </div>

                <AnimatePresence>
                  {showSuggestions && sugestoes.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-3 bg-[#0D0D0D]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100]"
                    >
                      <div className="p-2">
                        {sugestoes.map((sug, index) => (
                          <motion.button
                            key={sug.riotId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleSelecionarJogador(sug.riotId)}
                            className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg text-left transition-all group"
                          >
                            <div className="relative">
                              <img 
                                src={getIconeUrl(sug.iconId)} 
                                className="w-12 h-12 rounded-full border border-white/10 group-hover:border-[#FFB700]/50 transition-colors" 
                                alt="Icon" 
                              />
                              <div className="absolute -bottom-1 -right-1 bg-[#FFB700] text-[10px] font-bold text-black px-1.5 rounded-full border-2 border-[#0D0D0D]">
                                {sug.level}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-bold group-hover:text-[#FFB700] transition-colors">{sug.riotId}</p>
                              <p className="text-xs text-white/40">Invocador de League of Legends</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <CheckCircle className="w-5 h-5 text-[#FFB700]" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-8 space-y-4">
                <button
                  onClick={() => handleSelecionarJogador(searchTerm)}
                  disabled={loading || !searchTerm}
                  className="w-full py-4 rounded-xl font-black text-lg uppercase text-black transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, #FFB700, #FFB700dd)',
                    boxShadow: '0 10px 30px -5px rgba(255, 183, 0, 0.3)'
                  }}
                >
                  {loading ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Buscando...</>
                  ) : (
                    <><Gamepad2 className="w-5 h-5" /> Vincular Agora</>
                  )}
                </button>
                
                <p className="text-center text-white/30 text-xs px-4">
                  Ao vincular sua conta, você concorda com nossos termos de uso e privacidade. 
                  Sua conta será verificada através do ícone de perfil.
                </p>
              </div>

              {erro && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl flex items-center gap-3"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-400 text-sm font-medium">{erro}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}


        {/* ============================================ */}
        {/* ESTADO: VALIDANDO → Quase lá! Vincule o Discord */}
        {/* ============================================ */}
        {!carregandoInicial && passo === 'validando' && invocador && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Card do Invocador selecionado */}
            <div className="bg-black/60 backdrop-blur-xl rounded-3xl border border-white/5 p-6 shadow-2xl">
              <h3 className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Invocador Selecionado</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={invocador.iconeUrl} className="w-16 h-16 rounded-full border-2 border-[#FFB700]/50 shadow-xl" alt="Ícone" />
                  <div className="absolute -bottom-1 -right-1 bg-[#FFB700] text-[10px] font-bold text-black px-1.5 py-0.5 rounded-full border-2 border-[#0a0a0a]">
                    {invocador.nivel}
                  </div>
                </div>
                <div>
                  <p className="text-xl font-black text-white tracking-tight">{invocador.riotId}</p>
                  <p className="text-[10px] text-[#FFB700] font-bold uppercase tracking-widest mt-0.5">✅ Conta Riot vinculada</p>
                </div>
              </div>
            </div>

            {/* Card — Termine seu cadastro vinculando o Discord */}
            <div
              className="relative rounded-2xl overflow-hidden border-2 border-[#5865F2]/40 p-8"
              style={{
                background: 'rgba(13,13,13,0.95)',
                boxShadow: '0 0 40px -10px rgba(88,101,242,0.4)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#5865F2]/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center mx-auto mb-5">
                  <FaDiscord className="w-8 h-8 text-[#5865F2]" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">
                  Termine seu cadastro
                </h2>
                <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
                  Para concluir sua validação, vincule sua conta Discord. Isso permite gerenciar seu time pelo bot e receber notificações.
                </p>
                <button
                  onClick={handleVincularDiscord}
                  disabled={loadingDiscord}
                  className="w-full py-4 rounded-xl font-black text-lg uppercase text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 mb-4"
                  style={{ background: '#5865F2', boxShadow: '0 10px 25px -5px rgba(88,101,242,0.5)' }}
                >
                  {loadingDiscord
                    ? <><RefreshCw className="w-5 h-5 animate-spin" /> Redirecionando...</>
                    : <><FaDiscord className="w-5 h-5" /> Validar agora usando o Discord</>}
                </button>
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">
                  A validação só é concluída com Riot + Discord vinculados
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* ESTADO: VERIFICANDO (AGUARDANDO SINCRONIZAÇÃO) */}
        {/* ============================================ */}
        {!carregandoInicial && passo === 'verificando' && !contaVinculada && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border-2 border-[#FFB700]/30 p-12 text-center"
            style={{
              background: 'rgba(13, 13, 13, 0.9)',
              boxShadow: '0 0 60px -10px rgba(255, 183, 0, 0.3)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFB700]/10 via-transparent to-transparent" />
            
            <div className="relative">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 bg-[#FFB700]/20 blur-3xl rounded-full animate-pulse" />
                <div className="w-24 h-24 rounded-2xl bg-[#FFB700]/10 border-2 border-[#FFB700]/30 flex items-center justify-center relative animate-[spin_3s_linear_infinite]">
                  <Timer className="w-12 h-12 text-[#FFB700]" />
                </div>
              </div>
              
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight uppercase italic">Sincronizando Dados</h2>
              <p className="text-white/40 mb-8 max-w-sm mx-auto">
                Estamos verificando sua conta <strong className="text-[#FFB700]">{invocador?.riotId}</strong> nos servidores da Riot Games.
              </p>
              
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-8 max-w-md mx-auto">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#FFB700] to-transparent"
                />
              </div>

              <button 
                onClick={handleReiniciar} 
                className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/60 text-xs font-black tracking-widest transition-all uppercase"
              >
                Cancelar Processo
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* ESTADO: CONTA JÁ VINCULADA (ERRO) */}
        {/* ============================================ */}
        {!carregandoInicial && passo === 'ja_vinculada' && jaVinculadaInfo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden border-2 border-red-500/30 p-10 text-center"
            style={{
              background: 'rgba(13, 13, 13, 0.9)',
              boxShadow: '0 0 45px -10px rgba(239, 68, 68, 0.2)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent" />
            
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-8">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>

              <h2 className="text-3xl font-black text-white mb-4 tracking-tight uppercase italic leading-none">
                CONTA JÁ <span className="text-red-400">VINCULADA</span>
              </h2>
              
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-8 max-w-md mx-auto">
                <p className="text-white/60 text-sm">
                  A conta <strong className="text-white">{jaVinculadaInfo.riotId}</strong> já está vinculada a outro usuário em nosso sistema.
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleReiniciar}
                  className="px-12 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-sm uppercase hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Outra Conta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}