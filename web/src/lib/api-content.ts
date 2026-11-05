/**
 * Shape legado do domínio conteúdo (swap app.swap.conteudo) para highlights.
 * O fork consome snake_case (`titulo`/`thumbnail_url`/`link`); a API devolve
 * camelCase (`title`/`thumbnailUrl`/`videoUrl`). Os adaptadores abaixo
 * convertem nos dois sentidos para o JSX não mudar uma linha.
 */

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
