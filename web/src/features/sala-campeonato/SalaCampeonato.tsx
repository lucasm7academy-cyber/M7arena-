// src/features/sala-campeonato/SalaCampeonato.tsx
// Sala de TIMES (Campeonato ADR-085 e Time vs Time LIVRE ADR-086): mesma
// experiência da sala normal — tela cheia (LayoutWrapper esconde sidebar),
// fundo oficial, barra superior com estado/modo/modalidade — com o card de time
// (1 vaga por lado, PRONTO, sorteio → lado → first/last pick, draft Fearless,
// código e live). O servidor é a autoridade; esta tela só desenha e pede ações.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Copy, Loader2, Radio, Share2, Shield, Swords, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { DraftRoom } from '../../components/draft/DraftRoom';
import { useSalaRealtime } from '../../hooks/useSalaRealtime';
import { usePerfil } from '../../contexts/PerfilContext';
import { agoraServidor, registrarServerTime } from '../../lib/clockSync';

// Borda cortada no padrão das vagas/cards (mesmos cortes da sala normal).
const CUT_FRAME = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_INNER = 'polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)';
const CUT_BUTTON = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CUT_BUTTON_INNER = 'polygon(7.8px 0, 100% 0, 100% calc(100% - 7.8px), calc(100% - 7.8px) 100%, 0 100%, 0 7.8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

const ERROS: Record<string, string> = {
  vaga_ocupada: 'Essa vaga já está ocupada.',
  nao_e_do_time: 'Você não faz parte desse time.',
  ja_esta_na_sala: 'Você já está na outra vaga.',
  estado_invalido: 'A sala mudou de fase — atualize a página.',
  fora_da_vez: 'Não é a vez do seu time.',
  lado_ja_escolhido: 'O lado já foi escolhido.',
  fora_do_turno: 'Não é o turno do seu time.',
  campeao_indisponivel: 'Campeão indisponível (já usado ou travado pelo Fearless).',
  fase_invalida: 'Essa ação não é da fase atual.',
  tempo_expirado: 'O tempo do turno acabou.',
  sem_cargo_streamer: 'Só quem tem o cargo de streamer pode iniciar a live.',
  sem_twitch_no_perfil: 'Cadastre sua Twitch no perfil antes de iniciar a live.',
  sem_codigo: 'Sem código Riot disponível no momento.',
  times_incompletos: 'Os times do confronto ainda não estão definidos.',
  serie_finalizada: 'A série já foi finalizada.',
  resultado_anterior_pendente: 'Aguardando o resultado do jogo anterior.',
};

type AcaoRpc = { ok: boolean; erro?: string | null; estado?: string | null; mudou?: boolean };

