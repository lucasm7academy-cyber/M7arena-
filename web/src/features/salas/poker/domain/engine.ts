/**
 * Motor de Texas Hold'em no-limit, sem dependências externas.
 *
 * Fichas do app = ESSÊNCIA (moeda do site). Toda a lógica é pura: o estado
 * entra, um estado novo sai. A UI (PokerPage) só decide quando o bot joga.
 */

export type Suit = 's' | 'h' | 'd' | 'c';

export interface Card {
  r: number; // 2..14 (14 = Ás)
  s: Suit;
  id: string; // "Ah", "10s"...
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';

export type BotStyle = 'tight' | 'balanced' | 'loose' | 'maniac';

export interface Seat {
  id: string;
  name: string;
  avatar: string; // emoji ou inicial
  tint: string; // cor do avatar (hex)
  isHero: boolean;
  bot: boolean;
  style: BotStyle;
  stack: number;
  bet: number; // apostado nesta rua
  total: number; // apostado nesta mão
  cards: Card[];
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  lastAction?: string;
  won?: number;
  shown?: string; // rótulo da mão no showdown
}

export interface LogEntry {
  id: number;
  seatId?: string;
  text: string;
  kind: 'action' | 'street' | 'result' | 'system';
}

export interface HandScore {
  category: number; // 0..8
  kickers: number[];
  label: string;
  cards: Card[];
}

export interface PotLayer {
  amount: number;
  eligible: string[];
}

export interface PokerState {
  seats: Seat[];
  board: Card[];
  deck: Card[];
  street: Street;
  dealer: number;
  actor: number;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  sb: number;
  bb: number;
  handNo: number;
  log: LogEntry[];
  awards: { seatId: string; amount: number }[];
  showdown: boolean;
  message: string;
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface Action {
  type: ActionType;
  amount?: number; // total a que a aposta sobe (raise-to)
}

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
const HAND_LABEL = [
  'Carta alta',
  'Par',
  'Dois pares',
  'Trinca',
  'Sequência',
  'Flush',
  'Full house',
  'Quadra',
  'Straight flush',
];

export function cardLabel(card: Card): string {
  return `${RANK_LABEL[card.r]}${card.s}`;
}

export function formatChips(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ r, s, id: `${RANK_LABEL[r]}${s}` });
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Avaliação de mãos                                                   */
/* ------------------------------------------------------------------ */

function straightHigh(ranks: number[]): number | null {
  const uniq = Array.from(new Set(ranks)).sort((a, b) => b - a);
  if (uniq.includes(14)) uniq.push(1);
  for (let i = 0; i + 4 < uniq.length; i++) {
    if (uniq[i] - uniq[i + 4] === 4) {
      for (let k = 0; k < 4; k++) if (uniq[i + k] - uniq[i + k + 1] !== 1) return null;
      return uniq[i];
    }
  }
  return null;
}

export function evaluate(cards: Card[]): HandScore {
  const sorted = cards.slice().sort((a, b) => b.r - a.r);
  const counts = new Map<number, number>();
  for (const c of sorted) counts.set(c.r, (counts.get(c.r) || 0) + 1);

  const bySuit = new Map<Suit, Card[]>();
  for (const c of sorted) {
    const list = bySuit.get(c.s) || [];
    list.push(c);
    bySuit.set(c.s, list);
  }
  const flushCards = Array.from(bySuit.values()).find((list) => list.length >= 5) || null;

  const groups = Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const kickersFrom = (exclude: number[], limit: number) =>
    sorted.filter((c) => !exclude.includes(c.r)).filter((c, i, arr) => arr.findIndex((o) => o.r === c.r) === i)
      .slice(0, limit)
      .map((c) => c.r);

  // Straight flush
  if (flushCards) {
    const sfHigh = straightHigh(flushCards.map((c) => c.r));
    if (sfHigh) {
      const winning = flushCards
        .filter((c) => c.r <= sfHigh && c.r > sfHigh - 5)
        .sort((a, b) => b.r - a.r);
      return { category: 8, kickers: [sfHigh], label: sfHigh === 14 ? 'Royal flush' : 'Straight flush', cards: winning };
    }
  }

  // Quadra
  const quad = groups.find((g) => g.count === 4);
  if (quad) {
    const kicker = kickersFrom([quad.rank], 1)[0] ?? 0;
    return {
      category: 7,
      kickers: [quad.rank, kicker],
      label: HAND_LABEL[7],
      cards: sorted.filter((c) => c.r === quad.rank || c.r === kicker).slice(0, 5),
    };
  }

  // Full house / trinca
  const trips = groups.filter((g) => g.count === 3).map((g) => g.rank);
  const pairs = groups.filter((g) => g.count === 2).map((g) => g.rank);
  if (trips.length >= 2) {
    return {
      category: 6,
      kickers: [trips[0], trips[1]],
      label: HAND_LABEL[6],
      cards: sorted.filter((c) => c.r === trips[0] || c.r === trips[1]).slice(0, 5),
    };
  }
  if (trips.length === 1 && pairs.length >= 1) {
    return {
      category: 6,
      kickers: [trips[0], pairs[0]],
      label: HAND_LABEL[6],
      cards: sorted.filter((c) => c.r === trips[0] || c.r === pairs[0]).slice(0, 5),
    };
  }

  // Flush
  if (flushCards) {
    const top = flushCards.slice(0, 5);
    return { category: 5, kickers: top.map((c) => c.r), label: HAND_LABEL[5], cards: top };
  }

  // Sequência
  const straight = straightHigh(sorted.map((c) => c.r));
  if (straight) {
    const cards5: Card[] = [];
    const wanted = straight === 5 ? [5, 4, 3, 2, 14] : [straight, straight - 1, straight - 2, straight - 3, straight - 4];
    for (const rank of wanted) {
      const card = sorted.find((c) => c.r === rank);
      if (card) cards5.push(card);
    }
    return { category: 4, kickers: [straight], label: HAND_LABEL[4], cards: cards5 };
  }

  // Trinca
  if (trips.length === 1) {
    const kickers = kickersFrom([trips[0]], 2);
    return {
      category: 3,
      kickers: [trips[0], ...kickers],
      label: HAND_LABEL[3],
      cards: sorted.filter((c) => c.r === trips[0] || kickers.includes(c.r)).slice(0, 5),
    };
  }

  // Dois pares
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kicker = kickersFrom([p1, p2], 1)[0] ?? 0;
    return {
      category: 2,
      kickers: [p1, p2, kicker],
      label: HAND_LABEL[2],
      cards: sorted.filter((c) => c.r === p1 || c.r === p2 || c.r === kicker).slice(0, 5),
    };
  }

