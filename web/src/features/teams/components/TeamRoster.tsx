import React from 'react';
import { motion } from 'motion/react';
import { Users, ShieldCheck, ChevronRight, Plus } from 'lucide-react';
import { buildProfileIconUrl } from '../../../api/riot';
import { ROLE_CONFIG } from '../../../components/players/playerMeta';
import { Membro, ROLE_ORDER, eloDisplay } from '../roster';

const ELO_TO_ICON_NAME: Record<string, string> = {
  ferro: 'bronze',
  iron: 'bronze',
  bronze: 'bronze',
  prata: 'silver',
  silver: 'silver',
  ouro: 'gold',
  gold: 'gold',
  platina: 'platinum',
  platinum: 'platinum',
  esmeralda: 'emerald',
  emerald: 'emerald',
  diamante: 'diamond',
  diamond: 'diamond',
  mestre: 'master',
  master: 'master',
  'grão-mestre': 'grandmaster',
  'grao-mestre': 'grandmaster',
  grandmaster: 'grandmaster',
  desafiante: 'challenger',
  challenger: 'challenger',
};

function getEloRankIcon(elo?: string | null): string | null {
  if (!elo || elo === 'Sem Rank' || elo === 'UNRANKED') return null;
  const firstWord = elo.trim().toLowerCase().split(' ')[0];
  const fileKey = ELO_TO_ICON_NAME[firstWord];
  if (!fileKey) return null;
  return `/ranks/${fileKey}.png`;
}

interface TeamRosterProps {
  membros: Membro[];
  gradientFrom: string;
  onPlayerClick: (m: Membro) => void;
}

export default function TeamRoster({ membros, gradientFrom, onPlayerClick }: TeamRosterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="md:col-span-2 rounded-2xl border border-white/10 bg-[#08080a] shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: gradientFrom }} />
        <h2 className="text-white font-black text-xs uppercase tracking-widest">Lineup</h2>
        <span className="ml-auto text-white/40 text-[10px] uppercase font-bold tracking-wider">
          {membros.filter(m => m.role !== 'COACH').length} jogadores
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {ROLE_ORDER.map(role => {
          const membrosRole = membros.filter(m => m.role === role);
          const cfg = ROLE_CONFIG[role];

          // Só as 5 posições principais mostram "vaga aberta". Reserva e coach
          // só aparecem quando existem de fato — não inventam vaga vazia.
          const abreVaga = role !== 'RES' && role !== 'COACH' && membrosRole.length === 0;

          return (
            <React.Fragment key={role}>
              {membrosRole.map((m, idx) => (
                <div
                  key={m.userId || m.riotId}
                  onClick={() => onPlayerClick(m)}
                  className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 hover:bg-white/[0.035] transition-colors cursor-pointer group"
                >
                  {/* Role */}
                  <div className="flex items-center gap-2 w-[62px] md:w-[70px] shrink-0">
                    <img src={cfg.img} alt={cfg.label} className="w-4 h-4 object-contain" />
                    <span className={`text-[10px] font-black uppercase ${cfg.color}`}>
                      {role === 'RES' ? `R${idx + 1}` : cfg.label}
                    </span>
                  </div>

                  {/* Avatar */}
                  {m.iconeId ? (
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 bg-[#08080a] flex items-center justify-center shrink-0">
                      <img
                        src={buildProfileIconUrl(m.iconeId)}
                        alt={m.riotId}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={36}
                        height={36}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg border border-white/10 bg-[#08080a] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-white/30" />
                    </div>
                  )}

                  {/* Nome + cargo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold text-xs md:text-[13px] truncate">{m.riotId.split('#')[0]}</span>
                      {m.isLeader && (
                        <span
                          className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 border"
                          style={{ color: gradientFrom, borderColor: `${gradientFrom}60`, background: `${gradientFrom}18` }}
                        >
                          CAP
                        </span>
                      )}
                      {m.puuid && <ShieldCheck className="w-3 h-3 text-green-400 shrink-0" />}
                    </div>
                    <span className="text-white/30 text-[10px]">{m.riotId.split('#')[1] ? `#${m.riotId.split('#')[1]}` : ''}</span>
                  </div>

                  {/* Elo */}
                  {getEloRankIcon(m.elo) ? (
                    <div
                      className="flex items-center justify-center shrink-0 w-8 h-8 cursor-help"
                      title={eloDisplay(m.elo)}
                    >
                      <img
                        src={getEloRankIcon(m.elo)!}
                        alt={eloDisplay(m.elo)}
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] hover:scale-110 transition-transform"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <span className="text-white/25 text-[10px] font-black uppercase tracking-wider shrink-0">
                      {eloDisplay(m.elo)}
                    </span>
                  )}

                  <ChevronRight className="w-4 h-4 text-white/20 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}

              {abreVaga && (
                <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 opacity-40">
                  <div className="flex items-center gap-2 w-[62px] md:w-[70px] shrink-0">
                    <img src={cfg.img} alt={cfg.label} className="w-4 h-4 object-contain opacity-40" />
                    <span className={`text-[10px] font-black uppercase ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-lg border border-dashed border-white/15 flex items-center justify-center shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <span className="text-white/30 text-[11px] font-bold uppercase tracking-[0.12em]">Vaga aberta</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </motion.div>
  );
}
