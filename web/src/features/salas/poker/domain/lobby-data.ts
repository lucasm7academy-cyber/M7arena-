/**
 * Dados do lobby da Sala M7: a mesa da casa e os itens da loja de essência.
 * Só dados de apresentação — a lógica de mesa vive em `engine.ts`.
 *
 * No poker não existe "mesa bronze/prata/diamante": existe a mesa, com blinds
 * próprios, e as mesas que os jogadores criam. As criadas vêm de
 * `GET /api/poker/rooms`; aqui fica só a mesa oficial da M7.
 */

export interface PokerRoom {
  id: string;
  name: string;
  subtitle: string;
  /** Blinds no formato "SB / BB" — é a única "classificação" da mesa. */
  stakes: string;
  sb: number;
  bb: number;
  buyIn: number;
  seats: number;
  seated: number;
  players: string[]; // iniciais dos jogadores na sala
  tag?: 'HOT' | 'NOVO' | 'VIP';
  tint: string;
}

export const POKER_ROOMS: PokerRoom[] = [
  {
    id: 'm7',
    name: 'Sala M7',
    subtitle: 'Mesa principal da casa · 6 lugares',
    stakes: '10 / 20',
    sb: 10,
    bb: 20,
    buyIn: 2000,
    seats: 6,
    seated: 0,
    players: [],
    tint: '#c8aa6e',
  },
];

export type ShopKind = 'avatar' | 'cards' | 'felt' | 'emote';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  kind: ShopKind;
  price: number;
  rarity: 'comum' | 'raro' | 'épico' | 'lendário';
  preview: string;
  previewTint: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'frame-ouro',
    name: 'Moldura Ouro M7',
    description: 'Anel dourado animado no seu avatar da mesa.',
    kind: 'avatar',
    price: 1200,
    rarity: 'raro',
    preview: '◉',
    previewTint: '#c8aa6e',
  },
  {
    id: 'cards-obsidiana',
    name: 'Baralho Obsidiana',
    description: 'Verso preto fosco com o brasão da casa em relevo.',
    kind: 'cards',
    price: 2400,
    rarity: 'épico',
    preview: '♠',
    previewTint: '#8f7bff',
  },
  {
    id: 'felt-vinho',
    name: 'Feltro Vinho',
    description: 'Mesa de feltro vinho com ribalta dourada.',
    kind: 'felt',
    price: 3600,
    rarity: 'épico',
    preview: '▰',
    previewTint: '#a83f5c',
  },
  {
    id: 'emote-river',
    name: 'Emote "River Suado"',
    description: 'Solte no chat quando acertar a última carta.',
    kind: 'emote',
    price: 350,
    rarity: 'comum',
    preview: '😅',
    previewTint: '#3f97ff',
  },
  {
    id: 'cards-neon',
    name: 'Baralho Neon',
    description: 'Naipe ciano com brilho reativo ao hover.',
    kind: 'cards',
    price: 5200,
    rarity: 'lendário',
    preview: '♦',
    previewTint: '#3fe0c9',
  },
  {
    id: 'felt-verde',
    name: 'Feltro Clássico',
    description: 'O verde de sempre — já vem na mesa.',
    kind: 'felt',
    price: 0,
    rarity: 'comum',
    preview: '▰',
    previewTint: '#1f7a4d',
  },
];
