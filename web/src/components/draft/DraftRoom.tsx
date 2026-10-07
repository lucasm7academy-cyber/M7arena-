// src/components/draft/DraftRoom.tsx
// Draft (ban/pick) da sala — port visual do DraftRoom do site antigo
// (M7AcademySite, commit e4b7457), adaptado ao stack novo:
//
//  - O ESTADO vem do servidor (`sala.draft`, shape legado) — o cliente não
//    guarda turno/fase/time nem decide timeout. O que era lógica local virou
//    validação em api/src/lib/draft-flow.ts (invariante: regra no servidor).
//  - O TIMER é derivado do relógio do servidor (`turn_deadline_at`), com o
//    clockSync das salas — o bug de fuso/relógio local do site antigo não
//    existe mais. Quando o número chega a 0, o hook dispara o tick e o
//    SERVIDOR aplica ban vazio / cancelamento.
//  - Sem HUD de transmissão (o sistema de streams do site novo é por escala de
//    jogo, ADR-072 — não há StreamModal na sala).

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Ban, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { FiShieldOff } from 'react-icons/fi';
import { getDDRVersion, buildChampionIconUrl } from '../../api/riot';
import { traduzirErroSala, type ResultadoSalaRpc } from '../../api/salamod1';
import type { Champion, SalaDraft } from './draftTypes';

interface DraftRoomProps {
  modo: string;
  draft: SalaDraft;
  jogadores: any[];
  usuarioId: string;
  /** Segundos restantes do turno, derivados do relógio do servidor. */
  timer: number;
  onBanir: (championId: string) => Promise<ResultadoSalaRpc>;
  onPickar: (championId: string) => Promise<ResultadoSalaRpc>;
}

// ── Slots ────────────────────────────────────────────────────────────────────

