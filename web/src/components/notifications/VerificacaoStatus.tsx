import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVerificacao } from '../../contexts/VerificacaoContext';
import { Loader2, XCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function VerificacaoStatus() {
  const { verificacaoAtiva, cancelarVerificacao, tempoRestante } = useVerificacao();
  const navigate = useNavigate();
  const [falha, setFalha] = useState<{ tipo: 'timeout' | 'erro'; riotId: string } | null>(null);

  useEffect(() => {
    const handleTimeout = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFalha({ tipo: 'timeout', riotId: detail?.riotId ?? '' });
      setTimeout(() => setFalha(null), 6000);
    };

    const handleErro = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFalha({ tipo: 'erro', riotId: detail?.riotId ?? '' });
      setTimeout(() => setFalha(null), 6000);
    };

    window.addEventListener('verificacao_timeout', handleTimeout);
    window.addEventListener('verificacao_erro_salvar', handleErro);
    return () => {
      window.removeEventListener('verificacao_timeout', handleTimeout);
      window.removeEventListener('verificacao_erro_salvar', handleErro);
    };
  }, []);

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isConcluido = verificacaoAtiva?.status === 'concluido';
  const isCancelado = verificacaoAtiva?.status === 'cancelado';
  const isVerificando = verificacaoAtiva?.status === 'verificando';

  const mostrar = (verificacaoAtiva && !isCancelado) || falha;

  return createPortal(
    <AnimatePresence>
      {mostrar && (
        <motion.div
          key={falha ? `falha-${falha.tipo}` : 'verificando'}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          onClick={() => !falha && navigate('/vincular')}
          className={`fixed bottom-4 right-4 ${!falha ? 'cursor-pointer' : ''}`}
          style={{ pointerEvents: 'auto', zIndex: 2147483647 }}
        >
          <div className={`bg-black/90 backdrop-blur-lg rounded-xl border shadow-lg p-4 min-w-[280px] ${
            falha
              ? 'border-red-500/50'
              : isConcluido
              ? 'border-green-500/50'
              : 'border-primary/30'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                falha ? 'bg-red-500/20' : isConcluido ? 'bg-green-500/20' : 'bg-primary/20'
              }`}>
                {falha ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : isConcluido ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-white font-bold text-sm">
                  {falha
                    ? falha.tipo === 'timeout'
                      ? 'Verificação expirou'
                      : 'Falha ao vincular'
                    : isConcluido
                    ? 'Conta Verificada!'
                    : 'Verificando conta'}
                </p>
                <p className="text-white/60 text-xs font-mono">
                  {falha ? falha.riotId : verificacaoAtiva?.riotId}
                </p>

                {falha && (
                  <p className="text-red-400 text-xs mt-1">
                    {falha.tipo === 'timeout'
                      ? 'Tempo esgotado. Tente vincular novamente.'
                      : 'Erro ao salvar. Tente vincular novamente.'}
                  </p>
                )}

                {isConcluido && (
                  <p className="text-green-400 text-xs mt-1">Vinculada com sucesso!</p>
                )}

                {isVerificando && tempoRestante !== null && (
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-primary" />
                    <span className="text-primary text-xs font-mono">
                      {formatarTempo(tempoRestante)}
                    </span>
                  </div>
                )}

                {isVerificando && (
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelarVerificacao(); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cancelar verificação
                  </button>
                )}
              </div>

              {isVerificando && (
                <button
                  onClick={(e) => { e.stopPropagation(); cancelarVerificacao(); }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}

              {falha && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFalha(null); }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default VerificacaoStatus;
