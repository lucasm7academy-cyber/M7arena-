// draftSounds.ts — sons do draft (arquivos extraídos do client do LoL;
// curadoria do usuário em 2026-10-18).
//
// Os .ogg vivem NO REPO em /public/sounds/draft: o nginx serve estático, sem
// API e sem primeiro-toque esperando download (precarregarSons cria os
// elementos no mount). Nada de URL externa/CDN.
//
// Som é acessório: autoplay bloqueado, arquivo ausente ou áudio indisponível
// NUNCA pode quebrar o draft — por isso o play() sempre morre em silêncio
// (com um aviso único de autoplay, pra não parecer bug mudo).
//
// Camada x evento (correção 2026-10-18): os sons de fase são "cama" (4-5s,
// tocam quando a fase começa). Evento — o ban entrando, a notificação da sua
// vez, o fim do draft — CORTA a cama. Sem isso o 1º ban de cada fase ficava
// abafado por baixo da cama iniciada segundos antes (queixa do usuário: "o 1º
// ban não tem som, no 2º solta").

export type SomDraft =
  | 'inicioBan' | 'bansTravados' | 'seuBan' | 'suaVez'
  | 'banAliado' | 'banInimigo'
  | 'tickCurto'
  | 'gridClique' | 'lockInHover' | 'lockInClique' | 'pickNegado'
  | 'draftFinalizado';

// Volume por som: o tick precisa ficar discreto (1x por segundo por 30s);
// notificações da minha vez e o fim do draft são os momentos que "falam".
const FONTES: Record<SomDraft, { arquivo: string; volume: number }> = {
  inicioBan: { arquivo: 'inicio-do-ban.ogg', volume: 0.55 },
  bansTravados: { arquivo: 'bans-travados.ogg', volume: 0.6 },
  seuBan: { arquivo: 'seu-ban.ogg', volume: 0.7 },
  suaVez: { arquivo: 'sua-vez-de-escolher.ogg', volume: 0.7 },
  banAliado: { arquivo: 'ban-do-time-aliado.ogg', volume: 0.55 },
  banInimigo: { arquivo: 'ban-do-time-inimigo.ogg', volume: 0.55 },
  tickCurto: { arquivo: 'relogio-tick-curto.ogg', volume: 0.4 },
  gridClique: { arquivo: 'grid-clique.ogg', volume: 0.45 },
  lockInHover: { arquivo: 'lock-in-hover.ogg', volume: 0.35 },
  lockInClique: { arquivo: 'lock-in-clique.ogg', volume: 0.55 },
  pickNegado: { arquivo: 'pick-negado.ogg', volume: 0.5 },
  // Tema de finalização do draft (música, não SFX): começa no último pick e
  // toca até a tela voltar pra sala (~3,4s) — o volume fica de fundo.
  draftFinalizado: { arquivo: 'draft-finalizado.ogg', volume: 0.5 },
};

// "Cama" = som de fase (longo). "Evento" = acontecimento pontual. Evento
// dispara => cama para; cama nova => troca a anterior (nunca duas camas).
const CAMAS: ReadonlySet<SomDraft> = new Set(['inicioBan', 'bansTravados']);
const EVENTOS: ReadonlySet<SomDraft> = new Set(['banAliado', 'banInimigo', 'seuBan', 'suaVez', 'draftFinalizado']);

const cache = new Map<SomDraft, HTMLAudioElement>();
let avisouAutoplay = false;

// Mudo: preferência do usuário lembrada no navegador (botão no canto do draft).
const CHAVE_MUDO = 'm7.draft.som.mudo';
let mudo: boolean | null = null;

/** Se o usuário mutou os sons do draft (lembrado entre visitas). */
export function somMudo(): boolean {
  if (mudo === null) {
    try {
      mudo = typeof window !== 'undefined' && window.localStorage.getItem(CHAVE_MUDO) === '1';
      // fallback (storage indisponível, modo privado): começa ligado
    } catch {
      mudo = false;
    }
  }
  return mudo;
}

