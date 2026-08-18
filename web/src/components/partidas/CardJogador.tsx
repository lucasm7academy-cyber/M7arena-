// src/components/partidas/CardJogador.tsx
// Card individual de um jogador no lineup (estilo VagaSlot): card preto
// `#050505` com borda cortada da cor da side, ícone da rota que o jogador
// ocupou, avatar e nick. Usado no card "Em análise" (AguardandoRevisao) e no
// card "Partida Finalizada" (ResultadoPartida), onde o lado perdedor fica em
// preto e branco e o vencedor em cor (ADR-027).
import { ROLE_CONFIG, type Role } from '../../api/salamod1';

interface CardJogadorProps {
  jogador: any;
  /** Cor da borda e do nick. `null` = preto e branco (lado perdedor). */
  cor?: string | null;
  /** Cor do nick quando não é o time colorido (P&B). */
  corPb?: string;
  /** Borda do avatar quando o time está em cor. */
  avatarBorder?: string;
  /** Aplica grayscale no avatar (lado perdedor). */
  grayscale?: boolean;
  /** Ícone de check à direita (ex.: print enviado). */
  check?: boolean;
  /** Cor da borda do check (estilo VagaSlot). */
  checkCor?: string;
  /** KDA real da partida (Riot), ex.: "7/5/9" — mostrado à direita do nick. */
  kda?: string | null;
}

const clipOuter = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const clipInner = 'polygon(8.6px 0, 100% 0, 100% calc(100% - 8.6px), calc(100% - 8.6px) 100%, 0 100%, 0 8.6px)';

export function CardJogador({
  jogador,
  cor = '#9ca3af',
  corPb = '#9ca3af',
  avatarBorder = 'border-white/15',
  grayscale = false,
  check = false,
  checkCor = '#22c55e',
  kda = null,
}: CardJogadorProps) {
  const role = jogador?.role as Role | undefined;
  const roleImg = ROLE_CONFIG[role ?? 'RES']?.img;
  const corBorda = cor;
  const corNick = cor;

  return (
    <div className="relative p-[1px] overflow-hidden" style={{ backgroundColor: corBorda, clipPath: clipOuter }}>
      <div className="bg-[#050505] px-2 py-1.5 flex items-center gap-2" style={{ clipPath: clipInner }}>
        {/* Ícone da rota que o jogador ocupou */}
        {roleImg ? (
          <img src={roleImg} alt={role} className="w-5 h-5 object-contain brightness-0 invert opacity-70 shrink-0" loading="lazy" />
        ) : (
          <span className="w-5 h-5 rounded bg-white/5 text-white/30 text-[9px] font-black uppercase flex items-center justify-center shrink-0">
            {role || '?'}
          </span>
        )}
        {jogador?.avatar ? (
          <img
            src={jogador.avatar}
            alt={jogador.nome}
            className={`w-6 h-6 rounded-full object-cover shrink-0 border ${grayscale ? 'border-white/15 grayscale' : avatarBorder}`}
            loading="lazy"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
        )}
        <span
          className="flex-1 truncate text-xs font-black uppercase tracking-tight"
          style={{ color: corNick, textShadow: grayscale ? 'none' : `0 0 10px ${corNick}44` }}
        >
          {jogador?.nome || 'Jogador'}
        </span>
        {kda && (
          <span
            className="shrink-0 text-[9px] font-black tabular-nums"
            style={{ color: grayscale ? '#6b7280' : corNick, opacity: 0.85 }}
          >
            {kda}
          </span>
        )}
        {check && (
          <span
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: checkCor, boxShadow: `0 0 8px ${checkCor}88` }}
          >
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
