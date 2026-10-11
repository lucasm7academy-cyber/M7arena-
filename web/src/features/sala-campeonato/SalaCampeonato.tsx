// src/features/sala-campeonato/SalaCampeonato.tsx
// Sala Campeonato V1 (ADRs 076-085): mesmo visual/estrutura da sala normal,
// com as funcionalidades novas — 2 vagas (1 por time, do coach à reserva),
// PRONTO por jogo, sorteio → lado → first/last pick, draft Fearless, código da
// série visível até o fim e live do streamer. 100% dirigida pelo shape:
// o servidor é a autoridade; esta tela só desenha e pede ações.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, Radio, Swords, Trophy } from 'lucide-react';
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

  // Times do usuário (para saber o lado dele na série).
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

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-white/70">{erro}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 border border-white/15 text-xs font-black uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </div>
    );
  }
  if (!sala) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const estado: string = sala.estado ?? '';
  const eu = perfil?.id ?? '';
  const jogadorBlue = jogadorDoLado('blue');
  const jogadorRed = jogadorDoLado('red');
  const meuJogador = jogadorBlue?.id === eu || jogadorBlue?.user_id === eu ? jogadorBlue : jogadorRed?.id === eu || jogadorRed?.user_id === eu ? jogadorRed : null;
  const meuPronto = meuLado === 'blue' ? camp?.pronto_blue : meuLado === 'red' ? camp?.pronto_red : false;
  const escolhendo = camp?.escolha_time as 'blue' | 'red' | null;
  const tagDoLado = (lado?: 'blue' | 'red' | null) => (lado === 'blue' ? sala.time_a_tag : lado === 'red' ? sala.time_b_tag : '');
  const nomeDoLado = (lado?: 'blue' | 'red' | null) => (lado === 'blue' ? sala.time_a_nome : lado === 'red' ? sala.time_b_nome : '');
  const timerDraft = (() => {
    const dl = camp?.draft?.turn_deadline_at;
    if (!dl) return 30;
    return Math.max(0, Math.ceil((new Date(dl).getTime() - agoraServidor()) / 1000));
  })();

  const acaoDraft = async (tipo: 'ban' | 'pick', championId: string) => {
    const r = await chamar(`/sala-campeonato/${tipo}`, { championId });
    return { ok: !!r?.ok, erro: r?.ok ? undefined : r?.erro ?? undefined, estado: r?.estado ?? null, mudou: !!r?.ok };
  };

  return (
    <div className="relative min-h-screen pb-20">
      <img src="/images/fundo_elite.jpg" alt="" className="fixed inset-0 w-full h-full object-cover object-center opacity-30 pointer-events-none" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/campeonatos')}
            className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
            style={{ clipPath: CUT_BUTTON }}
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-[1px] bg-white/15" style={{ clipPath: CUT_FRAME }}>
            <div className="px-4 py-2 bg-[#0b0a0e] flex items-center gap-3" style={{ clipPath: CUT_INNER }}>
              <Trophy className="w-4 h-4" style={{ color: '#FFB700' }} />
              <div className="leading-tight">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  {camp?.serie?.campeonato_titulo ?? 'Sala Campeonato'}
                </p>
                <p className="text-sm font-black uppercase tracking-wide text-white">
                  {sala.time_a_tag} <span className="text-white/40">x</span> {sala.time_b_tag}
                  <span className="ml-3 text-[#FFB700]">JOGO {camp?.jogo ?? 1}</span>
                  <span className="ml-2 text-white/50 text-xs">MD{serie?.best_of ?? 3}</span>
                  <span className="ml-3 text-white">
                    {serie ? `${serie.placar_a} - ${serie.placar_b}` : ''}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Times + vagas */}
        <div className="grid gap-3 lg:grid-cols-[1fr_minmax(260px,360px)_1fr] items-stretch">
          {(['blue', 'red'] as const).map((lado) => {
            const jogador = lado === 'blue' ? jogadorBlue : jogadorRed;
            const pronto = lado === 'blue' ? camp?.pronto_blue : camp?.pronto_red;
            const ehMinha = !!meuJogador && meuJogador.side === lado;
            const valorVaga = !!jogador && (jogador.id === eu || jogador.user_id === eu);
            return (
              <div key={lado} className={`p-[1px] ${lado === 'blue' ? 'bg-[#00F0FF]/40' : 'bg-[#FF4655]/40'}`} style={{ clipPath: CUT_FRAME }}>
                <div className="h-full bg-[#0a0a0c] p-4 flex flex-col gap-3" style={{ clipPath: CUT_INNER }}>
                  <div className="flex items-center gap-3">
                    {sala[`time_${lado === 'blue' ? 'a' : 'b'}_logo`] ? (
                      <img
                        src={sala[`time_${lado === 'blue' ? 'a' : 'b'}_logo`]}
                        alt=""
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white/5 border border-white/10 flex items-center justify-center font-black text-white/40">
                        {tagDoLado(lado)?.slice(0, 2)}
                      </div>
                    )}
                    <div className="leading-tight">
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: lado === 'blue' ? '#00F0FF' : '#FF4655' }}>
                        {lado === 'blue' ? 'AZUL' : 'VERMELHO'} · TIME {lado === 'blue' ? 'A' : 'B'}
                      </p>
                      <p className="text-lg font-black uppercase text-white">{nomeDoLado(lado)}</p>
                    </div>
                  </div>

                  {/* Vaga */}
                  <div className="flex-1 flex flex-col justify-center gap-2 border-t border-white/10 pt-3">
                    {jogador ? (
                      <>
                        <p className="text-sm font-bold text-white">
                          {jogador.nome} <span className="text-white/40 text-xs">#{jogador.tag}</span>
                          {valorVaga && <span className="ml-2 text-[10px] text-[#00FF41] font-black uppercase">você</span>}
                        </p>
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
                      {estado === 'camp_vagas' && !jogador && meuLado === lado && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/entrar', { side: lado })}
                          className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                          style={{ background: lado === 'blue' ? '#00F0FF' : '#FF4655', clipPath: CUT_BUTTON }}
                        >
                          Entrar na vaga
                        </button>
                      )}
                      {estado === 'camp_vagas' && jogador && valorVaga && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/sair')}
                          className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white/80 border border-white/15 bg-white/5 disabled:opacity-50"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          Sair da vaga
                        </button>
                      )}
                      {estado === 'camp_prontos' && jogador && valorVaga && !meuPronto && (
                        <button
                          disabled={!!ocupado}
                          onClick={() => chamar('/sala-campeonato/pronto')}
                          className="px-5 py-2 text-[11px] font-black uppercase tracking-wider text-black bg-[#00FF41] disabled:opacity-50"
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
            <div className="h-full bg-[#0a0a0c] p-4 flex flex-col items-center justify-center gap-3 text-center" style={{ clipPath: CUT_INNER }}>
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
                    {camp?.pronto_blue ? `${sala.time_a_tag} pronto` : `${sala.time_a_tag} aguardando`} ·{' '}
                    {camp?.pronto_red ? `${sala.time_b_tag} pronto` : `${sala.time_b_tag} aguardando`}
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
                  {!camp?.lado_escolhido && escolhendo && escolhendo === meuLado && (
                    <div className="flex gap-2">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'blue' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-black bg-[#00F0FF] disabled:opacity-50"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Escolher Azul
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'red' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-white bg-[#FF4655] disabled:opacity-50"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Escolher Vermelho
                      </button>
                    </div>
                  )}
                  {camp?.lado_escolhido && escolhendo && escolhendo === meuLado && !camp?.pick_order_escolhido && (
                    <div className="flex gap-2">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'first' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-black bg-[#FFB700] disabled:opacity-50"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        First Pick
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'last' })}
                        className="px-4 py-2 text-[11px] font-black uppercase text-white border border-white/20 bg-white/10 disabled:opacity-50"
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
                        {camp?.primeiro_pick === 'blue' ? sala.time_a_tag : sala.time_b_tag} tem o first pick
                  </p>
                </>
              )}
              {(estado === 'camp_jogo' || estado === 'camp_finalizada') && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#00FF41]">
                    {estado === 'camp_jogo' ? 'Série em andamento' : 'Série finalizada'}
                  </p>
                  <p className="text-3xl font-black text-white">
                    {serie ? `${serie.placar_a} - ${serie.placar_b}` : ''}
                  </p>
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

        {/* Draft (tela cheia como na sala normal) */}
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
            <div className="bg-[#0a0a0c] p-4 flex flex-col gap-2" style={{ clipPath: CUT_INNER }}>
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
                    className="p-2.5 text-black bg-[#00F0FF]"
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
            <div className="bg-[#0a0a0c] p-4 flex flex-col gap-2" style={{ clipPath: CUT_INNER }}>
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
              ) : perfil?.cargo === 'streamer' ? (
                <button
                  disabled={!!ocupado}
                  onClick={async () => {
                    const r = await chamar('/sala-campeonato/live');
                    if (r?.ok) toast.success('Live criada! Ela aparece no site em "Assista Agora".');
                  }}
                  className="self-start px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white bg-[#9146FF] disabled:opacity-50"
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