/** Liga/desliga TODOS os sons do draft. Devolve o novo estado. */
export function alternarSomMudo(): boolean {
  mudo = !somMudo();
  try {
    window.localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0');
  } catch (erro) {
    // Sem storage a escolha vale só para esta página — não é falha do draft.
    console.info('[draft] não consegui guardar a preferência de mudo', erro);
  }
  // Mutou agora: silencia o que estiver tocando (killcam/ban em andamento).
  if (mudo) {
    pararSonsDraft();
  }
  return mudo;
}

/** Para um som específico (ex.: a notificação cumpriu o papel na ação confirmada). */
export function pararSom(nome: SomDraft): void {
  const som = cache.get(nome);
  if (som && !som.paused) {
    som.pause();
    som.currentTime = 0;
  }
}

function pararCamas(): void {
  for (const nome of CAMAS) pararSom(nome);
}

/** Para TODOS os sons do draft (a tela desmontou: nada vaza pra sala). */
export function pararSonsDraft(): void {
  for (const nome of cache.keys()) pararSom(nome);
}

function obterSom(nome: SomDraft): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  let som = cache.get(nome);
  if (!som) {
    const fonte = FONTES[nome];
    som = new Audio(`/sounds/draft/${fonte.arquivo}`);
    som.preload = 'auto';
    som.volume = fonte.volume;
    cache.set(nome, som);
  }
  return som;
}

/** Toca um som do draft. Rebobina se estiver tocando; falha em silêncio. */
export function tocarSom(nome: SomDraft): void {
  try {
    if (somMudo()) return;
    // Evento corta a cama da fase; cama nova troca a anterior (uma por vez).
    if (EVENTOS.has(nome) || CAMAS.has(nome)) pararCamas();
    const som = obterSom(nome);
    if (!som) return;
    som.currentTime = 0;
    som.play().catch(() => {
      // Autoplay bloqueado (esperado antes do primeiro gesto): avisa uma vez
      // só — repetir a cada tick poluiria o console.
      if (!avisouAutoplay) {
        avisouAutoplay = true;
        console.info('[draft] navegador bloqueou o áudio até a primeira interação da página.');
      }
    });
  } catch (erro) {
    // Som é enfeite: um erro de áudio jamais pode derrubar o draft.
    console.warn('[draft] falha ao tocar som', nome, erro);
  }
}

/** Cria os elementos no mount para o primeiro toque de cada som já estar baixado. */
export function precarregarSons(): void {
  for (const nome of Object.keys(FONTES) as SomDraft[]) {
    try {
      obterSom(nome);
    } catch (erro) {
      console.warn('[draft] falha ao pré-carregar som', nome, erro);
    }
  }
}

/**
 * Destrava o áudio no primeiro gesto (tap/clique). O Safari/iOS só libera
 * play() dentro de um gesto — os sons do draft disparam por WebSocket/polling
 * (fora de gesto), então sem isso ficariam mudos no celular.
 * Devolve o cleanup pra desinstalar o listener ao desmontar a tela.
 */
export function desbloquearSonsDraft(): () => void {
  if (typeof document === 'undefined') return () => {};
  const aoPrimeiroGesto = () => {
    document.removeEventListener('pointerdown', aoPrimeiroGesto);
    for (const nome of Object.keys(FONTES) as SomDraft[]) {
      try {
        const som = obterSom(nome);
        if (!som) continue;
        som.muted = true;
        const p = som.play();
        const finalizar = () => {
          som.pause();
          som.currentTime = 0;
          som.muted = false;
        };
        if (p) p.then(finalizar).catch(finalizar);
        else finalizar();
      } catch (erro) {
        console.warn('[draft] falha ao destravar som', nome, erro);
      }
    }
  };
  document.addEventListener('pointerdown', aoPrimeiroGesto);
  return () => document.removeEventListener('pointerdown', aoPrimeiroGesto);
}
