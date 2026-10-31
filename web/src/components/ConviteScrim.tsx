// Card de campanha no canto da tela: chama o jogador para o scrim.
// Não é modal e não bloqueia a navegação — aparece uma vez por sessão, só no
// Lobby e no /jogar, e pode ser fechado.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CutCard } from './ui/CutCard';

const CHAVE_SESSAO = 'm7:convite-scrim';
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';

function jaMostrouNestaSessao() {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO) === '1';
  } catch {
    // sessionStorage bloqueado (modo privado): mostra de novo.
    return false;
  }
}

function marcarComoMostrado() {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, '1');
  } catch {
    // Sem sessionStorage o card pode reaparecer na próxima navegação.
    return;
  }
}

export default function ConviteScrim() {
  const { user } = useAuth();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);

  const elegivel = !!user && (location.pathname === '/lobby' || location.pathname === '/jogar');

  useEffect(() => {
    if (!elegivel || jaMostrouNestaSessao()) return;
    const timer = setTimeout(() => {
      marcarComoMostrado();
      setAberto(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, [elegivel]);

  // Saiu do Lobby/Jogar (entrou numa sala, por exemplo): some. A sessão já foi
  // marcada quando apareceu, então não volta a incomodar ao retornar.
  useEffect(() => {
    if (!elegivel) setAberto(false);
  }, [elegivel]);

  const fechar = () => {
    marcarComoMostrado();
    setAberto(false);
  };

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0, x: 40, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 40, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[80] pointer-events-none"
          role="complementary"
          aria-label="Convite para jogar scrim na M7"
        >
          {/* Balão da campanha */}
          <CutCard
            borderColor="rgba(255,183,0,0.45)"
            background="#0A0A0A"
            className="pointer-events-auto w-[calc(100vw-24px)] sm:w-[300px] shadow-[0_12px_50px_rgba(0,0,0,0.65)]"
          >
            <div className="relative p-4 sm:p-5">
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar convite de scrim"
                className="absolute top-2 right-2 p-1.5 text-white/35 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFB700] pr-6">Scrim é na M7</p>
              <h3 className="mt-1 font-headline text-lg sm:text-xl font-black uppercase leading-[1.1] text-white">
                MD3 Fearless.<br />Draft integrado.
              </h3>
              <p className="mt-2 text-[11px] sm:text-xs text-white/55 leading-snug">
                Lado sorteado, código do pool e placar da série na tela. O competitivo é aqui.
              </p>
              <Link
                to="/jogar"
                onClick={fechar}
                className="mt-3 flex items-center justify-center gap-2 w-full bg-[#FFB700] hover:bg-[#e0a000] text-black text-[11px] font-black uppercase tracking-[0.15em] py-2.5 transition-colors"
                style={{ clipPath: CUT_BUTTON }}
              >
                Criar scrim <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CutCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
