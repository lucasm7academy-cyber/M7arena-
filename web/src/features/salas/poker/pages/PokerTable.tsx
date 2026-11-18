// Mesa da Sala M7 (/sala-m7/:roomId): feltro, assentos, board, HUD de ação,
// histórico e o caixa da essência. O servidor só decide buy-in e cashout; as
// mãos rodam no motor local contra os bots da casa.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, DoorOpen, Play, RefreshCw, ShieldAlert, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatChips, type LogEntry, type Street } from '../domain/engine';
import { POKER_ROOMS, type PokerRoom } from '../domain/lobby-data';
import { usePokerRoom } from '../hooks/usePokerRoom';
import { PokerSeat } from '../components/PokerSeat';
import { PlayingCard, EmptyCardSlot } from '../components/PlayingCard';
import { ActionBar } from '../components/ActionBar';
import { HandLog } from '../components/HandLog';
import { EssenceIcon } from '../components/EssenceIcon';
import { PokerDealer, type DealerMood } from '../components/PokerDealer';
import { api } from '../../../../lib/api';
import { ModalSenhaSala } from '../../../../components/partidas/ModaisElegibilidade';
import { toLobbyRoom, type LobbyRoom } from '../components/RoomCard';

const RUA: Record<Street, string> = {
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  complete: 'Mão encerrada',
};

const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';

function posicaoDoAssento(indice: number, total: number): CSSProperties {
  const angulo = ((90 + (indice * 360) / total) * Math.PI) / 180;
  return {
    '--seat-x': `${50 + 38 * Math.cos(angulo)}%`,
    '--seat-y': `${50 + 38 * Math.sin(angulo)}%`,
  } as CSSProperties;
}

/* ---------------------------------------------------------------- */
/* Estados de entrada (login, carregando, sem saldo, erro)           */
/* ---------------------------------------------------------------- */

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 text-white sm:p-6">
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 pt-10">
        <Link
          to="/sala-m7"
          className="inline-flex items-center gap-1.5 self-start text-[10px] font-black uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Voltar para as mesas
        </Link>
        {children}
      </div>
    </div>
  );
}