  // Par
  if (pairs.length === 1) {
    const kickers = kickersFrom([pairs[0]], 3);
    return {
      category: 1,
      kickers: [pairs[0], ...kickers],
      label: HAND_LABEL[1],
      cards: sorted.filter((c) => c.r === pairs[0] || kickers.includes(c.r)).slice(0, 5),
    };
  }

  const high = sorted.slice(0, 5);
  return { category: 0, kickers: high.map((c) => c.r), label: HAND_LABEL[0], cards: high };
}

export function compareHands(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i++) {
    const av = a.kickers[i] ?? 0;
    const bv = b.kickers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Mesa                                                                */
/* ------------------------------------------------------------------ */

export interface TableConfig {
  heroName: string;
  heroAvatar?: string;
  bots?: { name: string; avatar: string; tint: string; style: BotStyle }[];
  stack: number;
  sb: number;
  bb: number;
}

export const DEFAULT_BOTS: TableConfig['bots'] = [
  { name: 'Vitor', avatar: 'VT', tint: '#c8aa6e', style: 'balanced' },
  { name: 'Duda', avatar: 'DD', tint: '#5b8def', style: 'loose' },
  { name: 'Kaiô', avatar: 'KO', tint: '#e0679b', style: 'tight' },
  { name: 'Nina', avatar: 'NN', tint: '#3fbf9a', style: 'maniac' },
  { name: 'Rafa', avatar: 'RF', tint: '#b07be0', style: 'balanced' },
];

export function createTable(config: TableConfig): PokerState {
  const bots = config.bots ?? DEFAULT_BOTS;
  const seats: Seat[] = [
    {
      id: 'hero',
      name: config.heroName || 'Você',
      avatar: config.heroAvatar || 'M7',
      tint: '#c8aa6e',
      isHero: true,
      bot: false,
      style: 'balanced',
      stack: config.stack,
      bet: 0,
      total: 0,
      cards: [],
      folded: false,
      allIn: false,
      hasActed: false,
    },
    ...bots.map((bot, i) => ({
      id: `bot-${i}`,
      name: bot.name,
      avatar: bot.avatar,
      tint: bot.tint,
      isHero: false,
      bot: true,
      style: bot.style,
      stack: config.stack,
      bet: 0,
      total: 0,
      cards: [],
      folded: false,
      allIn: false,
      hasActed: false,
    })),
  ];

  return {
    seats,
    board: [],
    deck: [],
    street: 'complete',
    dealer: seats.length - 1,
    actor: -1,
    toCall: 0,
    minRaiseTo: config.bb * 2,
    maxRaiseTo: config.bb * 2,
    sb: config.sb,
    bb: config.bb,
    handNo: 0,
    log: [],
    awards: [],
    showdown: false,
    message: 'Aguardando o início da mão.',
  };
}

function nextActive(state: PokerState, from: number): number {
  for (let step = 1; step <= state.seats.length; step++) {
    const idx = (from + step) % state.seats.length;
    if (state.seats[idx].stack > 0) return idx;
  }
  return -1;
}

function log(state: PokerState, entry: Omit<LogEntry, 'id'>): void {
  state.log = [{ id: (state.log[state.log.length - 1]?.id ?? 0) + 1, ...entry }, ...state.log].slice(0, 40);
}

function clone(state: PokerState): PokerState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, cards: s.cards.slice() })),
    board: state.board.slice(),
    deck: state.deck.slice(),
    log: state.log.slice(),
    awards: state.awards.slice(),
  };
}

