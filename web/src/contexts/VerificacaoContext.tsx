import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { buscarJogadorCompleto } from '../api/riot';
import { supabase } from '../lib/supabase';
import { sincronizarContaRiot } from '../api/player';
import { useAuth } from '../contexts/AuthContext';
import { usePerfilSafe } from './PerfilContext';

interface VerificacaoAtiva {
  id: string;
  riotId: string;
  puuid: string;
  summonerId: string;
  iconeAtual: number;
  iconeEsperado: number;
  nivel: number;
  nickname: string;
  iniciadoEm: number;
  status: 'pendente' | 'verificando' | 'concluido' | 'cancelado';
}

interface VerificacaoContextType {
  verificacaoAtiva: VerificacaoAtiva | null;
  iniciarVerificacao: (dados: Omit<VerificacaoAtiva, 'id' | 'iniciadoEm' | 'status'>) => void;
  cancelarVerificacao: () => void;
  tempoRestante: number | null;
}

const VerificacaoContext = createContext<VerificacaoContextType | undefined>(undefined);

const POLLING_INTERVAL_MS = 30000; // 30 segundos para polling regular
const PRIMEIRO_POLLING_MS = 2000; // 2 segundos para PRIMEIRO check
const TIMEOUT_SEGUNDOS = 240;

export function VerificacaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { refetch: refetchPerfil } = usePerfilSafe();
  const [verificacaoAtiva, setVerificacaoAtiva] = useState<VerificacaoAtiva | null>(null);
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const processandoRef = useRef(false);

  const pararTudo = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => {
    const salva = localStorage.getItem('verificacao_ativa');
    if (salva) {
      try {
        const dados = JSON.parse(salva);
        const tempoPassado = (Date.now() - dados.iniciadoEm) / 1000;

        if (tempoPassado < TIMEOUT_SEGUNDOS && dados.status === 'pendente') {
          setVerificacaoAtiva({ ...dados, status: 'verificando' });
          iniciarPolling({ ...dados, status: 'verificando' });
        } else {
          localStorage.removeItem('verificacao_ativa');
        }
      } catch {
        localStorage.removeItem('verificacao_ativa');
      }
    }

    return () => pararTudo();
  }, []);

  const salvarNoBanco = async (verificacao: VerificacaoAtiva, iconeId: number) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('contas_riot')
        .upsert({
          user_id: user.id,
          riot_id: verificacao.riotId,
          puuid: verificacao.puuid,
          nickname: verificacao.nickname,
          level: verificacao.nivel,
          profile_icon_id: iconeId,
          validado: true,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('❌ Erro ao salvar conta Riot:', error.message, error);
        return false;
      }

      sincronizarContaRiot(verificacao.puuid, user.id).catch(() => {});

      return true;
    } catch (error) {
      console.error('❌ Exceção ao salvar conta Riot:', error);
      return false;
    }
  };

  const iniciarPolling = (verificacao: VerificacaoAtiva) => {
    pararTudo();
    processandoRef.current = false;

    const tempoPassado = (Date.now() - verificacao.iniciadoEm) / 1000;
    const segundosRestantes = Math.max(0, TIMEOUT_SEGUNDOS - tempoPassado);
    setTempoRestante(segundosRestantes);

    timerRef.current = setInterval(() => {
      setTempoRestante(prev => {
        if (prev === null || prev <= 1) {
          pararTudo();
          localStorage.removeItem('verificacao_ativa');
          setVerificacaoAtiva(null);
          setTempoRestante(null);
          window.dispatchEvent(new CustomEvent('verificacao_timeout', {
            detail: { riotId: verificacao.riotId },
          }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // ✅ PRIMEIRO CHECK EM 2 SEGUNDOS (VERIFICAÇÃO INSTANTÂNEA DO ÍCONE)
    const primeiroCheckRef = setTimeout(async () => {
      if (processandoRef.current) return;

      const resultado = await buscarJogadorCompleto(verificacao.riotId);

      if (resultado.success && resultado.data.iconeId === verificacao.iconeEsperado) {
        processandoRef.current = true;
        pararTudo();

        const salvou = await salvarNoBanco(verificacao, resultado.data.iconeId);

        if (salvou) {
          const concluida = { ...verificacao, status: 'concluido' as const };
          setVerificacaoAtiva(concluida);
          localStorage.setItem('verificacao_ativa', JSON.stringify(concluida));

          window.dispatchEvent(new CustomEvent('verificacao_concluida', {
            detail: { riotId: verificacao.riotId },
          }));

          // ✅ Recarrega só os dados do perfil (sem reload da página)
          refetchPerfil();
        } else {
          localStorage.removeItem('verificacao_ativa');
          setVerificacaoAtiva(null);
          setTempoRestante(null);
          window.dispatchEvent(new CustomEvent('verificacao_erro_salvar', {
            detail: { riotId: verificacao.riotId },
          }));
        }
      }
    }, PRIMEIRO_POLLING_MS);

    // ✅ POLLING REGULAR A CADA 30 SEGUNDOS (APÓS O PRIMEIRO CHECK)
    pollingRef.current = setInterval(async () => {
      if (processandoRef.current) return;

      const resultado = await buscarJogadorCompleto(verificacao.riotId);

      if (resultado.success && resultado.data.iconeId === verificacao.iconeEsperado) {
        processandoRef.current = true;
        pararTudo();
        clearTimeout(primeiroCheckRef);

        const salvou = await salvarNoBanco(verificacao, resultado.data.iconeId);

        if (salvou) {
          const concluida = { ...verificacao, status: 'concluido' as const };
          setVerificacaoAtiva(concluida);
          localStorage.setItem('verificacao_ativa', JSON.stringify(concluida));

          window.dispatchEvent(new CustomEvent('verificacao_concluida', {
            detail: { riotId: verificacao.riotId },
          }));

          // ✅ Recarrega só os dados do perfil (sem reload da página)
          refetchPerfil();
        } else {
          localStorage.removeItem('verificacao_ativa');
          setVerificacaoAtiva(null);
          setTempoRestante(null);
          window.dispatchEvent(new CustomEvent('verificacao_erro_salvar', {
            detail: { riotId: verificacao.riotId },
          }));
        }
      }
    }, POLLING_INTERVAL_MS);
  };

  const iniciarVerificacao = (dados: Omit<VerificacaoAtiva, 'id' | 'iniciadoEm' | 'status'>) => {
    const novaVerificacao: VerificacaoAtiva = {
      ...dados,
      id: Date.now().toString(),
      iniciadoEm: Date.now(),
      status: 'pendente',
    };

    setVerificacaoAtiva(novaVerificacao);
    localStorage.setItem('verificacao_ativa', JSON.stringify(novaVerificacao));
    iniciarPolling({ ...novaVerificacao, status: 'verificando' });
  };

  const cancelarVerificacao = () => {
    pararTudo();
    setVerificacaoAtiva(null);
    setTempoRestante(null);
    localStorage.removeItem('verificacao_ativa');
  };

  return (
    <VerificacaoContext.Provider value={{
      verificacaoAtiva,
      iniciarVerificacao,
      cancelarVerificacao,
      tempoRestante,
    }}>
      {children}
    </VerificacaoContext.Provider>
  );
}

export function useVerificacao() {
  const context = useContext(VerificacaoContext);
  if (context === undefined) {
    throw new Error('useVerificacao must be used within a VerificacaoProvider');
  }
  return context;
}