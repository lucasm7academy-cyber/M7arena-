// src/components/draft/TeamBall.tsx
// ── A BOLA DO TIME (círculo com a logo no fundo) ─────────────────────────────
// Desenho extraído do TeamPanel do draft para ser o MESMO em toda a sequência:
// a bola que o time ocupa no draft, a bola que viaja para o centro no fim do
// draft e a bola da tela de partida/finalizada. Círculo recortado, logo do time
// em `object-cover` de fundo (apagada fora da vez, cheia na vez), borda na cor
// do lado e brilho pulsando quando a bola está ACESA.
//
// O componente é burro: `lado` e `acesa` vêm de fora. Ele não decide turno, não
// lê o draft e não escolhe cor de tema — quem desenha passa a cor do LADO em
// jogo (azul/vermelho), igual ao TeamPanel.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { buildChampionIconUrl } from '../../api/riot';

export interface TeamBallProps {
  /** Logo do time — imagem de fundo da bola. Sem logo, a bola fica preta
   *  (mesmo estado do draft quando o time ainda não tem foto). */
  logo?: string | null;
  /** Lado EM JOGO deste time: manda na cor da borda e do brilho. */
  lado: 'blue' | 'red';
  /**
   * Bola ACESA: borda na cor do lado, logo cheia e brilho pulsando — é o estado
   * "na vez" do draft. Apagada: borda branca fraca e logo a 25%.
   */
  acesa?: boolean;
  /**
   * "Killcam" da última ação confirmada deste lado (ban = P&B + corte;
   * pick = dourado). Só o draft usa; a tela pós-draft passa `null`.
   */
  feedback?: { championId: string; tipo: 'ban' | 'pick'; nonce: number } | null;
  /**
   * Liga esta bola à MESMA bola em outro lugar da tela (motion layoutId): a
   * troca de posição vira o deslize até o centro no fim do draft. Use em UMA
   * bola por lado por vez — o painel do draft solta o id quando a bola do
   * centro entra (prop `saindo` do TeamPanel).
   */
  layoutId?: string;
}

/**
 * Tamanho ÚNICO da bola — o do draft (TeamPanel) e o do hub da sala: no celular
 * em retrato ela ocupa a largura disponível até 150px; em paisagem/desktop,
 * 32vmin quadrados. Quem precisa de outra caixa limita o container, nunca a
 * bola (senão a transição do draft para a tela de partida perde a continuidade).
 */
const TAMANHO =
  'aspect-square w-full max-w-[150px] landscape:aspect-auto landscape:h-[32vmin] landscape:w-[32vmin] landscape:max-w-none';

export function TeamBall({ logo, lado, acesa = false, feedback = null, layoutId }: TeamBallProps) {
  // A cor da VEZ é a cor do LADO (azul/vermelho) — nunca por fase.
  const corLado = lado === 'blue' ? '#3B82F6' : '#ef4444';
  const corLadoClaro = lado === 'blue' ? '#60A5FA' : '#f87171';
  const corLadoRgb = lado === 'blue' ? '59,130,246' : '239,68,68';
  // prefers-reduced-motion: sem pulso. A bola continua acesa (borda + brilho
  // fixos) para não perder a informação de "esta bola está em destaque".
  const reduzirMovimento = useReducedMotion();
  const pulsar = acesa && !reduzirMovimento;

  return (
    <motion.div
      layoutId={layoutId}
      initial={false}
      animate={
        acesa
          ? {
              boxShadow: pulsar
                ? [
                    `0 0 15px rgba(${corLadoRgb},0.3)`,
                    `0 0 32px rgba(${corLadoRgb},0.9)`,
                    `0 0 15px rgba(${corLadoRgb},0.3)`,
                  ]
                : `0 0 18px rgba(${corLadoRgb},0.45)`,
              borderColor: pulsar ? [corLado, corLadoClaro, corLado] : corLado,
            }
          : { boxShadow: '0 0 0px rgba(0,0,0,0)', borderColor: 'rgba(255,255,255,0.1)' }
      }
      transition={
        // O motion usa o MESMO `transition` do componente para a viagem de
        // layout (`layoutId`): por isso o pulso do brilho vai POR PROPRIEDADE e
        // o root fica com a duração da viagem. Com `repeat: Infinity` no root a
        // bola iria e voltaria para sempre em vez de parar no centro.
        pulsar
          ? {
              duration: 0.7,
              ease: 'easeOut',
              boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
              borderColor: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
            }
          : layoutId
            ? { duration: 0.7, ease: 'easeOut' }
            : { duration: 0.3 }
      }
      className={`relative ${TAMANHO} overflow-hidden rounded-full border-[3px] bg-black transition-all duration-300 landscape:border-[0.8vmin] ${
        acesa ? '' : 'border-white/10'
      }`}
      style={acesa ? { borderColor: corLado } : undefined}
    >
      {/* LOGO DO TIME no fundo da bola. Apagada no normal; ACESA (cor cheia)
          quando esta bola está em destaque. */}
      {logo ? (
        <img
          src={logo}
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            acesa ? 'opacity-100' : 'opacity-25'
          }`}
          referrerPolicy="no-referrer"
        />
      ) : null}

      {/* (A prévia/seleção do campeão e o tint azul/vermelho dentro da bola
          saíram por pedido do usuário: a bola fica só com a logo do time e a
          borda acesa na vez.) */}

      {/* "Killcam" da confirmação: quando um ban/pick é CONFIRMADO, o campeão
          pisca NA BOLA do lado que agiu e some sozinho (~2s). Cresce e assenta
          de volta; depois SAI com fade. Ban = desbota de cor para P&B no
          próprio lugar. */}
      <AnimatePresence>
        {feedback ? (
          <motion.div
            key={feedback.nonce}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="absolute inset-0 z-20"
          >
            <motion.img
              src={buildChampionIconUrl(feedback.championId)}
              alt=""
              initial={{ filter: 'grayscale(0) brightness(1)' }}
              animate={{
                scale: [1.25, 1.42, 1.12],
                filter: feedback.tipo === 'ban' ? 'grayscale(1) brightness(0.7)' : 'grayscale(0) brightness(1)',
              }}
              transition={{
                scale: { duration: 0.55, times: [0, 0.28, 1], ease: 'easeOut' },
                filter: feedback.tipo === 'ban' ? { duration: 0.45, ease: 'easeOut', delay: 0.15 } : { duration: 0.1 },
              }}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