export function potTotal(state: PokerState): number {
  return state.seats.reduce((sum, s) => sum + s.total, 0);
}

function maxBet(state: PokerState): number {
  return state.seats.reduce((max, s) => Math.max(max, s.bet), 0);
}

export function startHand(prev: PokerState): PokerState {
  const state = clone(prev);
  state.handNo += 1;
  state.deck = shuffle(makeDeck());
  state.board = [];
  state.awards = [];
  state.showdown = false;
  state.message = '';

  for (const seat of state.seats) {
    seat.cards = [];
    seat.bet = 0;
    seat.total = 0;
    seat.folded = false;
    seat.allIn = false;
    seat.hasActed = false;
    seat.lastAction = undefined;
    seat.won = undefined;
    seat.shown = undefined;
    if (seat.stack <= 0) seat.folded = true; // sem fichas: fica fora da mão
  }

  const dealer = nextActive(state, state.dealer);
  if (dealer < 0) {
    state.street = 'complete';
    state.message = 'Mesa sem fichas. Recarregue a essência para jogar.';
    return state;
  }
  state.dealer = dealer;

  for (const seat of state.seats) {
    if (seat.stack <= 0) continue;
    seat.cards = [state.deck.pop()!, state.deck.pop()!];
  }

  const activeCount = state.seats.filter((s) => s.stack > 0).length;
  const sbIndex = activeCount === 2 ? dealer : nextActive(state, dealer);
  const bbIndex = nextActive(state, sbIndex);

  const post = (index: number, amount: number, label: string) => {
    const seat = state.seats[index];
    const paid = Math.min(amount, seat.stack);
    seat.stack -= paid;
    seat.bet += paid;
    seat.total += paid;
    seat.lastAction = `${label} ${formatChips(paid)}`;
    if (seat.stack === 0) seat.allIn = true;
  };
  post(sbIndex, state.sb, 'SB');
  post(bbIndex, state.bb, 'BB');

  state.street = 'preflop';
  state.actor = activeCount === 2 ? sbIndex : nextActive(state, bbIndex);
  state.toCall = maxBet(state) - state.seats[state.actor].bet;
  state.minRaiseTo = state.bb * 2;
  state.maxRaiseTo = Math.max(state.minRaiseTo, state.seats[state.actor].bet + state.seats[state.actor].stack);

  log(state, { kind: 'street', text: `Mão #${state.handNo} — blinds ${formatChips(state.sb)}/${formatChips(state.bb)}` });
  log(state, { kind: 'system', seatId: state.seats[sbIndex].id, text: `SB ${state.seats[sbIndex].name} paga ${formatChips(state.seats[sbIndex].bet)}` });
  log(state, { kind: 'system', seatId: state.seats[bbIndex].id, text: `BB ${state.seats[bbIndex].name} paga ${formatChips(state.seats[bbIndex].bet)}` });

  return afterAdvance(state);
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canRaise: boolean;
  allIn: boolean;
}

