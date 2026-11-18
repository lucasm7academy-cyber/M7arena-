import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';
import type { AimRoundResult, AimSubmit } from '../hooks/useAimGame';
import { MODE_LABEL } from '../domain/engine';
import { AIM_CUT_ARENA, AIM_CUT_ARENA_IN, AIM_CUT_BUTTON } from './frames';

interface AimResultProps {
  result: AimRoundResult;
  submit: AimSubmit;
  onReplay: () => void;
  onDismiss: () => void;
  onRetrySubmit: () => void;
}

/**
 * Resultado da rodada: nota, números e o estado do envio ao servidor. Visitante
 * vê o convite para entrar em vez do envio; o ranking é sempre do servidor.
 */
export function AimResult({ result, submit, onReplay, onDismiss, onRetrySubmit }: AimResultProps) {
  const replayRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    replayRef.current?.focus();
  }, []);

  const numbers = [
    { label: 'Pontos', value: result.score.toLocaleString('pt-BR') },
    { label: 'Acerto', value: `${result.accuracy.toFixed(1)}%` },
    { label: 'APM', value: String(result.apm) },
    { label: 'Melhor combo', value: `x${result.bestCombo}` },
    { label: 'Reação média', value: result.reaction > 0 ? `${result.reaction} ms` : '—' },
    { label: 'Acertos / erros', value: `${result.hits} / ${result.misses + result.expired}` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="pointer-events-auto absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[#050507]/85 px-2 py-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aim-result-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 26 }}
        className="relative my-auto w-full max-w-xl p-[1px] bg-[#FFB700]/25"
        style={{ clipPath: AIM_CUT_ARENA }}
      >
        <div className="bg-[#08080a]" style={{ clipPath: AIM_CUT_ARENA_IN }}>
          {!reduceMotion && ['SS', 'S'].includes(result.grade.grade) && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 24 }, (_, i) => (
                <motion.span key={i} className="absolute top-0 h-1.5 w-1"
                  style={{ left: `${(i * 43) % 100}%`, background: ['#38e8ff', '#3fbf9a', '#FFB700'][i % 3] }}
                  initial={{ y: -20, opacity: 0, rotate: 0 }}
                  animate={{ y: 460, opacity: [0, .65, 0], rotate: i % 2 ? 190 : -190 }}
                  transition={{ delay: i * .035, duration: 1.8 }} />
              ))}
            </div>
          )}
          <div className="px-5 pt-5 sm:px-7 sm:pt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Rodada encerrada · {MODE_LABEL[result.mode]}
            </p>
            <h2
              id="aim-result-title"
              className="mt-1 font-anton text-2xl uppercase leading-none tracking-tight text-white sm:text-3xl"
            >
              Sua mira em números
            </h2>
          </div>

          <div className="mt-4 grid gap-5 px-5 pb-5 sm:grid-cols-[132px_1fr] sm:px-7 sm:pb-6">
            <div className="flex items-center justify-center gap-3 sm:flex-col sm:gap-1.5 sm:border-r sm:border-white/5 sm:pr-5">
              <span
                className="font-anton text-[64px] leading-none sm:text-[76px]"
                style={{ color: result.grade.tint, textShadow: `0 0 30px ${result.grade.tint}55` }}
                aria-hidden="true"
              >
                {result.grade.grade}
              </span>
              <div className="text-left sm:text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">Nota {result.grade.grade}</p>
                <p
                  className="text-[11px] font-black uppercase tracking-[0.15em]"
                  style={{ color: result.grade.tint }}
                >
                  {result.grade.label}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {numbers.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{item.label}</dt>
                  <dd className="mt-0.5 truncate font-black text-base tabular-nums text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-white/5 px-5 py-4 sm:px-7">
            <div aria-live="polite" className="min-h-[20px] text-[11px] leading-relaxed">
              {submit.status === 'sending' && (
                <span className="inline-flex items-center gap-2 text-white/45">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFB700]" />
                  Enviando sua nota ao servidor…
                </span>
              )}
              {submit.status === 'saved' && (
                <span className="text-[#3fbf9a]">
                  Nota enviada ao ranking
                  {submit.position ? ` · você está em #${submit.position}` : ''}.
                </span>
              )}
              {submit.status === 'error' && (
                <span className="text-[#ff8f8f]">
                  {submit.message ?? 'Não foi possível enviar sua nota.'}{' '}
                  <button
                    type="button"
                    onClick={onRetrySubmit}
                    className="font-black uppercase tracking-[0.12em] underline decoration-dotted underline-offset-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB700]"
                  >
                    Tentar de novo
                  </button>
                </span>
              )}
              {submit.status === 'skipped' && (
                <span className="text-white/55">
                  Fora do ranking por enquanto.{' '}
                  <Link
                    to="/login"
                    className="font-black uppercase tracking-[0.12em] text-[#FFB700] underline decoration-dotted underline-offset-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB700]"
                  >
                    Entre para salvar sua nota
                  </Link>
                  .
                </span>
              )}
              {submit.status === 'idle' && (
                <span className="text-white/30">Rodada livre: sem envio ao ranking.</span>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                ref={replayRef}
                type="button"
                onClick={onReplay}
                aria-label={`Jogar de novo no modo ${MODE_LABEL[result.mode]}`}
                className="group relative px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB700]"
              >
                <span
                  className="absolute inset-0 bg-[#FFB700] transition group-hover:brightness-110"
                  style={{ clipPath: AIM_CUT_BUTTON }}
                  aria-hidden="true"
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Jogar de novo
                </span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center justify-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                <X className="h-3.5 w-3.5" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
