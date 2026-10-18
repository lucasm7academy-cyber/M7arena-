// src/features/sala-campeonato/SalaCampeonato.tsx
// Sala de TIMES (Campeonato ADR-085 e Time vs Time LIVRE ADR-086): MESMO VISUAL
// da sala normal — display redondo (anéis + hub + HUD), vagas usando o próprio
// componente VagaSlot (com a foto do time no lugar do ícone de rota) e top bar
// idêntica. O servidor é a autoridade; esta tela só desenha e pede ações.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Copy, Loader2, Radio, RefreshCw, RotateCcw, Share2, Shield, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { DraftRoom } from '../../components/draft/DraftRoom';
import { VagaSlot } from '../../components/partidas/VagaSlot';
import { useSalaRealtime } from '../../hooks/useSalaRealtime';
import { usePerfil } from '../../contexts/PerfilContext';
import { agoraServidor, registrarServerTime } from '../../lib/clockSync';
import { ROLE_CONFIG } from '../../api/salamod1';
import { buildChampionIconUrl, getDDRVersion } from '../../api/riot';
import { CutCard } from '../../components/ui/CutCard';

// Borda cortada no padrão das vagas/cards (mesmos cortes da sala normal).
const CUT_FRAME = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_INNER = 'polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)';
const CUT_BUTTON = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const CUT_BUTTON_INNER = 'polygon(7.8px 0, 100% 0, 100% calc(100% - 7.8px), calc(100% - 7.8px) 100%, 0 100%, 0 7.8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