export function legalActions(state: PokerState): LegalActions {
  const seat = state.seats[state.actor];
  if (!seat || state.actor < 0) {
    return { canFold: false, canCheck: false, callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0, canRaise: false, allIn: false };
  }
  const toCall = Math.max(0, maxBet(state) - seat.bet);
  const callAmount = Math.min(toCall, seat.stack);
  const minRaiseTo = Math.min(seat.bet + seat.stack, Math.max(state.minRaiseTo, maxBet(state) + state.bb));
  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount,
    minRaiseTo,
    maxRaiseTo: seat.bet + seat.stack,
    canRaise: seat.stack > callAmount,
    allIn: seat.stack > 0,
  };
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

export function act(prev: PokerState, action: Action): PokerState {
  const state = clone(prev);
  const index = state.actor;
  if (index < 0) return prev;
  const seat = state.seats[index];
  const legal = legalActions(prev);
  const highest = maxBet(state);

  const commit = (amount: number) => {
    const paid = Math.min(amount, seat.stack);
    seat.stack -= paid;
    seat.bet += paid;
    seat.total += paid;
    if (seat.stack === 0) seat.allIn = true;
    return paid;
  };

  switch (action.type) {
    case 'fold': {
      seat.folded = true;
      seat.hasActed = true;
      seat.lastAction = 'Fold';
      log(state, { kind: 'action', seatId: seat.id, text: `${seat.name} folda` });
      break;
    }
    case 'check': {
      if (!legal.canCheck) return act(prev, { type: 'call' });
      seat.hasActed = true;
      seat.lastAction = 'Check';
      log(state, { kind: 'action', seatId: seat.id, text: `${seat.name} mesa` });
      break;
    }
    case 'call': {
      const paid = commit(legal.callAmount);
      seat.hasActed = true;
      seat.lastAction = legal.callAmount >= seat.stack + paid ? 'All-in' : `Call ${formatChips(paid)}`;
      log(state, {
        kind: 'action',
        seatId: seat.id,
        text: `${seat.name} paga ${formatChips(paid)}${seat.allIn ? ' (all-in)' : ''}`,
      });
      break;
    }
    case 'bet':
    case 'raise': {
      const target = Math.max(legal.minRaiseTo, Math.min(action.amount ?? legal.minRaiseTo, legal.maxRaiseTo));
      const before = seat.bet;
      const paid = commit(target - seat.bet);
      const raiseSize = seat.bet - highest;
      if (raiseSize > 0) {
        state.minRaiseTo = Math.max(state.minRaiseTo, seat.bet + raiseSize);
        for (const other of state.seats) if (other.id !== seat.id) other.hasActed = false;
      }
      seat.hasActed = true;
      seat.lastAction = seat.allIn ? 'All-in' : `${highest > 0 ? 'Raise' : 'Bet'} ${formatChips(seat.bet)}`;
      log(state, {
        kind: 'action',
        seatId: seat.id,
        text: `${seat.name} ${highest > before ? 'sobe para' : 'aposta'} ${formatChips(seat.bet)}${seat.allIn ? ' (all-in)' : ''}`,
      });
      void paid;
      break;
    }
    case 'allin': {
      const target = seat.bet + seat.stack;
      const paid = commit(seat.stack);
      const raiseSize = seat.bet - highest;
      if (raiseSize > 0) {
        state.minRaiseTo = Math.max(state.minRaiseTo, seat.bet + raiseSize);
        for (const other of state.seats) if (other.id !== seat.id) other.hasActed = false;
      }
      seat.hasActed = true;
      seat.lastAction = 'All-in';
      log(state, { kind: 'action', seatId: seat.id, text: `${seat.name} vai all-in com ${formatChips(paid)}` });
      void target;
      break;
    }
    default:
      return prev;
  }

  state.minRaiseTo = Math.max(state.sb * 2, state.minRaiseTo);
  return afterAdvance(state);
}

