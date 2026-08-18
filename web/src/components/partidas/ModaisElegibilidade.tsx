// src/components/partidas/ModaisElegibilidade.tsx
// Modais da M7 Arena com o estilo cortado (cut-edge) das salas e partidas finalizadas:
// bordas angulares (clip-path chamfered), cores vivas (#FFB700, #3B82F6, #EF4444),
// tipografia Anton/impact nos títulos, sem grades artificiais e 100% fiéis à identidade visual da plataforma.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Wallet,
  ShieldCheck,
  Ban,
  Swords,
  Gamepad2,
  LogIn,
  Plus,
  Lock,
  Trophy,
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import type { ErroElegibilidade } from '../../hooks/useSalaSimples';

const DEPOSIT_EVENT = 'm7:open-deposit';

// ── Polígonos de corte angular oficiais da M7 Arena ──
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_INNER = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_BUTTON = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';

export interface ModalShellProps {
  titulo: string;
  subtitulo?: string;
  badge?: string;
  corBorda?: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}

export function ModalShell({
  titulo,
  subtitulo,
  badge,
  corBorda = '#FFB700',
  icone,
  children,
  onClose,
  maxWidth = 'max-w-md',
}: ModalShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 12, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className={`relative p-[2px] w-full ${maxWidth} shadow-2xl transition-all`}
        style={{
          clipPath: CUT_FRAME,
          background: `linear-gradient(135deg, ${corBorda} 0%, rgba(255,255,255,0.4) 40%, ${corBorda} 70%, color-mix(in srgb, ${corBorda} 30%, #000000) 100%)`,
          boxShadow: `0 0 50px -10px ${corBorda}55, 0 25px 50px -12px rgba(0,0,0,0.9)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Container interno escuro com corte angular */}
        <div
          className="w-full bg-[#09090c] p-5 sm:p-6 relative overflow-hidden"
          style={{ clipPath: CUT_INNER }}
        >
          {/* Luz ambiente discreta no topo */}
          <div
            className="absolute -top-12 -right-12 w-48 h-48 pointer-events-none opacity-25 blur-3xl"
            style={{ background: corBorda }}
          />

          {/* Botão de fechar estilo botão cortado */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className="absolute top-4 right-4 p-[1px] bg-white/20 hover:bg-white/40 transition-colors z-20 cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
            title="Fechar"
            aria-label="Fechar"
          >
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 bg-[#141418] hover:bg-[#202028] flex items-center justify-center text-white/60 hover:text-white transition-colors"
              style={{ clipPath: CUT_BUTTON }}
            >
              <X className="w-4 h-4" />
            </div>
          </motion.button>

          {/* Cabeçalho estilo Partidas Finalizadas */}
          <div className="flex items-center gap-3.5 mb-4 pr-9">
            {icone && (
              <div
                className="relative p-[1px] shrink-0"
                style={{
                  clipPath: CUT_BUTTON,
                  background: `linear-gradient(135deg, ${corBorda}, transparent)`,
                }}
              >
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-[#121217]"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  {icone}
                </div>
              </div>
            )}

            <div className="min-w-0 flex-1">
              {badge && (
                <div className="mb-1">
                  <span
                    className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black"
                    style={{
                      clipPath: CUT_BADGE,
                      background: corBorda,
                    }}
                  >
                    {badge}
                  </span>
                </div>
              )}
              <h2
                className="text-white uppercase tracking-tight text-xl sm:text-2xl leading-none truncate select-none"
                style={{
                  fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  letterSpacing: '0.02em',
                }}
              >
                {titulo}
              </h2>
              {subtitulo && (
                <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mt-1 truncate">
                  {subtitulo}
                </p>
              )}
            </div>
          </div>

          {/* Conteúdo do corpo */}
          <div className="space-y-4">
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export interface ModaisElegibilidadeProps {
  erro: ErroElegibilidade;
  onClose: () => void;
  onAceitarTermos: () => void;
}

export function ModaisElegibilidade({ erro, onClose, onAceitarTermos }: ModaisElegibilidadeProps) {
  const navigate = useNavigate();

  const abrirDeposito = () => {
    onClose();
    window.dispatchEvent(new Event(DEPOSIT_EVENT));
  };

  return (
    <AnimatePresence>
      {/* 1. TERMOS DE USO & DECLARAÇÃO 18+ */}
      {erro?.tipo === 'termos' && (
        <ModalShell
          titulo="Maioridade Obrigatória (18+)"
          badge="Salas Apostadas • MC"
          subtitulo="Declaração para partidas valendo M7 Coins"
          corBorda="#FFB700"
          icone={<ShieldCheck className="w-6 h-6 text-[#FFB700]" />}
          onClose={onClose}
        >
          <div
            className="p-4 bg-[#111116] border border-[#FFB700]/30 space-y-3 relative"
            style={{ clipPath: CUT_BUTTON }}
          >
            <p className="text-white/80 text-xs font-bold leading-relaxed">
              As salas valendo <span className="text-[#FFB700] font-black">M7 Coins (MC)</span> envolvem premiação real e são restritas a maiores de 18 anos.
            </p>

            <div className="space-y-2 pt-2 border-t border-white/10 text-xs font-bold text-white/90">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  18+
                </span>
                <span>Declaro ter <strong>18 anos completos ou mais</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  ✓
                </span>
                <span>Aceito os <strong>Termos de Uso</strong> e as <strong>Regras da Arena</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  ✓
                </span>
                <span>Ciente das regras de <strong>resultado oficial e premiação</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onAceitarTermos}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFFFFF, #FFB700)',
                boxShadow: '0 0 25px -5px rgba(255,183,0,0.5)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON }}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirmar Maior de 18 Anos</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-white/60 hover:text-white bg-[#141419] transition-colors"
                style={{ clipPath: CUT_BUTTON }}
              >
                Cancelar
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 2. SALDO INSUFICIENTE */}
      {erro?.tipo === 'saldo' && (
        <ModalShell
          titulo="Saldo Insuficiente"
          badge="M7 Coins • Carteira"
          subtitulo="Recarregue para entrar na disputa"
          corBorda="#FFB700"
          icone={<GiTwoCoins className="w-7 h-7 text-[#FFB700]" />}
          onClose={onClose}
        >
          <div
            className="p-4 bg-[#111116] border border-[#FFB700]/30 space-y-3 relative"
            style={{ clipPath: CUT_BUTTON }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white/40 text-[10px] uppercase font-black tracking-widest block">Entrada da Sala</span>
                <span className="text-white font-bold text-xs">Valor necessário</span>
              </div>
              <div className="text-right">
                <span className="text-white/40 text-[10px] uppercase font-black tracking-widest block">Faltam</span>
                <span className="text-2xl font-black text-[#FFB700] tracking-tight flex items-center gap-1.5 justify-end">
                  <GiTwoCoins className="w-5 h-5" /> {erro.faltam} MC
                </span>
              </div>
            </div>
            <div className="h-2 bg-black/60 border border-white/10 overflow-hidden" style={{ clipPath: CUT_BADGE }}>
              <div
                className="h-full bg-[#FFB700] shadow-[0_0_10px_rgba(255,183,0,0.6)]"
                style={{ width: `${Math.max(15, Math.min(100, (erro.faltam / 1000) * 100))}%` }}
              />
            </div>
            <p className="text-white/40 text-[10px] uppercase font-black tracking-wider text-center pt-0.5">
              ⚡ Recarga instantânea via PIX • Crédito na hora
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={abrirDeposito}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFFFFF, #FFB700)',
                boxShadow: '0 0 25px -5px rgba(255,183,0,0.5)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON }}
              >
                <Wallet className="w-4 h-4" />
                <span>Recarregar MC via PIX</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-white/60 hover:text-white bg-[#141419] transition-colors"
                style={{ clipPath: CUT_BUTTON }}
              >
                Depois
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 3. VOCÊ JÁ ESTÁ EM OUTRA SALA */}
      {erro?.tipo === 'outra_sala' && (
        <ModalShell
          titulo="Você Já Está em Uma Sala"
          badge="Partida Ativa"
          subtitulo="Limite de uma sala apostada por vez"
          corBorda="#3b82f6"
          icone={<Swords className="w-6 h-6 text-blue-400" />}
          onClose={onClose}
        >
          <div
            className="p-4 bg-[#09111e] border border-blue-500/40 space-y-3 relative"
            style={{ clipPath: CUT_BUTTON }}
          >
            <p className="text-white/80 text-xs font-bold leading-relaxed">
              Você só pode participar de <strong className="text-white">uma sala apostada ativa por vez</strong>. Sua vaga e seu MC estão protegidos na sala:
            </p>
            <div className="p-3 bg-black/60 border border-blue-500/30 flex items-center justify-between" style={{ clipPath: CUT_BADGE }}>
              <span className="text-white/50 text-xs uppercase font-black tracking-wider">Sala Ativa</span>
              <span className="text-blue-400 font-black text-sm font-mono">#{String(erro.salaNum).padStart(6, '0')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onClose();
                navigate(`/${erro.modo || '5v5'}/${erro.salaNum}`);
              }}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #3b82f6, #60a5fa, #3b82f6)',
                boxShadow: '0 0 25px -5px rgba(59,130,246,0.5)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all"
                style={{ clipPath: CUT_BUTTON }}
              >
                <Swords className="w-4 h-4" />
                <span>Ir Para Minha Sala #{String(erro.salaNum).padStart(6, '0')}</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-white/60 hover:text-white bg-[#141419] transition-colors"
                style={{ clipPath: CUT_BUTTON }}
              >
                Fechar
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 4. RIOT ID OBRIGATÓRIO */}
      {erro?.tipo === 'riot_id' && (
        <ModalVincularConta
          onClose={onClose}
          motivo="Esta sala vale MC. Vincule seu Riot ID (Nick #TAG) para jogar — é ele que valida sua elegibilidade e amarra o resultado oficial ao seu perfil."
        />
      )}

      {/* 5. CONTA BANIDA */}
      {erro?.tipo === 'banida' && (
        <ModalShell
          titulo="Acesso Restrito"
          badge="Conta Suspensa"
          subtitulo="Restrição ativa de participação"
          corBorda="#ef4444"
          icone={<Ban className="w-6 h-6 text-red-500" />}
          onClose={onClose}
        >
          <div
            className="p-4 bg-[#1a0a0c] border border-red-500/40 space-y-3 relative"
            style={{ clipPath: CUT_BUTTON }}
          >
            <p className="text-white/80 text-xs font-bold leading-relaxed">
              Sua conta está impossibilitada de entrar em partidas. Se você acredita que isso foi um equívoco, consulte as regras ou solicite suporte.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-red-300 bg-[#160608] transition-colors"
                style={{ clipPath: CUT_BUTTON }}
              >
                Entendido
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

/**
 * Modal de login / cadastro para visitantes que tentam entrar em salas
 * ou criar partidas a partir da vitrine pública.
 */
export function ModalLoginVitrine({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <ModalShell
      titulo="Crie Sua Conta Para Jogar"
      badge="Vitrine M7 Arena"
      subtitulo="Entre na disputa por premiações em MC"
      corBorda="#FFB700"
      icone={<Trophy className="w-6 h-6 text-[#FFB700]" />}
      onClose={onClose}
    >
      <div
        className="p-4 bg-[#111116] border border-[#FFB700]/30 space-y-3 relative"
        style={{ clipPath: CUT_BUTTON }}
      >
        <p className="text-white/80 text-xs font-bold leading-relaxed">
          As salas valendo <span className="text-[#FFB700] font-black">MC</span> são a vitrine da arena. Crie sua conta grátis e ocupe uma vaga antes que a sala encha.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div
            className="px-3 py-2 bg-black/60 border border-white/10 flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider"
            style={{ clipPath: CUT_BADGE }}
          >
            <span className="text-[#FFB700]">⚡</span> 100% Grátis
          </div>
          <div
            className="px-3 py-2 bg-black/60 border border-white/10 flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider"
            style={{ clipPath: CUT_BADGE }}
          >
            <GiTwoCoins className="text-[#FFB700] w-3.5 h-3.5 shrink-0" /> Prêmios MC
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full relative p-[1px] cursor-pointer shadow-lg"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #FFB700, #FFFFFF, #FFB700)',
            boxShadow: '0 0 25px -5px rgba(255,183,0,0.5)',
          }}
        >
          <div
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
            style={{ clipPath: CUT_BUTTON }}
          >
            <Plus className="w-4 h-4" />
            <span>Criar Conta Gratuita</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-white hover:text-white bg-[#18181f] transition-colors"
            style={{ clipPath: CUT_BUTTON }}
          >
            <LogIn className="w-4 h-4" />
            <span>Já Tenho Conta — Entrar</span>
          </div>
        </motion.button>

        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/70 text-[11px] font-black uppercase tracking-widest text-center pt-1 transition-colors cursor-pointer"
        >
          Continuar assistindo como visitante
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * Modal de aviso de vínculo de conta Riot Games (Riot ID).
 */
export function ModalVincularConta({ onClose, motivo }: { onClose: () => void; motivo?: string }) {
  const navigate = useNavigate();

  return (
    <ModalShell
      titulo="Vincule Sua Conta Riot"
      badge="Riot Games • Vínculo"
      subtitulo="Conecte seu Nick #TAG para disputar partidas"
      corBorda="#3b82f6"
      icone={<Gamepad2 className="w-6 h-6 text-blue-400" />}
      onClose={onClose}
    >
      <div
        className="p-4 bg-[#09111e] border border-blue-500/40 space-y-3 relative"
        style={{ clipPath: CUT_BUTTON }}
      >
        <p className="text-white/80 text-xs font-bold leading-relaxed">
          {motivo || 'Para criar sala e participar das partidas valendo MC, você precisa vincular sua conta Riot.'}
        </p>

        <div className="space-y-2 pt-2 border-t border-white/10 text-xs font-bold text-white/90">
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Sincronização oficial de <strong>Elo e Liga no LoL</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Geração de <strong>códigos de partida oficiais</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Validação de prints e <strong>recebimento de MC</strong></span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/vincular');
          }}
          className="w-full relative p-[1px] cursor-pointer shadow-lg"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #3b82f6, #60a5fa, #3b82f6)',
            boxShadow: '0 0 25px -5px rgba(59,130,246,0.5)',
          }}
        >
          <div
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all"
            style={{ clipPath: CUT_BUTTON }}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Vincular Conta Riot</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-white/60 hover:text-white bg-[#141419] transition-colors"
            style={{ clipPath: CUT_BUTTON }}
          >
            Agora não
          </div>
        </motion.button>
      </div>
    </ModalShell>
  );
}

/**
 * Modal para digitar senha de sala privada.
 */
export function ModalSenhaSala({
  nome,
  onClose,
  onConfirm,
  erro,
}: {
  nome: string;
  onClose: () => void;
  onConfirm: (senha: string) => void;
  erro?: string;
}) {
  const [senha, setSenha] = useState('');

  return (
    <ModalShell
      titulo="Sala Privada"
      badge="Acesso Protegido"
      subtitulo={`Digite a senha para entrar em ${nome}`}
      corBorda="#FFB700"
      icone={<Lock className="w-6 h-6 text-[#FFB700]" />}
      onClose={onClose}
    >
      <div
        className="p-4 bg-[#111116] border border-[#FFB700]/30 space-y-3 relative"
        style={{ clipPath: CUT_BUTTON }}
      >
        <div className="space-y-1.5">
          <label className="text-white/40 text-[10px] uppercase font-black tracking-widest block">
            Senha da Sala
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha da partida"
            className="w-full bg-black/60 border border-white/15 p-3 text-white text-sm focus:outline-none focus:border-[#FFB700] transition-all placeholder:text-white/20 font-mono"
            style={{ clipPath: CUT_BADGE }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && senha) {
                onConfirm(senha);
              }
            }}
          />
        </div>
        {erro && <p className="text-red-400 text-xs font-black uppercase tracking-wider">{erro}</p>}
      </div>

      <div className="flex gap-3 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="flex-1 relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-4 flex items-center justify-center font-black text-xs uppercase tracking-widest text-white/60 hover:text-white bg-[#141419] transition-colors"
            style={{ clipPath: CUT_BUTTON }}
          >
            Cancelar
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onConfirm(senha)}
          disabled={!senha}
          className="flex-1 relative p-[1px] cursor-pointer disabled:opacity-50"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #FFB700, #FFFFFF, #FFB700)',
          }}
        >
          <div
            className="w-full py-3 px-4 flex items-center justify-center font-black text-xs uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
            style={{ clipPath: CUT_BUTTON }}
          >
            Entrar na Sala
          </div>
        </motion.button>
      </div>
    </ModalShell>
  );
}
