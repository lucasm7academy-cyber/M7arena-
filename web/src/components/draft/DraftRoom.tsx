// src/components/draft/DraftRoom.tsx
// Draft (ban/pick) da sala — port visual do DraftRoom do site antigo
// (M7AcademySite, commit e4b7457), adaptado ao stack novo:
//
//  - O ESTADO vem do servidor (`sala.draft`, shape legado) — o cliente não
//    guarda turno/fase/time nem decide timeout. O que era lógica local virou
//    validação em api/src/lib/draft/flow.ts (invariante: regra no servidor).
//  - As REGRAS DO MODO (slots de ban/pick, esconder pick do adversário, role
//    "em turno") também vêm do servidor via `draft.regras` — registry único em
//    api/src/lib/draft/modos/. Não existe `if (modo === ...)` aqui: o
//    componente é 100% burro.
//  - O TIMER é derivado do relógio do servidor (`turn_deadline_at`), com o
//    clockSync das salas — o bug de fuso/relógio local do site antigo não
//    existe mais. Quando o número chega a 0, o hook dispara o tick e o
//    SERVIDOR aplica ban vazio / cancelamento.
//  - Sem HUD de transmissão (o sistema de streams do site novo é por escala de
//    jogo, ADR-072 — não há StreamModal na sala).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Ban, Check, Copy, RefreshCw, RotateCcw, Search, Twitch, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { SiRiotgames } from 'react-icons/si';
import { getDDRVersion, buildChampionIconUrl } from '../../api/riot';
import { ROLE_CONFIG, traduzirErroSala, type ResultadoSalaRpc } from '../../api/salamod1';
import type { Champion, SalaDraft } from './draftTypes';
import { CHAMPION_POSITIONS, type RoleFiltro } from './championPositions';
import { alternarSomMudo, desbloquearSonsDraft, pararSom, pararSonsDraft, precarregarSons, somMudo, tocarSom } from './draftSounds';

/** Nome de time no confronto: o hífen não pode virar ponto de quebra de linha
 *  (U+2011 é o hífen "não separável" — mesma regra da sala normal). */
const nomeSemQuebra = (n?: string | null) => (n ?? '').replace(/-/g, '\u2011');

interface DraftRoomProps {
  draft: SalaDraft;
  jogadores: any[];
  usuarioId: string;
  /** Segundos restantes do turno, derivados do relógio do servidor. */
  timer: number;
  onBanir: (championId: string) => Promise<ResultadoSalaRpc>;
  onPickar: (championId: string) => Promise<ResultadoSalaRpc>;
  /** Prévia: dispara a seleção local (hover/click) para a sala — opcional. */
  onPreview?: (championId: string | null) => void;
  /** Prévia recebida de outro jogador da sala (selecionado, ainda não confirmado). */
  previewExterno?: { championId: string | null; side: 'blue' | 'red' | null } | null;
  /**
   * Lado EM JOGO do time A (sala de campeonato: vem das escolhas da sala).
   * `undefined`/`blue` = sem troca (A joga de azul). 'red' = trocou: a tela
   * mostra o time A no lado vermelho e o B no azul (painéis, bans e picks).
   */
  ladoDoTimeA?: 'blue' | 'red' | null;
  /** Visão de transmissão (telespectador): times grandes + placar da série.
   *  `cor` = cor TEMA do time (gradient_from) para o brilho do logo. */
  timeA?: { nome?: string | null; logo?: string | null; cor?: string | null } | null;
  timeB?: { nome?: string | null; logo?: string | null; cor?: string | null } | null;
  placar?: { a: number; b: number } | null;
  /**
   * Modo RESUMO: mostra o confronto com os CAMPEÕES ESCOLHIDOS (usado nos
   * ~10s após a última escolha, antes de voltar para a sala).
   */
  recap?: boolean;
  /**
   * Modo NÃO-campeonato (ex.: Time vs Time livre): o espectador vê o grid de
   * campeões igual a quem picka (apenas assistindo — sem botão de confirmar).
   * No campeonato fica `false` (visão de transmissão).
   */
  espectadorCompleto?: boolean;
  /**
   * MODO AO VIVO (partida em andamento): a MESMA tela do draft segura a sala
   * depois que o draft fecha — o relógio/turno dão lugar a times + placar +
   * status e o botão central vira o CÓDIGO DA PARTIDA (pedido do usuário
   * 2026-10-18). Sem grid, sem turno e sem sons de draft.
   */
  aoVivo?: {
    /** Rótulo do estado de espera ('Partida Pronta!'); o "Partida Ao Vivo!" saiu
        da tela (pedido do usuário 18/10 — verde feio): quando a partida rola,
        placar + transmissão já dizem isso. */
    status?: string | null;
    /** Ponto vermelho pulsante — partida realmente em andamento. */
    pulsante?: boolean;
    placar?: { a: number; b: number } | null;
    /** Linha fina extra sob o status (ex.: 'JOGO 2 · MD3' na série). */
    legenda?: string | null;
    /** Código da partida — só chega aqui para quem pode ver (filtro do servidor). */
    codigo?: string | null;
  } | null;
  /**
   * Ícones do TOPO — valem no DRAFT e na TELA AO VIVO (pedido do usuário
   * 18/10). Quem não passa a ação não vê o ícone; o MUDO é sempre visível.
   */
  acoesTopo?: AcoesTopo | null;
  /**
   * Rótulo da SÉRIE (ex.: 'JOGO 2 · MD3 · 1 - 0') — sala 5x5 personalizada.
   * Fica embaixo do título da fase; ausente nas salas de campeonato (que já
   * mostram o placar no confronto), então o draft delas não muda.
   */
  serieLabel?: string | null;
}

/** Ações dos ícones do topo (ao lado do mudo; sair fica no canto oposto). */
export interface AcoesTopo {
  /** Verificar Partida — só ícone (RefreshCw). */
  verificar?: { aoClicar: () => void; carregando?: boolean } | null;
  /** Twitch do streamer: iniciar a live, ENCERRAR a própria, ou abrir a de outro. */
  twitch?: {
    aoIniciar?: (() => void) | null;
    /** Sua live está no ar — clicar encerra (o card "Assista ao vivo" abre a Twitch). */
    aoEncerrar?: (() => void) | null;
    carregando?: boolean;
    /** Live no ar de outro streamer — link para assistir. */
    assistirHref?: string | null;
  } | null;
  /** Resetar Sala — só adm (o servidor valida). */
  resetar?: { aoClicar: () => void; carregando?: boolean } | null;
  /** Seta de sair da sala — canto oposto (esquerda). */
  sair?: (() => void) | null;
}

// ── Slots ────────────────────────────────────────────────────────────────────

