import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { X, ShieldCheck, Medal, Calendar, Users, TrendingUp, Trophy, Gamepad2 } from 'lucide-react';
import { buildProfileIconUrl, buildChampionIconUrl } from '../../api/riot';

// ── Tipos ──────────────────────────────────────────
export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'RES' | 'COACH';
export type EloType = 'Ferro' | 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Esmeralda' | 'Diamante' | 'Mestre' | 'Grão-Mestre' | 'Desafiante';

export interface Jogador {
  id: string;
  riotId: string;
  nome: string;
  nivel: number;
  elo: EloType;
  eloPontos?: number;
  iconeId: number;
  pais?: string;
  partidas: number;
  winRate: number;
  titulos: number;
  rolePrincipal: Role;
  roleSecundaria: Role;
  isVIP: boolean;
  isVerified: boolean;
  kda: number;
  csPorMinuto: number;
  participacaoKill: number;
  conquistas: string[];
  timeTag?: string;
  timeColor?: string;
  timeLogo?: string;
  timeId?: string | number;
  mp?: number;
  mc?: number;
}

// ── Configurações ──────────────────────────────────
export const ROLE_CONFIG: Record<Role, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png', color: 'text-red-400', bg: 'bg-red-400/10' },
  JG: { label: 'JG', img: '/lanes_brancas/Jungle_iconB.png', color: 'text-green-400', bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  RES: { label: 'RES', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  COACH: { label: 'COACH', img: '/lanes_brancas/coach_iconB.svg', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export const ELO_STYLES: Record<EloType, { border: string; glow: string; text: string; bg: string }> = {
  Ferro: { border: '#6c757d', glow: '#6c757d40', text: 'text-gray-500', bg: 'bg-gray-500/10' },
  Bronze: { border: '#cd7f32', glow: '#cd7f3240', text: 'text-amber-600', bg: 'bg-amber-600/10' },
  Prata: { border: '#c0c0c0', glow: '#c0c0c040', text: 'text-gray-300', bg: 'bg-gray-300/10' },
  Ouro: { border: '#ffd700', glow: '#ffd70040', text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  Platina: { border: '#00e5ff', glow: '#00e5ff40', text: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  Esmeralda: { border: '#2ecc71', glow: '#2ecc7140', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  Diamante: { border: '#3498db', glow: '#3498db60', text: 'text-blue-400', bg: 'bg-blue-400/10' },
  Mestre: { border: '#9b59b6', glow: '#9b59b680', text: 'text-purple-400', bg: 'bg-purple-400/10' },
  'Grão-Mestre': { border: '#e74c3c', glow: '#e74c3c80', text: 'text-red-400', bg: 'bg-red-400/10' },
  Desafiante: { border: '#f1c40f', glow: '#f1c40fa0', text: 'text-yellow-300', bg: 'bg-yellow-300/10' },
};

export const ELOS_ORDER: EloType[] = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Esmeralda', 'Diamante', 'Mestre', 'Grão-Mestre', 'Desafiante'];
export const ROLES_ORDER: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
export const TIER_MAP: Record<string, EloType> = {
  IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro',
  PLATINUM: 'Platina', EMERALD: 'Esmeralda', DIAMOND: 'Diamante',
  MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre', CHALLENGER: 'Desafiante',
};

export const getIconeUrl = (iconeId: number) => buildProfileIconUrl(iconeId);

// ── ModalBase ───────────────────────────────────────
const ModalBase = ({ onClose, children, title, gradientFrom = '#FFB700' }: {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  gradientFrom?: string;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
      style={{
        background: '#0d0d0d',
        border: `2px solid transparent`,
        backgroundImage: `linear-gradient(#0d0d0d, #0d0d0d) padding-box, linear-gradient(135deg, ${gradientFrom}, ${gradientFrom}80) border-box`,
        boxShadow: `0 0 45px -10px ${gradientFrom}60`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {title && (
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-white font-black text-lg tracking-tight uppercase">{title}</h2>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="p-6">{children}</div>
    </motion.div>
  </motion.div>
);

// ── PlayerDetailModal ───────────────────────────────
export const PlayerDetailModal = ({ jogador, onClose }: { jogador: Jogador; onClose: () => void }) => {
  const navigate = useNavigate();
  const eloFinal = jogador.elo;
  const roleConfig = ROLE_CONFIG[jogador.rolePrincipal];
  const eloStyle = ELO_STYLES[eloFinal];
  const winRateColor = jogador.winRate >= 50 ? '#4ade80' : '#ef4444';

  return (
    <ModalBase onClose={onClose} title={jogador.nome} gradientFrom={eloStyle.border}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: eloStyle.border }} />
              <img
                src={getIconeUrl(jogador.iconeId)}
                className="w-20 h-20 rounded-full border-3 relative z-10 shadow-2xl"
                style={{ borderColor: eloStyle.border }}
                alt={jogador.nome}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-black text-white truncate">{jogador.nome}</h3>
                {jogador.isVerified && <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: eloStyle.border }} />}
              </div>
              <p className="text-white/40 text-sm mb-2 truncate">{jogador.riotId}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${eloStyle.bg} ${eloStyle.text}`}>
                  {eloFinal} {jogador.eloPontos ? `${jogador.eloPontos} LP` : ''}
                </span>
                <span className="text-white/40 text-xs">Nível {jogador.nivel}</span>
              </div>
            </div>
          </div>

          {(jogador.timeLogo || jogador.timeTag) && (
            <div
              className={`flex flex-col items-center gap-1.5 shrink-0 ${jogador.timeId ? 'cursor-pointer group' : ''}`}
              onClick={() => { if (jogador.timeId) { onClose(); navigate(`/times/${jogador.timeId}`); } }}
            >
              <div
                className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center transition-all"
                style={{
                  boxShadow: `0 0 20px ${jogador.timeColor ?? '#fff'}50`,
                  borderColor: `${jogador.timeColor ?? '#fff'}40`,
                }}
              >
                {jogador.timeLogo ? (
                  <img src={jogador.timeLogo} alt={jogador.timeTag ?? 'Time'} className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="font-black text-xl tracking-widest" style={{ color: jogador.timeColor ?? '#fff' }}>{jogador.timeTag}</span>
                )}
              </div>
              <span className="text-[11px] font-black tracking-widest group-hover:underline" style={{ color: jogador.timeColor ?? '#fff' }}>
                #{jogador.timeTag}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Gamepad2 className="w-4 h-4" />, label: 'Partidas', value: jogador.partidas.toLocaleString() },
            { icon: <TrendingUp className="w-4 h-4" />, label: 'Win Rate', value: `${jogador.winRate}%`, color: winRateColor },
            { icon: <Trophy className="w-4 h-4" />, label: 'Títulos', value: jogador.titulos },
            { icon: <Gamepad2 className="w-4 h-4" />, label: 'KDA', value: jogador.kda.toFixed(1) },
            { icon: <Gamepad2 className="w-4 h-4" />, label: 'CS/min', value: jogador.csPorMinuto.toFixed(1) },
            { icon: <Users className="w-4 h-4" />, label: 'KP%', value: `${jogador.participacaoKill}%` },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <div className="flex items-center justify-center gap-1 mb-1 text-white/40">
                {stat.icon}
                <span className="text-[10px] font-bold uppercase">{stat.label}</span>
              </div>
              <p className="text-white font-black text-lg" style={stat.color ? { color: stat.color } : {}}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Roles */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Posições</p>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full ${roleConfig.bg} border border-white/10`}>
              <img src={roleConfig.img} alt={roleConfig.label} className="w-5 h-5 object-contain" />
              <span className={`text-sm font-bold ${roleConfig.color}`}>Principal: {roleConfig.label}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/5">
              <img src={ROLE_CONFIG[jogador.roleSecundaria].img} alt={ROLE_CONFIG[jogador.roleSecundaria].label} className="w-4 h-4 object-contain opacity-60" />
              <span className="text-xs text-white/40">{ROLE_CONFIG[jogador.roleSecundaria].label}</span>
            </div>
          </div>
        </div>

        {/* Conquistas */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Conquistas</p>
          <div className="flex flex-wrap gap-2">
            {jogador.conquistas.map((conquista, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Medal className="w-3 h-3 text-primary" />
                <span className="text-xs text-white/80">{conquista}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-white/30" />
            <span className="text-[10px] text-white/30">Temporada 2024</span>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};