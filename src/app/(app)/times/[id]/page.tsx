'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Crown, Trophy, Wallet, Users, Send,
  ChevronRight, ShieldCheck, LogOut, Paintbrush, Settings,
  UserPlus, UserX, Check, Plus, RefreshCw, X, Search, Upload,
  Copy, Phone, MessageCircle, MessageSquare, Flame, TrendingUp
} from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';
import { ROLE_CONFIG, ROLE_ORDER, TIER_MAP, type Role } from '@/features/times/domain/roles';

interface Membro {
  userId: string;
  riotId: string;
  role: Role;
  cargo: string;
  isLeader: boolean;
  elo: string;
  balance: number;
  iconeId?: number;
  nivel?: number;
  puuid?: string;
}

interface TimeData {
  id: string;
  nome: string;
  tag: string;
  logoUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  pdl: number;
  winrate: number;
  ranking: number;
  wins: number;
  gamesPlayed: number;
  donoId: string;
  torneio?: string;
  whatsapp?: string;
  discord?: string;
  membros: Membro[];
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ELO_COLORS: Record<string, string> = {
  Ferro: 'text-gray-500', Bronze: 'text-amber-600', Prata: 'text-gray-300',
  Ouro: 'text-yellow-400', Platina: 'text-cyan-400', Esmeralda: 'text-emerald-400',
  Diamante: 'text-blue-400', Mestre: 'text-amber-500',
  'Grão-Mestre': 'text-red-400', Desafiante: 'text-yellow-300',
};

const getEloColor = (elo: string) => ELO_COLORS[elo.split(' ')[0]] ?? 'text-white/60';

function buildProfileIconUrl(iconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${iconId}.png`;
}

export default function TimeDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = (params?.id as string) || '';
  const { perfil, refetchPerfil } = usePerfil();

  const [team, setTeam] = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'stats' | 'settings'>('roster');
  const [popup, setPopup] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/times/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
      } else {
        // Mock fallback para desenvolvimento local
        setTeam({
          id: teamId,
          nome: `Time #${teamId}`,
          tag: 'M7T',
          gradientFrom: '#FFB700',
          gradientTo: '#FF6600',
          pdl: 1450,
          winrate: 68,
          ranking: 3,
          wins: 34,
          gamesPlayed: 50,
          donoId: perfil?.id || 'dono-1',
          membros: [
            { userId: perfil?.id || 'dono-1', riotId: 'Kami#BR1', role: 'TOP', cargo: 'capitao', isLeader: true, elo: 'Desafiante', balance: 1500, iconeId: 29 },
            { userId: 'user-2', riotId: 'Brtt#BR1', role: 'ADC', cargo: 'jogador', isLeader: false, elo: 'Grão-Mestre', balance: 500, iconeId: 54 },
          ],
        });
      }
    } catch {
      setTeam({
        id: teamId,
        nome: `Time #${teamId}`,
        tag: 'M7T',
        gradientFrom: '#FFB700',
        gradientTo: '#FF6600',
        pdl: 1450,
        winrate: 68,
        ranking: 3,
        wins: 34,
        gamesPlayed: 50,
        donoId: perfil?.id || 'dono-1',
        membros: [
          { userId: perfil?.id || 'dono-1', riotId: 'Kami#BR1', role: 'TOP', cargo: 'capitao', isLeader: true, elo: 'Desafiante', balance: 1500, iconeId: 29 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) fetchTeam();
  }, [teamId]);

  if (loading) {
    return (
      <div className="min-h-screen text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 font-headline">Carregando detalhes do time...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase text-white font-headline">Time não encontrado</h2>
          <button onClick={() => router.push('/times')} className="mt-4 px-6 py-2.5 bg-primary text-black font-black uppercase rounded-xl font-headline">
            Voltar para Times
          </button>
        </div>
      </div>
    );
  }

  const isOwner = perfil && team.donoId === perfil.id;

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Voltar */}
        <button
          onClick={() => router.push('/times')}
          className="flex items-center gap-2 text-white/50 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer font-headline"
        >
          <ArrowLeft size={16} /> Voltar para Times
        </button>

        {/* HERO BANNER */}
        <div
          className="rounded-3xl border-2 p-8 relative overflow-hidden shadow-2xl"
          style={{
            borderColor: `${team.gradientFrom}50`,
            background: 'rgba(13,13,13,0.9)',
            boxShadow: `0 0 50px -10px ${team.gradientFrom}30`,
          }}
        >
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div
              className="w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0 shadow-2xl"
              style={{ border: `3px solid ${team.gradientFrom}`, background: 'black' }}
            >
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.nome} className="w-full h-full object-cover" />
              ) : (
                <span className="font-black text-3xl md:text-5xl tracking-widest font-headline" style={{ color: team.gradientFrom }}>
                  {team.tag}
                </span>
              )}
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter font-headline">
                  {team.nome}
                </h1>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest font-headline"
                  style={{ color: team.gradientFrom, background: `${team.gradientFrom}20`, border: `1px solid ${team.gradientFrom}50` }}
                >
                  #{team.tag}
                </span>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4" style={{ color: team.gradientFrom }} />
                  <span className="text-sm font-black font-headline">{team.pdl.toLocaleString('pt-BR')} PDL</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-black text-green-400 font-headline">{team.winrate}% Winrate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-black text-yellow-400 font-headline">RANK #{team.ranking}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROSTER / ELENCO */}
        <div className="rounded-3xl border border-white/10 p-8 bg-black/40 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-2xl font-black uppercase text-white tracking-wider font-headline flex items-center gap-3">
              <Users className="text-primary" /> Elenco da Equipe ({team.membros.length}/8)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.membros.map((membro) => {
              const roleCfg = ROLE_CONFIG[membro.role] || ROLE_CONFIG.RES;
              return (
                <div
                  key={membro.userId}
                  className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center gap-4 hover:border-white/20 transition-all"
                >
                  <img
                    src={buildProfileIconUrl(membro.iconeId || 29)}
                    alt={membro.riotId}
                    className="w-14 h-14 rounded-full border-2 border-primary/50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {membro.isLeader && <Crown className="w-4 h-4 text-yellow-400 shrink-0" />}
                      <p className="text-white font-black truncate font-headline">{membro.riotId}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${roleCfg.bg} ${roleCfg.color} font-headline`}>
                        {roleCfg.label}
                      </span>
                      <span className="text-xs text-white/40">{membro.elo}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
