// HUD de ação do herói: desistir / mesa / pagar / aumentar, slider com mínimo e
// máximo legais e atalhos de meio pote, pote e all-in. O motor valida de novo.
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsRight, HandCoins, Sparkles, X } from 'lucide-react';
import { formatChips, type Action, type LegalActions } from '../domain/engine';
import { EssenceIcon } from './EssenceIcon';

export interface ActionBarProps {
  legal: LegalActions;
  pot: number;
  bb: number;
  heroBet: number;
  onAction: (action: Action) => void;
  disabled?: boolean;
}

const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';

function roundToStep(value: number, step: number) {
  const s = Math.max(1, Math.round(step));
  return Math.max(s, Math.round(value / s) * s);
}

export function ActionBar({ legal, pot, bb, heroBet, onAction, disabled = false }: ActionBarProps) {
  const min = legal.minRaiseTo;
  const max = legal.maxRaiseTo;
  const step = Math.max(1, Math.round(bb));

  const [raiseTo, setRaiseTo] = useState(min);

  useEffect(() => {
    setRaiseTo((atual) => Math.min(max, Math.max(min, atual)));
  }, [min, max]);

  const seguro = Math.min(max, Math.max(min, raiseTo));
  const podeAumentar = legal.canRaise && max > min;
  const ehAposta = legal.callAmount === 0;

  const alvo = useMemo(
    () => ({
      meioPote: Math.min(max, Math.max(min, roundToStep(heroBet + legal.callAmount + pot / 2, step))),
      pote: Math.min(max, Math.max(min, roundToStep(heroBet + legal.callAmount + pot, step))),
    }),
    [heroBet, legal.callAmount, max, min, pot, step],
  );

  const labelPrincipal = ehAposta
    ? `Apostar ${formatChips(seguro)}`
    : `Aumentar p/ ${formatChips(seguro)}`;

  return (
    <section
      aria-label="Sua vez — escolha a ação"
      className="border border-cyan-300/20 bg-[#0d0d10]/90 p-2.5 shadow-[inset_0_0_0_1px_#ffffff0f,0_0_24px_#38e8ff14,0_15px_40px_#000a] backdrop-blur-xl sm:p-3"
      style={{ clipPath: CUT_BUTTON }}
    >
      {podeAumentar && (
        <div className="mb-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
              Aumentar para
            </span>
            <span className="flex items-center gap-1 text-sm font-black tabular-nums text-[#FFB700]">
              <EssenceIcon size={12} />
              {formatChips(seguro)}
            </span>
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={seguro}
            disabled={disabled}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            aria-label={`Valor do aumento, de ${formatChips(min)} até ${formatChips(max)} de essência`}
            className="h-4 w-full cursor-pointer accent-[#FFB700] disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-1.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setRaiseTo(min)}
                aria-label={`Aumentar para o mínimo legal: ${formatChips(min)} de essência`}
                className="rounded-[3px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                Mín
              </button>
              <button
                type="button"
                disabled={disabled || alvo.meioPote <= min}
                onClick={() => setRaiseTo(alvo.meioPote)}
                aria-label={`Meio pote: ${formatChips(alvo.meioPote)} de essência`}
                className="rounded-[3px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                ½ pote
              </button>
              <button
                type="button"
                disabled={disabled || alvo.pote <= min}
                onClick={() => setRaiseTo(alvo.pote)}
                aria-label={`Pote: ${formatChips(alvo.pote)} de essência`}
                className="rounded-[3px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                Pote
              </button>
            </div>
            <button
              type="button"
              disabled={disabled || !legal.allIn}
              onClick={() => onAction({ type: 'allin' })}
              aria-label={`All-in com ${formatChips(max)} de essência`}
              className="flex items-center gap-1 rounded-[3px] border border-red-400/45 bg-red-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-40"
            >
              <Sparkles className="h-2.5 w-2.5" />
              All-in
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ type: 'fold' })}
          aria-label="Desistir da mão"
          className="p-[1px] transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.2)' }}
        >
          <span
            className="flex items-center justify-center gap-1.5 bg-[#151518] px-2 py-3 text-[10px] font-black uppercase tracking-wider text-white/60 transition-colors hover:bg-[#222228]"
            style={{ clipPath: CUT_BUTTON }}
          >
            <X className="h-3.5 w-3.5" />
            Desistir
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ type: legal.canCheck ? 'check' : 'call' })}
          aria-label={
            legal.canCheck
              ? 'Mesa: passar sem apostar'
              : `Pagar ${formatChips(legal.callAmount)} de essência para continuar`
          }
          className="p-[1px] transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ clipPath: CUT_BUTTON, background: 'rgba(102,204,255,0.6)' }}
        >
          <span
            className="flex items-center justify-center gap-1.5 bg-[#0b1929] px-2 py-3 text-[10px] font-black uppercase tracking-wider text-[#66ccff] transition-colors hover:bg-[#102a40]"
            style={{ clipPath: CUT_BUTTON }}
          >
            {legal.canCheck ? <Check className="h-3.5 w-3.5" /> : <HandCoins className="h-3.5 w-3.5" />}
            {legal.canCheck ? 'Mesa' : `Pagar ${formatChips(legal.callAmount)}`}
          </span>
        </button>

        <button
          type="button"
          disabled={disabled || !podeAumentar}
          onClick={() => onAction({ type: ehAposta ? 'bet' : 'raise', amount: seguro })}
          aria-label={podeAumentar ? labelPrincipal : 'Aumento indisponível: faltam fichas'}
          className="p-[1px] transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, #FFB700, #FFE082)' }}
        >
          <span
            className="flex items-center justify-center gap-1.5 bg-[#FFB700] px-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-black transition-colors hover:bg-[#FFC533]"
            style={{ clipPath: CUT_BUTTON }}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
            {podeAumentar ? labelPrincipal : 'Aumentar'}
          </span>
        </button>
      </div>
    </section>
  );
}
