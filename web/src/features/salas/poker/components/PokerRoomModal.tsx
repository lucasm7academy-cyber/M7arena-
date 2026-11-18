import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Lock, Plus, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { ApiPokerRoom } from '../../../../lib/api';

const CUT_FRAME = 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)';
const CUT_BUTTON = 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)';
const FIELD = 'w-full rounded-[4px] border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-emerald-400/60';
const LABEL = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-white/50';

export function PokerRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: (room: ApiPokerRoom) => void }) {
  const [name, setName] = useState('');
  const [blind, setBlind] = useState('10/20');
  const [seats, setSeats] = useState(6);
  const [isPrivate, setPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [valendoEssencia, setEssencia] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const color = isPrivate ? '#a855f7' : valendoEssencia ? '#3fbf9a' : '#38bdf8';
  const [sb, bb] = blind.split('/').map(Number);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      // O SDK genérico preserva credentials, erros e prefixo /api. O body segue
      // o contrato de rooms: o servidor calcula 100 BB, não recebe buy-in livre.
      const response = await api.post<{ ok: boolean; room: ApiPokerRoom }>('/poker/rooms', {
        name: name.trim(), sb, bb, seats, isPrivate, password: isPrivate ? password : undefined, valendoEssencia,
      });
      if (!response.ok || !response.room) throw new Error('indisponivel');
      onCreated(response.room);
    } catch {
      setError('Não foi possível criar a mesa. O serviço pode ainda não estar disponível. Tente novamente.');
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 text-white backdrop-blur-sm" onClick={() => { if (!busy) onClose(); }}>
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="poker-create-title"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .15 }}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto border bg-[#09090c] p-5 shadow-2xl sm:p-6"
        style={{ clipPath: CUT_FRAME, borderColor: `${color}80` }} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) onClose();
          if (e.key !== 'Tab') return;
          const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select');
          if (!controls?.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}>
        <button type="button" disabled={busy} aria-label="Fechar" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center border border-white/10 bg-white/5 text-white/60 hover:text-white disabled:opacity-40" style={{ clipPath: CUT_BUTTON }}><X className="h-4 w-4" /></button>
        <div className="mb-6 flex items-center gap-3"><Plus className="h-6 w-6" style={{ color }} /><div><p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color }}>Poker Texas Hold'em</p><h2 id="poker-create-title" className="mt-1 font-anton text-2xl uppercase tracking-tight">Criar sala</h2></div></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className={LABEL}>Nome da mesa</span><input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Mesa dos amigos" className={FIELD} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className={LABEL}>Blinds SB / BB</span><select value={blind} onChange={(e) => setBlind(e.target.value)} className={FIELD}>{['5/10', '10/20', '25/50', '50/100'].map((v) => <option className="bg-[#111116]" key={v}>{v}</option>)}</select></label>
            <label><span className={LABEL}>Lugares</span><select value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={FIELD}>{[2, 3, 4, 5, 6].map((v) => <option className="bg-[#111116]" key={v}>{v}</option>)}</select></label>
          </div>
          <fieldset><legend className={LABEL}>Visibilidade</legend><div className="grid grid-cols-2 gap-2">{[false, true].map((privateValue) => <button key={String(privateValue)} type="button" onClick={() => setPrivate(privateValue)} aria-pressed={isPrivate === privateValue} className="flex items-center justify-center gap-2 border border-white/10 bg-white/5 p-3 text-[11px] font-black uppercase tracking-wider" style={{ clipPath: CUT_BUTTON, color: isPrivate === privateValue ? color : '#ffffff70', borderColor: isPrivate === privateValue ? `${color}80` : undefined }}>{privateValue && <Lock className="h-3 w-3" />}{privateValue ? 'Privada' : 'Pública'}</button>)}</div></fieldset>
          {isPrivate && <label className="block"><span className={LABEL}>Senha da mesa</span><input required type="password" minLength={4} maxLength={100} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} /></label>}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[4px] border border-white/10 bg-white/5 p-3"><span><span className="block text-[10px] font-black uppercase tracking-[0.2em]">Valendo essência</span><span className="mt-1 block text-[11px] text-white/50">{valendoEssencia ? `Entrada de ${bb * 100} EA · 100 BB` : 'Mesa de treino · entrada grátis'}</span></span><input type="checkbox" checked={valendoEssencia} onChange={(e) => setEssencia(e.target.checked)} className="h-5 w-5 accent-emerald-400" /></label>
          <p className="text-[11px] leading-relaxed text-white/40">As apostas são definidas a cada rodada. A entrada é calculada pelo servidor.</p>
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="w-full px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-black transition hover:brightness-110 disabled:opacity-50" style={{ clipPath: CUT_BUTTON, background: color }}>{busy ? 'Criando…' : 'Criar sala'}</button>
        </form>
      </motion.div>
    </div>, document.body,
  );
}