export default function SalaCampeonato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { perfil } = usePerfil();
  const [sala, setSala] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [meusTimes, setMeusTimes] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [compartilhado, setCompartilhado] = useState(false);
  const [, setTick] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/matches/${id}`, { credentials: 'include' });
      if (!r.ok) {
        setErro('Sala não encontrada.');
        return;
      }
      const j = await r.json();
      registrarServerTime(j?.server_time);
      setSala(j);
      setErro(null);
      // Tick preguiçoso (sala livre: iniciando_partida → partida_iniciada).
      // O servidor decide; a chamada é idempotente.
      if (j?.estado === 'iniciando_partida') {
        fetch(`/api/matches/${id}/tick`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => {});
      }
    } catch {
      setErro('Não foi possível carregar a sala.');
    }
  }, [id]);

  // Realtime (WebSocket) + fallback de polling de 5s (ADR-082).
  useSalaRealtime(Number(id) || 0, { onUpdate: () => carregar(), onReconnect: () => carregar() });
  useEffect(() => {
    const t = setInterval(() => carregar(), 5000);
    return () => clearInterval(t);
  }, [carregar]);
  // Tick de 1s para o cronômetro do draft.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  // Times do usuário (para saber o lado dele na série de campeonato).
  useEffect(() => {
    const uid = perfil?.id;
    if (!uid) return;
    fetch(`/api/teams/by-user/${uid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const ids = (Array.isArray(rows) ? rows : [])
          .map((t: any) => t?.time_id ?? t?.team_id ?? t?.id)
          .filter(Boolean);
        setMeusTimes(ids);
      })
      .catch(() => {});
  }, [perfil?.id]);

  const camp = sala?.campeonato;
  const serie = camp?.serie;
  const meuLado: 'blue' | 'red' | null = useMemo(() => {
    if (!serie || !meusTimes.length) return null;
    if (serie.time_a_id && meusTimes.includes(serie.time_a_id)) return 'blue';
    if (serie.time_b_id && meusTimes.includes(serie.time_b_id)) return 'red';
    return null;
  }, [serie, meusTimes]);

  const jogadorDoLado = (lado: 'blue' | 'red') =>
    (sala?.jogadores ?? []).find((j: any) => (j.side ?? (j.is_time_a ? 'blue' : 'red')) === lado) ?? null;

  const chamar = async (path: string, body?: any): Promise<AcaoRpc | null> => {
    setOcupado(path);
    try {
      const r = await fetch(`/api/matches/${id}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        toast.error(ERROS[j?.erro] ?? j?.erro ?? 'Não foi possível completar a ação.');
        return j;
      }
      await carregar();
      return j;
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha de rede.');
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const compartilhar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCompartilhado(true);
      toast.success('Link da sala copiado!');
      setTimeout(() => setCompartilhado(false), 2500);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  if (erro) {
    return (
      <div className="flex-1 w-full min-h-screen bg-[#050505] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-white/70">{erro}</p>
          <button
            onClick={() => navigate('/jogar')}
            className="px-4 py-2 bg-white/10 border border-white/15 text-xs font-black uppercase tracking-wider cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }
  if (!sala) {
    return (
      <div className="flex-1 w-full min-h-screen bg-[#050505] flex items-center justify-center text-white/60">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const estado: string = sala.estado ?? '';
  const eu = perfil?.id ?? '';
  const jogadorBlue = jogadorDoLado('blue');
  const jogadorRed = jogadorDoLado('red');
  const meuJogador =
    jogadorBlue?.id === eu || jogadorBlue?.user_id === eu
      ? jogadorBlue
      : jogadorRed?.id === eu || jogadorRed?.user_id === eu
        ? jogadorRed
        : null;
  // Lado efetivo: a vaga ocupada manda (vale também para a sala LIVRE, sem time).
  const meuLadoEfetivo: 'blue' | 'red' | null = (meuJogador?.side as 'blue' | 'red' | undefined) ?? meuLado;
  const meuPronto = meuLadoEfetivo === 'blue' ? camp?.pronto_blue : meuLadoEfetivo === 'red' ? camp?.pronto_red : false;
  const escolhendo = camp?.escolha_time as 'blue' | 'red' | null;
  const tagDoLado = (lado?: 'blue' | 'red' | null) =>
    lado === 'blue' ? sala.time_a_tag || 'AZUL' : lado === 'red' ? sala.time_b_tag || 'VERMELHO' : '';
  const nomeDoLado = (lado?: 'blue' | 'red' | null) =>
    lado === 'blue' ? sala.time_a_nome || 'Time Azul' : lado === 'red' ? sala.time_b_nome || 'Time Vermelho' : '';
  const timerDraft = (() => {
    const dl = camp?.draft?.turn_deadline_at;
    if (!dl) return 30;
    return Math.max(0, Math.ceil((new Date(dl).getTime() - agoraServidor()) / 1000));
  })();
  const estadoRotulo =
    estado === 'camp_vagas'
      ? 'Aguardando Times'
      : estado === 'camp_prontos'
        ? 'Falta PRONTO'
        : estado === 'camp_lado'
          ? 'Escolha de Lado'
          : estado === 'camp_draft'
            ? 'Draft'
            : estado === 'camp_jogo'
              ? 'Em Série'
              : estado === 'iniciando_partida'
                ? 'Iniciando'
                : estado === 'partida_iniciada'
                  ? 'Em Andamento'
                  : estado === 'camp_finalizada' || estado === 'encerrada'
                    ? 'Finalizada'
                    : estado;

  const acaoDraft = async (tipo: 'ban' | 'pick', championId: string) => {
    const r = await chamar(`/sala-campeonato/${tipo}`, { championId });
    return { ok: !!r?.ok, erro: r?.ok ? undefined : r?.erro ?? undefined, estado: r?.estado ?? null, mudou: !!r?.ok };
  };

  return (
    <div className="flex-1 w-full min-h-screen md:min-h-0 bg-[#050505] flex flex-col items-center justify-start p-0 font-sans relative overflow-x-hidden md:overflow-hidden md:h-full text-white">
      {/* Background Layer (igual às salas) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0">
          <img src="/images/fundo_elite.jpg" alt="" className="w-full h-full object-cover object-center opacity-30" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* ── TOP BAR (mesmo padrão da sala normal) ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 md:p-[1.5vmin] bg-black/60 backdrop-blur-xl border border-white/[0.08] shadow-2xl flex-wrap md:flex-nowrap"
        style={{ clipPath: CUT_FRAME }}
      >
        <div className="flex items-center gap-3 sm:gap-4 md:gap-[2vmin] z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/jogar')}
            className="group relative p-[1px] bg-white/15 hover:bg-red-500/50 transition-colors shrink-0 shadow-lg cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
            title="Sair da sala"
          >
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-[4.4vmin] md:h-[4.4vmin] bg-[#0A0A0A] hover:bg-red-950/40 flex items-center justify-center text-white/70 hover:text-red-400 transition-colors"
              style={{ clipPath: CUT_BUTTON_INNER }}
            >
              <ArrowLeft className="w-4 h-4 md:w-[2vmin] md:h-[2vmin]" />
            </div>
          </motion.button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative p-[1px] bg-white/15 shrink-0" style={{ clipPath: CUT_BUTTON }}>
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 md:w-[4.4vmin] md:h-[4.4vmin] bg-[#0d0d10] flex items-center justify-center text-[#FFB700] shadow-inner"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Trophy className="w-4 h-4 md:w-[2vmin] md:h-[2vmin]" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-base md:text-[2vmin] font-black tracking-wider text-white uppercase leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                {sala.nome || (serie ? `${sala.time_a_tag} x ${sala.time_b_tag}` : 'Time vs Time')}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="p-[1px] bg-[#FFB700]/30" style={{ clipPath: CUT_BADGE }}>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FFB700]/10 text-[10px] md:text-[1.2vmin] font-black text-[#FFB700] tracking-widest leading-none font-mono block"
                    style={{ clipPath: CUT_BADGE_INNER }}
                  >
                    #{String(sala.id).padStart(6, '0')}
                  </span>
                </div>
                {serie && (
                  <div className="p-[1px] bg-white/10" style={{ clipPath: CUT_BADGE }}>
                    <span
                      className="px-1.5 py-0.5 bg-[#0b0a0e] text-[10px] md:text-[1.2vmin] font-black text-white/70 tracking-widest leading-none block"
                      style={{ clipPath: CUT_BADGE_INNER }}
                    >
                      JOGO {camp?.jogo ?? 1} · MD{serie.best_of ?? 3}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-[1.5vmin] z-10 flex-wrap sm:flex-nowrap">
          {/* Card Estado */}
          <div className="relative p-[1px] bg-white/10 shrink-0" style={{ clipPath: CUT_BADGE }}>
            <div className="px-3 py-1.5 md:px-3.5 bg-[#0b0a0e] flex flex-col justify-center" style={{ clipPath: CUT_BADGE_INNER }}>
              <span className="text-[8.5px] md:text-[0.95vmin] font-bold text-white/40 uppercase tracking-widest leading-none">
                Estado
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-1.5 h-1.5 shrink-0 ${
                    estado === 'camp_finalizada' || estado === 'encerrada'
                      ? 'bg-purple-400'
                      : estado === 'partida_iniciada' || estado === 'camp_jogo'
                        ? 'bg-cyan-400 animate-pulse'
                        : estado === 'camp_draft' || estado === 'camp_lado'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <span className="text-xs md:text-[1.35vmin] font-black text-white uppercase tracking-wider leading-none">
                  {estadoRotulo}
                </span>
              </div>
            </div>
          </div>

          {/* Card Modo */}
          <div className="relative p-[1px] bg-white/10 shrink-0" style={{ clipPath: CUT_BADGE }}>
            <div className="px-3 py-1.5 md:px-3.5 bg-[#0b0a0e] flex flex-col justify-center" style={{ clipPath: CUT_BADGE_INNER }}>
              <span className="text-[8.5px] md:text-[0.95vmin] font-bold text-white/40 uppercase tracking-widest leading-none">
                Modo
              </span>
              <span className="text-xs md:text-[1.35vmin] font-black uppercase tracking-wider mt-1 leading-none text-[#FFB700]">
                {serie ? 'CAMPEONATO' : 'TIME VS TIME'}
              </span>
            </div>
          </div>

          {/* Card Placar/Modalidade */}
          <div className="relative p-[1px] bg-white/10 shrink-0" style={{ clipPath: CUT_BADGE }}>
            <div className="px-3 py-1.5 md:px-3.5 bg-[#0b0a0e] flex flex-col justify-center" style={{ clipPath: CUT_BADGE_INNER }}>
              <span className="text-[8.5px] md:text-[0.95vmin] font-bold text-white/40 uppercase tracking-widest leading-none">
                {serie ? 'Placar da Série' : 'Modalidade'}
              </span>
              <span className="text-xs md:text-[1.35vmin] font-black uppercase tracking-wider mt-1 leading-none flex items-center gap-1.5">
                {serie ? (
                  <span className="text-white">
                    {serie.placar_a} - {serie.placar_b}
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" /> Casual
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Compartilhar */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-white/[0.08]">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={compartilhar}
              className="relative p-[1px] bg-[#FFB700]/30 hover:bg-[#FFB700]/60 transition-colors shrink-0 cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
              title="Compartilhar sala"
            >
              <div
                className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#120e03] hover:bg-[#1a1405] flex items-center justify-center gap-1.5 text-[#FFB700] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                {compartilhado ? (
                  <>
                    <Check className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] text-emerald-400" />
                    <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider text-emerald-400 hidden sm:inline">
                      Copiado!
                    </span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin]" />
                    <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                      Convidar
                    </span>
                  </>
                )}
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── CONTEÚDO ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-6 py-4 space-y-4 flex flex-col">
        {/* Times + hub central */}
        <div className="grid gap-3 lg:grid-cols-[1fr_minmax(260px,360px)_1fr] items-stretch">
          {(['blue', 'red'] as const).map((lado) => {
            const jogador = lado === 'blue' ? jogadorBlue : jogadorRed;
            const pronto = lado === 'blue' ? camp?.pronto_blue : camp?.pronto_red;
            const valorVaga = !!jogador && (jogador.id === eu || jogador.user_id === eu);
            return (
              <div
                key={lado}
                className={`p-[1px] ${lado === 'blue' ? 'bg-[#00F0FF]/40' : 'bg-[#FF4655]/40'}`}
                style={{ clipPath: CUT_FRAME }}
              >
                <div className="h-full bg-[#0a0a0c]/90 backdrop-blur-sm p-4 flex flex-col gap-3" style={{ clipPath: CUT_INNER }}>
                  <div className="flex items-center gap-3">
                    {sala[`time_${lado === 'blue' ? 'a' : 'b'}_logo`] ? (
                      <img src={sala[`time_${lado === 'blue' ? 'a' : 'b'}_logo`]} alt="" className="w-16 h-16 object-contain" />
                    ) : (
                      <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center font-black text-white/40 text-lg">
                        {tagDoLado(lado)?.slice(0, 2)}
                      </div>
                    )}
                    <div className="leading-tight">
                      <p
                        className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: lado === 'blue' ? '#00F0FF' : '#FF4655' }}
                      >
                        {lado === 'blue' ? 'AZUL' : 'VERMELHO'} · TIME {lado === 'blue' ? 'A' : 'B'}
                      </p>
                      <p className="text-lg font-black uppercase text-white">{nomeDoLado(lado)}</p>
                    </div>
                  </div>

                  {/* Vaga */}
                  <div className="flex-1 flex flex-col justify-center gap-2 border-t border-white/10 pt-3">
                    {jogador ? (
                      <>
                        <div className="flex items-center gap-2">
                          {jogador.avatar ? (
                            <img src={jogador.avatar} alt="" className="w-8 h-8 rounded-full border border-white/20" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15" />
                          )}
                          <p className="text-sm font-bold text-white">
                            {jogador.nome} <span className="text-white/40 text-xs">#{jogador.tag}</span>
                            {valorVaga && (
                              <span className="ml-2 text-[10px] text-[#00FF41] font-black uppercase">você</span>
                            )}
                          </p>
                        </div>
                        {pronto && estado === 'camp_prontos' && (
                          <p className="text-[11px] font-black uppercase text-[#00FF41] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Pronto
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Vaga aberta</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {estado === 'camp_vagas' && !jogador && (!serie || meuLado === lado) && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/entrar', { side: lado })}
                          className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black disabled:opacity-50 cursor-pointer"
                          style={{ background: lado === 'blue' ? '#00F0FF' : '#FF4655', clipPath: CUT_BUTTON }}
                        >
                          Entrar na vaga
                        </button>
                      )}
                      {estado === 'camp_vagas' && jogador && valorVaga && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/sair')}
                          className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white/80 border border-white/15 bg-white/5 disabled:opacity-50 cursor-pointer"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          Sair da vaga
                        </button>
                      )}
                      {estado === 'camp_prontos' && jogador && valorVaga && !meuPronto && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/pronto')}
                          className="px-5 py-2 text-[11px] font-black uppercase tracking-wider text-black bg-[#00FF41] disabled:opacity-50 cursor-pointer"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          Pronto
                        </button>
                      )}
                      {estado === 'camp_prontos' && jogador && valorVaga && meuPronto && (
                        <span className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#00FF41] border border-[#00FF41]/40 bg-[#00FF41]/10">
                          Pronto!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hub central */}
          <div className="p-[1px] bg-white/15 lg:order-none order-first" style={{ clipPath: CUT_FRAME }}>
            <div
              className="h-full bg-[#0a0a0c]/90 backdrop-blur-sm p-4 flex flex-col items-center justify-center gap-3 text-center"
              style={{ clipPath: CUT_INNER }}
            >
              {estado === 'camp_vagas' && (
                <>
                  <Swords className="w-7 h-7 text-white/40" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/60">
                    Aguardando os times preencherem as vagas
                  </p>
                </>
              )}
              {estado === 'camp_prontos' && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#00FF41]">
                    Os dois times precisam marcar PRONTO
                  </p>
                  <p className="text-xs text-white/50">
                    {camp?.pronto_blue ? `${tagDoLado('blue')} pronto` : `${tagDoLado('blue')} aguardando`} ·{' '}
                    {camp?.pronto_red ? `${tagDoLado('red')} pronto` : `${tagDoLado('red')} aguardando`}
                  </p>
                </>
              )}
              {estado === 'camp_lado' && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#FFB700]">
                    {!camp?.lado_escolhido
                      ? `${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO O LADO`
                      : `${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO FIRST OU LAST PICK`}
                  </p>
                  {!camp?.lado_escolhido && escolhendo && escolhendo === meuLadoEfetivo && (
                    <div className="flex gap-2">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'blue' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-black bg-[#00F0FF] disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Escolher Azul
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'red' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-white bg-[#FF4655] disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Escolher Vermelho
                      </button>
                    </div>
                  )}
                  {camp?.lado_escolhido && escolhendo && escolhendo === meuLadoEfetivo && !camp?.pick_order_escolhido && (
                    <div className="flex gap-2">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'first' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-black bg-[#FFB700] disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        First Pick
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'last' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-white border border-white/20 bg-white/10 disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Last Pick
                      </button>
                    </div>
                  )}
                  {camp?.lado_escolhido && (
                    <p className="text-xs text-white/50">
                      Lado: {nomeDoLado(camp.lado_escolhido)} joga de {camp.lado_escolhido === 'blue' ? 'azul' : 'vermelho'}
                    </p>
                  )}
                </>
              )}
              {estado === 'camp_draft' && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Draft em andamento</p>
                  <p className="text-xs text-white/50">
                    {camp?.primeiro_pick === 'blue' ? tagDoLado('blue') : tagDoLado('red')} tem o first pick
                  </p>
                </>
              )}
              {['camp_jogo', 'camp_finalizada', 'iniciando_partida', 'partida_iniciada', 'encerrada'].includes(estado) && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#00FF41]">
                    {estado === 'camp_jogo'
                      ? 'Série em andamento'
                      : estado === 'camp_finalizada'
                        ? 'Série finalizada'
                        : estado === 'iniciando_partida'
                          ? 'Partida pronta — prepare o cliente do LoL!'
                          : estado === 'partida_iniciada'
                            ? 'Partida em andamento'
                            : 'Partida encerrada'}
                  </p>
                  {serie && (
                    <p className="text-3xl font-black text-white">
                      {serie.placar_a} - {serie.placar_b}
                    </p>
                  )}
                  {camp?.lado_time_a && (
                    <p className="text-xs text-white/50">
                      {sala.time_a_tag} de {camp.lado_time_a === 'blue' ? 'azul' : 'vermelho'} · {sala.time_b_tag} de{' '}
                      {camp.lado_time_a === 'blue' ? 'vermelho' : 'azul'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Draft (mesma tela do draft das salas) */}
        {estado === 'camp_draft' && camp?.draft && (
          <div className="w-full">
            <DraftRoom
              draft={camp.draft}
              jogadores={sala.jogadores ?? []}
              usuarioId={eu}
              timer={timerDraft}
              onBanir={(champ: string) => acaoDraft('ban', champ)}
              onPickar={(champ: string) => acaoDraft('pick', champ)}
            />
          </div>
        )}

        {/* Código + live */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="p-[1px] bg-white/15" style={{ clipPath: CUT_FRAME }}>
            <div className="bg-[#0a0a0c]/90 backdrop-blur-sm p-4 flex flex-col gap-2" style={{ clipPath: CUT_INNER }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Código da partida</p>
              {sala.codigo_partida ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs sm:text-sm text-[#00F0FF] break-all bg-black/40 border border-white/10 px-3 py-2">
                    {sala.codigo_partida}
                  </code>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(sala.codigo_partida);
                        toast.success('Código copiado! Cole no LoL em Jogar > Torneios > Código de Torneio.');
                      } catch {
                        toast.error('Não foi possível copiar.');
                      }
                    }}
                    className="p-2.5 text-black bg-[#00F0FF] cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                    title="Copiar código"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/40">
                  O código fica visível para os jogadores das duas equipes e para a organização até o fim da série.
                </p>
              )}
            </div>
          </div>

          <div className="p-[1px] bg-white/15" style={{ clipPath: CUT_FRAME }}>
            <div className="bg-[#0a0a0c]/90 backdrop-blur-sm p-4 flex flex-col gap-2" style={{ clipPath: CUT_INNER }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Transmissão</p>
              {camp?.live ? (
                <a
                  href={`https://twitch.tv/${camp.live.twitch}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-black uppercase text-[#9146FF] hover:brightness-125"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  ASSISTA ESSE JOGO AO VIVO!
                  <span className="text-white/50 text-xs normal-case ml-1">@{camp.live.twitch}</span>
                </a>
              ) : perfil?.cargo === 'streamer' && !!serie ? (
                <button
                  disabled={!!ocupado}
                  onClick={async () => {
                    const r = await chamar('/sala-campeonato/live');
                    if (r?.ok) toast.success('Live criada! Ela aparece no site em "Assista Agora".');
                  }}
                  className="self-start px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white bg-[#9146FF] disabled:opacity-50 cursor-pointer"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Iniciar live
                  </span>
                </button>
              ) : (
                <p className="text-xs text-white/40">Sem transmissão no momento.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
