/**
 * Shape legado do domínio conteúdo (swap app.swap.conteudo). O fork consome
 * snake_case (`titulo`/`resumo`/`thumbnail_url`/`publicado_em`/`destaque`);
 * a API devolve camelCase (`title`/`summary`/`imageUrl`/`publishedAt`). Os
 * adaptadores abaixo convertem nos dois sentidos para o JSX não mudar uma linha.
 */

export interface ApiLegacyNews {
  id: string;
  titulo: string;
  slug: string;
  resumo: string;
  conteudo?: string;
  categoria: string;
  thumbnail_url: string | null;
  autor?: string;
  publicado_em: string;
  destaque: boolean;
  ativo?: boolean;
  link_url?: string | null;
  link_texto?: string | null;
}

export interface ApiNewsRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  imageUrl: string | null;
  authorId: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoria: string;
  destaque: boolean;
  linkUrl: string | null;
  linkText: string | null;
  autor: string | null;
}

export interface ApiLegacyHighlight {
  id: string;
  titulo: string;
  link: string;
  thumbnail_url: string | null;
  ativo: boolean;
  ordem: number;
  categoria: string;
}

export interface ApiHighlightRow {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  authorId: string;
  active: boolean;
  createdAt: string;
  ordem: number;
  categoria: string;
}

export interface ApiPlayerStats {
  userId: string;
  modo: string;
  victories: number;
  defeats: number;
  totalGames: number;
  winrate: number;
}

export function toLegacyNews(n: ApiNewsRow): ApiLegacyNews {
  return {
    id: n.id,
    titulo: n.title,
    slug: n.slug,
    resumo: n.summary ?? '',
    conteudo: n.content || undefined,
    categoria: n.categoria,
    thumbnail_url: n.imageUrl,
    autor: n.autor ?? undefined,
    publicado_em: n.publishedAt || n.createdAt,
    destaque: n.destaque,
    ativo: n.published,
    link_url: n.linkUrl,
    link_texto: n.linkText,
  };
}

export function toApiNews(data: Partial<ApiLegacyNews>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.titulo !== undefined) out.title = data.titulo;
  if (data.slug !== undefined) out.slug = data.slug;
  if (data.resumo !== undefined) out.summary = data.resumo;
  if (data.conteudo !== undefined) out.content = data.conteudo;
  if (data.categoria !== undefined) out.categoria = data.categoria;
  if (data.thumbnail_url !== undefined) out.imageUrl = data.thumbnail_url;
  if (data.autor !== undefined) out.autor = data.autor;
  if (data.publicado_em !== undefined) out.publishedAt = data.publicado_em;
  if (data.destaque !== undefined) out.destaque = data.destaque;
  if (data.ativo !== undefined) out.published = data.ativo;
  if (data.link_url !== undefined) out.linkUrl = data.link_url;
  if (data.link_texto !== undefined) out.linkText = data.link_texto;
  return out;
}

export function toLegacyHighlight(h: ApiHighlightRow): ApiLegacyHighlight {
  return {
    id: h.id,
    titulo: h.title,
    link: h.videoUrl,
    thumbnail_url: h.thumbnailUrl,
    ativo: h.active,
    ordem: h.ordem,
    categoria: h.categoria,
  };
}

export function toApiHighlight(data: Partial<ApiLegacyHighlight>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.titulo !== undefined) out.title = data.titulo;
  if (data.link !== undefined) out.videoUrl = data.link;
  if (data.thumbnail_url !== undefined) out.thumbnailUrl = data.thumbnail_url;
  if (data.ativo !== undefined) out.active = data.ativo;
  if (data.ordem !== undefined) out.ordem = data.ordem;
  if (data.categoria !== undefined) out.categoria = data.categoria;
  return out;
}

export interface ApiContentSdk {
  news: (params?: { all?: boolean }) => Promise<ApiLegacyNews[]>;
  newsCreate: (data: Partial<ApiLegacyNews>) => Promise<ApiLegacyNews>;
  newsUpdate: (id: string, data: Partial<ApiLegacyNews>) => Promise<ApiLegacyNews>;
  newsDelete: (id: string) => Promise<{ ok: boolean }>;
  highlights: (params?: { all?: boolean }) => Promise<ApiLegacyHighlight[]>;
  highlightsCreate: (data: Partial<ApiLegacyHighlight>) => Promise<ApiLegacyHighlight>;
  highlightsUpdate: (id: string, data: Partial<ApiLegacyHighlight>) => Promise<ApiLegacyHighlight>;
  highlightsDelete: (id: string) => Promise<{ ok: boolean }>;
  playerStats: (userId: string) => Promise<ApiPlayerStats[]>;
  recordPlayerStats: (data: { userId: string; modo: string; vitoria: boolean }) => Promise<ApiPlayerStats>;
}
