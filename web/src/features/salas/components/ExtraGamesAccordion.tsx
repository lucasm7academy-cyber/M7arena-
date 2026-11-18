import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronRight, Crosshair, Spade } from 'lucide-react';

const ENTRIES = [
  { id: 'poker', title: "Sala M7 — Poker Texas Hold'em", summary: 'A mesa da casa e as mesas dos jogadores. O pote se decide a cada rodada.', icon: Spade, color: '#3fbf9a', second: '#38e8ff', chips: ['Blinds SB / BB', '2–6 lugares', 'Essência ou treino grátis'], description: 'Entre na Sala M7 ou crie uma mesa pública ou privada. Acompanhe o pote, pague a aposta ou aumente na sua vez.', href: '/sala-m7', cta: 'Entrar na Sala M7' },
  { id: 'aim', title: 'Treino de Mira', summary: 'Trinta segundos para aquecer reflexo, movimento e precisão.', icon: Crosshair, color: '#ff5fa2', second: '#38e8ff', chips: ['3 modos', 'Clique e arrasto', 'Ranking do servidor'], description: 'Escolha seu modo, siga os alvos e construa seu combo. Arraste sem penalidade no vazio e tente superar sua melhor mira.', href: '/treino-mira', cta: 'Treinar mira' },
];

/** Entradas extras da vitrine; não participa do polling das partidas. */
export function ExtraGamesAccordion() {
  const [open, setOpen] = useState<string | null>(null);
  const reduced = useReducedMotion();
  return (
    <section aria-label="Mais formas de jogar" className="space-y-3">
      {ENTRIES.map(({ id, title, summary, icon: Icon, color, second, chips, description, href, cta }) => {
        const expanded = open === id;
        return (
          <div key={id} className="rounded-[8px] p-px transition-shadow duration-200"
            style={{ background: `linear-gradient(110deg,${color}${expanded ? '99' : '40'},${second}${expanded ? '80' : '25'})`, boxShadow: expanded ? `inset 0 0 0 1px #ffffff0f,0 0 26px ${color}18,0 0 40px ${second}0a` : undefined }}>
            <div className="overflow-hidden rounded-[7px] bg-[#08090c]/95">
              <button type="button" id={`${id}-toggle`} aria-expanded={expanded} aria-controls={`${id}-details`}
                onClick={() => setOpen(expanded ? null : id)}
                className="flex w-full items-center gap-4 bg-white/[0.03] p-4 text-left backdrop-blur-xl transition-colors duration-200 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-cyan-300 sm:p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] border" style={{ color, borderColor: `${color}40`, background: `${color}0c` }}><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block font-anton text-lg uppercase tracking-tight text-white sm:text-2xl" style={{ textShadow: expanded ? `0 0 18px ${color}25` : undefined }}>{title}</span><span className="mt-1 block text-xs leading-relaxed text-white/50">{summary}</span></span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-[240ms] ${expanded ? 'rotate-180' : ''}`} style={{ color }} />
              </button>
              <AnimatePresence initial={false}>
                {expanded && <motion.div id={`${id}-details`} role="region" aria-labelledby={`${id}-toggle`}
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : .24, ease: 'easeInOut' }} className="overflow-hidden">
                  <div className="border-t border-white/5 bg-white/[.03] px-5 pb-5 pt-4 backdrop-blur-xl sm:px-6">
                    <div className="flex flex-wrap gap-2">{chips.map((chip) => <span key={chip} className="rounded-[4px] border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/55">{chip}</span>)}</div>
                    <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="max-w-xl text-xs leading-relaxed text-white/55">{description}</p><Link to={href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-black transition duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white" style={{ background: color, clipPath: 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)' }}>{cta}<ChevronRight className="h-4 w-4" /></Link></div>
                  </div>
                </motion.div>}
              </AnimatePresence>
              {!expanded && <div id={`${id}-details`} hidden />}
            </div>
          </div>
        );
      })}
    </section>
  );
}