function canAct(seat: Seat): boolean {
  return !seat.folded && seat.stack > 0;
}

function roundComplete(state: PokerState): boolean {
  const contenders = state.seats.filter((s) => !s.folded);
  if (contenders.length <= 1) return true;
  const actors = contenders.filter(canAct);
  if (actors.length === 0) return true;
  const highest = maxBet(state);
  return actors.every((s) => s.hasActed && s.bet === highest);
}

function findNextActor(state: PokerState, from: number): number {
  for (let step = 1; step <= state.seats.length; step++) {
    const idx = (from + step) % state.seats.length;
    const seat = state.seats[idx];
    if (canAct(seat) && !(seat.hasActed && seat.bet === maxBet(state))) return idx;
  }
  return -1;
}

function resetStreetActions(state: PokerState): void {
  for (const seat of state.seats) {
    seat.bet = 0;
    seat.hasActed = false;
    seat.lastAction = undefined;
  }
}

function dealBoard(state: PokerState, count: number): void {
  for (let i = 0; i < count; i++) state.board.push(state.deck.pop()!);
}

function sidePots(state: PokerState): PotLayer[] {
  const contribs = state.seats.map((s) => s.total);
  const levels = Array.from(new Set(contribs.filter((c) => c > 0))).sort((a, b) => a - b);
  const layers: PotLayer[] = [];
  let prev = 0;
  for (const level of levels) {
    const contributors = state.seats.filter((s) => s.total >= level);
    const amount = (level - prev) * contributors.length;
    const eligible = contributors.filter((s) => !s.folded).map((s) => s.id);
    if (amount > 0) layers.push({ amount, eligible });
    prev = level;
  }
  return layers;
}

