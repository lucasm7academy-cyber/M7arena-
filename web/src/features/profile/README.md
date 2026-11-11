# Perfil e vínculo da conta Riot

## Entradas

- [Perfil](pages/Perfil.tsx), `/perfil`, privado: apresentação e edição do próprio
  perfil, lanes, redes sociais, avatar, dados Pix, Riot/elos/performance, carteira,
  punições e histórico de desafios.
- [Vincular](pages/Vincular.tsx), `/vincular`, privado: consulta Riot ID, apresentação
  da conta encontrada e vínculo/desvínculo. Ambas são lazy em [App](../../App.tsx).

## Onde estão os dados e as ações

[PerfilContext](../../contexts/PerfilContext.tsx) fornece o contexto compartilhado;
a página mantém edição, modais, sincronização e seus estados. `api.profiles`
persiste dados na [API de Perfis](../../../../api/src/modules/profiles/README.md).
`web/src/api/riot.ts` consulta o proxy próprio, e `api/player.ts` sincroniza
metadados da própria conta. Assets DDragon são apresentação.

Vincular usa `players.byPuuid` para localizar vínculo existente e
`profiles.linkRiot`. O fluxo de desvincular pode chamar `teams.removeMemberships`
antes de `profiles.unlinkRiot`; preserve a ordem e as confirmações, pois também
afeta elenco. O servidor resolve a identidade e valida o vínculo Riot em produção.

Pix privado é editado no Perfil e consumido por [Economia](../economy/README.md).
[CarteiraEStrikes](../economy/components/CarteiraEStrikes.tsx) exibe saldo e
elegibilidade; [HistoricoApostas](../apostas/components/HistoricoApostas.tsx) pertence
ao domínio de desafios. Os componentes são usados aqui sem tornar esses serviços
exclusivos do Perfil. Modais de elegibilidade e UI continuam compartilhados.

## Cuidados e limites

Não deduzir elegibilidade apenas do saldo exibido ou do vínculo local; API é
autoridade. Campos privados não podem aparecer no catálogo de jogadores ou no
perfil público. A página ainda concentra componentes de elo, performance e Pix
com a coordenação; uma divisão posterior deve preservar callbacks e ciclo de vida.

Não há suíte DOM específica dessas páginas. Build/lint validam imports/tipos;
`api/test/profile-privacidade.test.ts` valida shape privado/público, não todo o
vínculo. Não chamar Riot real nem alterar dados Pix/contas para validar documentação.
