// Orquestra uma mesa da Sala M7: buy-in, abertura de mão, turnos dos bots e
// cashout. O estado do motor é mutável de propósito — vive em `estadoRef` e a
// tela é forçada a redesenhar por um contador de versão (sem clonar por frame).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { usePerfil } from '../../../../contexts/PerfilContext';
import { api } from '../../../../lib/api';
import {
  act,
  botAction,
  createTable,
  DEFAULT_BOTS,
  legalActions,
  potTotal,
  startHand,
  type Action,
  type LegalActions,
  type PokerState,
  type Seat,
} from '../domain/engine';
import type { PokerRoom } from '../domain/lobby-data';

export type PokerPhase = 'login' | 'carregando' | 'sem-saldo' | 'erro' | 'mesa';

export interface ResultadoSaque {
  ok: boolean;
  payout: number;
  /** Sessão já estava fechada no servidor (resposta perdida, cashout repetido). */
  jaEncerrada?: boolean;
}

const MENSAGENS: Record<string, string> = {
  saldo_insuficiente: 'Saldo de essência insuficiente para este buy-in.',
  ea_insuficiente: 'Saldo de essência insuficiente para este buy-in.',
  insuficiente: 'Saldo de essência insuficiente para este buy-in.',
  nao_autenticado: 'Sua sessão expirou. Entre novamente para sentar na mesa.',
  nao_autorizado: 'Sua sessão expirou. Entre novamente para sentar na mesa.',
  mesa_cheia: 'Esta mesa lotou. Escolha outra sala.',
  mesa_lotada: 'Esta mesa lotou. Escolha outra sala.',
  mesa_invalida: 'Esta mesa não está mais disponível.',
  sessao_ativa: 'Você já tem uma mesa aberta. Saia dela antes de entrar em outra.',
  sessao_nao_encontrada: 'Sua sessão de mesa não existe mais. Entre de novo.',
  sessao_invalida: 'Sua sessão de mesa não existe mais. Entre de novo.',
  sessao_encerrada: 'Esta sessão de mesa já foi encerrada.',
  sala_invalida: 'Esta mesa não está mais disponível.',
  valor_invalido: 'O valor informado para esta mesa é inválido.',
  falha_rede: 'Falha de conexão. Confira sua internet e tente de novo.',
  senha_incorreta: 'Senha incorreta. Volte às mesas e tente novamente.',
  senha_invalida: 'Senha incorreta. Volte às mesas e tente novamente.',
};

/** Código devolvido pela API (`data.erro`) para a chave interna, quando existe. */
function codigoConhecido(codigo?: string): string | null {
  if (!codigo) return null;
  const chave = String(codigo).toLowerCase().trim();
  if (MENSAGENS[chave]) return chave;
  if (chave.includes('saldo') || chave.includes('funds')) return 'saldo_insuficiente';
  return null;
}

function mensagemErro(codigo?: string): string {
  const chave = codigoConhecido(codigo);
  if (chave) return MENSAGENS[chave];
  return 'Não foi possível completar a operação da mesa. Tente de novo.';
}

export interface UsePokerRoom {
  fase: PokerPhase;
  mensagem: string | null;
  falta: number;
  ea: number | null;
  sessaoId: string | null;
  estado: PokerState | null;
  heroi: Seat | null;
  versao: number;
  pote: number;
  legal: LegalActions | null;
  ehVezDoHeroi: boolean;
  maoEncerrada: boolean;
  emJogo: boolean;
  sacando: boolean;
  erroSaque: string | null;
  nomeHeroi: string;
  novaMao: () => void;
  agir: (acao: Action) => void;
  sacar: () => Promise<ResultadoSaque>;
  tentarDeNovo: () => void;
}

