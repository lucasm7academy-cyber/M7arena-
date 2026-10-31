// src/pages/MinhasPartidas.tsx
// NOVA VERSÃO - Com bloqueio para não-VIP e marketing premium

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePerfilSafe } from '../contexts/PerfilContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { 
  Trophy, Crown, Swords, Users, Calendar, Clock, 
  ChevronRight, TrendingUp, TrendingDown, History,
  Target, Shield
} from 'lucide-react';
import { getModoInfo, type ModoJogo } from '../api/salamod1';

interface Partida {
  id: number;
  modo: string;
  vencedor: string | null;
  vencedor_nome?: string;
  created_at: string;
  jogadores: Array<{ id: string; nome: string; isTimeA: boolean }>;
  timeANome?: string;
  timeBNome?: string;
}

export default function MinhasPartidas() {
  const { user } = useAuth();
  const { perfil: perfilCtx } = usePerfilSafe();
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ vitorias: 0, derrotas: 0, winRate: 0 });
  const [isVip, setIsVip] = useState(false);

  // VIP vem do PerfilContext (cargo/perfil já carregado pela API própria).
  useEffect(() => {
    setIsVip(perfilCtx?.isVip || false);
  }, [perfilCtx?.isVip]);

  const carregarDados = React.useCallback(async () => {
    if (!user) return;
    try {
      // Histórico vem da API própria (matches encerradas das quais o usuário
      // participou), sem baixar a tabela legada de resultados.
      const salas = await api.matches.minhas({ limit: 200 });

      const minhasPartidas: Partida[] = salas.map((sala) => {
        const jogador = sala.jogadores.find((j) => j.user_id === user.id);
        const meuLado = jogador?.is_time_a ?? false;
        const nomeAdversario = sala.time_a_nome || sala.time_b_nome
          ? (meuLado ? sala.time_b_nome : sala.time_a_nome) ?? undefined
          : sala.jogadores.find((j) => j.is_time_a !== meuLado)?.nome ?? undefined;

        return {
          id: sala.id,
          modo: sala.modo,
          vencedor: sala.vencedor ?? null,
          vencedor_nome: nomeAdversario,
          created_at: sala.created_at,
          jogadores: sala.jogadores.map((j) => ({
            id: j.user_id,
            nome: j.nome,
            isTimeA: j.is_time_a,
          })),
          timeANome: sala.time_a_nome ?? undefined,
          timeBNome: sala.time_b_nome ?? undefined,
        };
      });

      setPartidas(minhasPartidas);

      // Calcular estatísticas
      let vitorias = 0;
      minhasPartidas.forEach(partida => {
        const jogador = partida.jogadores.find((j) => j.id === user.id);
        if (jogador && partida.vencedor) {
          const venceuTimeA = partida.vencedor === 'A';
          if (jogador.isTimeA === venceuTimeA) vitorias++;
        }
      });

      setStats({
        vitorias,
        derrotas: minhasPartidas.length - vitorias,
        winRate: minhasPartidas.length > 0 ? Math.round((vitorias / minhasPartidas.length) * 100) : 0
      });
    } catch (err) {
      console.error('[MinhasPartidas] erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);


  const isVitoria = (partida: Partida, userId: string): boolean => {
    const jogador = partida.jogadores.find((j) => j.id === userId);
    if (!jogador || !partida.vencedor) return false;

    const venceuTimeA = partida.vencedor === 'A';
    return jogador.isTimeA === venceuTimeA;
  };

  const getModoLabel = (modo: string): string => {
    const labels: Record<string, string> = {
      '1v1': '1v1',
      '5v5': '5v5',
      'time_vs_time': 'Time vs Time',
      'aram': 'ARAM',
    };
    return labels[modo] || modo;
  };

  // Partidas exibidas: histórico completo (o antigo bloqueio VIP foi removido
  // junto com o modal de compra do VIP).

  return (
    <div className="min-h-screen bg-transparent text-white font-sans p-6 md:p-10 relative">
      
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* ============================================ */}
        {/* HEADER PREMIUM */}
        {/* ============================================ */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFB700]/20 to-transparent border border-[#FFB700]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,183,0,0.1)]">
              <History className="w-7 h-7 text-[#FFB700]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
                Minhas <span className="text-[#FFB700]">Partidas</span>
              </h1>
              <div className="h-1 w-20 bg-gradient-to-r from-[#FFB700] to-transparent mt-2 rounded-full" />
            </div>
            {isVip && (
              <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-black text-xs uppercase tracking-wider">VIP Ativo</span>
              </div>
            )}
          </div>
          <p className="text-white/40 text-sm font-medium max-w-lg ml-[72px]">
            Histórico completo das suas partidas finalizadas na plataforma.
          </p>
        </div>

        {/* ============================================ */}
        {/* CARDS DE ESTATÍSTICAS */}
        {/* ============================================ */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl p-6 border border-white/10 animate-pulse" style={{ background: 'rgba(13,13,13,0.8)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-10 w-20 bg-white/10 rounded mb-2" />
                <div className="h-3 w-24 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : partidas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8"
          >
            {/* Total de Partidas */}
            <div className="rounded-xl p-6 border border-white/10"
              style={{
                background: 'rgba(13, 13, 13, 0.8)',
                backdropFilter: 'blur(16px)'
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Total</span>
              </div>
              <p className="text-4xl font-black text-white">{partidas.length}</p>
              <p className="text-white/30 text-xs uppercase tracking-wider mt-1">Partidas jogadas</p>
            </div>

            {/* Vitórias */}
            <div className="rounded-xl p-6 border border-green-500/30"
              style={{
                background: 'rgba(13, 13, 13, 0.8)',
                backdropFilter: 'blur(16px)'
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Vitórias</span>
              </div>
              <p className="text-4xl font-black text-green-400">{stats.vitorias}</p>
              <p className="text-white/30 text-xs uppercase tracking-wider mt-1">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                {stats.winRate}% Win Rate
              </p>
            </div>

            {/* Derrotas */}
            <div className="rounded-xl p-6 border border-red-500/30"
              style={{
                background: 'rgba(13, 13, 13, 0.8)',
                backdropFilter: 'blur(16px)'
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Derrotas</span>
              </div>
              <p className="text-4xl font-black text-red-400">{stats.derrotas}</p>
              <p className="text-white/30 text-xs uppercase tracking-wider mt-1">
                <TrendingDown className="w-3 h-3 inline mr-1" />
                Continuar treinando
              </p>
            </div>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* LISTA DE PARTIDAS */}
        {/* ============================================ */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-5 animate-pulse flex gap-4 items-center" style={{ background: 'rgba(13,13,13,0.8)' }}>
                <div className="w-1 self-stretch rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-24 bg-white/10 rounded" />
                    <div className="h-4 w-16 bg-white/10 rounded" />
                  </div>
                  <div className="h-3 w-48 bg-white/10 rounded" />
                </div>
                <div className="h-8 w-16 bg-white/10 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        ) : partidas.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden border border-white/10 p-16 text-center"
            style={{
              background: 'rgba(13, 13, 13, 0.8)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <History className="w-10 h-10 text-white/20" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase mb-3">
              Sua jornada começa aqui
            </h3>
            <p className="text-white/40 text-sm max-w-md mx-auto mb-6">
              Você ainda não disputou nenhuma partida. Entre na arena e comece a construir seu histórico de vitórias.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/jogar')}
                className="px-6 py-3 rounded-xl bg-[#FFB700] text-black font-black text-sm uppercase hover:bg-[#e0a000] transition-all inline-flex items-center gap-2"
              >
                <Swords className="w-4 h-4" />
                Encontrar Partida
              </button>
              <button
                onClick={() => navigate('/lobby')}
                className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm uppercase hover:bg-white/20 transition-all inline-flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Ver Campeonatos
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="relative">
            <div className="space-y-3">
              {partidas.map((partida, index) => {
                const vitoria = isVitoria(partida, user!.id);
                const jogador = partida.jogadores.find((j) => j.id === user!.id);
                const modoInfo = getModoInfo(partida.modo as ModoJogo);
                const nomeAdversario = partida.vencedor_nome || 'Desconhecido';
                const timeJogador = jogador?.isTimeA ? 'A' : 'B';
                const nomeTimeJogador = timeJogador === 'A' ? partida.timeANome : partida.timeBNome;

                return (
                  <motion.div
                    key={partida.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/sala/${partida.id}`)}
                    className="relative rounded-xl overflow-hidden group border transition-all cursor-pointer"
                    style={{
                      background: vitoria 
                        ? 'rgba(34, 197, 94, 0.05)' 
                        : 'rgba(13, 13, 13, 0.8)',
                      borderColor: vitoria 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(16px)'
                    }}
                  >
                    {/* Barra lateral colorida */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ 
                        background: vitoria 
                          ? 'linear-gradient(to bottom, #22c55e, #16a34a)' 
                          : 'linear-gradient(to bottom, #ef4444, #dc2626)'
                      }}
                    />

                    <div className="p-5 pl-7">
                      <div className="flex items-center justify-between gap-4">
                        {/* Esquerda - Informações da partida */}
                        <div className="flex-1">
                          {/* Header com badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            {/* Badge Vitória/Derrota */}
                            <span 
                              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase"
                              style={{
                                background: vitoria 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : 'rgba(239, 68, 68, 0.2)',
                                border: `1px solid ${vitoria ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                color: vitoria ? '#4ade80' : '#f87171'
                              }}
                            >
                              {vitoria ? '🏆 VITÓRIA' : '✗ DERROTA'}
                            </span>

                            {/* Badge Modo */}
                            <span 
                              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                              style={{
                                background: `${modoInfo.cor}20`,
                                border: `1px solid ${modoInfo.cor}40`,
                                color: modoInfo.cor
                              }}
                            >
                              {modoInfo.icone} {getModoLabel(partida.modo)}
                            </span>

                            {/* Data/Hora */}
                            <span className="text-white/30 text-[10px] font-bold uppercase flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(partida.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </span>
                            <span className="text-white/30 text-[10px] font-bold uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(partida.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {/* Jogador e Adversário */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFB700]/20 to-transparent border border-[#FFB700]/30 flex items-center justify-center">
                                <Users className="w-4 h-4 text-[#FFB700]" />
                              </div>
                              <div>
                                <p className="text-white font-black text-sm uppercase">
                                  {jogador?.nome || 'Você'}
                                </p>
                                {nomeTimeJogador && (
                                  <p className="text-white/40 text-[10px] font-bold uppercase">
                                    Time {nomeTimeJogador}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className="text-white/20 font-black text-lg">VS</span>

                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                <Swords className="w-4 h-4 text-white/40" />
                              </div>
                              <div>
                                <p className="text-white/60 font-bold text-sm uppercase">
                                  {nomeAdversario}
                                </p>
                                <p className="text-white/30 text-[10px] font-bold uppercase">
                                  Adversário
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Direita - Resultado e Ação */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className={`text-2xl font-black uppercase tracking-tighter ${
                              vitoria ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {vitoria ? 'WIN' : 'LOSS'}
                            </p>
                            <p className="text-white/30 text-[10px] font-mono font-bold uppercase">
                              Sala #{partida.id}
                            </p>
                          </div>
                          
                          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#FFB700]/20 group-hover:border-[#FFB700]/50 transition-all">
                            <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#FFB700] transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* LEGENDA */}
        {/* ============================================ */}
        {partidas.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500/50 border border-green-400" />
              <span className="text-white/30 text-[10px] font-bold uppercase">Vitória</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50 border border-red-400" />
              <span className="text-white/30 text-[10px] font-bold uppercase">Derrota</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}