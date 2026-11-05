/**
 * Link do perfil público no OP.GG a partir do Riot ID.
 * A plataforma é BR; sem Riot ID válido não inventamos URL.
 */
export function opGgUrl(riotId: string | null | undefined, region = "br"): string | null {
  const raw = (riotId ?? "").trim();
  const hash = raw.lastIndexOf("#");
  if (hash <= 0 || hash === raw.length - 1) return null;

  const gameName = raw.slice(0, hash).trim();
  const tagLine = raw.slice(hash + 1).trim().toLowerCase();
  if (!gameName || !tagLine) return null;

  return `https://op.gg/pt/lol/summoners/${region}/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;
}