function settle(state: PokerState): PokerState {
  state.street = 'showdown';
  const contenders = state.seats.filter((s) => !s.folded);
  const scores = new Map<string, HandScore>();
  for (const seat of contenders) {
    scores.set(seat.id, evaluate([...seat.cards, ...state.board]));
  }

  if (contenders.length === 1) {
    const winner = contenders[0];
    const amount = potTotal(state);
    winner.stack += amount;
    winner.won = amount;
    state.awards = [{ seatId: winner.id, amount }];
    state.showdown = false;
    state.street = 'complete';
    state.message = `${winner.name} leva ${formatChips(amount)} de essência.`;
    log(state, { kind: 'result', seatId: winner.id, text: `${winner.name} leva ${formatChips(amount)} (todos foldaram)` });
    state.actor = -1;
    return state;
  }

  state.showdown = true;
  for (const seat of state.seats) {
    const score = scores.get(seat.id);
    if (score) seat.shown = score.label;
  }

  const awards = new Map<string, number>();
  for (const layer of sidePots(state)) {
    const eligible = layer.eligible.filter((id) => scores.has(id));
    if (!eligible.length) continue;
    let winners: string[] = [];
    for (const id of eligible) {
      const score = scores.get(id)!;
      if (!winners.length) {
        winners = [id];
        continue;
      }
      const cmp = compareHands(score, scores.get(winners[0])!);
      if (cmp > 0) winners = [id];
      else if (cmp === 0) winners.push(id);
    }

    // Desempate do resto: quem está mais perto do dealer na ordem horária.
    const distance = (id: string) => {
      const seatIndex = state.seats.findIndex((s) => s.id === id);
      return (seatIndex - state.dealer + state.seats.length) % state.seats.length;
    };
    winners.sort((a, b) => distance(a) - distance(b));
    const share = Math.floor(layer.amount / winners.length);
    let remainder = layer.amount - share * winners.length;
    for (const id of winners) {
      const bonus = remainder > 0 ? 1 : 0;
      if (bonus) remainder -= 1;
      awards.set(id, (awards.get(id) ?? 0) + share + bonus);
    }
  }

  state.awards = Array.from(awards.entries()).map(([seatId, amount]) => ({ seatId, amount }));
  for (const award of state.awards) {
    const seat = state.seats.find((s) => s.id === award.seatId);
    if (seat) {
      seat.stack += award.amount;
      seat.won = (seat.won ?? 0) + award.amount;
    }
  }

  const winnerNames = state.awards.map((a) => state.seats.find((s) => s.id === a.seatId)?.name).filter(Boolean);
  state.street = 'complete';
  state.actor = -1;
  state.message = `${winnerNames.join(', ')} leva${winnerNames.length > 1 ? 'm' : ''} ${formatChips(
    state.awards.reduce((sum, a) => sum + a.amount, 0),
  )} de essência.`;
  for (const award of state.awards) {
    const seat = state.seats.find((s) => s.id === award.seatId);
    if (seat) {
      log(state, {
        kind: 'result',
        seatId: seat.id,
        text: `${seat.name} vence ${formatChips(award.amount)} com ${seat.shown ?? 'a melhor mão'}`,
      });
    }
  }
  return state;
}

function afterAdvance(state: PokerState): PokerState {
  const contenders = state.seats.filter((s) => !s.folded);
  if (contenders.length <= 1) return settle(state);

  if (roundComplete(state)) {
    // Fecha a rua: recolhe as apostas para o total da mão (já contabilizado) e abre a próxima.
    resetStreetActions(state);
    const canStillAct = state.seats.filter((s) => canAct(s)).length;

    if (state.street === 'preflop') {
      dealBoard(state, 3);
      state.street = 'flop';
      log(state, { kind: 'street', text: `Flop: ${state.board.map(cardLabel).join(' ')}` });
    } else if (state.street === 'flop') {
      dealBoard(state, 1);
      state.street = 'turn';
      log(state, { kind: 'street', text: `Turn: ${cardLabel(state.board[state.board.length - 1])}` });
    } else if (state.street === 'turn') {
      dealBoard(state, 1);
      state.street = 'river';
      log(state, { kind: 'street', text: `River: ${cardLabel(state.board[state.board.length - 1])}` });
    } else {
      return settle(state);
    }

    if (canStillAct <= 1) {
      // Só resta um jogador com fichas: distribui o resto do board e vai ao showdown.
      while (state.board.length < 5) dealBoard(state, 1);
      return settle(state);
    }

    const next = findNextActor(state, state.dealer);
    state.actor = next >= 0 ? next : -1;
    if (state.actor < 0) return settle(state);
    state.toCall = Math.max(0, maxBet(state) - state.seats[state.actor].bet);
    state.minRaiseTo = Math.max(state.bb, state.minRaiseTo);
    state.maxRaiseTo = state.seats[state.actor].bet + state.seats[state.actor].stack;
    return state;
  }

  const next = findNextActor(state, state.actor);
  state.actor = next;
  if (state.actor < 0) return settle(state);
  state.toCall = Math.max(0, maxBet(state) - state.seats[state.actor].bet);
  state.minRaiseTo = Math.max(state.minRaiseTo, maxBet(state) + state.bb);
  state.maxRaiseTo = state.seats[state.actor].bet + state.seats[state.actor].stack;
  return state;
}

