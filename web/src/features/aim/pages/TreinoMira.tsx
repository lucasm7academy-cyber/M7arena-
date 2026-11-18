import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronRight, Crosshair, Move, Target, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { MODE_HINT, MODE_LABEL } from '../domain/engine';
import type { AimMode } from '../domain/engine';
import { useAimGame } from '../hooks/useAimGame';
import { AimCanvas } from '../components/AimCanvas';
import { AimHud } from '../components/AimHud';
import { AimResult } from '../components/AimResult';
import { AimLeaderboard } from '../components/AimLeaderboard';
import { AIM_CUT_BUTTON, AIM_CUT_CARD } from '../components/frames';

const MODES = [
  { mode: 'flick' as const, icon: Crosshair, color: '#38e8ff' },
  { mode: 'track' as const, icon: Move, color: '#3fbf9a' },
  { mode: 'precision' as const, icon: Target, color: '#a855f7' },
];

export default function TreinoMira() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<AimMode>('flick');
  const [savedVersion, setSavedVersion] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const handleSaved = useCallback(() => setSavedVersion((v) => v + 1), []);
  const game = useAimGame({ mode, canSubmit: Boolean(user) && !isLoading, onSaved: handleSaved });
  const playing = game.phase === 'playing';
  const color = MODES.find((m) => m.mode === mode)!.color;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBest(null);
    if (user) {
      api.aim.leaderboard(mode, 25).then(({ rows }) => {
        if (cancelled) return;
        const own = rows.filter((row) => row.hero || row.id === user.id);
        if (own.length) setBest(Math.max(...own.map((row) => row.score)));
      }).catch(() => { /* Sem inventar recorde quando o ranking está indisponível. */ });
    }
    return () => { cancelled = true; };
  }, [mode, savedVersion, user]);

  return createPortal(
    <main className="fixed inset-0 z-[60] overflow-y-auto bg-[#040406] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 10% 0%,rgba(255,95,162,.12),transparent 55%),radial-gradient(ellipse at 90% 60%,rgba(56,232,255,.12),transparent 55%)', boxShadow: 'inset 0 0 160px #000' }} />
      <button type="button" aria-label="Voltar" onClick={() => navigate('/lobby')}
        className="fixed left-4 top-4 z-[70] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-[#0d0d0d]/90 text-white/65 backdrop-blur transition duration-200 hover:border-red-400/50 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-[#FFB700]">
        <X className="h-5 w-5" />
      </button>
      <div className={`relative mx-auto w-full ${playing ? 'max-w-none px-3 pt-3' : 'max-w-[1100px] px-4 pb-14 pt-20 sm:px-6'}`}>
        {!playing && game.phase === 'idle' && (
          <motion.section initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}
            className="mx-auto mb-8 max-w-3xl border border-transparent p-5 backdrop-blur-xl sm:p-8" style={{ clipPath: AIM_CUT_CARD, background: 'linear-gradient(#0d0d14e8,#0d0d14e8) padding-box,linear-gradient(120deg,#ff5fa266,#38e8ff55) border-box', boxShadow: 'inset 0 0 0 1px #ffffff0f,0 0 30px #ff5fa218' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">M7 Arena · Aquecimento · 30 segundos</p>
            <h1 className="mt-3 text-4xl font-black uppercase italic leading-none tracking-tighter sm:text-6xl" style={{ textShadow: '0 0 24px #38e8ff25' }}>Treino de mira</h1>
            <p className="mt-3 text-sm text-white/50">Escolha seu ritmo. Acerte o centro. Encontre sua melhor mira.</p>
            <div role="group" aria-label="Escolha o modo de treino" className="mt-6 grid gap-2 sm:grid-cols-3">
              {MODES.map(({ mode: option, icon: Icon, color: tint }, index) => (
                <motion.button key={option} type="button" aria-pressed={option === mode} onClick={() => setMode(option)}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * .07, duration: .2 }}
                  className="relative border border-white/10 bg-white/5 p-4 text-left transition-colors duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#FFB700]"
                  style={{ clipPath: AIM_CUT_BUTTON, borderColor: option === mode ? `${tint}99` : undefined }}>
                  <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: tint }} />
                  <Icon className="mb-3 h-5 w-5" style={{ color: tint }} />
                  <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: option === mode ? tint : undefined }}>{MODE_LABEL[option]}</span>
                  <span className="mt-2 block text-[11px] leading-relaxed text-white/50">{option === 'track' ? 'Segure e acompanhe os alvos.' : option === 'precision' ? 'Alvos menores. Controle fino.' : 'Reação rápida entre os alvos.'}</span>
                </motion.button>
              ))}
            </div>
            <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="max-w-sm">
                <p className="text-xs leading-relaxed text-white/60">{MODE_HINT[mode]}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/40">Recorde pessoal no top 25: <strong className="text-white/85">{best === null ? '—' : best.toLocaleString('pt-BR')}</strong></p>
              </div>
              <button type="button" onClick={game.start} className="flex min-h-14 shrink-0 items-center justify-center gap-4 px-8 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#FFB700]" style={{ clipPath: AIM_CUT_BUTTON, background: color }}>
                Começar <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 text-[10px] text-white/40">Clique ou segure e arraste em qualquer modo. Arrastar no vazio não conta como erro.</p>
          </motion.section>
        )}
        <section aria-label="Arena de treino" className={playing || game.phase === 'finished' ? '' : 'hidden'}>
          <div className="mb-3 pl-14"><AimHud hud={game.hud} mode={mode} playing={playing} /></div>
          <AimCanvas canvasRef={game.canvasRef} playing={playing} onPointerDown={game.handlePointerDown} onPointerMove={game.handlePointerMove} onPointerLeave={game.handlePointerLeave} onPointerUp={game.handlePointerUp} label={`Arena de mira · ${MODE_LABEL[mode]}`}>
            {game.phase === 'finished' && game.result && <AimResult result={game.result} submit={game.submit} onReplay={game.start} onDismiss={game.dismissResult} onRetrySubmit={game.retrySubmit} />}
          </AimCanvas>
        </section>
        {!playing && <div className="mt-8"><AimLeaderboard refreshKey={savedVersion} highlightName={user?.user_metadata.full_name ?? null} /></div>}
      </div>
    </main>, document.body,
  );
}
