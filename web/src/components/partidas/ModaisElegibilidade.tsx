// src/components/partidas/ModaisElegibilidade.tsx
// Modais de entrada em salas apostadas (design v3 §11 / ADR-033): saldo
// insuficiente, "você já está em outra sala", Riot ID obrigatório, termos 18+
// e conta banida. Seguem o tema visual supremo da M7 Arena (fundos escuros
// + borda dourada #FFB700 + iluminação ambiente).

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Wallet,
  AlertTriangle,
  LinkIcon,
  ShieldCheck,
  Ban,
  Coins,
  Swords,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  LogIn,
  Plus,
  Lock,
  Trophy,
} from 'lucide-react';
import GoldEssenceIcon from '../icons/GoldEssenceIcon';
import type { ErroElegibilidade } from '../../hooks/useSalaSimples';

const DEPOSIT_EVENT = 'm7:open-deposit';

export interface ModalShellProps {
  titulo: string;
  subtitulo?: string;
  badge?: string;
  corGlow?: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}

export function ModalShell({
  titulo,
  subtitulo,
  badge,
  corGlow = '#FFB700',
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
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className={`relative w-full ${maxWidth} rounded-3xl overflow-hidden bg-[#0a0a0c] border`}
        style={{
          borderColor: `${corGlow}35`,
          boxShadow: `0 0 80px -10px ${corGlow}30, 0 25px 70px rgba(0,0,0,0.9)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-[100px] pointer-events-none opacity-20"
            style={{ background: corGlow }}
          />
          <div
            className="absolute -bottom-24 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-10"
            style={{ background: corGlow }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(${corGlow} 1px, transparent 1px), linear-gradient(90deg, ${corGlow} 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Top neon accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${corGlow}, transparent)` }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white transition-all flex items-center justify-center cursor-pointer backdrop-blur-sm"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* Header content */}
        <div className="relative z-10 pt-7 px-6 pb-2 text-center flex flex-col items-center">
          {icone && (
            <div className="relative mb-3.5">
              <div
                className="absolute inset-0 rounded-2xl blur-lg opacity-40 animate-pulse"
                style={{ background: corGlow }}
              />
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${corGlow}25, ${corGlow}08)`,
                  borderColor: `${corGlow}50`,
                }}
              >
                {icone}
              </div>
            </div>
          )}

          {badge && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2"
              style={{
                background: `${corGlow}15`,
                border: `1px solid ${corGlow}35`,
                color: corGlow,
              }}
            >
              <Sparkles className="w-3 h-3" />
              <span>{badge}</span>
            </div>
          )}

          <h2 className="text-white font-black text-xl uppercase tracking-tight leading-tight">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="text-white/60 text-xs mt-1 leading-relaxed max-w-xs">
              {subtitulo}
            </p>
          )}
        </div>

        {/* Body content */}
        <div className="relative z-10 p-6 pt-3 space-y-4">
          {children}
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
          titulo="Confirmação de Maioridade"
          badge="Salas Apostadas • 18+"
          subtitulo="Declaração legal obrigatória para partidas valendo MC"
          corGlow="#FFB700"
          icone={
            <div className="relative flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#FFB700]" />
              <span className="absolute -bottom-1 -right-2 px-1 py-0.2 bg-[#FFB700] text-black text-[9px] font-black rounded-sm shadow-sm">18+</span>
            </div>
          }
          onClose={onClose}
        >
          <div className="rounded-2xl bg-gradient-to-b from-[#FFB700]/10 to-[#FFB700]/[0.02] border border-[#FFB700]/25 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFB700]/20 border border-[#FFB700]/40 flex items-center justify-center shrink-0 text-[#FFB700] font-black text-xs">
                18+
              </div>
              <div>
                <h4 className="text-white font-black text-sm uppercase tracking-tight">Valendo Premiação em MC</h4>
                <p className="text-white/70 text-xs mt-0.5 leading-relaxed">
                  As partidas competitivas valendo M7 Coins (MC) são exclusivas para maiores de 18 anos.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 text-xs text-white/80">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#FFB700]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#FFB700]" />
                </div>
                <span>Declaro ter <strong>18 anos de idade completos ou mais</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#FFB700]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#FFB700]" />
                </div>
                <span>Aceito os <strong>Termos de Uso</strong> e <strong>Políticas da M7 Arena</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#FFB700]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#FFB700]" />
                </div>
                <span>Ciente das regras de <strong>resultado oficial e premiação</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={onAceitarTermos}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#FFB700] via-[#FFC837] to-[#FFA000] text-black text-sm font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(255,183,0,0.35)] flex items-center justify-center gap-2 group cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Confirmar (Sou Maior de 18 Anos)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Voltar / Cancelar
            </button>
          </div>
        </ModalShell>
      )}

      {/* 2. SALDO INSUFICIENTE */}
      {erro?.tipo === 'saldo' && (
        <ModalShell
          titulo="Saldo Insuficiente"
          badge="M7 Coins • Carteira"
          subtitulo="Você precisa de mais MC para entrar nesta disputa"
          corGlow="#FFB700"
          icone={<GoldEssenceIcon size={32} />}
          onClose={onClose}
        >
          <div className="rounded-2xl bg-gradient-to-b from-[#FFB700]/10 to-[#FFB700]/[0.02] border border-[#FFB700]/25 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest block">MC Necessários</span>
                <span className="text-white font-bold text-xs">Para garantir sua vaga</span>
              </div>
              <div className="text-right">
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest block">Faltam</span>
                <span className="text-2xl font-black text-[#FFB700] tracking-tight drop-shadow-[0_0_12px_rgba(255,183,0,0.4)] flex items-center gap-1.5 justify-end">
                  <GoldEssenceIcon size={18} /> {erro.faltam} MC
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-black/40 border border-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FFB700] to-[#FFA000] shadow-[0_0_10px_rgba(255,183,0,0.5)] transition-all duration-500"
                style={{ width: `${Math.max(12, Math.min(100, (erro.faltam / 1000) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1">
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#FFB700]" /> PIX Instantâneo</span>
              <span>Liberação imediata em segundos</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={abrirDeposito}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#FFB700] via-[#FFC837] to-[#FFA000] text-black text-sm font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(255,183,0,0.35)] flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Recarregar MC via PIX</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Depois
            </button>
          </div>
        </ModalShell>
      )}

      {/* 3. VOCÊ JÁ ESTÁ EM OUTRA SALA */}
      {erro?.tipo === 'outra_sala' && (
        <ModalShell
          titulo="Você Já Está em Uma Sala"
          badge="Partida em Andamento"
          subtitulo="Você só pode disputar uma sala apostada por vez"
          corGlow="#3b82f6"
          icone={<Swords className="w-8 h-8 text-blue-400" />}
          onClose={onClose}
        >
          <div className="rounded-2xl bg-gradient-to-b from-blue-500/10 to-blue-500/[0.02] border border-blue-500/25 p-4 space-y-3">
            <p className="text-white/70 text-xs leading-relaxed">
              Você só pode estar em <strong className="text-white">uma sala apostada ativa</strong>. Sua vaga e seus MC estão garantidos e seguros na sala abaixo:
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
              <span className="text-white/50 text-xs uppercase font-bold tracking-wider">Sua Sala Ativa</span>
              <span className="text-blue-400 font-black text-sm font-mono">#{String(erro.salaNum).padStart(6, '0')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => {
                onClose();
                navigate(`/${erro.modo || '5v5'}/${erro.salaNum}`);
              }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(59,130,246,0.35)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Ir Para Minha Sala #{String(erro.salaNum).padStart(6, '0')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Fechar
            </button>
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
          subtitulo="Sua conta possui restrições ativas para entrar em partidas"
          corGlow="#ef4444"
          icone={<Ban className="w-8 h-8 text-red-500" />}
          onClose={onClose}
        >
          <div className="rounded-2xl bg-gradient-to-b from-red-500/10 to-red-500/[0.02] border border-red-500/25 p-4.5 space-y-3">
            <p className="text-white/70 text-xs leading-relaxed">
              Sua conta está impossibilitada de entrar em partidas casuais e apostadas. Se você acredita que isso foi um equívoco, consulte as diretrizes ou fale com nosso suporte.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Entendido
            </button>
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
      titulo="Crie sua conta para jogar"
      badge="Vitrine M7 Arena"
      subtitulo="A vitrine oficial dos melhores confrontos valendo premiações"
      corGlow="#FFB700"
      icone={<Trophy className="w-8 h-8 text-[#FFB700]" />}
      onClose={onClose}
    >
      <div className="rounded-2xl bg-gradient-to-b from-[#FFB700]/10 to-[#FFB700]/[0.02] border border-[#FFB700]/25 p-4.5 space-y-3">
        <p className="text-white/80 text-xs leading-relaxed">
          As salas valendo <span className="text-[#FFB700] font-black">MC</span> são a vitrine da arena. Crie sua conta grátis em menos de 1 minuto e ocupe sua vaga antes que a sala encha!
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2 text-xs text-white/80">
            <Sparkles className="w-3.5 h-3.5 text-[#FFB700] shrink-0" />
            <span className="font-bold">100% Gratuito</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2 text-xs text-white/80">
            <Coins className="w-3.5 h-3.5 text-[#FFB700] shrink-0" />
            <span className="font-bold">Premiações MC</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <button
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#FFB700] via-[#FFC837] to-[#FFA000] text-black text-sm font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(255,183,0,0.35)] flex items-center justify-center gap-2 group cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Conta Gratuita</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Já Tenho Conta — Entrar</span>
        </button>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/70 text-[11px] font-bold uppercase tracking-wider text-center pt-1 transition-colors cursor-pointer"
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
      titulo="Vincule sua Conta Riot"
      badge="Riot Games • Vínculo"
      subtitulo="Conecte seu Riot ID oficial (Nick #TAG) para jogar"
      corGlow="#38bdf8"
      icone={<Gamepad2 className="w-8 h-8 text-sky-400" />}
      onClose={onClose}
    >
      <div className="rounded-2xl bg-gradient-to-b from-sky-500/10 to-sky-500/[0.02] border border-sky-500/25 p-4.5 space-y-3">
        <p className="text-white/80 text-xs leading-relaxed">
          {motivo || 'Para criar salas, entrar nas vagas e disputar partidas valendo premiações em MC, você precisa vincular sua conta Riot.'}
        </p>

        <div className="space-y-2 pt-1 text-xs text-white/80">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 text-sky-400" />
            </div>
            <span>Sincronização automática do seu <strong>Elo no League of Legends</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 text-sky-400" />
            </div>
            <span>Entrada em salas e <strong>códigos de torneio oficiais</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 text-sky-400" />
            </div>
            <span>Validação de prints e <strong>recebimento de MC</strong></span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <button
          onClick={() => {
            onClose();
            navigate('/vincular');
          }}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-600 text-black text-sm font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(56,189,248,0.35)] flex items-center justify-center gap-2 group cursor-pointer"
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Vincular Conta Riot Agora</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          Agora não
        </button>
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
      corGlow="#FFB700"
      icone={<Lock className="w-8 h-8 text-[#FFB700]" />}
      onClose={onClose}
    >
      <div className="rounded-2xl bg-gradient-to-b from-[#FFB700]/10 to-[#FFB700]/[0.02] border border-[#FFB700]/25 p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-white/40 text-[10px] uppercase font-bold tracking-widest block">
            Senha da Sala
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha da partida"
            className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-[#FFB700] focus:ring-1 focus:ring-[#FFB700]/50 transition-all placeholder:text-white/20"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && senha) {
                onConfirm(senha);
              }
            }}
          />
        </div>
        {erro && <p className="text-red-400 text-xs font-bold">{erro}</p>}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(senha)}
          disabled={!senha}
          className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#FFB700] to-[#FFA000] disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_25px_rgba(255,183,0,0.3)] cursor-pointer"
        >
          Entrar na Sala
        </button>
      </div>
    </ModalShell>
  );
}
