/**
 * Shape legado de perfil consumido pelas telas. A chave Pix só deve ser
 * preenchida quando o chamador é o próprio usuário (GET /profiles/me); o perfil
 * público passa `payout = null` para não expor dados de recebimento.
 */
export function toLegacyProfile(user: any, payout: any = null) {
  const socials = (user?.socials as Record<string, string>) || {};
  return {
    id: user.id,
    bio: user.bio ?? "",
    lane_primaria: user.lanePrimary ?? null,
    lane_secundaria: user.laneSecondary ?? null,
    is_vip: Boolean(user.isVip),
    instagram: socials.instagram ?? "",
    twitch: socials.twitch ?? "",
    youtube: socials.youtube ?? "",
    discord: socials.discord ?? "",
    chave_pix: payout?.pixKey ?? "",
    tipo_chave_pix: payout?.pixType ?? "",
    nome_pix: payout?.pixName ?? "",
  };
}