function BanSlot({ champion, active, jaBaniu, champions, version }: {
  champion: string | null; active: boolean; jaBaniu: boolean;
  champions: Record<string, Champion>; version: string;
}) {
  const champ = champion ? champions[champion] : null;
  return (
    <div className="flex flex-col items-center gap-[0.3vmin]">
      <div className={`
        relative w-[5vmin] h-[5vmin] border bg-black/60 flex items-center justify-center overflow-hidden transition-all duration-300
        ${jaBaniu ? 'border-red-600/80 shadow-[0_0_8px_rgba(220,38,38,0.3)]' : 'border-white/15'}
        ${active ? 'border-[#c89b3c] shadow-[0_0_12px_rgba(200,155,60,0.5)] scale-110' : ''}
      `}>
        {champ ? (
          <>
            <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
              className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 border-t-2 border-red-600/80 -rotate-45 origin-center scale-150" />
          </>
        ) : (
          <div className={jaBaniu ? 'opacity-40' : 'opacity-15'}>
            <Ban className="w-[3vmin] h-[3vmin] text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

function PickSlot({ champion, active, hidden, champions, version }: {
  champion: string | null; active: boolean; hidden: boolean;
  champions: Record<string, Champion>; version: string;
}) {
  const champ = champion ? champions[champion] : null;
  return (
    <div className="flex flex-col items-center gap-[0.3vmin]">
      <div className={`
        w-[10vmin] h-[11vmin] border bg-black/50 overflow-hidden shadow-inner relative group transition-all duration-300
        ${champ ? 'border-white/20' : 'border-white/10'}
        ${active ? 'border-[#c89b3c] shadow-[0_0_12px_rgba(200,155,60,0.5)]' : ''}
      `}>
        {hidden ? (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <span className="text-[3vmin] font-black text-white/60">?</span>
          </div>
        ) : champ ? (
          <>
            <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer" />
            <div className="absolute bottom-0 left-0 right-0 h-[3vmin] bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-[0.3vmin]">
              <span className="text-[0.9vmin] font-bold text-[#f0e6d2] uppercase tracking-wider drop-shadow-md">
                {champ.name}
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-15">
            <FiShieldOff size="5vmin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Painel do time (círculo central de cada lado) ───────────────────────────

function TeamPanel({ lado, emTurno, fase, selected, meuTime, jogadorNome }: {
  lado: 'blue' | 'red'; emTurno: boolean; fase: 'ban' | 'pick';
  selected: Champion | null; meuTime: 'blue' | 'red' | null; jogadorNome: string;
}) {
  const corTurno = fase === 'ban' ? 'border-red-500' : 'border-[#FFD700]';
  const estaSelecionando = selected && emTurno && meuTime === lado;
  return (
    <div className="w-[25vmin] flex flex-col items-center gap-[1.5vmin] pointer-events-auto">
      <div className="text-center w-full truncate px-[1vmin]">
        <span className="text-[2vmin] font-bold text-white/90 tracking-widest drop-shadow-md">
          {jogadorNome}
        </span>
      </div>

      <div className="relative">
        <motion.div
          initial={false}
          animate={emTurno ? (
            fase === 'ban' ? {
              boxShadow: ['0 0 20px rgba(239,68,68,0.3)', '0 0 30px rgba(239,68,68,0.9)', '0 0 15px rgba(239,68,68,0.3)'],
              borderColor: ['#ef4444', '#f87171', '#ef4444'],
            } : {
              boxShadow: ['0 0 10px rgba(255,215,0,0.5)', '0 0 10px rgba(255,215,0,0.95)', '0 0 10px rgba(255,215,0,0.5)'],
              borderColor: ['#FFD700', '#FFC300', '#FFD700'],
            }
          ) : { boxShadow: '0 0 0px rgba(0,0,0,0)', borderColor: 'rgba(255,255,255,0.1)' }}
          transition={emTurno ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          className={`w-[18vmin] h-[18vmin] rounded-full border-[0.6vmin] overflow-hidden bg-black transition-all duration-300 ${emTurno ? corTurno : 'border-white/10'}`}
        >
          {!emTurno && (
            <div className="w-full h-full relative flex items-center justify-center bg-black/60">
              <div className="relative flex flex-col items-center justify-center gap-[1vmin] z-10">
                <div className="flex gap-[0.8vmin]">
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-[1.2vmin] h-[1.2vmin] bg-white/60 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-[1.2vmin] h-[1.2vmin] bg-white/60 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-[1.2vmin] h-[1.2vmin] bg-white/60 rounded-full" />
                </div>
                <p className="text-[1.2vmin] font-bold text-white/90 uppercase tracking-wider drop-shadow-md">Aguardando</p>
              </div>
            </div>
          )}

          {estaSelecionando ? (
            <img src={buildChampionIconUrl(selected!.id)} alt={selected!.name}
              className="w-full h-full object-cover scale-125 relative z-10" referrerPolicy="no-referrer" />
          ) : null}

          {emTurno && !estaSelecionando && (
            <div className={`w-full h-full flex flex-col items-center justify-center gap-[1vmin] relative z-10 ${fase === 'ban' ? 'bg-red-600/10' : 'bg-[#FFD700]/10'}`}>
              <div className="flex gap-[0.8vmin]">
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className={`w-[1.2vmin] h-[1.2vmin] rounded-full ${fase === 'ban' ? 'bg-red-500' : 'bg-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.8)]'}`} />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className={`w-[1.2vmin] h-[1.2vmin] rounded-full ${fase === 'ban' ? 'bg-red-500' : 'bg-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.8)]'}`} />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className={`w-[1.2vmin] h-[1.2vmin] rounded-full ${fase === 'ban' ? 'bg-red-500' : 'bg-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.8)]'}`} />
              </div>
              <p className={`text-[1.8vmin] font-bold uppercase tracking-widest text-center px-2 drop-shadow-md ${fase === 'ban' ? 'text-red-500' : 'text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]'}`}>
                {fase === 'ban' ? 'Banir' : 'Escolher'}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="text-center min-h-[3.5vmin]">
        <h2 className="text-[2.5vmin] font-bold text-white uppercase tracking-tighter mb-[0.5vmin]">
          {estaSelecionando ? selected!.name : ''}
        </h2>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export const DraftRoom: React.FC<DraftRoomProps> = ({
  modo, draft, jogadores, usuarioId, timer, onBanir, onPickar,
}) => {
  const [champions, setChampions] = useState<Record<string, Champion>>({});
  const [version, setVersion] = useState('16.20.1');
  const [selectedChamp, setSelectedChamp] = useState<Champion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const v = await getDDRVersion();
        if (!vivo) return;
        setVersion(v);
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/pt_BR/champion.json`);
        const data = await res.json();
        if (vivo) setChampions(data.data);
      } catch (error) {
        // Nunca engole erro: o grid fica vazio e o console diz por quê.
        console.error('[DraftRoom] Falha ao carregar campeões do Data Dragon:', error);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Meu lado nesta sala (só desenha — a permissão real é validada no servidor).
  const meuJogador = jogadores.find((j: any) => j.user_id === usuarioId);
  const meuTime: 'blue' | 'red' | null = meuJogador ? (meuJogador.is_time_a ? 'blue' : 'red') : null;
  const possoJogar = !!meuJogador;

  const emTurno = draft.status === 'ongoing';
  const fase = draft.current_phase;
  const isMeuTurno = possoJogar && emTurno && meuTime === draft.current_team;

  // Nome exibido do jogador "em turno" (JG no 5v5, MID no 1v1) — igual ao antigo.
  const roleEmTurno = modo === '1v1' || modo === 'aram' ? 'MID' : 'JG';
  const formatarNome = (p: any, padrao: string) => {
    if (!p) return padrao;
    const tag = (p.tag || '').replace('#', '');
    return tag ? `${p.nome}#${tag}` : p.nome;
  };
  const nomeBlue = formatarNome(jogadores.find((j: any) => j.is_time_a && j.role === roleEmTurno), 'BLUE-SIDE');
  const nomeRed = formatarNome(jogadores.find((j: any) => !j.is_time_a && j.role === roleEmTurno), 'RED-SIDE');

  const jaUsado = (champId: string) =>
    draft.blue_bans.includes(champId) || draft.red_bans.includes(champId) ||
    draft.blue_picks.includes(champId) || draft.red_picks.includes(champId);

  // 1v1: oculta os picks do time ADVERSÁRIO enquanto o draft está em andamento
  // (mesma regra do site antigo — nada de espiar o pick do oponente).
  const esconderPickAdversario = (lado: 'blue' | 'red', championId: string | null) =>
    modo === '1v1' && draft.status === 'ongoing' && !!championId && lado !== meuTime;

  const filteredChampions = useMemo(() => {
    return (Object.values(champions) as Champion[])
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, searchTerm]);

  // Quantidade de slots por lado: 5 bans/5 picks no 5v5/time_vs_time;
  // 1 ban/1 pick no 1v1/ARAM (mesma TURN_ORDER do servidor).
  const isDuo = modo === '1v1' || modo === 'aram';
  const maxBans = isDuo ? 1 : 5;
  const maxPicks = isDuo ? 1 : 5;

  const handleChampionClick = (champ: Champion) => {
    if (!isMeuTurno || enviando) return;
    if (jaUsado(champ.id)) return;
    setSelectedChamp(champ);
  };

  const confirmarAcao = async () => {
    if (!selectedChamp || !isMeuTurno || enviando) return;
    setEnviando(true);
    try {
      const r = fase === 'ban' ? await onBanir(selectedChamp.id) : await onPickar(selectedChamp.id);
      if (!r.ok) {
        // O hook mostra no layout da sala, mas durante o draft a tela é esta —
        // o aviso precisa aparecer aqui.
        toast.error(traduzirErroSala(r.erro));
        return;
      }
      setSelectedChamp(null);
    } finally {
      setEnviando(false);
    }
  };

  const segundos = Math.max(0, Math.min(timer, 30));

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] bg-black text-[#f0e6d2] font-sans overflow-hidden select-none">
      {/* DYNAMIC BACKGROUND */}
      <div className="absolute inset-0" style={{
        background: fase === 'ban'
          ? 'radial-gradient(circle at center, rgba(127,29,29,0.4) 0%, #000 70%)'
          : 'radial-gradient(circle at center, rgba(30,58,138,0.4) 0%, #000 70%)',
      }} />

      {/* HEADER SECTION - TIMER + FASE */}
      <div className="relative pt-[2vmin] flex flex-col items-center z-40">
        <h1 className="text-[3.5vmin] font-bold tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] uppercase">
          {fase === 'ban' ? 'FASE DE BANS' : 'FASE DE PICKS'}
        </h1>

        <div className="relative w-[60vmin] h-[0.5vmin] bg-white/10 mt-[1vmin] overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c89b3c] to-transparent"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: segundos / 30 }}
            transition={{ duration: 1, ease: 'linear' }}
            style={{ originX: 0.5 }}
          />
        </div>

        <div className={`text-[6vmin] font-black mt-[0.5vmin] tabular-nums drop-shadow-lg ${segundos <= 10 ? 'text-red-500' : 'text-white'}`}>
          {segundos}
        </div>
      </div>

      {/* BANS SECTION */}
      <div className="absolute top-[5vmin] left-0 right-0 flex justify-between px-[4vmin] z-40">
        <div className="flex flex-col gap-[0.5vmin] items-start">
          <span className="text-[1vmin] font-bold text-white/20 uppercase tracking-[0.3em] ml-[0.5vmin]">Bans</span>
          <div className="flex flex-row gap-[1vmin]">
            {[...Array(maxBans)].map((_, i) => (
              <BanSlot key={`B-${i}`} champion={draft.blue_bans[i] ?? null}
                active={emTurno && draft.current_team === 'blue' && fase === 'ban'}
                jaBaniu={i < draft.blue_bans.length} champions={champions} version={version} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-[0.5vmin] items-start">
          <span className="text-[1vmin] font-bold text-white/20 uppercase tracking-[0.3em] ml-[0.5vmin]">Bans</span>
          <div className="flex flex-row gap-[1vmin]">
            {[...Array(maxBans)].map((_, i) => (
              <BanSlot key={`R-${i}`} champion={draft.red_bans[i] ?? null}
                active={emTurno && draft.current_team === 'red' && fase === 'ban'}
                jaBaniu={i < draft.red_bans.length} champions={champions} version={version} />
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="absolute inset-0 flex items-center justify-between px-[4vmin] pointer-events-none z-30">
        <TeamPanel lado="blue" emTurno={emTurno && draft.current_team === 'blue'} fase={fase}
          selected={selectedChamp} meuTime={meuTime} jogadorNome={nomeBlue} />
        <TeamPanel lado="red" emTurno={emTurno && draft.current_team === 'red'} fase={fase}
          selected={selectedChamp} meuTime={meuTime} jogadorNome={nomeRed} />
      </div>

      {/* CENTER - CHAMPION GRID */}
      <div className="absolute top-[12vmin] left-1/2 -translate-x-1/2 w-full max-w-[85vmin] flex flex-col gap-[1vmin] z-40">
        <div className="flex justify-end mb-[0.5vmin]">
          <div className="relative w-[30vmin]">
            <Search className="absolute left-[1vmin] top-1/2 -translate-y-1/2 w-[1.8vmin] h-[1.8vmin] text-[#c89b3c]" />
            <input
              type="text"
              placeholder="Buscar campeão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/80 border border-[#c89b3c]/40 rounded-sm py-[0.8vmin] pl-[3.5vmin] pr-[1.5vmin] text-[1.6vmin] outline-none focus:border-[#c89b3c] transition-colors placeholder:text-[#c89b3c]/30 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-6 gap-x-[0.8vmin] gap-y-[1.2vmin] max-h-[58vmin] overflow-y-auto custom-scrollbar pr-[1vmin]">
          {filteredChampions.map(champ => {
            const usado = jaUsado(champ.id);
            const selecionado = selectedChamp?.id === champ.id;
            return (
              <div
                key={champ.id}
                onClick={() => handleChampionClick(champ)}
                className={`flex flex-col items-center gap-[0.3vmin] group ${isMeuTurno ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`
                  relative w-[11.5vmin] h-[11.5vmin] border-2 transition-all duration-200
                  ${selecionado ? 'border-[#c89b3c] scale-110 shadow-[0_0_15px_rgba(200,155,60,0.5)]' : 'border-white/10 group-hover:border-white/40'}
                  ${usado ? 'opacity-30 grayscale cursor-not-allowed' : ''}
                `}>
                  <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
                    className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {(draft.blue_bans.includes(champ.id) || draft.red_bans.includes(champ.id)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-grayscale overflow-hidden">
                      <div className="absolute inset-0 border-t-4 border-red-600/80 -rotate-45 origin-center scale-150" />
                    </div>
                  )}
                </div>
                <span className={`text-[1.2vmin] font-bold truncate w-full text-center ${selecionado ? 'text-[#c89b3c]' : 'text-white/60'}`}>
                  {champ.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER PICKS & ACTION BUTTON */}
      <div className="absolute bottom-[2vmin] left-0 right-0 flex items-end justify-between px-[4vmin] z-50">
        <div className="flex flex-col gap-[1vmin]">
          <span className="text-[1.2vmin] font-bold text-[#0000FF]/60 uppercase tracking-[0.3em] ml-[0.5vmin]">PICKS AZUL</span>
          <div className="flex gap-[0.8vmin]">
            {[...Array(maxPicks)].map((_, i) => (
              <PickSlot key={`BP-${i}`} champion={draft.blue_picks[i] ?? null}
                active={emTurno && draft.current_team === 'blue' && fase === 'pick'}
                hidden={esconderPickAdversario('blue', draft.blue_picks[i] ?? null)}
                champions={champions} version={version} />
            ))}
          </div>
        </div>

        <div className="mb-[2vmin] relative">
          <button
            disabled={!selectedChamp || !isMeuTurno || enviando}
            onClick={confirmarAcao}
            className={`
              relative px-[12vmin] py-[2.5vmin] font-bold text-[2.2vmin] tracking-[0.15em] uppercase transition-all duration-300 group
              ${selectedChamp && isMeuTurno && !enviando
                ? 'text-[#f0e6d2] hover:text-white cursor-pointer'
                : 'text-white/20 cursor-not-allowed'}
            `}
          >
            <div className="absolute inset-0 z-0">
              <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="w-full h-full drop-shadow-[0_0_15px_rgba(200,155,60,0.1)]">
                <path d="M40,5 L260,5 L295,60 Q150,85 5,60 Z" fill="none"
                  stroke={selectedChamp && isMeuTurno && !enviando ? '#c89b3c' : 'rgba(255,255,255,0.1)'} strokeWidth="2" />
                <path d="M42,7 L258,7 L292,59 Q150,83 8,59 Z"
                  fill={selectedChamp && isMeuTurno && !enviando ? '#1e2328' : '#0a0a0a'}
                  className="transition-colors duration-300 group-hover:fill-[#252a30]" />
              </svg>
            </div>
            <span className="relative z-10 drop-shadow-md">
              {enviando ? '...' : fase === 'ban' ? 'BANIR' : 'CONFIRMAR'}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-[1vmin] items-end">
          <span className="text-[1.2vmin] font-bold text-[#FF0000]/60 uppercase tracking-[0.3em] mr-[0.5vmin]">PICKS VERMELHO</span>
          <div className="flex gap-[0.8vmin]">
            {[...Array(maxPicks)].map((_, i) => (
              <PickSlot key={`RP-${i}`} champion={draft.red_picks[i] ?? null}
                active={emTurno && draft.current_team === 'red' && fase === 'pick'}
                hidden={esconderPickAdversario('red', draft.red_picks[i] ?? null)}
                champions={champions} version={version} />
            ))}
          </div>
        </div>
      </div>

      {/* AVISO DE ESPECTADOR (GLOBAL) */}
      {!possoJogar && (
        <div className="absolute bottom-[12vmin] left-1/2 -translate-x-1/2 px-[3vmin] py-[0.8vmin] bg-yellow-500/10 border border-yellow-500/20 rounded-full z-50">
          <p className="text-yellow-400 text-[1.2vmin] font-bold">👁 Você está como espectador</p>
        </div>
      )}

      {/* Selo de pronto */}
      {isMeuTurno && selectedChamp && (
        <div className="absolute top-[16vmin] left-1/2 -translate-x-1/2 z-50 flex items-center gap-[1vmin] px-[2vmin] py-[0.8vmin] bg-[#c89b3c]/10 border border-[#c89b3c]/30 rounded-full">
          <Check className="w-[1.6vmin] h-[1.6vmin] text-[#c89b3c]" />
          <span className="text-[1.2vmin] font-bold text-[#c89b3c] uppercase tracking-widest">Confirme sua escolha</span>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(200, 155, 60, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c89b3c; border-radius: 2px; }
      `}</style>
    </div>
  );
};