// Nome do time em até 2 linhas quebrando SÓ nos espaços: o hífen vira hífen
// não separável (U+2011) — senão "E-sports" quebra no traço ("E-" / "sports")
// mesmo sem espaço ali, e o usuário quer a palavra inteira (18/10). O desenho
// do traço não muda.
const nomeSemQuebra = (n?: string | null) => (n ?? '').replace(/-/g, '\u2011');

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
  // Sala LIVRE (personalizada): a vaga é ocupada COM o time do jogador.
  sem_time: 'Você precisa criar ou entrar em um time para ocupar esta vaga.',
  mesmo_time: 'Esse time já está na outra vaga.',
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
  // Nomes dos campeões (pt-BR) para o layout pós-draft — uma busca só (CDN).
  const [nomesCampeoes, setNomesCampeoes] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const v = await getDDRVersion();
        const r = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/pt_BR/champion.json`);
        const j = await r.json();
        if (!vivo) return;
        const mapa: Record<string, string> = {};
        for (const c of Object.values(j?.data ?? {}) as any[]) mapa[c.id] = c.name;
        setNomesCampeoes(mapa);
      } catch {
        // Sem os nomes, o layout cai no id do campeão — nada trava.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
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
  // ── PÓS-DRAFT (killcam do último pick) ──────────────────────────────────────
  // Quando a ÚLTIMA escolha fecha o draft, o servidor muda a sala de camp_draft
  // para camp_jogo NO MESMO update. Por isso a tela não pode depender de estado/
  // efeito pra decidir que o draft (já fechado) ainda está na frente: o render
  // do fechamento cairia direto na sala e a killcam do último campeão nunca
  // rodava — sobrava um cronômetro de 10s no lugar dela (pedido do usuário
  // 18/10). A janela é DERIVADA do relógio (`finalizado_em`): segura o draft
  // ~1s além do fim da animação (2,2s de killcam + 0,5s de fade) e solta
  // sozinha de volta para a sala.
  const POS_DRAFT_MS = 3400;
  const posDraftFim = camp?.draft?.finalizado_em ? Date.parse(camp.draft.finalizado_em) : 0;
  const posDraftAtivo =
    camp?.draft?.status === 'finished' && posDraftFim > 0 && agoraServidor() - posDraftFim < POS_DRAFT_MS;
  // O tick de 1s também re-renderiza, mas este timeout solta a tela no instante
  // certo (sem esperar o próximo tick).
  useEffect(() => {
    if (!posDraftAtivo) return;
    const resta = Math.max(0, POS_DRAFT_MS - (agoraServidor() - posDraftFim));
    const t = setTimeout(() => setTick((x) => x + 1), resta + 30);
    return () => clearTimeout(t);
  }, [posDraftAtivo, posDraftFim]);
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

  // Verificar Partida (sala LIVRE / T vs T): mesmo acelerador das salas
  // normais — força a verificação da partida na Riot AGORA (avança a série ou
  // encerra). Fica disponível para QUALQUER jogador logado na sala (pedido do
  // usuário); o servidor valida (staff ou quem está na vaga) e o polling
  // automático continua rodando por trás.
  const verificarPartidaAgora = async () => {
    if ((sala?.estado ?? '') !== 'partida_iniciada') {
      toast('A verificação roda com a partida em andamento (depois do draft).', { icon: 'ℹ️' });
      return;
    }
    setOcupado('verificar-partida');
    try {
      const r = await fetch(`/api/matches/${id}/verificar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json().catch(() => null);
      if (j?.estado === 'encerrada') {
        const nome = j?.vencedor === 'A' ? sala?.time_a_nome ?? 'Time A' : sala?.time_b_nome ?? 'Time B';
        toast.success(`Partida finalizada! ${nome} venceu.`);
      } else if (j?.estado === 'cancelada') {
        toast.error('Partida cancelada — os nicks não conferiram ou o jogo não foi encontrado.');
      } else if (j?.motivo === 'serie_avancou' || j?.estado === 'camp_prontos') {
        toast.success('Jogo verificado! A série continua — de volta ao PRONTO.');
      } else if (j?.erro === 'estado_invalido') {
        toast.error('A sala não está em partida iniciada.');
      } else if (j?.erro === 'nao_participante') {
        toast.error('Só participantes da sala ou staff podem verificar.');
      } else if (j?.erro) {
        toast.error('Não foi possível verificar a partida.');
      } else {
        toast('Partida ainda em andamento ou não encontrada na Riot. A verificação automática continua.', { icon: 'ℹ️' });
      }
      await carregar();
    } catch {
      toast.error('Falha de rede.');
    } finally {
      setOcupado(null);
    }
  };

  // TEMPORÁRIO (admin): reseta a sala para o PRONTO do mesmo jogo — prontos
  // zerados, escolhas limpas e o draft do jogo atual apagado. Botão sai quando
  // o fluxo estiver 100% (pedido do usuário 13/10).
  const resetarSala = async () => {
    if (!window.confirm('Resetar a sala para o PRONTO? (zera os prontos, as escolhas e o draft deste jogo)')) return;
    const r = await chamar('/sala-campeonato/resetar');
    if (r?.ok) toast.success('Sala resetada para o PRONTO!');
  };

  if (erro) {    return (
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
  // Admin/proprietário: enxerga o botão TEMPORÁRIO de resetar a sala (pedido 13/10).
  const ehAdm = ['admin', 'proprietario'].includes((perfil as any)?.cargo ?? '');
  const jogadorBlue = jogadorDoLado('blue');
  const jogadorRed = jogadorDoLado('red');
  const meuJogador =
    jogadorBlue?.id === eu || jogadorBlue?.user_id === eu
      ? jogadorBlue
      : jogadorRed?.id === eu || jogadorRed?.user_id === eu
        ? jogadorRed
        : null;
  // Lado efetivo: a vaga ocupada manda (vale para campeonato E sala livre).
  // O shape legado pode mandar `side` VAZIO em algumas salas — normaliza com o
  // fallback por `is_time_a` (senão ninguém é "da vez" e os botões ficam presos).
  const ladoVaga: 'blue' | 'red' | null =
    meuJogador?.side === 'blue' || meuJogador?.side === 'red'
      ? (meuJogador.side as 'blue' | 'red')
      : meuJogador
        ? meuJogador.is_time_a
          ? 'blue'
          : 'red'
        : null;
  const meuLadoEfetivo: 'blue' | 'red' | null = ladoVaga ?? meuLado;
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
  // Escolha de lado/pick (ADR-092): o que ainda falta escolher neste jogo.
  const faltaLado = !camp?.lado_escolhido;
  const faltaPick = !camp?.pick_order_escolhido;
  // É a MINHA vez de escolher? (os botões aparecem para todos; quem não é da
  // vez vê tudo apagado/travado — claro que só o sorteado escolhe)
  const ehMinhaVez = !!escolhendo && escolhendo === meuLadoEfetivo;
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

  // Draft em TELA CHEIA + PÓS-DRAFT: durante o draft o DraftRoom ocupa a tela
  // (igual à sala normal); quando a última escolha fecha, a MESMA tela segura
  // até a killcam do último campeão terminar (`posDraftAtivo`, derivado do
  // relógio — sem cronômetro e sem tela separada) e então a sala volta.
  if (((estado === 'camp_draft') || posDraftAtivo) && camp?.draft) {
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
        espectadorCompleto
        timeA={{ nome: sala.time_a_nome, logo: sala.time_a_logo }}
        timeB={{ nome: sala.time_b_nome, logo: sala.time_b_logo }}
        placar={camp?.serie ? { a: camp.serie.placar_a ?? 0, b: camp.serie.placar_b ?? 0 } : null}
      />
    );
  }

  // ── TELA AO VIVO (partida em andamento): a MESMA casca do draft segue
  //    segurando a sala depois que o draft fecha — o relógio/turno dão lugar a
  //    times + placar + status e o botão de confirmar vira o CÓDIGO DA PARTIDA
  //    (pedido do usuário 18/10). Vale para a sala livre (iniciando_partida /
  //    partida_iniciada) e para a série do campeonato (camp_jogo).
  const aoVivoAtivo =
    estado === 'camp_jogo' ||
    estado === 'partida_iniciada' ||
    (!serie && estado === 'iniciando_partida');
  if (aoVivoAtivo && camp?.draft) {
    const placarA = serie ? (serie.placar_a ?? 0) : (camp?.placar_a ?? 0);
    const placarB = serie ? (serie.placar_b ?? 0) : (camp?.placar_b ?? 0);
    return (
      <div className="relative">
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
          espectadorCompleto
          timeA={{ nome: sala.time_a_nome, logo: sala.time_a_logo }}
          timeB={{ nome: sala.time_b_nome, logo: sala.time_b_logo }}
          placar={serie ? { a: placarA, b: placarB } : null}
          aoVivo={{
            status: estado === 'iniciando_partida' ? 'Partida Pronta!' : 'Partida Ao Vivo!',
            pulsante: estado !== 'iniciando_partida',
            placar: { a: placarA, b: placarB },
            legenda: serie
              ? `JOGO ${camp?.jogo ?? 1} · MD${serie.best_of ?? 3}`
              : camp?.formato
                ? `Série ${String(camp.formato).toUpperCase()}`
                : null,
            codigo: sala.codigo_partida ?? null,
            // Ícones do topo (pedido do usuário 18/10): Verificar Partida só
            // ícone ao lado do mudo, Twitch do streamer (iniciar live / abrir a
            // que está no ar) e a seta de sair da sala no canto oposto.
            acoes: {
              verificar: !serie && !!perfil && !['encerrada', 'cancelada'].includes(estado)
                ? { aoClicar: verificarPartidaAgora, carregando: ocupado === 'verificar-partida' }
                : null,
              twitch: perfil?.cargo === 'streamer'
                ? {
                    aoIniciar: camp?.live ? null : async () => {
                      const r = await chamar('/sala-campeonato/live');
                      if (r?.ok) toast.success('Live criada! Os jogadores já recebem o aviso de assistir.');
                    },
                    carregando: ocupado === '/sala-campeonato/live',
                    assistirHref: camp?.live ? `https://twitch.tv/${camp.live.twitch}` : null,
                  }
                : null,
              sair: () => navigate('/jogar'),
            },
          }}
        />

        {/* A tela ao vivo não tem a top bar da sala: os gatilhos que ainda
            importam com a partida rolando ficam neste canto, DEPOIS da seta de
            sair (que ocupa a ponta esquerda). O Verificar Partida virou ícone
            do topo direito, ao lado do mudo (pedido do usuário 18/10). O
            automático (polling/cron) continua rodando por trás de qualquer
            jeito. */}
        <div className="absolute left-[6vmin] top-[0.5vmin] z-[80] flex items-center gap-[0.8vmin]">
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
          {ehAdm && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              disabled={!!ocupado}
              onClick={resetarSala}
              className="relative p-[1px] bg-[#ef4444]/50 hover:bg-[#ef4444] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              style={{ clipPath: CUT_BUTTON }}
              title="Temporário: reseta a sala para o PRONTO (prontos, escolhas e draft)"
            >
              <div
                className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#1a0505] hover:bg-[#2a0808] flex items-center justify-center gap-1.5 text-[#ff8a8a] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <RotateCcw className={`w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] ${String(ocupado ?? '').includes('resetar') ? 'animate-spin' : ''}`} />
                <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                  Resetar Sala
                </span>
              </div>
            </motion.button>
          )}
        </div>

        {/* Notificação "Assista ao vivo" — vale igual na tela ao vivo */}
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
      </div>
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

  // A VAGA só aparece quando ela SERVE: ocupar (camp_vagas), marcar PRONTO
  // (camp_prontos — inclusive o PRONTO de novo dos jogos 2+ da série) e na
  // escolha de lado/pick. Com o jogo em andamento (iniciando_partida /
  // partida_iniciada) ou série finalizada ela sai de cena — pedido do usuário
  // (18/10): no lugar dela ficam os campeões escolhidos, maiores.
  const mostrarVaga = ['camp_vagas', 'camp_prontos', 'camp_lado'].includes(estado);

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
        {/* Etiqueta Blue-Side / Red-Side (igual à sala normal) — sai com o jogo
            em andamento: o espaço é dos campeões (pedido do usuário 18/10). */}
        {mostrarVaga && (
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
        )}

        {/* (Nome/logo do time saíram daqui — a identidade dos times fica no
            centro, estilo resumo; a coluna fica com o lado, a vaga quando ela
            serve [PRONTO] e os campeões escolhidos) */}

        {/* VAGA — visual idêntico ao da sala normal (foto do time no ícone).
            Some com o jogo em andamento: vaga só serve quando alguém precisa
            entrar/PRONTO (pedido do usuário 18/10). */}
        {mostrarVaga && (
          <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full">
            <VagaSlot
              ocupada={!!jogador}
              nome={jogador?.nome}
              tag={jogador?.tag}
              icone={jogador?.avatar}
              isTimeA={posicao === 'blue'}
              role={tagDoLado(lado) || (lado === 'blue' ? 'TIME A' : 'TIME B')}
              semRoleIcon
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
              aoSair={
                // Sair da vaga: antes do PRONTO e durante camp_prontos (o servidor
                // reseta os prontos e a sala volta a camp_vagas) — igual à sala
                // normal, para outro membro do time poder assumir a vaga.
                valorVaga && (estado === 'camp_vagas' || estado === 'camp_prontos')
                  ? () => chamar('/sala-campeonato/sair')
                  : undefined
              }
              roleIconImg={logoDoLado(lado) ?? ROLE_CONFIG.MID.img}
              vipTier="free"
              isFinalizada={estado === 'camp_finalizada' || estado === 'encerrada'}
            />
          </div>
        )}

        {/* Campeões escolhidos para ESTE confronto (picks do draft do jogo
            atual) — aparecem na sala depois que o draft fecha e, com o jogo em
            andamento, ocupam o lugar da vaga em destaque (maiores). */}
        {camp?.draft?.status === 'finished' && (
          <div className="flex items-center justify-center gap-1.5 md:gap-[0.8vmin] mt-1 md:mt-[0.6vmin]">
            {(lado === 'blue' ? camp.draft.blue_picks : camp.draft.red_picks)
              .filter(Boolean)
              .map((c: string, i: number) => (
                <img
                  key={`${c}-${i}`}
                  src={buildChampionIconUrl(c)}
                  alt={c}
                  title={c}
                  className="w-12 h-12 md:w-[8vmin] md:h-[8vmin] object-cover border border-white/15"
                  referrerPolicy="no-referrer"
                />
              ))}
          </div>
        )}

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

  // ── CENTRO NO ESTILO TRANSMISSÃO (pós-draft): logos dos times X placar da
  //    série — SEM o display redondo (pedido do usuário). Todos os avisos de
  //    estado continuam aqui, no formato limpo. Desktop: absoluto no meio;
  //    Mobile: entra no fluxo vertical.
  const renderHub = () => (
    <div className="relative md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full max-w-[440px] md:w-[40vmin] md:max-w-none z-10 flex flex-col items-center justify-center gap-2 md:gap-[1.4vmin] shrink-0 my-4 md:my-0 px-3 md:px-0 text-center">
      <div className="w-12 md:w-[6vmin] h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/40 to-transparent" />
      <span className="text-[10px] md:text-[0.9vmin] font-black text-[#FFB700]/60 uppercase tracking-[0.6em] md:tracking-[0.8em]">
        Summoner's Rift
      </span>

      {/* Logos + nomes dos times e placar da série (estilo resumo pós-draft) */}
      <div className="flex items-center justify-center gap-3 md:gap-[3vmin] mt-1 md:mt-[0.5vmin]">
        <div className="flex flex-col items-center gap-1 md:gap-[0.8vmin] w-[18vmin]">
          {sala.time_a_logo ? (
            <img
              src={sala.time_a_logo}
              alt=""
              className="w-20 h-20 md:w-[14vmin] md:h-[14vmin] object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]"
            />
          ) : (
            <div className="w-20 h-20 md:w-[14vmin] md:h-[14vmin]" />
          )}
          <span className="text-[10px] md:text-[1.3vmin] font-black uppercase tracking-[0.2em] text-white/90 leading-tight line-clamp-2 max-w-full">
            {nomeSemQuebra(sala.time_a_nome)}
          </span>
        </div>
        <span className="text-2xl md:text-[3.2vmin] font-black text-white/50 leading-none">X</span>
        <div className="flex flex-col items-center gap-1 md:gap-[0.8vmin] w-[18vmin]">
          {sala.time_b_logo ? (
            <img
              src={sala.time_b_logo}
              alt=""
              className="w-20 h-20 md:w-[14vmin] md:h-[14vmin] object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]"
            />
          ) : (
            <div className="w-20 h-20 md:w-[14vmin] md:h-[14vmin]" />
          )}
          <span className="text-[10px] md:text-[1.3vmin] font-black uppercase tracking-[0.2em] text-white/90 leading-tight line-clamp-2 max-w-full">
            {nomeSemQuebra(sala.time_b_nome)}
          </span>
        </div>
      </div>
      {serie && (
        <span className="text-3xl md:text-[5vmin] font-black tabular-nums text-white leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
          {serie.placar_a} <span className="text-white/40">-</span> {serie.placar_b}
        </span>
      )}
      {!serie && camp?.formato && (
        <>
          <span className="text-3xl md:text-[5vmin] font-black tabular-nums text-white leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
            {camp.placar_a ?? 0} <span className="text-white/40">-</span> {camp.placar_b ?? 0}
          </span>
          <span className="text-[10px] md:text-[1.1vmin] font-black uppercase tracking-[0.4em] text-white/50 mt-1 md:mt-[0.6vmin]">
            Série {String(camp.formato).toUpperCase()}
          </span>
        </>
      )}

      {/* Estado da sala — mesmos avisos de antes, no estilo limpo.
          O aviso "Aguardando os Times" saiu da sala LIVRE (T vs T) — pedido
          do usuário; no campeonato ele continua (o par é definido pela série). */}
      {estado === 'camp_vagas' && serie && (
        <div className="flex flex-col items-center gap-0.5 md:gap-[0.8vmin] mt-1 md:mt-[0.6vmin]">
          <span className="text-lg md:text-[2.4vmin] font-black text-white uppercase tracking-[0.25em]">Aguardando os Times</span>
          <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/70 uppercase tracking-[0.3em]">Cada lado ocupa a sua vaga</span>
        </div>
      )}
      {/* (O aviso "Marquem PRONTO" saiu do centro — pedido do usuário; o
          estado já aparece no topo da sala e nos botões de PRONTO) */}
      {estado === 'camp_draft' && (
        <div className="flex flex-col items-center gap-0.5 md:gap-[0.8vmin] mt-1 md:mt-[0.6vmin]">
          <span className="text-lg md:text-[2.4vmin] font-black text-white uppercase tracking-[0.25em]">Draft em Andamento</span>
          <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/70 uppercase tracking-[0.25em]">
            {camp?.primeiro_pick === 'blue' ? tagDoLado('blue') : tagDoLado('red')} tem o first pick
          </span>
        </div>
      )}
      {['camp_jogo', 'camp_finalizada', 'iniciando_partida', 'partida_iniciada', 'encerrada'].includes(estado) && (
        <div className="flex flex-col items-center gap-0.5 md:gap-[0.8vmin] mt-1 md:mt-[0.6vmin]">
          <span className="inline-flex items-center gap-1.5 md:gap-[0.8vmin] text-lg md:text-[2.2vmin] font-black text-[#00FF41] uppercase tracking-[0.25em]">
            {/* Ponto vermelho pulsante = "ao vivo" (mesmo indicador das lives
                da sala) — pedido do usuário 18/10. */}
            {estado === 'partida_iniciada' && (
              <span className="w-2 h-2 md:w-[1.1vmin] md:h-[1.1vmin] rounded-full bg-red-500 animate-pulse shrink-0" />
            )}
            {estado === 'camp_jogo'
              ? 'Série em Andamento'
              : estado === 'camp_finalizada'
                ? 'Série Finalizada'
                : estado === 'iniciando_partida'
                  ? 'Partida Pronta!'
                  : estado === 'partida_iniciada'
                    ? 'Partida Ao Vivo!'
                    : 'Partida Encerrada'}
          </span>
          {camp?.lado_time_a && serie && (
            <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/60 uppercase tracking-[0.2em] leading-relaxed">
              {sala.time_a_tag} de {camp.lado_time_a === 'blue' ? 'azul' : 'vermelho'} · {sala.time_b_tag} de{' '}
              {camp.lado_time_a === 'blue' ? 'vermelho' : 'azul'}
            </span>
          )}
          {!serie && estado === 'iniciando_partida' && (
            <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/60 uppercase tracking-[0.2em]">
              Código no painel abaixo
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ── SÉRIE EM ANDAMENTO (camp_jogo): layout estilo "Escolhas concluídas" —
  //    logos grandes X, campeões do confronto e as VAGAS em chips logo abaixo
  //    de cada time (o botão de copiar código fica embaixo, como está).
  //    `finalizada` = PARTIDA FINALIZADA da sala LIVRE (T vs T): mesmo layout
  //    com faixa de título, vencedor dourado e o placar da série local — pedido
  //    do usuário (a sala não puxava a partida finalizada).
  const renderPosDraft = (finalizada = false) => {
    const ladoA: 'blue' | 'red' = camp?.lado_time_a === 'red' ? 'red' : 'blue';
    const placarA = serie ? (serie.placar_a ?? 0) : (camp?.placar_a ?? 0);
    const placarB = serie ? (serie.placar_b ?? 0) : (camp?.placar_b ?? 0);
    // Vencedor: `vencedor` legado ('A' | 'B') — o último jogo foi o que fechou
    // a série. Sem ele, cai para a comparação do placar.
    const vencedorSerie: 'A' | 'B' | null =
      sala.vencedor === 'A' || sala.vencedor === 'B'
        ? sala.vencedor
        : placarA === placarB
          ? null
          : placarA > placarB
            ? 'A'
            : 'B';
    const nomeVencedor =
      vencedorSerie === 'A' ? sala.time_a_nome : vencedorSerie === 'B' ? sala.time_b_nome : null;
    const duracao =
      finalizada && sala.resultado_riot?.duracao_s
        ? `${Math.floor(sala.resultado_riot.duracao_s / 60)}:${String(
            Math.round(sala.resultado_riot.duracao_s % 60)
          ).padStart(2, '0')}`
        : null;
    const bloco = (posicao: 'blue' | 'red') => {
      const vaga: 'blue' | 'red' = ladoA === posicao ? 'blue' : 'red';
      const isA = vaga === 'blue';
      const picks = ((isA ? camp?.draft?.blue_picks : camp?.draft?.red_picks) ?? []).filter(Boolean) as string[];
      const logo = isA ? sala.time_a_logo : sala.time_b_logo;
      const nome = isA ? sala.time_a_nome : sala.time_b_nome;
      const cor = posicao === 'blue' ? '#3B82F6' : '#ef4444';
      const venceu = finalizada && ((isA && vencedorSerie === 'A') || (!isA && vencedorSerie === 'B'));
      return (
        <div className="flex flex-col items-center gap-2 md:gap-[1.6vmin] w-[46vmin] max-w-full">
          <div className="relative">
            {logo ? (
              <img
                src={logo}
                alt=""
                className={`w-16 h-16 md:w-[12vmin] md:h-[12vmin] object-contain ${
                  venceu
                    ? 'drop-shadow-[0_0_45px_rgba(255,183,0,0.6)]'
                    : posicao === 'blue'
                      ? 'drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]'
                      : 'drop-shadow-[0_0_30px_rgba(239,68,68,0.35)]'
                }`}
              />
            ) : (
              <div className="w-16 h-16 md:w-[12vmin] md:h-[12vmin]" />
            )}
            {venceu && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 md:px-[1vmin] md:py-[0.3vmin] bg-[#FFB700] text-black text-[9px] md:text-[1.05vmin] font-black uppercase tracking-[0.25em] whitespace-nowrap shadow-[0_0_18px_rgba(255,183,0,0.5)]">
                Vencedor
              </span>
            )}
          </div>
          <span className="text-[11px] md:text-[1.6vmin] font-black uppercase tracking-[0.25em] leading-tight line-clamp-2 max-w-full" style={{ color: cor }}>
            {nomeSemQuebra(nome)}
          </span>

          {/* Campeões escolhidos neste confronto */}
          <div className="flex items-center justify-center gap-1 md:gap-[0.8vmin]">
            {picks.map((c, i) => (
              <div key={`${c}-${i}`} className="flex flex-col items-center gap-[0.3vmin]">
                <img
                  src={buildChampionIconUrl(c)}
                  alt={c}
                  title={c}
                  className="w-10 h-10 md:w-[9vmin] md:h-[9vmin] object-cover border border-white/15"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[9px] md:text-[1vmin] font-bold text-white/70 uppercase truncate max-w-[9vmin]">
                  {nomesCampeoes[c] ?? c}
                </span>
              </div>
            ))}
          </div>

          {/* (A vaga do jogador saiu daqui — com o jogo em andamento ela não
              serve; quem manda é o jogo. A vaga volta nas fases de PRONTO.
              Pedido do usuário 18/10.) */}
        </div>
      );
    };
    return (
      <div className="w-full flex flex-col items-center gap-3 md:gap-[2.5vmin] py-4">
        {/* PARTIDA FINALIZADA (sala livre T vs T): faixa de título + vencedor
            + duração do último jogo — mesmo espírito das outras salas. */}
        {finalizada && (
          <div className="flex flex-col items-center gap-1 md:gap-[0.9vmin]">
            <span className="px-4 py-1.5 md:px-[2.4vmin] md:py-[1vmin] bg-[#FFB700] text-black text-sm md:text-[2.1vmin] font-black uppercase tracking-[0.35em] shadow-[0_0_30px_rgba(255,183,0,0.35)]">
              Partida Finalizada
            </span>
            <span className="text-[10px] md:text-[1.35vmin] font-bold uppercase tracking-[0.25em] text-white/75 text-center">
              {nomeVencedor ? `${nomeVencedor} venceu` : 'Empate'}
              {` · série ${String(camp?.formato ?? 'md3').toUpperCase()}`}
              {duracao ? ` · último jogo ${duracao}` : ''}
            </span>
          </div>
        )}
        <div className="w-full flex items-center justify-center gap-3 md:gap-[6vmin]">
          {bloco('blue')}
          <span className="text-3xl md:text-[5vmin] font-black text-white/50 leading-none drop-shadow-lg">X</span>
          {bloco('red')}
        </div>
        {(serie || finalizada) && (
          <span className="text-3xl md:text-[5vmin] font-black tabular-nums text-white leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
            {placarA} <span className="text-white/40">-</span> {placarB}
          </span>
        )}
        <span
          className={`text-[10px] md:text-[1.1vmin] font-black uppercase tracking-[0.4em] ${
            finalizada ? 'text-[#FFB700]' : 'text-[#00FF41]'
          }`}
        >
          {finalizada ? 'Série Finalizada' : 'Série em Andamento'}
        </span>
      </div>
    );
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

            {/* Verificar Partida (sala LIVRE / T vs T): mesmo acelerador das
                salas normais — força a verificação na Riot AGORA (avança a
                série ou encerra). Visível para QUALQUER jogador logado, em
                qualquer fase da sala (pedido do usuário); o servidor valida
                (staff ou vaga) e o polling automático continua por trás. */}
            {!serie && !!perfil && !['encerrada', 'cancelada'].includes(estado) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                disabled={!!ocupado}
                onClick={verificarPartidaAgora}
                className="relative p-[1px] bg-[#00F0FF]/30 hover:bg-[#00F0FF]/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                style={{ clipPath: CUT_BUTTON }}
                title="Verificar partida — confere na Riot agora"
              >
                <div
                  className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#001418] hover:bg-[#002229] flex items-center justify-center gap-1.5 text-[#00F0FF] transition-colors"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <RefreshCw className={`w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] ${ocupado === 'verificar-partida' ? 'animate-spin' : ''}`} />
                  <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                    Verificar Partida
                  </span>
                </div>
              </motion.button>
            )}

            {/* TEMPORÁRIO (admin): resetar a sala pro PRONTO — sai quando o
                fluxo estiver 100% (pedido do usuário 13/10). */}
            {ehAdm && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                disabled={!!ocupado}
                onClick={resetarSala}
                className="relative p-[1px] bg-[#ef4444]/50 hover:bg-[#ef4444] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                style={{ clipPath: CUT_BUTTON }}
                title="Temporário: reseta a sala para o PRONTO (prontos, escolhas e draft)"
              >
                <div
                  className="h-8 sm:h-9 md:h-[4.4vmin] px-3 md:px-[1.6vmin] bg-[#1a0505] hover:bg-[#2a0808] flex items-center justify-center gap-1.5 text-[#ff8a8a] transition-colors"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <RotateCcw className={`w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] ${String(ocupado ?? '').includes('resetar') ? 'animate-spin' : ''}`} />
                  <span className="text-[10.5px] md:text-[1.15vmin] font-black uppercase tracking-wider hidden sm:inline">
                    Resetar Sala
                  </span>
                </div>
              </motion.button>
            )}

            {/* Iniciar Live (streamer): roxa estilo Twitch, ao lado de Convidar.
                Vale pra campeonato E scrim (T vs T livre). */}
            {perfil?.cargo === 'streamer' && !camp?.live && (
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
          {estado === 'camp_jogo' || (!serie && estado === 'encerrada') ? (
            <div className="w-full flex items-center justify-center z-20 py-2 md:py-0">
              {renderPosDraft(!serie && estado === 'encerrada')}
            </div>
          ) : (
          <div className="w-full flex items-center justify-start md:justify-center z-20 flex-col md:flex-row gap-4 md:gap-[70vmin] py-2 md:py-0">
            {renderTimeColumn(equipeNoLado('blue'), 'blue')}
            {renderHub()}
            {renderTimeColumn(equipeNoLado('red'), 'red')}
          </div>
          )}

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

          {/* ESCOLHA DE LADO/PICK — painel limpo SEM o display redondo (pedido
              do usuário): 4 botões de tamanho IGUAL e uniforme, centralizados.
              Quem é da vez vê os botões; os demais acompanham o aviso. */}
          <AnimatePresence>
            {estado === 'camp_lado' && (
              <motion.div
                key="overlay-lado"
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[86vw] max-w-[400px] md:w-[52vmin] md:max-w-[52vmin]"
              >
                {/* Card SÓLIDO (sem transparência preta) com a BORDA INTEIRA nos
                    cantos recortados — via CutCard (a borda segue o corte). */}
                <CutCard
                  borderColor="#FFB700"
                  background="#0A0A0A"
                  className="w-full"
                  contentClassName="flex flex-col items-center gap-3 md:gap-[1.8vmin] p-4 md:p-[3vmin]"
                >
                <span className="text-base md:text-[2.2vmin] font-black text-[#FFB700] uppercase tracking-[0.25em] text-center leading-tight">
                  {faltaLado && faltaPick
                    ? `#${tagDoLado(escolhendo)} ESCOLHE LADO OU PICK:`
                    : faltaLado
                      ? `#${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO O LADO:`
                      : faltaPick
                        ? `#${tagDoLado(escolhendo)} ESTÁ ESCOLHENDO FIRST OU LAST PICK:`
                        : 'ESCOLHAS CONCLUÍDAS'}
                </span>

                {/* Escolhedor com as DUAS opções abertas: linha de cima = LADO
                    (vermelho/azul); linha de baixo = PICK (first/last) — 4
                    botões UNIFORMES (mesmo tamanho) em grid de 2 colunas. */}
                {faltaLado && faltaPick && (
                  <div className={`w-full flex flex-col gap-2 md:gap-[1.4vmin] ${ehMinhaVez ? '' : 'opacity-40 pointer-events-none'}`}>
                    <span className="text-[9px] md:text-[1.05vmin] font-black text-white/40 uppercase tracking-[0.3em] text-center">
                      Lado
                    </span>
                    <div className="grid grid-cols-2 gap-2 md:gap-[1.4vmin]">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'red' })}
                        className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-white bg-[#FF4655] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Vermelho
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/lado', { lado: 'blue' })}
                        className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black bg-[#00F0FF] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Azul
                      </button>
                    </div>
                    <span className="text-[9px] md:text-[1.05vmin] font-black text-white/40 uppercase tracking-[0.3em] text-center mt-1 md:mt-[0.6vmin]">
                      Pick
                    </span>
                    <div className="grid grid-cols-2 gap-2 md:gap-[1.4vmin]">
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'first' })}
                        className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black bg-[#00FF41] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        First
                      </button>
                      <button
                        disabled={!!ocupado}
                        onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'last' })}
                        className="w-full disabled:opacity-50 cursor-pointer group"
                      >
                        <CutCard
                          borderColor="#FFC400"
                          background="#FFB700"
                          className="h-11 md:h-[7vmin] w-full"
                          contentClassName="h-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black transition-[filter] group-hover:brightness-110"
                        >
                          Last
                        </CutCard>
                      </button>
                    </div>
                  </div>
                )}

                {/* Só falta o LADO (o adversário escolheu o pick primeiro) */}
                {faltaLado && !faltaPick && (
                  <div className={`w-full grid grid-cols-2 gap-2 md:gap-[1.4vmin] ${ehMinhaVez ? '' : 'opacity-40 pointer-events-none'}`}>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/lado', { lado: 'red' })}
                      className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-white bg-[#FF4655] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      Vermelho
                    </button>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/lado', { lado: 'blue' })}
                      className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black bg-[#00F0FF] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      Azul
                    </button>
                  </div>
                )}

                {/* Só falta o PICK (o adversário escolheu o lado primeiro) */}
                {!faltaLado && faltaPick && (
                  <div className={`w-full grid grid-cols-2 gap-2 md:gap-[1.4vmin] ${ehMinhaVez ? '' : 'opacity-40 pointer-events-none'}`}>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'first' })}
                      className="h-11 md:h-[7vmin] w-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black bg-[#00FF41] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      First Pick
                    </button>
                    <button
                      disabled={!!ocupado}
                      onClick={() => chamar('/sala-campeonato/pick-order', { ordem: 'last' })}
                      className="w-full disabled:opacity-50 cursor-pointer group"
                    >
                      <CutCard
                        borderColor="#FFC400"
                        background="#FFB700"
                        className="h-11 md:h-[7vmin] w-full"
                        contentClassName="h-full flex items-center justify-center text-[11px] md:text-[1.5vmin] font-black uppercase text-black transition-[filter] group-hover:brightness-110"
                      >
                        Last Pick
                      </CutCard>
                    </button>
                  </div>
                )}

                {/* Resumo do que já foi decidido */}
                {camp?.lado_escolhido && (
                  <span className="text-[11px] md:text-[1.15vmin] font-bold text-white/60 uppercase tracking-[0.2em] text-center">
                    {nomeDoLado(camp.lado_escolhido)} joga de {camp.lado_escolhido === 'blue' ? 'azul' : 'vermelho'}
                    {camp?.pick_order_escolhido ? ` · ${camp.pick_order_escolhido === 'first' ? 'First' : 'Last'} pick` : ''}
                  </span>
                )}
                {!camp?.lado_escolhido && camp?.pick_order_escolhido && (
                  <span className="text-[11px] md:text-[1.15vmin] font-bold text-white/60 uppercase tracking-[0.2em] text-center">
                    {camp.pick_order_escolhido === 'first' ? 'First' : 'Last'} pick já escolhido
                  </span>
                )}
                </CutCard>
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
                  className="block bg-[#FFB700] px-6 py-2.5 md:px-[8vmin] md:py-[1.6vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[11px] md:text-[1.5vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-2 md:gap-[1.2vmin] transition-colors"
                  style={{ clipPath: CUT_INNER }}
                >
                  {codigoCopiado ? (
                    <Check className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin]" />
                  ) : (
                    <Copy className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin]" />
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