export function usePokerRoom(room: PokerRoom, password?: string): UsePokerRoom {
  const { user } = useAuth();
  const { perfil } = usePerfil();

  const { id: roomId, buyIn, sb, bb, seats: lugares } = room;

  const estadoRef = useRef<PokerState | null>(null);
  const [versao, setVersao] = useState(0);
  const [fase, setFase] = useState<PokerPhase>('carregando');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);
  const [ea, setEa] = useState<number | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [sacando, setSacando] = useState(false);
  const [erroSaque, setErroSaque] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const bootKeyRef = useRef<string | null>(null);
  const sacandoRef = useRef(false);

  const bump = useCallback(() => setVersao((v) => v + 1), []);
  const gravar = useCallback(
    (novo: PokerState) => {
      estadoRef.current = novo;
      bump();
    },
    [bump],
  );

  const nomeHeroi = perfil?.nome?.trim() || user?.email?.split('@')[0] || 'Você';
  const iniciaisHeroi =
    nomeHeroi
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase() || 'M7';

  const bots = useMemo(() => (DEFAULT_BOTS ?? []).slice(0, Math.max(1, lugares - 1)), [lugares]);

  /* ---------------- buy-in ---------------- */

  useEffect(() => {
    if (!user) {
      setFase('login');
      return;
    }

    const chave = `${user.id}:${roomId}`;
    if (bootKeyRef.current === chave) return;
    bootKeyRef.current = chave;

    // Sem flag de cancelamento: em StrictMode o efeito roda duas vezes e a
    // segunda encontra a chave já tomada. Abortar a primeira deixaria a mesa
    // presa em "carregando"; setState após desmontagem é ignorado pelo React.
    const entrar = async () => {
      setFase('carregando');
      setMensagem(null);
      setFalta(0);

      // Saldo primeiro: sem essência, a entrada é bloqueada com o valor que falta.
      let saldo: number | null = null;
      try {
        const carteira = await api.wallet.balance();
        saldo = typeof carteira?.ea === 'number' ? carteira.ea : null;
        setEa(saldo);
      } catch {
        // Sem leitura do saldo seguimos para o buy-in: o servidor é a autoridade.
      }

      if (saldo !== null && saldo < buyIn) {
        setFalta(buyIn - saldo);
        setFase('sem-saldo');
        return;
      }

      try {
        const resposta = await api.poker.buyIn(roomId, buyIn, password);

        if (!resposta?.ok || !resposta.sessionId) {
          if (typeof resposta?.ea === 'number') {
            setEa(resposta.ea);
            setFalta(Math.max(0, buyIn - resposta.ea));
          } else if (saldo !== null) {
            setFalta(Math.max(0, buyIn - saldo));
          }
          setMensagem(mensagemErro(resposta?.erro));
          setFase(
            resposta?.erro === 'saldo_insuficiente' || resposta?.erro === 'ea_insuficiente'
              ? 'sem-saldo'
              : 'erro',
          );
          return;
        }

        setSessaoId(resposta.sessionId);
        if (typeof resposta.ea === 'number') setEa(resposta.ea);

        const mesa = createTable({
          heroName: nomeHeroi,
          heroAvatar: iniciaisHeroi,
          bots,
          stack: buyIn === 0 ? bb * 100 : buyIn,
          sb,
          bb,
        });

        gravar(startHand(mesa));
        setFase('mesa');
      } catch (erro) {
        const chave = codigoConhecido(erro instanceof Error ? erro.message : undefined);

        if (chave === 'saldo_insuficiente') {
          // O servidor recusou por saldo: busca o valor atual para dizer quanto falta.
          try {
            const carteira = await api.wallet.balance();
            const atual = typeof carteira?.ea === 'number' ? carteira.ea : null;
            setEa(atual);
            if (atual !== null) setFalta(Math.max(0, buyIn - atual));
          } catch {
            /* mantém a recusa do servidor */
          }
          setMensagem(MENSAGENS.saldo_insuficiente);
          setFase('sem-saldo');
          return;
        }

        setMensagem(
          erro instanceof TypeError ? MENSAGENS.falha_rede : mensagemErro(chave ?? undefined),
        );
        setFase('erro');
      }
    };

    void entrar();
    // A chave já trava repetições; `tentativa` permite o botão de tentar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, tentativa, password]);

  /* ---------------- turnos dos bots ---------------- */

  useEffect(() => {
    if (fase !== 'mesa') return;
    const estado = estadoRef.current;
    if (!estado || estado.actor < 0) return;

    const assento = estado.seats[estado.actor];
    if (!assento || !assento.bot) return;

    const alvo = estado.actor;
    const mao = estado.handNo;
    const atraso = 620 + Math.random() * 760;

    const timer = window.setTimeout(() => {
      const atual = estadoRef.current;
      if (!atual || atual.handNo !== mao || atual.actor !== alvo) return;
      const atualAssento = atual.seats[alvo];
      if (!atualAssento?.bot) return;
      gravar(act(atual, botAction(atual, alvo)));
    }, atraso);

    // O cleanup cobre troca de versão e desmontagem: nenhum timer sobra.
    return () => window.clearTimeout(timer);
  }, [versao, fase, gravar]);

  /* ---------------- ações ---------------- */

  const novaMao = useCallback(() => {
    const estado = estadoRef.current;
    if (!estado) return;
    if (estado.street !== 'complete') return;
    const heroi = estado.seats.find((s) => s.isHero);
    if (!heroi || heroi.stack <= 0) return;
    gravar(startHand(estado));
  }, [gravar]);

  const agir = useCallback(
    (acao: Action) => {
      const estado = estadoRef.current;
      if (!estado || estado.actor < 0) return;
      if (!estado.seats[estado.actor]?.isHero) return;
      gravar(act(estado, acao));
    },
    [gravar],
  );

  const sacar = useCallback(async (): Promise<ResultadoSaque> => {
    if (!sessaoId || sacandoRef.current) return { ok: false, payout: 0 };

    const estado = estadoRef.current;
    const heroi = estado?.seats.find((s) => s.isHero);
    const stack = Math.max(0, Math.round(heroi?.stack ?? 0));

    sacandoRef.current = true;
    setSacando(true);
    setErroSaque(null);

    try {
      const resposta = await api.poker.cashOut(sessaoId, stack);
      if (!resposta?.ok) {
        setErroSaque(mensagemErro(resposta?.erro));
        return { ok: false, payout: 0 };
      }
      if (typeof resposta.ea === 'number') setEa(resposta.ea);
      setSessaoId(null);
      return { ok: true, payout: resposta.payout ?? stack };
    } catch (erro) {
      const chave = codigoConhecido(erro instanceof Error ? erro.message : undefined);

      // Sessão já fechada no servidor (resposta perdida ou cashout repetido):
      // nada foi creditado de novo, mas a mesa não pode continuar aberta aqui.
      if (chave === 'sessao_encerrada' || chave === 'sessao_nao_encontrada') {
        setSessaoId(null);
        return { ok: true, payout: 0, jaEncerrada: true };
      }

      setErroSaque(
        erro instanceof TypeError ? MENSAGENS.falha_rede : mensagemErro(chave ?? undefined),
      );
      return { ok: false, payout: 0 };
    } finally {
      sacandoRef.current = false;
      setSacando(false);
    }
  }, [sessaoId]);

  const tentarDeNovo = useCallback(() => {
    bootKeyRef.current = null;
    setTentativa((t) => t + 1);
  }, []);

  /* ---------------- derivados ---------------- */

  const estado = estadoRef.current;
  const heroi = estado?.seats.find((s) => s.isHero) ?? null;
  const ehVezDoHeroi = !!estado && estado.actor >= 0 && !!estado.seats[estado.actor]?.isHero;
  const maoEncerrada = estado?.street === 'complete';
  const emJogo =
    !!estado &&
    (estado.street === 'preflop' ||
      estado.street === 'flop' ||
      estado.street === 'turn' ||
      estado.street === 'river');
  const pote = estado ? potTotal(estado) : 0;

  const legal = useMemo(() => {
    if (!estado || !ehVezDoHeroi) return null;
    return legalActions(estado);
  }, [estado, versao, ehVezDoHeroi]);

  return {
    fase,
    mensagem,
    falta,
    ea,
    sessaoId,
    estado,
    heroi,
    versao,
    pote,
    legal,
    ehVezDoHeroi,
    maoEncerrada,
    emJogo,
    sacando,
    erroSaque,
    nomeHeroi,
    novaMao,
    agir,
    sacar,
    tentarDeNovo,
  };
}
