import { motion } from 'motion/react';
import { ArrowRight, Lock, Users } from 'lucide-react';
import { formatChips } from '../domain/engine';
import type { PokerRoom } from '../domain/lobby-data';
import type { ApiPokerRoom } from '../../../../lib/api';

export type LobbyRoom = PokerRoom & { isPrivate?: boolean; ownerName?: string };

export function toLobbyRoom(room: ApiPokerRoom): LobbyRoom {
  const { id, name, sb, bb, buyIn, seats, seated, isPrivate, ownerName } = room;
  return {
    id, name, sb, bb, buyIn, seats, seated, isPrivate, ownerName,
    subtitle: room.buyIn === 0 ? 'Mesa de treino' : 'Valendo essência',
    stakes: `${room.sb} / ${room.bb}`, players: [],
    tint: room.isPrivate ? '#a855f7' : room.buyIn === 0 ? '#38bdf8' : '#3fbf9a',
  };
}

const CUT_FRAME = 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)';
const CUT_BADGE = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';

export function RoomCard({ room, indice = 0, onEnter }: {
  room: LobbyRoom; indice?: number; onEnter: () => void;
}) {
  const color = room.isPrivate ? '#a855f7' : room.buyIn === 0 ? '#38bdf8' : '#3fbf9a';
  return (
    <motion.button type="button" onClick={onEnter}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .2, delay: Math.min(indice * .07, .35) }}
      whileHover={{ borderColor: `${color}99`, y: -2 }}
      aria-label={`Entrar em ${room.name}, blinds ${room.sb}/${room.bb}, ${room.seated} de ${room.seats} lugares, ${room.isPrivate ? 'privada' : 'pública'}`}
      className="group relative w-full overflow-hidden border border-white/10 bg-[rgba(13,13,13,0.8)] p-5 text-left backdrop-blur transition-shadow duration-200 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-[#FFB700]"
      style={{ clipPath: CUT_FRAME }}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ clipPath: CUT_BADGE, background: `${color}18`, color }}>
          {room.isPrivate && <Lock className="h-3 w-3" />}{room.isPrivate ? 'Privada' : 'Pública'}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/55"><Users className="h-3.5 w-3.5" />{room.seated}/{room.seats}</span>
      </div>
      <h3 className="mt-4 font-anton text-2xl uppercase leading-none tracking-tight text-white">{room.name}</h3>
      <p className="mt-2 text-[11px] text-white/45">Dono: {room.ownerName || 'M7 Arena'}</p>
      <div className="my-4 flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[.025] px-3 py-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Blinds SB / BB</p><p className="mt-1 text-xl font-black tabular-nums text-white">{room.sb} / {room.bb}</p></div>
        <div className="text-right"><p className="text-[9px] uppercase tracking-widest" style={{ color }}>{room.buyIn === 0 ? 'Treino grátis' : 'Essência Azul'}</p><p className="mt-1 text-xs font-bold text-white/60">{room.buyIn === 0 ? 'Sem apostar EA' : `Entrada ${formatChips(room.buyIn)} EA`}</p></div>
      </div>
      <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>Entrar na mesa <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
    </motion.button>
  );
}