function BanSlot({ champion, preview, active, jaBaniu, champions, version }: {
  champion: string | null; preview?: Champion | null; active: boolean; jaBaniu: boolean;
  champions: Record<string, Champion>; version: string;
}) {
  const champ = champion ? champions[champion] : null;
  return (
    <div className="flex flex-col items-center gap-[0.3vmin]">
      <div className={`
        relative w-[6vmin] h-[6vmin] border bg-black/60 flex items-center justify-center overflow-hidden transition-all duration-300
        ${jaBaniu ? 'border-red-600/80 shadow-[0_0_8px_rgba(220,38,38,0.3)]' : 'border-white/15'}
      `}>
        {champ ? (
          <>
            {/* Ban em PRETO E BRANCO: o campeão está fora do jogo — colorido, o
                espectador confundia com pick (pedido do usuário 18/10). */}
            <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
              className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 border-t-2 border-red-600/80 -rotate-45 origin-center scale-150" />
          </>
        ) : preview ? (
          /* PRÉVIA (campeão na mira, ainda não confirmado) — o mesmo campeão que
             aparece na bola do lado, aqui no slot que está sendo decidido. */
          <img src={buildChampionIconUrl(preview.id, version)} alt={preview.name}
            className="w-full h-full object-cover grayscale opacity-45" referrerPolicy="no-referrer" />
        ) : (
          <div className={jaBaniu ? 'opacity-40' : 'opacity-15'}>
            <Ban className="w-[3.6vmin] h-[3.6vmin] text-white" />
          </div>
        )}

        {/* Turno do BAN: linha vermelha só na base + brilho subindo, pulsando devagar */}
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 animate-pulse [animation-duration:2.8s]"
          >
            <span
              className="absolute inset-x-0 bottom-0"
              style={{ height: '62%', background: 'linear-gradient(to top, rgba(239,68,68,0.55), rgba(239,68,68,0.18) 45%, transparent)' }}
            />
            <span
              className="absolute inset-x-0 bottom-0"
              style={{ height: '0.22vmin', background: '#ef4444', boxShadow: '0 -0.8vmin 1.8vmin rgba(239,68,68,0.95)' }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function PickSlot({ champion, preview, active, naFila, hidden, champions, version, lado }: {
  champion: string | null; preview?: Champion | null; active: boolean; naFila?: boolean; hidden: boolean;
  champions: Record<string, Champion>; version: string;
  /** Lado do time dono do slot — a cor do indicador segue o lado (azul/vermelho). */
  lado: 'blue' | 'red';
}) {
  const champ = champion ? champions[champion] : null;
  const rgbLado = lado === 'blue' ? '59,130,246' : '239,68,68';
  const corLado = lado === 'blue' ? '#3b82f6' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-[0.3vmin]">
      <div className={`
        w-[11vmin] h-[11vmin] border bg-black/50 overflow-hidden shadow-inner relative group transition-all duration-300
        ${champ ? 'border-white/20' : 'border-white/10'}
      `}>
        {hidden ? (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <span className="text-[3vmin] font-black text-white/60">?</span>
          </div>
        ) : champ ? (
          <>
            <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer" />
            <div className="absolute bottom-0 left-0 right-0 h-[3vmin] bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-[0.3vmin]">
              <span className="text-[0.9vmin] font-bold text-[#f0e6d2] uppercase tracking-wider drop-shadow-md">
                {champ.name}
              </span>
            </div>
          </>
        ) : preview ? (
          /* PRÉVIA (campeão na mira, ainda não confirmado) — igual à bola do
             lado, agora também no slot que está sendo decidido. */
          <img src={buildChampionIconUrl(preview.id, version)} alt={preview.name}
            className="w-full h-full object-cover opacity-55 saturate-50" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-50 text-white/30">
            <SiRiotgames className="w-[5vmin] h-[5vmin]" />
          </div>
        )}

        {/* Turno com DOIS picks (pick duplo do 5v5): o segundo slot do turno
            ganha a barra na cor do lado; o pulso fica só no que está aberto. */}
        {naFila && !active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
            style={{ height: '0.28vmin', background: corLado, boxShadow: `0 0 1.4vmin rgba(${rgbLado},0.5)` }}
          />
        )}

        {/* Turno do PICK: linha na cor do lado só na base + brilho neon subindo, pulsando devagar */}
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 animate-pulse [animation-duration:2.8s]"
          >
            <span
              className="absolute inset-x-0 bottom-0"
              style={{ height: '62%', background: `linear-gradient(to top, rgba(${rgbLado},0.55), rgba(${rgbLado},0.18) 45%, transparent)` }}
            />
            <span
              className="absolute inset-x-0 bottom-0"
              style={{ height: '0.28vmin', background: corLado, boxShadow: `0 -1vmin 2.2vmin rgba(${rgbLado},0.95)` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Painel do time (círculo central de cada lado) ───────────────────────────

function TeamPanel({ ladoJogo, emTurno, jogadorNome, logoTime, textoAbaixo, feedback }: {
  ladoJogo: 'blue' | 'red'; emTurno: boolean;
  jogadorNome: string;
  /** Logo do time do lado — fundo da bola. Apagada; ACESA na cor do time na vez. */
  logoTime?: string | null;
  /** Texto no lugar do nome do campeão enquanto o time não escolheu (ex.: "Banindo..."). */
  textoAbaixo?: string | null;
  /** "Killcam" da última ação confirmada deste lado (ban = P&B + corte; pick = dourado). */
  feedback?: { championId: string; tipo: 'ban' | 'pick'; nonce: number } | null;
}) {
  // A cor da VEZ é a cor do LADO (azul/vermelho) — nunca mais por fase.
  const corLado = ladoJogo === 'blue' ? '#3B82F6' : '#ef4444';
  const corLadoClaro = ladoJogo === 'blue' ? '#60A5FA' : '#f87171';
  const corLadoRgb = ladoJogo === 'blue' ? '59,130,246' : '239,68,68';
  return (
    <div className="w-[25vmin] flex flex-col items-center gap-[1.5vmin] pointer-events-auto">
      <div className="text-center w-full truncate px-[1vmin]">
        <span className="text-[2vmin] font-black text-white/90 tracking-widest drop-shadow-md">
          {jogadorNome}
        </span>
      </div>

      <div className="relative">
        <motion.div
          initial={false}
          animate={emTurno ? {
            boxShadow: [
              `0 0 15px rgba(${corLadoRgb},0.3)`,
              `0 0 32px rgba(${corLadoRgb},0.9)`,
              `0 0 15px rgba(${corLadoRgb},0.3)`,
            ],
            borderColor: [corLado, corLadoClaro, corLado],
          } : { boxShadow: '0 0 0px rgba(0,0,0,0)', borderColor: 'rgba(255,255,255,0.1)' }}
          transition={emTurno ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          className={`relative w-[32vmin] h-[32vmin] rounded-full border-[0.8vmin] overflow-hidden bg-black transition-all duration-300 ${emTurno ? '' : 'border-white/10'}`}
          style={emTurno ? { borderColor: corLado } : undefined}
        >
          {/* LOGO DO TIME no fundo da bola. Apagada no normal; ACESA (cor cheia)
              quando é a vez deste lado banir/escolher. */}
          {logoTime ? (
            <img
              src={logoTime}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${emTurno ? 'opacity-100' : 'opacity-25'}`}
              referrerPolicy="no-referrer"
            />
          ) : null}

          {/* (O "Aguardando" com as 3 bolinhas saiu do meio da bola — pedido do
              usuário 2026-10-17: quando não é a vez, a borda não acende, então
              a bola fica só com a logo do time de fundo, sem texto.) */}

          {/* (A prévia/seleção do campeão saiu da bola — pedido do usuário
              2026-10-24: o campeão na mira aparece nos slots de ban/pick, e a
              bola fica só com a logo do time.) */}

          {/* (O tint azul/vermelho por dentro da bola na vez saiu — pedido do
              usuário 2026-10-17: "fica feio demais esse azul/vermelho mais
              claro dentro". Na vez fica só a BORDA acesa na cor do lado; o
              centro é a logo do time de fundo, igual aos demais estados.) */}

          {/* "Killcam" da confirmação: quando um ban/pick é CONFIRMADO, o
              campeão pisca NA BOLA do lado que agiu e some sozinho (~2s).
              Cresce e assenta de volta; depois SAI com fade. Ban = a imagem
              desbota de cor para preto e branco no próprio lugar. A bola em si
              fica só com a logo do time (pedido do usuário 2026-10-24). */}
          <AnimatePresence>
            {feedback ? (
              <motion.div
                key={feedback.nonce}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
                exit={{ opacity: 0, transition: { duration: 0.5 } }}
                className="absolute inset-0 z-20"
              >
                <motion.img
                  src={buildChampionIconUrl(feedback.championId)}
                  alt=""
                  initial={{ filter: 'grayscale(0) brightness(1)' }}
                  animate={{
                    scale: [1.25, 1.42, 1.12],
                    filter: feedback.tipo === 'ban' ? 'grayscale(1) brightness(0.7)' : 'grayscale(0) brightness(1)',
                  }}
                  transition={{
                    scale: { duration: 0.55, times: [0, 0.28, 1], ease: 'easeOut' },
                    filter: feedback.tipo === 'ban' ? { duration: 0.45, ease: 'easeOut', delay: 0.15 } : { duration: 0.1 },
                  }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="text-center min-h-[3.5vmin]">
        <h2
          className="text-[2.5vmin] font-bold tracking-tighter mb-[0.5vmin]"
          style={emTurno && textoAbaixo ? { color: corLado } : undefined}
        >
          {emTurno ? textoAbaixo ?? '' : ''}
        </h2>
      </div>
    </div>
  );
}

// ── Resumo pós-draft (10s): time + campeões escolhidos ───────────────────────

function TimeRecap({ time, picks, lado, champions, version }: {
  time?: { nome?: string | null; logo?: string | null } | null;
  picks: string[];
  lado: 'blue' | 'red';
  champions: Record<string, Champion>;
  version: string;
}) {
  return (
    <div className="flex flex-col items-center gap-[1.2vmin] w-[44vmin]">
      {time?.logo ? (
        <img
          src={time.logo}
          alt=""
          className={`w-[12vmin] h-[12vmin] object-contain ${
            lado === 'blue' ? 'drop-shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]'
          }`}
        />
      ) : null}
      <span className={`text-[2.2vmin] font-black uppercase tracking-[0.25em] truncate max-w-full ${lado === 'blue' ? 'text-[#60A5FA]' : 'text-[#f87171]'}`}>
        {time?.nome ?? ''}
      </span>
      <div className="flex items-center justify-center gap-[1vmin] mt-[0.4vmin]">
        {picks.map((c, i) => (
          <div key={`${c}-${i}`} className="flex flex-col items-center gap-[0.4vmin]">
            <img
              src={buildChampionIconUrl(c, version)}
              alt={c}
              className="w-[10vmin] h-[10vmin] object-cover border border-white/15"
              referrerPolicy="no-referrer"
            />
            <span className="text-[1.1vmin] font-bold text-white/70 uppercase text-center leading-tight max-w-[10vmin] truncate">
              {champions[c]?.name ?? c}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export const DraftRoom: React.FC<DraftRoomProps> = ({
  draft, jogadores, usuarioId, timer, onBanir, onPickar, onPreview, previewExterno, ladoDoTimeA,
  timeA, timeB, placar, recap, espectadorCompleto, aoVivo, acoesTopo, serieLabel,
}) => {
  const [champions, setChampions] = useState<Record<string, Champion>>({});
  const [version, setVersion] = useState('16.20.1');
  const [selectedChamp, setSelectedChamp] = useState<Champion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Filtro de rota (como no client do LoL): null = todos; clicar de novo limpa.
  const [roleFiltro, setRoleFiltro] = useState<RoleFiltro | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Mudo dos sons do draft (botão no canto do topo) — preferência lembrada.
  const [mudo, setMudo] = useState<boolean>(() => somMudo());
  // Tela ao vivo: feedback do "copiar código" (2,5s de "Código Copiado!").
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const v = await getDDRVersion();
        if (!vivo) return;
        setVersion(v);
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/pt_BR/champion.json`);
        const data = await res.json();
        if (vivo) setChampions(data.data);
      } catch (error) {
        // Nunca engole erro: o grid fica vazio e o console diz por quê.
        console.error('[DraftRoom] Falha ao carregar campeões do Data Dragon:', error);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Meu lado nesta sala (só desenha — a permissão real é validada no servidor).
  const meuJogador = jogadores.find((j: any) => j.user_id === usuarioId);
  const meuTime: 'blue' | 'red' | null = meuJogador ? (meuJogador.is_time_a ? 'blue' : 'red') : null;
  const possoJogar = !!meuJogador;
  // TELA AO VIVO (partida em andamento): mesma casca do draft com os dados do
  // jogo no lugar do relógio — sem grid e sem botão de confirmar.
  const aoVivoAtivo = !!aoVivo;
  // Espectador do Time vs Time vê o grid (mesma visão de quem picka).
  const mostraGrid = !aoVivoAtivo && (possoJogar || !!espectadorCompleto);

  const emTurno = draft.status === 'ongoing';
  const fase = draft.current_phase;
  // Sala 5v5 personalizada: o MID é o capitão do draft — só ele confirma o
  // ban/pick do time. Nas salas de campeonato/livre a flag não vem (ou é
  // false) e qualquer participante do lado da vez age, como sempre.
  const apenasControlador = draft.regras.apenas_role_controladora === true;
  const souControlador = !apenasControlador ||
    String(meuJogador?.role ?? '').toUpperCase() === String(draft.regras.role_controladora ?? '').toUpperCase();
  const isMeuTurno = possoJogar && emTurno && meuTime === draft.current_team && souControlador;

  // Nome exibido do jogador "em turno" (a role vem das regras do modo
  // publicadas pelo servidor: MID na sala 5v5, JG no time_vs_time). Na sala
  // 5v5 a role também RESTRINGE a ação (só o MID age); nos demais é vitrine.
  const roleEmTurno = draft.regras.role_controladora;
  const formatarNome = (p: any, padrao: string) => {
    if (!p) return padrao;
    const tag = (p.tag || '').replace('#', '');
    return tag ? `${p.nome}#${tag}` : p.nome;
  };
  const nomeA = formatarNome(jogadores.find((j: any) => j.is_time_a && j.role === roleEmTurno), 'BLUE-SIDE');
  const nomeB = formatarNome(jogadores.find((j: any) => !j.is_time_a && j.role === roleEmTurno), 'RED-SIDE');

  // Lado EM JOGO de cada EQUIPE (os arrays do draft são por equipe: blue_* =
  // time A, red_* = time B). Na sala de campeonato o lado vem das escolhas;
  // nas salas normais sem escolha fica A=azul / B=vermelho. A tela mostra cada
  // equipe no lado que ELA ESCOLHEU — painéis, bans e picks seguem esse lado.
  const ladoEquipeA: 'blue' | 'red' = ladoDoTimeA === 'red' ? 'red' : 'blue';
  const ladoEquipeB: 'blue' | 'red' = ladoEquipeA === 'blue' ? 'red' : 'blue';
  // Em cima da bola: NOME DO TIME daquele lado (sala de campeonato/livre usa
  // os nomes dos times; salas normais caem no rótulo antigo — jogador/role ou
  // BLUE-SIDE/RED-SIDE).
  const nomeTimeA = (timeA?.nome ?? '').trim();
  const nomeTimeB = (timeB?.nome ?? '').trim();
  const labelEquipeA = nomeTimeA || (nomeA.startsWith('BLUE-SIDE') || nomeA.startsWith('RED-SIDE')
    ? (ladoEquipeA === 'blue' ? 'BLUE-SIDE' : 'RED-SIDE')
    : nomeA);
  const labelEquipeB = nomeTimeB || (nomeB.startsWith('BLUE-SIDE') || nomeB.startsWith('RED-SIDE')
    ? (ladoEquipeB === 'blue' ? 'BLUE-SIDE' : 'RED-SIDE')
    : nomeB);
  // Visão de transmissão (telespectador): o time que JOGA DE AZUL fica à
  // ESQUERDA e o de VERMELHO à direita — seguindo a escolha de lado, igual às
  // bolas do draft (antes as logos grandes ficavam fixas A X B).
  const timeNaEsquerda = ladoEquipeA === 'blue' ? timeA : timeB;
  const timeNaDireita = ladoEquipeA === 'blue' ? timeB : timeA;
  // Coluna da esquerda = equipe que joga de AZUL; da direita = de VERMELHO.
  const equipeEsquerda: 'A' | 'B' = ladoEquipeA === 'blue' ? 'A' : 'B';
  const equipeDireita: 'A' | 'B' = equipeEsquerda === 'A' ? 'B' : 'A';
  // Lado (em jogo) que está agindo agora — governa a barra de turno do topo.
  const ladoEmTurno: 'blue' | 'red' = draft.current_team === 'blue' ? ladoEquipeA : ladoEquipeB;

  const jaUsado = (champId: string) =>
    draft.blue_bans.includes(champId) || draft.red_bans.includes(champId) ||
    draft.blue_picks.includes(champId) || draft.red_picks.includes(champId);

  // FEARLESS: os picks dos jogos anteriores da série também estão travados (o
  // servidor publica a lista em draft.campeoes_travados). O grid mostra esses
  // campeões apagados, igual aos já usados — o clique nem chega no servidor.
  const travados: string[] = draft.campeoes_travados ?? [];
  const indisponivel = (champId: string) => jaUsado(champId) || travados.includes(champId);

  // Prévia recebida de outro jogador (WebSocket): vira a imagem DENTRO da bola
  // do lado dele quando a sala ainda aguarda confirmação e o campeão não foi usado.
  const champDoPreview = (lado: 'blue' | 'red'): Champion | null => {
    if (!previewExterno?.championId || previewExterno.side !== lado) return null;
    if (draft.status !== 'ongoing' || indisponivel(previewExterno.championId)) return null;
    return champions[previewExterno.championId] ?? ({ id: previewExterno.championId, name: previewExterno.championId } as Champion);
  };
  const previewBlue = champDoPreview('blue');
  const previewRed = champDoPreview('red');

  // Prévia que vai para o SLOT do time (além da bola): a minha própria escolha
  // ainda não confirmada ou a que o outro jogador do lado mandou. `ehA` fala em
  // espaço de TIME (blue = time A), igual aos arrays do draft.
  const previewDoTime = (ehA: boolean): Champion | null => {
    if (meuTime === (ehA ? 'blue' : 'red') && selectedChamp) return selectedChamp;
    return ehA ? previewBlue : previewRed;
  };

  // Esconde os picks do time ADVERSÁRIO enquanto o draft está em andamento —
  // ligado só nos modos cujo registry marca `esconder_picks_adversario` (nada
  // de espiar o pick do oponente).
  const esconderPickAdversario = (lado: 'blue' | 'red', championId: string | null) =>
    draft.regras.esconder_picks_adversario && draft.status === 'ongoing' && !!championId && lado !== meuTime;

  const filteredChampions = useMemo(() => {
    return (Object.values(champions) as Champion[])
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(c => !roleFiltro || (CHAMPION_POSITIONS[c.key] ?? []).includes(roleFiltro))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, searchTerm, roleFiltro]);

  // Quantidade de slots por lado — vem das regras do modo (5/5 no 5v5 e
  // time_vs_time; o modo com draft define), nunca de um if no componente.
  const maxBans = draft.regras.max_bans_por_lado;
  const maxPicks = draft.regras.max_picks_por_lado;

  const handleChampionClick = (champ: Champion) => {
    if (!isMeuTurno || enviando) return;
    if (indisponivel(champ.id)) {
      // Campeão usado/banido: o client do LoL nega com som — o clique nem chega
      // no servidor.
      tocarSom('pickNegado');
      return;
    }
    tocarSom('gridClique');
    setSelectedChamp(champ);
    // Prévia para a sala: quem assiste vê o que está sendo considerado.
    onPreview?.(champ.id);
  };

  const confirmarAcao = async () => {
    if (!selectedChamp || !isMeuTurno || enviando) return;
    tocarSom('lockInClique');
    setEnviando(true);
    try {
      const r = fase === 'ban' ? await onBanir(selectedChamp.id) : await onPickar(selectedChamp.id);
      if (!r.ok) {
        // O hook mostra no layout da sala, mas durante o draft a tela é esta —
        // o aviso precisa aparecer aqui.
        toast.error(traduzirErroSala(r.erro));
        return;
      }
      setSelectedChamp(null);
      onPreview?.(null);
    } finally {
      setEnviando(false);
    }
  };

  // Barra de tempo do turno: duração publicada pelo servidor (regra geral do
  // motor), nunca um 30 hardcoded aqui.
  const duracaoSeg = Math.max(1, Math.round((draft.duracao_turno_ms ?? 30_000) / 1000));
  const segundos = Math.max(0, Math.min(timer, duracaoSeg));

  // Código da partida (tela ao vivo): mesmo gesto do botão da sala — copia e
  // confirma no toast; o próprio botão troca o texto por "Código Copiado!".
  const copiarCodigoAoVivo = async () => {
    try {
      await navigator.clipboard.writeText(aoVivo?.codigo ?? '');
      setCodigoCopiado(true);
      toast.success('Código copiado! Cole no LoL em Jogar > Torneios > Código de Torneio.');
      setTimeout(() => setCodigoCopiado(false), 2500);
    } catch (erro) {
      // Permissão de clipboard negada: o código está na tela para copiar na mão.
      console.error('[DraftRoom] Falha ao copiar o código da partida:', erro);
      toast.error('Não foi possível copiar — selecione o código na tela.');
    }
  };

  // ── "Killcam" da bola (pedido do usuário 2026-10-17) ─────────────────────
  // Quando um ban/pick é CONFIRMADO, o campeão aparece por ~2s NA BOLA do lado
  // que agiu (ban = P&B + lâmina vermelha varrendo; pick = explosão dourada).
  // Detecta pela contagem das listas do draft — vale igual para o meu lado e
  // para o adversário. Pick que a regra do modo esconde não anima: mostrar o
  // boneco ali vazaria justamente o que a sala faz questão de esconder.
  const [feedback, setFeedback] = useState<{ lado: 'blue' | 'red'; championId: string; tipo: 'ban' | 'pick'; nonce: number } | null>(null);
  const contagensDraftRef = useRef<[number, number, number, number] | null>(null);
  useEffect(() => {
    const atual: [number, number, number, number] = [
      draft.blue_bans.length, draft.red_bans.length,
      draft.blue_picks.length, draft.red_picks.length,
    ];
    const prev = contagensDraftRef.current;
    contagensDraftRef.current = atual;
    if (!prev) return; // primeira carga: não repete o histórico
    const listas: Array<[string[], 'blue' | 'red', 'ban' | 'pick']> = [
      [draft.blue_bans, 'blue', 'ban'],
      [draft.red_bans, 'red', 'ban'],
      [draft.blue_picks, 'blue', 'pick'],
      [draft.red_picks, 'red', 'pick'],
    ];
    for (let i = 0; i < listas.length; i++) {
      const [lista, lado, tipo] = listas[i];
      if (lista.length <= prev[i]) continue;
      const championId = lista[lista.length - 1];
      if (!championId) break;
      if (tipo === 'pick' && esconderPickAdversario(lado, championId)) break;
      const nonce = Date.now();
      setFeedback({ lado, championId, tipo, nonce });
      window.setTimeout(() => setFeedback((f) => (f && f.nonce === nonce ? null : f)), 2200);
      // Som da ação junto com a killcam: ban tem voz de time aliado/inimigo
      // (comparação no espaço de dados, igual às listas acima); o ÚLTIMO pick
      // fecha o draft — o servidor marca `finished` no mesmo update, então o
      // som de finalização sai no mesmo frame da animação.
      if (tipo === 'ban') tocarSom(lado === meuTime ? 'banAliado' : 'banInimigo');
      else if (draft.status === 'finished') tocarSom('draftFinalizado');
      // A ação confirmada foi MINHA: a notificação da minha vez já cumpriu o
      // papel (senão ela segue 4-5s por baixo do som do ban/pick).
      if (lado === meuTime) pararSom(tipo === 'ban' ? 'seuBan' : 'suaVez');
      break; // uma ação por atualização de estado
    }
  }, [draft.blue_bans.join(','), draft.red_bans.join(','), draft.blue_picks.join(','), draft.red_picks.join(',')]);

  // ── Sons do draft (pedido do usuário 2026-10-18) ─────────────────────────
  // Arquivos locais /sounds/draft (repo → nginx, sem API). Precarga no mount e
  // destrava no primeiro gesto — sem isso o iOS/Safari mantém mudo.
  useEffect(() => {
    precarregarSons();
    const desinstalar = desbloquearSonsDraft();
    return () => {
      desinstalar();
      // Sair do draft (fim da killcam/fim da sala) para TUDO — o tema de
      // finalização (34s) não pode continuar tocando na sala.
      pararSonsDraft();
    };
  }, []);

  // Intro de fase: o draft abre banindo (turno 0 do template é ban) e cada
  // virada ban→pick→ban avisa. No ban→pick os bans do momento acabaram de
  // travar — o som desta virada é o "bans travados", não uma intro de pick
  // (o template encadeia os dois no mesmo instante; tocar os dois seria sopa).
  const faseSonoraRef = useRef<string | null>(null);
  useEffect(() => {
    // Tela ao vivo: o draft já fechou — nada de intro de fase no mount.
    if (aoVivoAtivo) return;
    const anterior = faseSonoraRef.current;
    faseSonoraRef.current = fase;
    if (anterior === fase) return;
    if (anterior === null) {
      // Mount: só anuncia se o draft abre na fase de ban; espectador que entra
      // no meio de uma fase de picks não ouve "bans travados" fora de hora.
      if (fase === 'ban') tocarSom('inicioBan');
      return;
    }
    tocarSom(fase === 'pick' ? 'bansTravados' : 'inicioBan');
  }, [fase]);

  // Vez de agir: notificação própria quando o turno vira pra mim.
  const minhaVezSonoraRef = useRef<string | null>(null);
  useEffect(() => {
    const minha = emTurno && isMeuTurno ? fase : null;
    const anterior = minhaVezSonoraRef.current;
    minhaVezSonoraRef.current = minha;
    if (!minha || minha === anterior) return;
    tocarSom(minha === 'ban' ? 'seuBan' : 'suaVez');
  }, [emTurno, isMeuTurno, fase]);

  // Relógio do turno: SÓ os últimos 10 segundos têm som (tick curto) — a
  // contagem de 30→10 ficou sem nada a pedido do usuário (2026-10-18).
  const segundoSonoroRef = useRef<number | null>(null);
  useEffect(() => {
    const anterior = segundoSonoroRef.current;
    segundoSonoroRef.current = segundos;
    if (!emTurno || anterior === null || segundos === anterior) return;
    if (segundos <= 10) tocarSom('tickCurto');
  }, [segundos, emTurno]);

  // Coluna de picks de uma EQUIPE, rotulada pelo lado EM JOGO dela.
  const colunaPicks = (equipe: 'A' | 'B', direita: boolean) => {
    const ehA = equipe === 'A';
    const lado = ehA ? ladoEquipeA : ladoEquipeB;
    const picks = ehA ? draft.blue_picks : draft.red_picks;
    // Prévia vai só para o slot da vez (o próximo vazio do lado que está agindo).
    const previa = emTurno && draft.current_team === (ehA ? 'blue' : 'red') && fase === 'pick'
      ? previewDoTime(ehA)
      : null;
    // Turnos de PICK DUPLO: além do slot aberto, os próximos do MESMO turno
    // ganham a barra na cor do lado (sem pulso) — mostra que vêm dois picks.
    const restantes = emTurno && draft.current_team === (ehA ? 'blue' : 'red') && fase === 'pick'
      ? Math.max(1, draft.restantes_no_turno ?? 1)
      : 1;
    return (
      <div className={`flex flex-col gap-[1vmin] ${direita ? 'items-end' : ''}`}>
        <span
          className={`text-[1.2vmin] font-bold uppercase tracking-[0.3em] ${
            lado === 'blue' ? 'text-[#0000FF]/60 ml-[0.5vmin]' : 'text-[#FF0000]/60 mr-[0.5vmin]'
          }`}
        >
          PICKS {lado.toUpperCase()}
        </span>
        <div className="flex gap-[0.8vmin]">
          {[...Array(maxPicks)].map((_, i) => (
            <PickSlot
              key={`${equipe}-${i}`}
              champion={picks[i] ?? null}
              preview={i === picks.length ? previa : null}
              active={emTurno && draft.current_team === (ehA ? 'blue' : 'red') && fase === 'pick' && i === picks.length}
              naFila={i > picks.length && i < picks.length + restantes}
              hidden={esconderPickAdversario(ehA ? 'blue' : 'red', picks[i] ?? null)}
              champions={champions}
              version={version}
              lado={lado}
            />
          ))}
        </div>
      </div>
    );
  };

  // ── RESUMO (10s após a última escolha): times + campeões escolhidos ────────
  if (recap) {
    const picksEsq = (ladoEquipeA === 'blue' ? draft.blue_picks : draft.red_picks).filter(Boolean) as string[];
    const picksDir = (ladoEquipeA === 'blue' ? draft.red_picks : draft.blue_picks).filter(Boolean) as string[];
    return (
      <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] bg-black text-[#f0e6d2] font-sans overflow-hidden select-none">
        <img src="/images/fundo_elite.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-center opacity-30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)]" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 h-full flex flex-col items-center justify-center gap-[4vmin] px-[3vmin]"
        >
          <span className="text-[2vmin] font-black uppercase tracking-[0.5em] text-[#FFB700] text-center">
            Escolhas concluídas
          </span>

          <div className="flex items-center justify-center gap-[5vmin] w-full">
            <TimeRecap
              time={timeNaEsquerda}
              picks={picksEsq}
              lado={ladoEquipeA === 'blue' ? 'blue' : 'red'}
              champions={champions}
              version={version}
            />
            <span className="text-[6vmin] font-black text-white/60 leading-none drop-shadow-lg">X</span>
            <TimeRecap
              time={timeNaDireita}
              picks={picksDir}
              lado={ladoEquipeA === 'blue' ? 'red' : 'blue'}
              champions={champions}
              version={version}
            />
          </div>

          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-[1.3vmin] font-bold uppercase tracking-[0.35em] text-white/50"
          >
            Voltando para a sala…
          </motion.span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] bg-black text-[#f0e6d2] font-sans overflow-hidden select-none">
      {/* (O brilho azul/vermelho por fase foi removido — pedido do usuário:
          fundo agora é o padrão das salas/lobby, sem tint de cor) */}
      {/* Fundo padrão das salas/lobby — MESMA composição do LayoutWrapper
          (imagem + fade radial pro preto + sombra em gradiente na base),
          igual ao fundo do /lobby */}
      <img src="/images/fundo_elite.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-center opacity-30 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)]" />

      {/* HEADER SECTION - TIMER + FASE. Na TELA AO VIVO o topo fica limpo: o
          confronto desce para o CENTRO da tela (pedido do usuário 18/10). */}
      {!aoVivoAtivo && (
      <div className="relative pt-[2vmin] flex flex-col items-center z-40">
        <>
        <h1 className="text-[3.5vmin] font-bold tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] uppercase">
          {fase === 'ban' ? 'FASE DE BANS' : 'FASE DE PICKS'}
        </h1>

        {/* Rótulo da SÉRIE (sala 5x5 personalizada): jogo, formato e placar.
            Só aparece quando o dono da tela passa o rótulo — o draft da sala de
            campeonato continua idêntico. */}
        {serieLabel && (
          <span className="mt-[0.6vmin] text-[1.25vmin] font-black uppercase tracking-[0.4em] text-[#c89b3c]">
            {serieLabel}
          </span>
        )}

        {/* (A prévia agora aparece DENTRO da bola do time — ver TeamPanel) */}

        {/* BARRA DE TURNO: metade azul (esquerda) / metade vermelha (direita).
            O lado que está agindo preenche a metade dele com a cor do lado, e
            o preenchimento recua do lado (borda externa) para o CENTRO
            conforme o tempo passa — o tick vai do lado da ação até o centro. */}
        <div className="relative w-[60vmin] h-[1.1vmin] mt-[1vmin] flex">
          {/* Metade azul — preenchimento ancorado no centro, recua p/ ele */}
          <div className="relative flex-1 bg-[#3B82F6]/15 overflow-hidden">
            <motion.div
              className="absolute top-0 right-0 h-full bg-[#3B82F6]"
              initial={false}
              animate={{ width: emTurno && ladoEmTurno === 'blue' ? `${(segundos / duracaoSeg) * 100}%` : '0%' }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
          {/* Metade vermelha — espelho */}
          <div className="relative flex-1 bg-[#ef4444]/15 overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-[#ef4444]"
              initial={false}
              animate={{ width: emTurno && ladoEmTurno === 'red' ? `${(segundos / duracaoSeg) * 100}%` : '0%' }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
          {/* Divisória central */}
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/40 -translate-x-1/2" />
        </div>

        {/* Números do timer — visíveis para TODOS, telespectador incluído
            (pedido do usuário 2026-10-12). */}
        <div className={`text-[6vmin] font-black mt-[0.5vmin] tabular-nums drop-shadow-lg ${segundos <= 10 ? 'text-red-500' : 'text-white'}`}>
          {segundos}
        </div>
        </>
      </div>
      )}

      {/* TELA AO VIVO — CONFRONTO NO CENTRO da altura (pedido do usuário
          18/10): logos grandes, nomes em até 2 linhas CENTRALIZADOS, placar e
          status — mesma composição do miolo da sala, agora no meio da tela. */}
      {aoVivoAtivo && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[1.4vmin] pointer-events-none">
          <div className="flex items-start justify-center gap-[7vmin]">
            <div className="flex flex-col items-center gap-[1.1vmin] w-[24vmin]">
              {timeA?.logo
                ? <img src={timeA.logo} alt="" className="w-[14vmin] h-[14vmin] object-contain"
                    style={{ filter: `drop-shadow(0 0 28px color-mix(in srgb, ${timeA.cor || (ladoEquipeA === 'blue' ? '#3B82F6' : '#ef4444')} 70%, transparent))` }} />
                : <div className="w-[14vmin] h-[14vmin]" />}
              <span className="text-[1.8vmin] font-black uppercase tracking-[0.2em] text-white/90 leading-snug line-clamp-2 max-w-full text-center">
                {nomeSemQuebra(labelEquipeA)}
              </span>
            </div>
            <span className="text-[3.2vmin] font-black text-white/50 leading-none mt-[5.4vmin]">X</span>
            <div className="flex flex-col items-center gap-[1.1vmin] w-[24vmin]">
              {timeB?.logo
                ? <img src={timeB.logo} alt="" className="w-[14vmin] h-[14vmin] object-contain"
                    style={{ filter: `drop-shadow(0 0 28px color-mix(in srgb, ${timeB.cor || (ladoEquipeB === 'blue' ? '#3B82F6' : '#ef4444')} 70%, transparent))` }} />
                : <div className="w-[14vmin] h-[14vmin]" />}
              <span className="text-[1.8vmin] font-black uppercase tracking-[0.2em] text-white/90 leading-snug line-clamp-2 max-w-full text-center">
                {nomeSemQuebra(labelEquipeB)}
              </span>
            </div>
          </div>
          <span className="text-[6vmin] font-black tabular-nums leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
            {aoVivo?.placar?.a ?? 0} <span className="text-white/40">-</span> {aoVivo?.placar?.b ?? 0}
          </span>
          {!!aoVivo?.legenda && (
            <span className="text-[1.2vmin] font-black uppercase tracking-[0.4em] text-white/50">
              {aoVivo.legenda}
            </span>
          )}
          {!!aoVivo?.status && (
            <span className="inline-flex items-center gap-[0.8vmin] text-[2.4vmin] font-black text-[#00FF41] uppercase tracking-[0.25em]">
              {aoVivo.pulsante && <span className="w-[1.1vmin] h-[1.1vmin] rounded-full bg-red-500 animate-pulse shrink-0" />}
              {aoVivo.status}
            </span>
          )}
        </div>
      )}

      {/* ÍCONES DO TOPO — canto superior direito, acima dos bans do time
          vermelho e colados na lateral. Valem no DRAFT e na TELA AO VIVO
          (pedido do usuário 18/10): Trocar/Encerrar live do streamer, Resetar
          Sala (SÓ adm), Verificar Partida (só na tela ao vivo) e o mudo; no
          canto oposto, a seta de sair da sala. Absoluto de propósito: não
          empurra a linha de bans nem muda a altura dela. */}
      <div className="absolute top-[1vmin] right-[1.5vmin] z-50 flex items-center gap-[0.8vmin]">
        {acoesTopo?.resetar && (
          <button
            type="button"
            disabled={acoesTopo.resetar.carregando}
            onClick={() => acoesTopo?.resetar?.aoClicar()}
            title="Resetar sala (adm) — volta para o PRONTO"
            className="p-[0.7vmin] border border-[#ef4444]/50 text-[#ff8a8a] hover:text-white hover:border-[#ef4444] transition-colors duration-200 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-[2vmin] h-[2vmin] ${acoesTopo.resetar.carregando ? 'animate-spin' : ''}`} />
          </button>
        )}
        {acoesTopo?.twitch && (
          acoesTopo.twitch.aoEncerrar ? (
            /* Sua live está no ar: clicar ENCERRA — o card "Assista ao vivo"
               (canto inferior esquerdo) já leva para a Twitch (pedido do
               usuário 18/10). */
            <button
              type="button"
              disabled={acoesTopo.twitch.carregando}
              onClick={() => acoesTopo?.twitch?.aoEncerrar?.()}
              title="Encerrar sua live"
              className="relative p-[0.7vmin] border border-white/60 text-white hover:text-red-400 hover:border-red-500/60 transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              {acoesTopo.twitch.carregando
                ? <RefreshCw className="w-[2vmin] h-[2vmin] animate-spin" />
                : <Twitch className="w-[2vmin] h-[2vmin]" />}
              <span className="absolute top-[0.2vmin] right-[0.2vmin] w-[0.9vmin] h-[0.9vmin] rounded-full bg-red-600 animate-pulse" />
            </button>
          ) : acoesTopo.twitch.assistirHref ? (
            <a
              href={acoesTopo.twitch.assistirHref}
              target="_blank"
              rel="noreferrer"
              title="Abrir live na Twitch"
              className="relative p-[0.7vmin] border border-[#9146FF]/60 text-[#a866ff] hover:text-white hover:border-[#9146FF] transition-colors duration-200 cursor-pointer"
            >
              <Twitch className="w-[2vmin] h-[2vmin]" />
              <span className="absolute top-[0.2vmin] right-[0.2vmin] w-[0.9vmin] h-[0.9vmin] rounded-full bg-red-600 animate-pulse" />
            </a>
          ) : (
            <button
              type="button"
              disabled={acoesTopo.twitch.carregando}
              onClick={() => acoesTopo?.twitch?.aoIniciar?.()}
              title="Iniciar live na Twitch"
              className="p-[0.7vmin] border border-[#9146FF]/60 text-[#9146FF] hover:text-[#c9a7ff] hover:border-[#9146FF] transition-colors duration-200 cursor-pointer disabled:opacity-50"
            >
              {acoesTopo.twitch.carregando
                ? <RefreshCw className="w-[2vmin] h-[2vmin] animate-spin" />
                : <Twitch className="w-[2vmin] h-[2vmin]" />}
            </button>
          )
        )}
        {acoesTopo?.verificar && (
          <button
            type="button"
            disabled={acoesTopo.verificar.carregando}
            onClick={() => acoesTopo?.verificar?.aoClicar()}
            title="Verificar partida — confere na Riot agora"
            className="p-[0.7vmin] border border-[#00F0FF]/40 text-[#00F0FF] hover:text-white hover:border-[#00F0FF] transition-colors duration-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-[2vmin] h-[2vmin] ${acoesTopo.verificar.carregando ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMudo(alternarSomMudo())}
          title={mudo ? 'Ligar sons do draft' : 'Mutar sons do draft'}
          aria-label={mudo ? 'Ligar sons do draft' : 'Mutar sons do draft'}
          aria-pressed={mudo}
          className={`
            cursor-pointer p-[0.7vmin] border transition-colors duration-200
            ${mudo
              ? 'border-white/10 text-white/30 hover:text-white/60'
              : 'border-[#c89b3c]/40 text-[#c89b3c] hover:text-[#e6c469]'}
          `}
        >
          {mudo
            ? <VolumeX className="w-[2vmin] h-[2vmin]" />
            : <Volume2 className="w-[2vmin] h-[2vmin]" />}
        </button>
      </div>

      {/* SAIR DA SALA (draft e tela ao vivo) — mesma linguagem dos ícones do
          topo, no canto oposto: volta para /jogar como a seta da sala normal. */}
      {acoesTopo?.sair && (
        <button
          type="button"
          onClick={() => acoesTopo?.sair?.()}
          title="Sair da sala"
          className="absolute top-[1vmin] left-[1.5vmin] z-50 p-[0.7vmin] border border-white/15 text-white/70 hover:text-red-400 hover:border-red-500/50 transition-colors duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-[2vmin] h-[2vmin]" />
        </button>
      )}

      {/* BANS SECTION — cada EQUIPE no lado em jogo dela (esquerda = azul) */}
      <div className="absolute top-[5vmin] left-0 right-0 flex justify-between px-[4vmin] z-40">
        {(equipeEsquerda === 'A' ? (['A', 'B'] as const) : (['B', 'A'] as const)).map((equipe) => {
            const ehA = equipe === 'A';
            const dataSide = ehA ? 'blue' : 'red';
            const bans = ehA ? draft.blue_bans : draft.red_bans;
            const previaBan = emTurno && draft.current_team === dataSide && fase === 'ban'
              ? previewDoTime(ehA)
              : null;
            return (
              <div key={equipe} className="flex flex-col gap-[0.5vmin] items-start">
                <span className="text-[1vmin] font-bold text-white/20 uppercase tracking-[0.3em] ml-[0.5vmin]">Bans</span>
                <div className="flex flex-row gap-[1vmin]">
                  {[...Array(maxBans)].map((_, i) => (
                    <BanSlot key={`${equipe}-${i}`} champion={bans[i] ?? null}
                      preview={i === bans.length ? previaBan : null}
                      active={emTurno && draft.current_team === dataSide && fase === 'ban' && i === bans.length}
                      jaBaniu={i < bans.length} champions={champions} version={version} />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* MAIN CONTENT AREA — painéis no lado em jogo de cada equipe.
          A bola fica CENTRADA no vão entre o draft (85vmin) e a lateral da
          tela: padding = metade do vão − metade da coluna (12.5vmin). O max()
          só segura telas estreitas (vão menor que a coluna).
          Na TELA AO VIVO as bolas SAEM: sem ban/pick elas não têm função — o
          confronto (logos + placar + status) fica no topo (pedido do usuário). */}
      {!aoVivoAtivo && (
      <div className="absolute inset-0 flex items-center justify-between px-[max(2vmin,calc((100%_-_85vmin)/4_-_12.5vmin))] pointer-events-none z-30">
        {(equipeEsquerda === 'A' ? (['A', 'B'] as const) : (['B', 'A'] as const)).map((equipe) => {
          const ehA = equipe === 'A';
          const dataSide = ehA ? 'blue' : 'red';
          return (
            <TeamPanel key={equipe}
              ladoJogo={ehA ? ladoEquipeA : ladoEquipeB}
              emTurno={emTurno && draft.current_team === dataSide}
              jogadorNome={ehA ? labelEquipeA : labelEquipeB}
              logoTime={ehA ? (timeA?.logo ?? null) : (timeB?.logo ?? null)}
              textoAbaixo={fase === 'ban' ? 'Banindo...' : 'Escolhendo...'}
              feedback={feedback && feedback.lado === dataSide ? feedback : null} />
          );
        })}
      </div>
      )}

      {/* CENTER - CHAMPION GRID — SÓ para quem está na sala como JOGADOR. O
          telespectador não escolhe nada: fica sem grid, sem busca e sem o
          botão de confirmar (fase + timer + picks/bans continuam visíveis).
          O espaço liberado é o lugar natural da visão de transmissão. */}
      {mostraGrid && (
      <div className="absolute top-[12vmin] left-1/2 -translate-x-1/2 w-full max-w-[85vmin] flex flex-col gap-[1vmin] z-40">
        <div className="flex items-center justify-between gap-[1vmin] mb-[0.5vmin]">
          {/* Filtro de rota (igual ao client do LoL) — ícones do ROLE_CONFIG
              (/perfil). Clicar filtra; clicar de novo limpa o filtro. */}
          <div className="flex items-center gap-[0.35vmin]">
            {(['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map((r) => {
              const ativo = roleFiltro === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFiltro(ativo ? null : r)}
                  title={`Filtrar por ${ROLE_CONFIG[r].label}`}
                  className={`group flex items-center gap-[0.4vmin] px-[0.6vmin] py-[0.45vmin] border transition-colors cursor-pointer ${
                    ativo ? 'border-[#c89b3c] bg-[#c89b3c]/15' : 'border-white/10 bg-black/70 hover:border-white/30'
                  }`}
                >
                  <img
                    src={ROLE_CONFIG[r].img}
                    alt={ROLE_CONFIG[r].label}
                    className={`w-[1.8vmin] h-[1.8vmin] object-contain ${ativo ? '' : 'opacity-60 group-hover:opacity-90'}`}
                  />
                  <span className={`text-[1vmin] font-bold uppercase tracking-wide ${ativo ? 'text-[#c89b3c]' : 'text-white/55 group-hover:text-white/80'}`}>
                    {ROLE_CONFIG[r].label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative w-[30vmin]">
            <Search className="absolute left-[1vmin] top-1/2 -translate-y-1/2 w-[1.8vmin] h-[1.8vmin] text-[#c89b3c]" />
            <input
              type="text"
              placeholder="Buscar campeão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/80 border border-[#c89b3c]/40 rounded-sm py-[0.8vmin] pl-[3.5vmin] pr-[1.5vmin] text-[1.6vmin] outline-none focus:border-[#c89b3c] transition-colors placeholder:text-[#c89b3c]/30 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-6 gap-x-[0.8vmin] gap-y-[1.2vmin] max-h-[58vmin] overflow-y-auto custom-scrollbar pr-[1vmin]">
          {filteredChampions.map(champ => {
            const usado = indisponivel(champ.id);
            const selecionado = selectedChamp?.id === champ.id;
            return (
              <div
                key={champ.id}
                onClick={() => handleChampionClick(champ)}
                className={`flex flex-col items-center gap-[0.3vmin] group ${isMeuTurno ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`
                  relative w-[11.5vmin] h-[11.5vmin] border-2 transition-all duration-200
                  ${selecionado ? 'border-[#c89b3c] scale-110 shadow-[0_0_15px_rgba(200,155,60,0.5)]' : 'border-white/10 group-hover:border-white/40'}
                  ${usado ? 'opacity-30 grayscale cursor-not-allowed' : ''}
                `}>
                  <img src={buildChampionIconUrl(champ.id, version)} alt={champ.name}
                    className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {(draft.blue_bans.includes(champ.id) || draft.red_bans.includes(champ.id)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-grayscale overflow-hidden">
                      <div className="absolute inset-0 border-t-4 border-red-600/80 -rotate-45 origin-center scale-150" />
                    </div>
                  )}
                </div>
                <span className={`text-[1.2vmin] font-bold truncate w-full text-center ${selecionado ? 'text-[#c89b3c]' : 'text-white/60'}`}>
                  {champ.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* CENTRO — VISÃO DE TRANSMISSÃO (telespectador): Time A X Time B grande
          + placar da série embaixo (o grid de escolha não existe aqui). */}
      {!possoJogar && !espectadorCompleto && (timeA || timeB || placar) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[110vmin] flex flex-col items-center gap-[2.5vmin] z-40 pointer-events-none">
          <div className="flex items-center justify-center gap-[6vmin] w-full">
            <div className="flex flex-col items-center gap-[1vmin] w-[30vmin]">
              {timeNaEsquerda?.logo ? (
                <img src={timeNaEsquerda.logo} alt="" className="w-[18vmin] h-[18vmin] object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]" />
              ) : (
                <div className="w-[18vmin] h-[18vmin] bg-white/5 border border-white/10" />
              )}
              <span className="text-[2.2vmin] font-black uppercase tracking-[0.25em] text-white/90 truncate max-w-full px-[1vmin]">
                {timeNaEsquerda?.nome ?? ''}
              </span>
            </div>
            <span className="text-[7vmin] font-black text-white/60 leading-none drop-shadow-lg">X</span>
            <div className="flex flex-col items-center gap-[1vmin] w-[30vmin]">
              {timeNaDireita?.logo ? (
                <img src={timeNaDireita.logo} alt="" className="w-[18vmin] h-[18vmin] object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.35)]" />
              ) : (
                <div className="w-[18vmin] h-[18vmin] bg-white/5 border border-white/10" />
              )}
              <span className="text-[2.2vmin] font-black uppercase tracking-[0.25em] text-white/90 truncate max-w-full px-[1vmin]">
                {timeNaDireita?.nome ?? ''}
              </span>
            </div>
          </div>
          {placar && (
            <div className="text-[6vmin] font-black tabular-nums leading-none text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {placar.a} <span className="text-white/40">-</span> {placar.b}
            </div>
          )}
        </div>
      )}

      {/* FOOTER PICKS & ACTION BUTTON */}
      <div className="absolute bottom-[2vmin] left-0 right-0 flex items-end justify-between px-[4vmin] z-50">
        {colunaPicks(equipeEsquerda, false)}

        {!aoVivoAtivo && possoJogar && (() => {
          // Cor do "aguardando você escolher": ban = vermelho; pick = cor do
          // MEU lado como aparece na tela (azul/vermelho). Ação dos outros =
          // botão apagado, como sempre.
          const meuLadoVisual = meuTime === 'blue' ? ladoEquipeA : meuTime === 'red' ? ladoEquipeB : null;
          const aguardando = isMeuTurno && !selectedChamp && !enviando;
          const pronto = !!selectedChamp && isMeuTurno && !enviando;
          // Só a BORDA muda de cor (texto e fundo seguem o padrão do botão).
          const corVez = fase === 'ban' || meuLadoVisual !== 'blue'
            ? { linha: '#ef4444', brilho: 'rgba(239,68,68,0.6)' }
            : { linha: '#3b82f6', brilho: 'rgba(59,130,246,0.6)' };
          return (
            <div className="mb-[2vmin] relative">
              <button
                disabled={!selectedChamp || !isMeuTurno || enviando}
                onMouseEnter={() => {
                  if (selectedChamp && isMeuTurno && !enviando) tocarSom('lockInHover');
                }}
                onClick={confirmarAcao}
                className={`
                  relative px-[12vmin] py-[2.5vmin] font-bold text-[2.2vmin] tracking-[0.15em] uppercase transition-all duration-300 group
                  ${pronto ? 'text-[#f0e6d2] hover:text-white cursor-pointer' : 'text-white/20 cursor-not-allowed'}
                `}
              >
                <div className={`absolute inset-0 z-0 ${aguardando ? 'animate-pulse [animation-duration:2.8s]' : ''}`}>
                  <svg
                    viewBox="0 0 300 80"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                    style={{
                      filter: pronto
                        ? 'drop-shadow(0 0 15px rgba(200,155,60,0.35))'
                        : aguardando
                          ? `drop-shadow(0 0 16px ${corVez.brilho})`
                          : 'drop-shadow(0 0 15px rgba(200,155,60,0.1))',
                    }}
                  >
                    <path d="M40,5 L260,5 L295,60 Q150,85 5,60 Z" fill="none"
                      stroke={pronto ? '#c89b3c' : aguardando ? corVez.linha : 'rgba(255,255,255,0.1)'} strokeWidth="2" />
                    <path d="M42,7 L258,7 L292,59 Q150,83 8,59 Z"
                      fill={pronto ? '#1e2328' : '#0a0a0a'}
                      className="transition-colors duration-300 group-hover:fill-[#252a30]" />
                  </svg>
                </div>
                <span className="relative z-10 drop-shadow-md">
                  {enviando ? '...' : fase === 'ban' ? 'BANIR' : 'CONFIRMAR'}
                </span>
              </button>
            </div>
          );
        })()}

        {/* CÓDIGO DA PARTIDA (tela ao vivo): no lugar do botão de confirmar —
            MESMO painel da sala ("Prepare-se para a batalha" + "Copiar
            Código"), sem mudar nada. Só chega aqui quem o servidor deixa ver
            (staff ou time da vaga); o espectador continua com os patrocínios. */}
        {aoVivoAtivo && aoVivo?.codigo && (
          <div className="mb-[2vmin] flex flex-col items-center gap-[1.5vmin]">
            <p className="text-[1.4vmin] font-black text-white uppercase tracking-[0.5em]">
              Prepare-se para a batalha
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={copiarCodigoAoVivo}
              className="relative p-[1.5px] bg-black cursor-pointer"
              style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
            >
              <span
                className="block bg-[#FFB700] px-[8vmin] py-[1.6vmin] font-black uppercase tracking-[0.4em] text-[1.5vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-[1.2vmin] transition-colors"
                style={{ clipPath: 'polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)' }}
              >
                {codigoCopiado
                  ? <Check className="w-[1.8vmin] h-[1.8vmin]" />
                  : <Copy className="w-[1.8vmin] h-[1.8vmin]" />}
                {codigoCopiado ? 'Código Copiado!' : 'Copiar Código'}
              </span>
            </motion.button>
          </div>
        )}

        {/* PATROCINADORES (telespectador): no lugar do botão de confirmar —
            linha fina, selo "PATROCINADORES" e os logos centralizados. */}
        {!possoJogar && !(aoVivoAtivo && aoVivo?.codigo) && (
          <div className="mb-[1vmin] flex flex-col items-center gap-[0.8vmin] pointer-events-none">
            <div className="w-[42vmin] h-[1px] bg-gradient-to-r from-transparent via-[#c89b3c]/70 to-transparent" />
            <span className="text-[1.1vmin] font-bold uppercase tracking-[0.5em] text-white/45">Patrocinadores</span>
            <div className="flex items-center justify-center gap-[7vmin] mt-[0.6vmin]">
              <img
                src="/images/patrocinadores/m7-arena.png"
                alt="M7 Arena"
                className="h-[6vmin] object-contain opacity-95"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <img
                src="/images/patrocinadores/mobyle-store.svg"
                alt="Mobyle Store"
                className="h-[6vmin] object-contain opacity-95"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
        )}

        {colunaPicks(equipeDireita, true)}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(200, 155, 60, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c89b3c; border-radius: 2px; }
      `}</style>
    </div>
  );
};
