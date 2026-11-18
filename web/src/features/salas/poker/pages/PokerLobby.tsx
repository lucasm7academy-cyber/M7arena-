import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { ModalSenhaSala } from '../../../../components/partidas/ModaisElegibilidade';
import { POKER_ROOMS, SHOP_ITEMS } from '../domain/lobby-data';
import { formatChips } from '../domain/engine';
import { RoomCard, toLobbyRoom, type LobbyRoom } from '../components/RoomCard';
import { PokerRoomModal } from '../components/PokerRoomModal';
import { EssenceShop } from '../components/EssenceShop';
import { EssenceIcon } from '../components/EssenceIcon';

const CUT_BUTTON = 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)';

export default function PokerLobby() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ea, setEa] = useState<number | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[]>(POKER_ROOMS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [lockedRoom, setLockedRoom] = useState<LobbyRoom | null>(null);

  useEffect(() => {
    let alive = true;
    setEa(null);
    if (user) api.wallet.balance().then((wallet) => { if (alive) setEa(typeof wallet.ea === 'number' ? wallet.ea : null); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.poker.rooms().then(({ rooms: list }) => {
      if (!alive) return;
      setRooms(list.map(toLobbyRoom)); setError('');
    }).catch(() => {
      if (!alive) return;
      setRooms(POKER_ROOMS);
      setError('A lista de mesas dos jogadores ainda não está disponível. Exibindo apenas a mesa da casa.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload, user]);

  const enter = (room: LobbyRoom) => {
    if (!user) { navigate('/login'); return; }
    if (room.isPrivate) { setLockedRoom(room); return; }
    navigate(`/sala-m7/${room.id}`);
  };

  return (
    <main className="relative min-h-screen bg-[#050506] px-4 py-6 text-white sm:p-6 md:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 95% 10%,rgba(63,191,154,.08),transparent 50%),radial-gradient(ellipse at 5% 65%,rgba(56,232,255,.06),transparent 50%),radial-gradient(ellipse at 50% 0%,rgba(255,183,0,.06),transparent 45%)', boxShadow: 'inset 0 0 140px #000' }} />
      <div className="relative mx-auto max-w-[1240px] space-y-8">
        <Link to="/jogar" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar para as salas</Link>
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Poker · Texas Hold'em</p><h1 className="mt-2 font-anton text-5xl uppercase italic leading-none tracking-tight sm:text-6xl">Sala M7</h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">A mesa está aberta. Entre na mesa da casa ou crie a sua.<br className="hidden sm:block" /> O pote e as apostas se decidem a cada rodada.</p></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-4 py-2"><EssenceIcon size={18} /><div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Seu saldo</p><p className="text-sm font-black tabular-nums text-cyan-200">{ea === null ? '—' : formatChips(ea)} EA</p></div></div>
            <button type="button" onClick={() => user ? setCreating(true) : navigate('/login')} className="flex items-center gap-2 bg-emerald-400 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-black transition hover:brightness-110" style={{ clipPath: CUT_BUTTON }}><Plus className="h-4 w-4" />Criar sala</button>
          </div>
        </header>
        <section aria-labelledby="poker-rooms-title">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="poker-rooms-title" className="font-anton text-2xl uppercase tracking-tight">Mesas disponíveis</h2><button type="button" onClick={() => setReload((v) => v + 1)} disabled={loading} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/50 hover:text-white disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar</button></div>
          {error && <p role="status" className="mb-4 border-l-2 border-cyan-400/40 bg-white/[.02] px-3 py-2 text-xs text-white/50">{error}</p>}
          {loading && <p role="status" className="mb-3 text-xs text-white/40">Buscando mesas…</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rooms.map((room, i) => <RoomCard key={room.id} room={room} indice={i} onEnter={() => enter(room)} />)}</div>
          {!loading && !rooms.length && <p className="border border-dashed border-white/10 p-6 text-center text-sm text-white/50">Nenhuma mesa disponível neste momento.</p>}
          <p className="mt-4 text-[11px] text-white/35">Mesas privadas aparecem apenas para o dono. A senha é conferida pelo servidor ao entrar.</p>
        </section>
        <details className="rounded-[8px] border border-white/10 bg-[rgba(13,13,13,0.8)] p-4 backdrop-blur">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.2em] text-white/50">Loja de essência · em breve</summary>
          <div className="mt-5"><EssenceShop items={SHOP_ITEMS} ea={ea} /></div>
        </details>
        <footer className="border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/35">Mesas contra bots da casa, no navegador. Essência Azul (EA) é fictícia, não é sacável e não se converte em dinheiro. O servidor controla a entrada e o resgate do caixa.</footer>
      </div>
      {creating && <PokerRoomModal onClose={() => setCreating(false)} onCreated={(room) => { setCreating(false); setRooms((list) => [...list.filter((item) => item.id !== room.id), toLobbyRoom(room)]); setReload((v) => v + 1); }} />}
      {lockedRoom && <ModalSenhaSala nome={lockedRoom.name} onClose={() => setLockedRoom(null)} onConfirm={(password) => navigate(`/sala-m7/${lockedRoom.id}`, { state: { pokerPassword: password } })} />}
    </main>
  );
}