function Aviso({
  icone,
  titulo,
  texto,
  acoes,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  acoes: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-[10px] border border-white/12 bg-[rgba(13,13,13,0.8)] p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-[4px] border border-[#FFB700]/35 bg-[#FFB700]/10">
        {icone}
      </div>
      <h1 className="text-lg font-black uppercase tracking-[0.12em] text-white">{titulo}</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{texto}</p>
      <div className="mt-4 flex flex-wrap gap-2">{acoes}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Mesa                                                              */
/* ---------------------------------------------------------------- */

function Mesa({ room, password }: { room: PokerRoom; password?: string }) {
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const {
    fase,
    mensagem,
    falta,
    ea,
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
    sessaoId,
    novaMao,
    agir,
    sacar,
    tentarDeNovo,
  } = usePokerRoom(room, password);

  const [saidaAberta, setSaidaAberta] = useState(false);

  // Sair pelo navegador/fechar a aba não pode passar silencioso: a sessão da
  // mesa fica aberta no servidor até o cashout.
  useEffect(() => {
    if (!sessaoId) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sessaoId]);

  useEffect(() => {
    if (!saidaAberta) return;
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setSaidaAberta(false);
    };
    window.addEventListener('keydown', fecharComEsc);
    return () => window.removeEventListener('keydown', fecharComEsc);
  }, [saidaAberta]);

  const confirmarSaque = useCallback(async () => {
    const resultado = await sacar();
    if (!resultado.ok) return;
    if (resultado.jaEncerrada) {
      toast('Sua sessão de mesa já estava encerrada. Confira o saldo de essência.', {
        icon: 'ℹ️',
      });
    } else {
      toast.success(`Você saiu com ${formatChips(resultado.payout)} EA`);
    }
    navigate('/sala-m7');
  }, [sacar, navigate]);

  const abrirSaida = () => {
    if (!sessaoId) {
      navigate('/sala-m7');
      return;
    }
    setSaidaAberta(true);
  };

  if (fase === 'login') {
    return (
      <Casca>
        <Aviso
          icone={<DoorOpen className="h-5 w-5 text-[#FFB700]" />}
          titulo="Entre para sentar"
          texto="A vitrine é pública, mas o buy-in da mesa usa a essência da sua conta."
          acoes={
            <Link
              to="/login"
              className="rounded-[4px] bg-[#FFB700] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black"
            >
              Entrar na conta
            </Link>
          }
        />
      </Casca>
    );
  }

  if (fase === 'carregando') {
    return (
      <Casca>
        <div className="w-full rounded-[10px] border border-white/12 bg-[rgba(13,13,13,0.8)] p-10 text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#FFB700] border-t-transparent" />
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
            Preparando sua mesa…
          </p>
        </div>
      </Casca>
    );
  }

  if (fase === 'sem-saldo') {
    return (
      <Casca>
        <Aviso
          icone={<ShieldAlert className="h-5 w-5 text-[#FFB700]" />}
          titulo="Falta essência para sentar"
          texto={
            falta > 0
              ? `Esta mesa pede ${formatChips(room.buyIn)} EA de buy-in. Faltam ${formatChips(falta)} EA no seu saldo${ea !== null ? ` de ${formatChips(ea)} EA` : ''}.`
              : mensagem ?? 'Saldo de essência insuficiente para este buy-in.'
          }
          acoes={
            <>
              <button
                type="button"
                onClick={tentarDeNovo}
                className="rounded-[4px] border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white/70 transition-colors hover:border-white/35 hover:text-white"
              >
                Conferir saldo
              </button>
              <Link
                to="/sala-m7"
                className="rounded-[4px] bg-[#FFB700] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black"
              >
                Ver outra mesa
              </Link>
            </>
          }
        />
      </Casca>
    );
  }

  if (fase === 'erro' || !estado || !heroi) {
    return (
      <Casca>
        <Aviso
          icone={<WifiOff className="h-5 w-5 text-[#FFB700]" />}
          titulo="Não foi possível abrir a mesa"
          texto={mensagem ?? 'A mesa não respondeu. Tente de novo em instantes.'}
          acoes={
            <>
              <button
                type="button"
                onClick={() => password ? navigate(`/sala-m7/${room.id}`, { replace: true, state: null }) : tentarDeNovo()}
                className="flex items-center gap-1.5 rounded-[4px] bg-[#FFB700] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black"
              >
                <RefreshCw className="h-3 w-3" />
                {password ? 'Informar senha novamente' : 'Tentar de novo'}
              </button>
              <Link
                to="/sala-m7"
                className="rounded-[4px] border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white/70 transition-colors hover:border-white/35 hover:text-white"
              >
                Voltar para as mesas
              </Link>
            </>
          }
        />
      </Casca>
    );
  }

  const assentoDaVez = estado.actor >= 0 ? estado.seats[estado.actor] : null;
  const lucroDaMao = (heroi.won ?? 0) - heroi.total;
  const semFichas = heroi.stack <= 0;
  const log: LogEntry[] = estado.log;

  const statusTexto = ehVezDoHeroi
    ? 'Sua vez'
    : assentoDaVez
      ? `${assentoDaVez.name} está pensando…`
      : maoEncerrada
        ? 'Mão encerrada'
        : 'Distribuindo as cartas…';

  // O crupiê acompanha a rua: distribui no pré-flop/flop, revela no turn/river
  // e descansa no resultado (dourado se o herói levou, vermelho se perdeu).
  const humorDoCrupie: DealerMood = maoEncerrada
    ? 'result'
    : estado.street === 'turn' || estado.street === 'river'
      ? 'showdown'
      : estado.street === 'preflop' || estado.street === 'flop'
        ? 'deal'
        : 'idle';
  const heroVenceu = (heroi.won ?? 0) > 0;

  return (
    <div className="relative min-h-screen bg-[#040406] pb-4 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 15%,rgba(56,232,255,.12),transparent 50%),radial-gradient(ellipse at 90% 65%,rgba(255,95,162,.10),transparent 55%)', boxShadow: 'inset 0 0 160px #000' }} />
      <div className="relative mx-auto max-w-[1320px] space-y-3 px-3 pt-3 sm:px-5 sm:pt-5">
        {/* Barra da mesa */}
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-transparent px-3 py-2 backdrop-blur-xl shadow-[inset_0_0_0_1px_#ffffff0f,0_0_22px_#38e8ff12]" style={{ background: 'linear-gradient(#0d0d14e8,#0d0d14e8) padding-box,linear-gradient(110deg,#38e8ff55,#ff5fa240) border-box' }}>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={abrirSaida}
              aria-label="Voltar e resgatar a essência da mesa"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-red-400/50 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="leading-none">
              <p className="text-xs font-black uppercase italic tracking-tight text-cyan-200">
                {room.name}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Blinds {formatChips(room.sb)}/{formatChips(room.bb)} · {room.seats} lugares
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-[3px] border border-[#3FCBB8]/25 bg-[#3FCBB8]/[0.06] px-2 py-1.5">
              <EssenceIcon size={12} />
              <span className="text-[11px] font-black tabular-nums text-[#6fe3d0]">
                {ea === null ? '—' : `${formatChips(ea)}`}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/30">EA</span>
            </div>

            <button
              type="button"
              onClick={abrirSaida}
              className="flex items-center gap-1.5 rounded-[3px] border border-white/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/65 transition-colors hover:border-[#e0679b]/60 hover:text-white"
            >
              <DoorOpen className="h-3 w-3" />
              Sair da mesa
            </button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div className="min-w-0">
            {/* Feltro — o crupiê fica atrás, com a mesa cobrindo a cintura */}
            <div
              className="relative"
              style={{ '--dealer-h': 'clamp(150px, 30vw, 300px)' } as CSSProperties}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center select-none"
                style={{ height: 'var(--dealer-h)' }}
              >
                <PokerDealer mood={humorDoCrupie} heroWon={heroVenceu} />
              </div>

              <div
                className="relative z-10 rounded-[40px] p-[8px] shadow-[0_30px_70px_#000,inset_0_0_0_1px_#ffffff16,0_0_28px_#38e8ff12]"
                style={{
                  background: 'linear-gradient(155deg, #4d4530 0%, #111316 30%, #08090b 60%, #332b1b 100%)',
                  marginTop: 'calc(var(--dealer-h) * 0.55)',
                }}
              >
              <div
                className="relative overflow-hidden rounded-[32px] shadow-[inset_0_0_65px_#0009,inset_0_0_0_1px_#ffb70055] md:min-h-[570px]"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 42%, #155546 0%, #0a302b 48%, #041714 100%)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.16]"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px)',
                    backgroundSize: '3px 3px',
                  }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[15px] ring-1 ring-inset ring-[#c8aa6e]/25"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-[7%] hidden rounded-[50%] border border-white/8 md:block"
                />

                {/* Assentos: grade no retrato, posições na elipse a partir do md. */}
                <div className="relative z-20 grid grid-cols-2 gap-x-1 gap-y-4 px-1 py-4 sm:grid-cols-3 md:contents">
                  {estado.seats.map((assento, indice) => (
                    <div
                      key={assento.id}
                      className={[
                        'md:absolute md:z-20 md:w-[172px] md:-translate-x-1/2 md:-translate-y-1/2',
                        'md:left-[var(--seat-x)] md:top-[var(--seat-y)]',
                        assento.isHero ? 'order-last md:order-none' : '',
                      ].join(' ')}
                      style={posicaoDoAssento(indice, estado.seats.length)}
                    >
                      <PokerSeat
                        seat={assento}
                        active={estado.actor === indice}
                        dealer={estado.dealer === indice}
                        showdown={estado.showdown}
                      />
                    </div>
                  ))}
                </div>

                {/* Centro: pote, board e rua */}
                <div className="pointer-events-none relative z-10 flex flex-col items-center gap-2 px-2 pb-5 md:absolute md:inset-0 md:justify-center md:pb-0">
                  <div className="flex items-center gap-1.5 rounded-full border border-[#FFB700]/35 bg-black/75 px-3 py-1">
                    <EssenceIcon size={11} />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
                      Pote
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={pote}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18 }}
                        className="text-[13px] font-black tabular-nums text-[#FFB700]"
                      >
                        {formatChips(pote)}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const carta = estado.board[i];
                      if (!carta) return <EmptyCardSlot key={`vazio-${i}`} />;
                      return (
                        <motion.div
                          key={`${carta.id}-${versao}`}
                          initial={{ opacity: 0, y: -10, rotateX: -70 }}
                          animate={{ opacity: 1, y: 0, rotateX: 0 }}
                          transition={{ duration: 0.32, delay: i * 0.05 }}
                        >
                          <PlayingCard card={carta} size="md" />
                        </motion.div>
                      );
                    })}
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
                    {RUA[estado.street]}
                  </span>
                </div>
              </div>
              </div>
            </div>

            {/* HUD: ação ou espera */}
            <div className="sticky bottom-0 z-30 -mx-3 mt-3 bg-gradient-to-t from-[#050506] via-[#050506]/95 to-transparent px-3 pb-3 pt-2 sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:bg-none lg:p-0">
              <AnimatePresence mode="wait" initial={false}>
                {maoEncerrada ? (
                  <motion.div
                    key="resultado"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.22 }}
                    role="status"
                    className="rounded-[10px] border border-[#FFB700]/35 bg-[rgba(13,13,13,0.92)] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFB700]/80">
                          {lucroDaMao >= 0 ? 'Boa mão' : 'Mão encerrada'}
                        </p>
                        <p className="mt-1 text-[13px] font-bold leading-snug text-white/85">
                          {estado.message}
                        </p>
                        {heroi.shown && (
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/35">
                            Sua mão: {heroi.shown}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-[3px] px-2 py-1 text-[12px] font-black tabular-nums ${
                          lucroDaMao > 0
                            ? 'bg-[#3FCBB8]/15 text-[#6fe3d0]'
                            : lucroDaMao === 0
                              ? 'bg-white/8 text-white/60'
                              : 'bg-[#e0679b]/15 text-[#f0a3c0]'
                        }`}
                      >
                        {lucroDaMao > 0 ? '+' : lucroDaMao === 0 ? '' : '-'}
                        {formatChips(Math.abs(lucroDaMao))} EA
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {semFichas ? (
                        <>
                          <p className="flex-1 text-[11px] leading-snug text-white/45">
                            Você ficou sem essência nesta mesa. Saia para devolver o caixa à
                            carteira.
                          </p>
                          <button
                            type="button"
                            onClick={abrirSaida}
                            className="flex items-center gap-1.5 rounded-[3px] bg-[#FFB700] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black"
                          >
                            <DoorOpen className="h-3 w-3" />
                            Sair da mesa
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={novaMao}
                            aria-label="Começar uma nova mão"
                            className="flex items-center gap-1.5 px-0.5 py-0.5"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: 'linear-gradient(135deg, #FFB700, #FFE082)',
                            }}
                          >
                            <span
                              className="flex items-center gap-1.5 bg-[#FFB700] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black"
                              style={{ clipPath: CUT_BUTTON }}
                            >
                              <Play className="h-3 w-3" />
                              Nova mão
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={abrirSaida}
                            className="rounded-[3px] border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-white/35 hover:text-white"
                          >
                            Sair com {formatChips(heroi.stack)} EA
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : ehVezDoHeroi && legal ? (
                  <motion.div
                    key="acao"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ActionBar
                      legal={legal}
                      pot={pote}
                      bb={room.bb}
                      heroBet={heroi.bet}
                      onAction={agir}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="espera"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-[rgba(13,13,13,0.88)] px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          semMovimento ? 'bg-[#FFB700]/70' : 'animate-pulse bg-[#FFB700]'
                        }`}
                      />
                      {statusTexto}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white/30">
                      Pote {formatChips(pote)} EA
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Coluna lateral */}
          <aside className="space-y-3">
            <HandLog log={log} handNo={estado.handNo} />

            <div className="rounded-[8px] border border-white/10 bg-[rgba(13,13,13,0.8)] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
                Sua mesa
              </p>
              <dl className="mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-white/35">Buy-in</dt>
                  <dd className="font-black tabular-nums text-white/70">
                    {formatChips(room.buyIn)} EA
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/35">Blinds</dt>
                  <dd className="font-black tabular-nums text-white/70">
                    {formatChips(room.sb)} / {formatChips(room.bb)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/35">Mãos jogadas</dt>
                  <dd className="font-black tabular-nums text-white/70">{estado.handNo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/35">Seu caixa</dt>
                  <dd className="font-black tabular-nums text-[#6fe3d0]">
                    {formatChips(heroi.stack)} EA
                  </dd>
                </div>
              </dl>
              <p className="mt-2.5 border-t border-white/8 pt-2 text-[9px] leading-snug text-white/25">
                Mesa contra bots da casa. A essência é fictícia e não é sacável.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Caixa da mesa */}
      <AnimatePresence>
        {saidaAberta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setSaidaAberta(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-saida"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[10px] border border-[#c8aa6e]/30 bg-[#0A0B0C] p-5"
            >
              <h2
                id="titulo-saida"
                className="text-xl uppercase tracking-tight text-white"
                style={{ fontFamily: '"Anton", Impact, sans-serif' }}
              >
                Sair da mesa
              </h2>
              {room.buyIn === 0 ? <p className="mt-2 text-[12px] leading-relaxed text-white/55">Encerrar a mesa de treino? As fichas de treino não são devolvidas ao saldo de EA.</p> : <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                Você devolve{' '}
                <strong className="font-black text-[#6fe3d0]">
                  {formatChips(heroi.stack)} EA
                </strong>{' '}
                do seu caixa para a essência da conta. Esta sessão de mesa é encerrada.
              </p>}
              {emJogo && !heroi.folded && (
                <p className="mt-2 rounded-[3px] border border-[#e0679b]/35 bg-[#e0679b]/10 px-2 py-1.5 text-[10px] font-bold text-[#f0a3c0]">
                  Você está no meio de uma mão — ela será abandonada.
                </p>
              )}
              {erroSaque && (
                <p role="alert" className="mt-2 text-[11px] font-bold text-[#f58b8b]">
                  {erroSaque}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaidaAberta(false)}
                  className="rounded-[3px] border border-white/15 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition-colors hover:border-white/35 hover:text-white"
                >
                  Continuar jogando
                </button>
                <button
                  type="button"
                  onClick={() => void confirmarSaque()}
                  disabled={sacando}
                  aria-label={room.buyIn === 0 ? 'Encerrar mesa de treino' : `Sacar ${formatChips(heroi.stack)} de essência e sair da mesa`}
                  className="rounded-[3px] bg-[#FFB700] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-black transition-colors hover:bg-[#FFC533] disabled:opacity-60"
                >
                  {sacando ? 'Fechando…' : room.buyIn === 0 ? 'Encerrar treino' : 'Sacar e sair'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export default function PokerTable() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const [rooms, setRooms] = useState<LobbyRoom[]>(POKER_ROOMS);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const mesa = rooms.find((sala) => sala.id === roomId);
  const password = typeof location.state?.pokerPassword === 'string' ? location.state.pokerPassword : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.poker.rooms().then(({ rooms: list }) => {
      if (alive) { setRooms(list.map(toLobbyRoom)); setUnavailable(false); }
    }).catch(() => { if (alive) setUnavailable(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roomId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (loading) return createPortal(<div className="fixed inset-0 z-[60] overflow-y-auto bg-[#040406]"><Casca><p role="status" className="text-sm text-white/50">Buscando sua mesa…</p></Casca></div>, document.body);

  if (!mesa) {
    return createPortal(
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#040406]">
      <Casca>
        <Aviso
          icone={<ShieldAlert className="h-5 w-5 text-[#FFB700]" />}
          titulo={unavailable ? 'Mesas indisponíveis' : 'Mesa não encontrada'}
          texto={unavailable ? 'O serviço de mesas ainda não está disponível. Volte à lista e tente novamente.' : 'Essa mesa não está disponível para sua conta ou o endereço está errado.'}
          acoes={
            <Link
              to="/sala-m7"
              className="rounded-[4px] bg-[#FFB700] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-black"
            >
              Ver mesas
            </Link>
          }
        />
      </Casca>
      </div>, document.body,
    );
  }

  if (mesa.isPrivate && !password) return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#040406]">
      <ModalSenhaSala nome={mesa.name} onClose={() => navigate('/sala-m7')} onConfirm={(senha) => navigate(`/sala-m7/${mesa.id}`, { replace: true, state: { pokerPassword: senha } })} />
    </div>, document.body,
  );
  return createPortal(<div className="fixed inset-0 z-[60] overflow-y-auto bg-[#040406]"><Mesa key={mesa.id} room={mesa} password={password} /></div>, document.body);
}
