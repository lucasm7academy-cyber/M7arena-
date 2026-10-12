// src/features/sala-campeonato/SalaCampeonato.tsx
// Sala de TIMES (Campeonato ADR-085 e Time vs Time LIVRE ADR-086): MESMO VISUAL
// da sala normal — display redondo (anéis + hub + HUD), vagas usando o próprio
// componente VagaSlot (com a foto do time no lugar do ícone de rota) e top bar
// idêntica. O servidor é a autoridade; esta tela só desenha e pede ações.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Copy, Loader2, Radio, RefreshCw, Share2, Shield, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { DraftRoom } from '../../components/draft/DraftRoom';
import { VagaSlot } from '../../components/partidas/VagaSlot';
import { useSalaRealtime } from '../../hooks/useSalaRealtime';
import { usePerfil } from '../../contexts/PerfilContext';
import { agoraServidor, registrarServerTime } from '../../lib/clockSync';
import { ROLE_CONFIG } from '../../api/salamod1';

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

/** Indicadores arcanos do display central (mesma arte da sala normal). */
function ArcaneIndicators() {
  return (
    <div className="absolute inset-0 rounded-full pointer-events-none z-10">
      {[...Array(30)].map((_, i) => (
        <div
          key={`tick-${i}`}
          className="absolute top-1/2 left-1/2 w-[1px] bg-white/5 origin-bottom"
          style={{
            transform: `translate(-50%, -50%) rotate(${i * 12}deg) translateY(-35vmin)`,
            height: i % 5 === 0 ? '2.5vmin' : '1.2vmin',
            backgroundColor: i % 5 === 0 ? 'rgba(255, 183, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          }}
        />
      ))}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 100, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-[2vmin] rounded-full border border-dashed border-white/[0.03]"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-[5vmin] rounded-full border border-dotted border-[#FFB700]/[0.02]"
      />
    </div>
  );
}

/** Display central (mesma arte da sala normal). */
function CentralDisplay() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      <AnimatePresence mode="wait">
        <motion.div
          key="image-step"
          initial={{ scale: 0.2, opacity: 0, filter: 'blur(10px)' }}
          animate={{ scale: 0.85, opacity: 0.8, filter: 'blur(0px)' }}
          exit={{ scale: 1.1, opacity: 0, filter: 'blur(5px)' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <img
            src="https://static.wikia.nocookie.net/leagueoflegends/images/9/9c/Summoner%27s_Rift_LoL_Promo_01.png/revision/latest/scale-to-width-down/1000?cb=20220817091416"
            alt="Summoner's Rift"
            loading="lazy"
            className="w-[90%] h-[90%] object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-20" />
    </div>
  );
}

export default function SalaCampeonato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { perfil } = usePerfil();
  const [sala, setSala] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [meusTimes, setMeusTimes] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [compartilhado, setCompartilhado] = useState(false);
  const [codigoCopiado, setCodigoCopiado] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<{ championId: string | null; side: 'blue' | 'red' | null } | null>(null);
  const [bannerTroca, setBannerTroca] = useState(false);
  const [ladoVisto, setLadoVisto] = useState<{ chave: string; lado: 'blue' | 'red' } | null>(null);
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

  // Realtime (WebSocket) + fallback de polling de 5s (ADR-082). A prévia do
  // draft chega pelo socket (em memória, sem banco) — a tela só desenha.
  const { enviarPreview } = useSalaRealtime(Number(id) || 0, {
    onUpdate: () => carregar(),
    onReconnect: () => carregar(),
    onDraftPreview: (p) => setPreviewDraft(p),
  });
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

  // TROCA DE LADOS NA SALA: o banner aparece junto com o deslize das colunas
  // e some sozinho (~3s). A detecção da troca é feita em tempo de render, mais
  // abaixo (só o render da troca ganha a animação).
  useEffect(() => {
    if (!bannerTroca) return;
    const t = setTimeout(() => setBannerTroca(false), 3200);
    return () => clearTimeout(t);
  }, [bannerTroca]);

  // Times do usuário (para saber o lado dele na série de campeonato).
  useEffect(() => {
    const uid = perfil?.id;
    if (!uid) return;
    fetch(`/api/teams/by-user/${uid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((resp) => {
        // A rota devolve { memberships: [...], teams: [...] } (não um array).
        const arr = Array.isArray(resp) ? resp : resp?.memberships ?? [];
        const ids = (Array.isArray(arr) ? arr : [])
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

  // Botão de copiar centralizado, estilo da sala normal.
  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(sala?.codigo_partida ?? '');
      setCodigoCopiado(true);
      toast.success('Código copiado! Cole no LoL em Jogar > Torneios > Código de Torneio.');
      setTimeout(() => setCodigoCopiado(false), 2500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  // Encerrar a própria live (botão branco no menu, ao lado de Convidar).
  const encerrarLive = async () => {
    if (!camp?.live?.id) return;
    setOcupado('live-parar');
    try {
      const r = await fetch(`/api/streams/${camp.live.id}/parar`, { method: 'POST', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        toast.error(j?.erro === 'sem_permissao' ? 'Só quem iniciou a live pode encerrá-la.' : 'Não foi possível encerrar a live.');
        return;
      }
      toast.success('Live encerrada.');
      await carregar();
    } catch {
      toast.error('Falha de rede.');
    } finally {
      setOcupado(null);
    }
  };

  // Atualizar Resultado (campeonato): dispara a verificação da SÉRIE na Riot
  // agora — é o mesmo botão do cronograma. Serve para quando o jogo acabou e a
  // sala não computou sozinha (o servidor também confere a cada 3 min). Quem
  // pode: staff do campeonato ou time da série (o servidor valida).
  const atualizarResultado = async () => {
    if (!camp?.serie?.id || !camp?.serie?.campeonato_id) return;
    setOcupado('verificar-serie');
    try {
      const r = await fetch(`/api/tournaments/${camp.serie.campeonato_id}/jogo/${camp.serie.id}/verificar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        toast.error(j?.error ?? 'Não foi possível atualizar o resultado.');
        return;
      }
      if (j?.motivo === 'riot_indisponivel') {
        toast.error('Não foi possível consultar a Riot agora. Tente de novo em instantes.');
      } else if (j?.estado === 'finalizada') {
        toast.success(`Série finalizada! Placar: ${j.scoreA} - ${j.scoreB}`);
      } else if (j?.estado === 'em_andamento') {
        toast(`Série em andamento: ${j.scoreA} - ${j.scoreB}`, { icon: '⚔️' });
      } else if (j?.motivo === 'sem_codigo') {
        toast.error('Série ainda não possui código de torneio.');
      } else {
        toast('Nenhuma partida nova detectada na Riot ainda.', { icon: 'ℹ️' });
      }
      await carregar();
    } catch {
      toast.error('Falha de rede.');
    } finally {
      setOcupado(null);
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

  // ── TROCA DE LADOS NA SALA (detecção em tempo de render) ─────────────────
  // Padrão React de ajustar estado durante o render: no momento EXATO em que o
  // lado em jogo muda (shape novo pelo WS/polling), este render é descartado e
  // o re-render imediato já sai com banner + animação ligados — é o ÚNICO
  // render que anima (~3s). Qualquer outro reflow depois é instantâneo; quem
  // recarrega a página já vê os times no lado certo, sem animação. A chave é
  // por jogo: cada jogo novo começa sincronizado e parado.
  const ladoAtual: 'blue' | 'red' = camp?.lado_time_a === 'red' ? 'red' : 'blue';
  const chaveLado = `${sala.id}:${camp?.jogo ?? 1}`;
  if (ladoVisto && ladoVisto.chave === chaveLado && ladoVisto.lado !== ladoAtual) {
    setLadoVisto({ chave: chaveLado, lado: ladoAtual });
    setBannerTroca(true);
  } else if (!ladoVisto || ladoVisto.chave !== chaveLado) {
    setLadoVisto({ chave: chaveLado, lado: ladoAtual });
  }

  const estado: string = sala.estado ?? '';
  const eu = perfil?.id ?? '';
  // Staff do campeonato: pode forçar a verificação da SÉRIE (mesma regra da
  // rota do cronograma — staff do campeonato OU time da série).
  const ehStaffCampeonato = ['admin', 'proprietario', 'organizador'].includes((perfil as any)?.cargo ?? '');
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
  const logoDoLado = (lado: 'blue' | 'red') => sala[`time_${lado === 'blue' ? 'a' : 'b'}_logo`] ?? null;
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

  // Draft em TELA CHEIA (igual à sala normal): durante o draft a sala não fica
  // junto na página — o DraftRoom ocupa a tela e, quando fecha, a sala volta
  // sozinha (o estado muda para camp_jogo e o polling/WS atualizam sem reload).
  if (estado === 'camp_draft' && camp?.draft) {
    return (
      <DraftRoom
        draft={camp.draft}
        jogadores={sala.jogadores ?? []}
        usuarioId={eu}
        timer={timerDraft}
        onBanir={(champ: string) => acaoDraft('ban', champ)}
        onPickar={(champ: string) => acaoDraft('pick', champ)}
        onPreview={(champId: string | null) => enviarPreview(champId, meuLadoEfetivo)}
        previewExterno={previewDraft}
        ladoDoTimeA={camp?.lado_time_a ?? null}
        timeA={{ nome: sala.time_a_nome, logo: sala.time_a_logo }}
        timeB={{ nome: sala.time_b_nome, logo: sala.time_b_logo }}
        placar={camp?.serie ? { a: camp.serie.placar_a ?? 0, b: camp.serie.placar_b ?? 0 } : null}
      />
    );
  }

  // ── LATERAIS: etiqueta + nome do time + VAGA (componente VagaSlot, idêntico
  //    ao da sala normal; a foto do time entra no lugar do ícone de rota) ────
  //
  // TROCA DE LADOS NA SALA: as colunas são posicionais (esquerda = lado azul,
  // direita = lado vermelho) e o TIME de cada lado vem das escolhas. Quando o
  // time da vaga azul escolhe jogar de vermelho, as colunas deslizam devagar
  // (~3s via framer layout) — todos na sala veem, porque o estado chega pelo
  // shape (WebSocket + polling).
  const ladoJogoA: 'blue' | 'red' = camp?.lado_time_a === 'red' ? 'red' : 'blue';
  const equipeNoLado = (posicao: 'blue' | 'red'): 'blue' | 'red' =>
    (ladoJogoA === posicao ? 'blue' : 'red');

  const renderTimeColumn = (lado: 'blue' | 'red', posicao: 'blue' | 'red') => {
    const jogador = lado === 'blue' ? jogadorBlue : jogadorRed;
    const pronto = lado === 'blue' ? camp?.pronto_blue : camp?.pronto_red;
    const valorVaga = !!jogador && (jogador.id === eu || jogador.user_id === eu);
    // Cor pelo lado EM JOGO (posição na sala), não pela vaga: é o que mostra a
    // troca acontecendo para todo mundo.
    const cor = posicao === 'blue' ? '#3B82F6' : '#ef4444';
    return (
      <motion.div
        key={lado}
        layout="position"
        transition={{ duration: bannerTroca ? 3 : 0, ease: 'easeInOut' }}
        className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full max-w-[440px] md:w-[44vmin] md:max-w-none px-3 md:px-0 shrink-0"
      >
        {/* Etiqueta Blue-Side / Red-Side (igual à sala normal) */}
        <div
          className="relative mb-1 md:mb-[1vmin] p-[1.5px] overflow-hidden self-center"
          style={{
            backgroundColor: cor,
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
          }}
        >
          <div
            className="bg-[#050505] px-5 py-1"
            style={{ clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)' }}
          >
            <span className="block text-xs md:text-[1.4vmin] font-black uppercase tracking-[0.4em]" style={{ color: cor }}>
              {posicao === 'blue' ? 'Blue-Side' : 'Red-Side'}
            </span>
          </div>
        </div>

        {/* Nome/foto do time */}
        <div className="flex items-center gap-2.5 self-center -mt-1 md:-mt-[0.5vmin]">
          {logoDoLado(lado) ? (
            <img src={logoDoLado(lado)} alt="" className="w-8 h-8 md:w-[3.6vmin] md:h-[3.6vmin] object-contain" />
          ) : (
            <div
              className="w-8 h-8 md:w-[3.6vmin] md:h-[3.6vmin] bg-white/5 border border-white/10 flex items-center justify-center font-black text-white/40 text-[10px]"
            >
              {tagDoLado(lado)?.slice(0, 2)}
            </div>
          )}
          <span className="text-sm md:text-[1.7vmin] font-black uppercase tracking-wide text-white">
            {nomeDoLado(lado)}
          </span>
        </div>

        {/* VAGA — visual idêntico ao da sala normal (foto do time no ícone) */}
        <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full">
          <VagaSlot
            ocupada={!!jogador}
            nome={jogador?.nome}
            tag={jogador?.tag}
            icone={jogador?.avatar}
            isTimeA={posicao === 'blue'}
            role={tagDoLado(lado) || (lado === 'blue' ? 'TIME A' : 'TIME B')}
            isConfirmado={!!pronto && estado === 'camp_prontos'}
            aoEntrar={() => {
              if (!perfil?.id) {
                toast.error('Entre na sua conta para ocupar a vaga.');
                navigate('/login');
                return;
              }
              if (estado !== 'camp_vagas') {
                toast.error('A sala não está aceitando entradas agora.');
                return;
              }
              // Bloqueio local SÓ quando temos certeza de que a vaga é de outro
              // time; na dúvida (dados ainda carregando), quem decide é o servidor.
              if (serie && meuLado && meuLado !== lado) {
                toast.error('Essa vaga é do outro time.');
                return;
              }
              chamar('/sala-campeonato/entrar', { side: lado });
            }}
            aoSair={valorVaga && estado === 'camp_vagas' ? () => chamar('/sala-campeonato/sair') : undefined}
            roleIconImg={logoDoLado(lado) ?? ROLE_CONFIG.MID.img}
            vipTier="free"
            isFinalizada={estado === 'camp_finalizada' || estado === 'encerrada'}
          />
        </div>

        {/* PRONTO do lado (a sala normal tem os botões de confirmação abaixo) */}
        {estado === 'camp_prontos' && valorVaga && !meuPronto && (
          <button
            disabled={!!ocupado}
            onClick={() => chamar('/sala-campeonato/pronto')}
            className="w-full py-2 text-[11px] md:text-[1.3vmin] font-black uppercase tracking-widest text-black bg-[#00FF41] disabled:opacity-50 cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
          >
            Pronto
          </button>
        )}
        {estado === 'camp_prontos' && valorVaga && meuPronto && (
          <span className="w-full py-2 text-center text-[11px] md:text-[1.3vmin] font-black uppercase tracking-widest text-[#00FF41] border border-[#00FF41]/40 bg-[#00FF41]/10">
            Pronto!
          </span>
        )}
      </motion.div>
    );
  };

  // ── HUB REDONDO CENTRAL (estrutura EXATA da sala normal) ────────────────
  const renderHub = () => (
    <div className="relative md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-[84vw] h-[84vw] max-w-[340px] max-h-[340px] md:w-[55vmin] md:h-[55vmin] md:max-w-none md:max-h-none rounded-full z-10 flex items-center justify-center shrink-0 my-4 md:my-0">
      {/* Outer rings */}
      <div className="absolute inset-[-8vmin] rounded-full border border-white/[0.02] border-dashed animate-[spin_100s_linear_infinite]" />
      <div className="absolute inset-[-4vmin] rounded-full border-t-4 border-l-2 border-[#FFB700]/10 opacity-30 animate-[spin_60s_linear_infinite]" />

      {/* Main Hub Body */}
      <div className="relative w-full h-full rounded-full bg-black shadow-[0_0_100px_rgba(0,0,0,1)] border-[6px] border-white/5 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(40,30,20,0.6)_0%,transparent_100%)] opacity-50" />
        <ArcaneIndicators />
        <CentralDisplay />

        {/* Nosso estado — mesmo padrão do overlay da sala (z-[35] sem interação) */}
        {estado === 'camp_vagas' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 md:p-[6vmin] text-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 md:gap-[2.5vmin]">
              <span className="text-xl md:text-[3vmin] font-black text-white uppercase tracking-[0.25em] drop-shadow-[0_0_20px_rgba(255,183,0,0.4)] leading-tight">
                Aguardando os Times
              </span>
              <span className="text-xs md:text-[1.3vmin] font-bold text-white/70 uppercase tracking-[0.3em]">
                Cada lado ocupa a sua vaga
              </span>
            </div>
          </motion.div>
        )}
        {estado === 'camp_prontos' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 md:p-[6vmin] text-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 md:gap-[2.5vmin]">
              <span className="text-xl md:text-[2.6vmin] font-black text-[#00FF41] uppercase tracking-[0.25em] leading-tight">
                Marquem PRONTO
              </span>
              <span className="text-xs md:text-[1.2vmin] font-bold text-white/70 uppercase tracking-[0.25em] leading-relaxed">
                {tagDoLado('blue')}: {camp?.pronto_blue ? 'PRONTO' : 'aguardando'}
                <br />
                {tagDoLado('red')}: {camp?.pronto_red ? 'PRONTO' : 'aguardando'}
              </span>
            </div>
          </motion.div>
        )}
        {estado === 'camp_draft' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 md:p-[6vmin] text-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 md:gap-[2.5vmin]">
              <span className="text-xl md:text-[2.6vmin] font-black text-white uppercase tracking-[0.25em] leading-tight">
                Draft em Andamento
              </span>
              <span className="text-xs md:text-[1.2vmin] font-bold text-white/70 uppercase tracking-[0.25em]">
                {camp?.primeiro_pick === 'blue' ? tagDoLado('blue') : tagDoLado('red')} tem o first pick
              </span>
            </div>
          </motion.div>
        )}
        {['camp_jogo', 'camp_finalizada', 'iniciando_partida', 'partida_iniciada', 'encerrada'].includes(estado) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 md:p-[6vmin] text-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-1.5 md:gap-[1.6vmin]">
              <span className="text-lg md:text-[2.4vmin] font-black text-[#00FF41] uppercase tracking-[0.25em] leading-tight">
                {estado === 'camp_jogo'
                  ? 'Série em Andamento'
                  : estado === 'camp_finalizada'
                    ? 'Série Finalizada'
                    : estado === 'iniciando_partida'
                      ? 'Partida Pronta!'
                      : estado === 'partida_iniciada'
                        ? 'Partida em Andamento'
                        : 'Partida Encerrada'}
              </span>
              {serie && (
                <span className="text-2xl md:text-[4vmin] font-black text-white tabular-nums leading-none">
                  {serie.placar_a} - {serie.placar_b}
                </span>
              )}
              {camp?.lado_time_a && serie && (
                <span className="text-[11px] md:text-[1.15vmin] font-bold text-white/60 uppercase tracking-[0.2em] leading-relaxed">
                  {sala.time_a_tag} de {camp.lado_time_a === 'blue' ? 'azul' : 'vermelho'} · {sala.time_b_tag} de{' '}
                  {camp.lado_time_a === 'blue' ? 'vermelho' : 'azul'}
                </span>
              )}
              {!serie && estado === 'iniciando_partida' && (
                <span className="text-[11px] md:text-[1.15vmin] font-bold text-white/60 uppercase tracking-[0.2em]">
                  Código no painel abaixo
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* HUB HUD Overlay (igual à sala normal) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
          <div className="absolute top-8 md:top-10 flex flex-col items-center">
            <div className="w-12 md:w-[6vmin] h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/40 to-transparent mb-1 md:mb-2" />
            <span className="text-[10px] md:text-[0.9vmin] font-black text-[#FFB700]/60 uppercase tracking-[0.6em] md:tracking-[0.8em]">
              Summoner's Rift
            </span>
          </div>
          <div className="absolute bottom-8 md:bottom-10 flex flex-col items-center">
            <span className="text-[10px] md:text-[0.9vmin] font-black text-white/20 uppercase tracking-[0.5em]">
              FASE BETA V1
            </span>
            <div className="w-20 md:w-[10vmin] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-2" />
          </div>
        </div>
      </div>
    </div>
  );

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

            {/* Atualizar Resultado (campeonato): mesmo botão do cronograma —
                força a verificação da série na Riot AGORA. Visível para staff
                do campeonato e para os times da série (o servidor valida); o
                servidor também confere sozinho a cada 3 min. */}
            {!!serie && (ehStaffCampeonato || !!meuLado) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                disabled={!!ocupado}
                onClick={atualizarResultado}
                className="relative p-[1px] bg-[#00F0FF]/30 hover:bg-[#00F0FF]/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                style={{ clipPath: CUT_BUTTON }}
                title="Atualizar resultado — verifica a série na Riot agora"
              >
                <div
                  className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#001418] hover:bg-[#002229] flex items-center justify-center gap-1.5 text-[#00F0FF] transition-colors"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <RefreshCw className={`w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] ${ocupado === 'verificar-serie' ? 'animate-spin' : ''}`} />
                  <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                    Atualizar Resultado
                  </span>
                </div>
              </motion.button>
            )}

            {/* Iniciar Live (streamer): roxa estilo Twitch, ao lado de Convidar */}
            {perfil?.cargo === 'streamer' && !!serie && !camp?.live && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                disabled={!!ocupado}
                onClick={async () => {
                  const r = await chamar('/sala-campeonato/live');
                  if (r?.ok) toast.success('Live criada! Os jogadores já recebem o aviso de assistir.');
                }}
                className="relative p-[1px] bg-[#9146FF]/70 hover:bg-[#9146FF] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                style={{ clipPath: CUT_BUTTON }}
                title="Iniciar live na Twitch"
              >
                <div
                  className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#9146FF] hover:bg-[#a866ff] flex items-center justify-center gap-1.5 text-white transition-colors"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <Radio className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin]" />
                  <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                    Iniciar Live
                  </span>
                </div>
              </motion.button>
            )}

            {/* Encerrar Live (SÓ o streamer dono da live ativa): branca */}
            {perfil?.cargo === 'streamer' &&
              !!serie &&
              camp?.live?.id &&
              !!(perfil as any)?.twitch &&
              String((perfil as any).twitch).toLowerCase() === String(camp.live.twitch).toLowerCase() && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  disabled={!!ocupado}
                  onClick={encerrarLive}
                  className="relative p-[1px] bg-white/70 hover:bg-white transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  style={{ clipPath: CUT_BUTTON }}
                  title="Encerrar sua live"
                >
                  <div
                    className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-white hover:bg-white/95 flex items-center justify-center gap-1.5 text-black transition-colors"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0" />
                    <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                      Encerrar Live
                    </span>
                  </div>
                </motion.button>
              )}
          </div>
        </div>
      </motion.div>

      {/* ── ARENA (mesma estrutura da sala: times nas laterais + hub redondo) ─ */}
      <div className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-6 flex flex-col gap-4">
        <div className="w-full relative flex flex-col items-center justify-start md:justify-center md:flex-1 overflow-visible py-4 md:py-[2vmin]">
          <div className="w-full flex items-center justify-start md:justify-center z-20 flex-col md:flex-row gap-4 md:gap-[70vmin] py-2 md:py-0">
            {renderTimeColumn(equipeNoLado('blue'), 'blue')}
            {renderHub()}
            {renderTimeColumn(equipeNoLado('red'), 'red')}
          </div>

          {/* Banner da troca de lados — aparece junto com o deslize das
              colunas e some sozinho (~3s). pointer-events-none: não bloqueia. */}
          <AnimatePresence>
            {bannerTroca && (
              <motion.div
                key="banner-troca"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-1 md:top-[2vmin] left-1/2 -translate-x-1/2 z-[55] pointer-events-none"
              >
                <div className="px-5 py-2 md:px-[2.5vmin] md:py-[1.4vmin] bg-black/80 backdrop-blur-md border border-[#FFB700]/40 text-center whitespace-nowrap">
                  <p className="text-base md:text-[2.2vmin] font-black uppercase tracking-[0.35em] text-[#FFB700]">
                    Troca de Lados
                  </p>
                  <p className="mt-0.5 text-[9px] md:text-[1.1vmin] font-bold uppercase tracking-[0.2em] text-white/70">
                    {tagDoLado('blue')} joga de {ladoJogoA === 'blue' ? 'azul' : 'vermelho'} · {tagDoLado('red')} joga de {ladoJogoA === 'blue' ? 'vermelho' : 'azul'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ESCOLHA DE LADO — overlay interativo (mesmo padrão do overlay de
              confirmação da sala: z-[60], círculo central) */}
          <AnimatePresence>
            {estado === 'camp_lado' && (
              <motion.div
                key="overlay-lado"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84vw] h-[84vw] max-w-[340px] max-h-[340px] md:w-[55vmin] md:h-[55vmin] md:max-w-none md:max-h-none rounded-full bg-black/60 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4 md:p-[5vmin] border border-[#FFB700]/20"
              >
                <span className="text-base md:text-[2.2vmin] font-black text-[#FFB700] uppercase tracking-[0.25em] text-center leading-tight">
                  {!camp?.lado_escolhido
                    ? `${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO O LADO`
                    : `${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO FIRST OU LAST PICK`}
                </span>
                {!camp?.lado_escolhido && escolhendo && escolhendo === meuLadoEfetivo && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3 md:mt-[2vmin]">
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/lado', { lado: 'blue' })}
                      className="px-4 py-2 text-[11px] md:text-[1.3vmin] font-black uppercase text-black bg-[#00F0FF] disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      Escolher Azul
                    </button>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/lado', { lado: 'red' })}
                      className="px-4 py-2 text-[11px] md:text-[1.3vmin] font-black uppercase text-white bg-[#FF4655] disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      Escolher Vermelho
                    </button>
                  </div>
                )}
                {camp?.lado_escolhido && escolhendo && escolhendo === meuLadoEfetivo && !camp?.pick_order_escolhido && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3 md:mt-[2vmin]">
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'first' })}
                      className="px-4 py-2 text-[11px] md:text-[1.3vmin] font-black uppercase text-black bg-[#FFB700] disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      First Pick
                    </button>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'last' })}
                      className="px-4 py-2 text-[11px] md:text-[1.3vmin] font-black uppercase text-white border border-white/20 bg-white/10 disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      Last Pick
                    </button>
                  </div>
                )}
                {camp?.lado_escolhido && (
                  <span className="text-[11px] md:text-[1.15vmin] font-bold text-white/60 uppercase tracking-[0.2em] mt-3 md:mt-[2vmin] text-center">
                    {nomeDoLado(camp.lado_escolhido)} joga de {camp.lado_escolhido === 'blue' ? 'azul' : 'vermelho'}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* (O draft roda em tela cheia — early return acima; a sala volta
            sozinha quando o draft fecha) */}

        {/* Código + live */}
        <div className="flex flex-col items-center gap-3">
          {sala.codigo_partida && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col items-center gap-2 md:gap-[1.5vmin] pb-4"
            >
              <p className="text-xs md:text-[1.4vmin] font-black text-white uppercase tracking-[0.4em] md:tracking-[0.5em]">
                Prepare-se para a batalha
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={copiarCodigo}
                className="relative p-[1.5px] bg-black cursor-pointer"
                style={{ clipPath: CUT_FRAME }}
              >
                <span
                  className="block bg-[#FFB700] px-8 py-3.5 md:px-[12vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-sm md:text-[1.8vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-2 md:gap-[1.5vmin] transition-colors"
                  style={{ clipPath: CUT_INNER }}
                >
                  {codigoCopiado ? (
                    <Check className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin]" />
                  ) : (
                    <Copy className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin]" />
                  )}
                  {codigoCopiado ? 'Código Copiado!' : 'Copiar Código'}
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* NOTIFICAÇÃO "ASSISTA AO VIVO" — canto esquerdo inferior, branca,
              atualiza sozinha pelo polling/WS quando a live do jogo sobe */}
          {camp?.live && (
            <a
              href={`https://twitch.tv/${camp.live.twitch}`}
              target="_blank"
              rel="noreferrer"
              className="fixed left-3 bottom-3 sm:left-5 sm:bottom-5 z-[80] bg-white text-black shadow-2xl px-4 py-3 flex items-center gap-3 hover:scale-[1.03] transition-transform"
              style={{ clipPath: CUT_BUTTON }}
              title="Assistir na Twitch"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-black uppercase tracking-wide">Assista ao vivo</span>
                <span className="text-[11px] font-bold text-[#9146FF]">@{camp.live.twitch}</span>
              </span>
            </a>
          )}

          {/* (Transmissão migrou para o menu — botão Iniciar Live — e para a
              notificação fixa "Assista ao vivo") */}
        </div>
      </div>
    </div>
  );
}