/* ------------------------------------------------------------------ */
/* Bots                                                                */
/* ------------------------------------------------------------------ */

const STYLE_TUNING: Record<BotStyle, { aggression: number; looseness: number; bluff: number }> = {
  tight: { aggression: 0.9, looseness: -0.08, bluff: 0.05 },
  balanced: { aggression: 1, looseness: 0, bluff: 0.11 },
  loose: { aggression: 1.05, looseness: 0.1, bluff: 0.16 },
  maniac: { aggression: 1.25, looseness: 0.16, bluff: 0.26 },
};

function preflopStrength(cards: Card[]): number {
  const [a, b] = cards.slice().sort((x, y) => y.r - x.r);
  let score = (a.r + b.r) / 40; // 0.1 .. 0.7
  if (a.r === b.r) score += 0.3 + a.r / 60;
  if (a.s === b.s) score += 0.07;
  const gap = Math.abs(a.r - b.r);
  if (gap === 1) score += 0.06;
  else if (gap === 2) score += 0.03;
  if (a.r >= 13 && b.r >= 10) score += 0.08;
  return Math.min(1, score);
}

export function handStrength(state: PokerState, seat: Seat): number {
  if (!seat.cards.length) return 0;
  if (state.board.length === 0) return preflopStrength(seat.cards);
  const score = evaluate([...seat.cards, ...state.board]);
  const base = [0.12, 0.32, 0.52, 0.66, 0.76, 0.86, 0.92, 0.97, 1][score.category];
  const kickerBonus = Math.min(0.06, score.kickers[0] / 260);
  return Math.min(1, base + kickerBonus);
}

export function botAction(state: PokerState, index: number): Action {
  const seat = state.seats[index];
  const legal = legalActions(state);
  const tuning = STYLE_TUNING[seat.style];
  const strength = Math.min(1, handStrength(state, seat) + tuning.looseness * 0.5);
  const pot = potTotal(state);
  const potOdds = legal.callAmount > 0 ? legal.callAmount / (pot + legal.callAmount) : 0;
  const rnd = Math.random();
  const step = state.bb;
  const raiseTo = (fraction: number) => Math.min(legal.maxRaiseTo, roundTo(
    Math.max(legal.minRaiseTo, seat.bet + legal.callAmount + Math.round((pot * fraction + state.bb) * tuning.aggression)),
    step,
  ));

  if (seat.stack <= state.bb && strength > 0.4) return { type: 'allin' };

  if (legal.canCheck) {
    if (strength > 0.74 && legal.canRaise && rnd < 0.82) return { type: 'bet', amount: raiseTo(0.62) };
    if (strength > 0.5 && legal.canRaise && rnd < 0.45) return { type: 'bet', amount: raiseTo(0.45) };
    if (rnd < tuning.bluff && legal.canRaise) return { type: 'bet', amount: raiseTo(0.4) };
    return { type: 'check' };
  }

  if (strength > 0.86 && legal.canRaise && rnd < 0.78) return { type: 'raise', amount: raiseTo(0.85) };
  if (strength > 0.7 && legal.canRaise && rnd < 0.5) return { type: 'raise', amount: raiseTo(0.6) };
  if (strength >= potOdds + 0.12 - tuning.looseness) {
    if (legal.callAmount >= seat.stack) return { type: 'allin' };
    return { type: 'call' };
  }
  if (rnd < tuning.bluff * 0.5) return { type: 'call' };
  return { type: 'fold' };
}

export function isHandOver(state: PokerState): boolean {
  return state.street === 'complete' || state.street === 'showdown';
}
