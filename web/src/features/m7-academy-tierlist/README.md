# M7 Academy Tierlist — código sem entrada ativa

Esta pasta existe, mas não é funcionalidade acessível pelo App atual:
[App.tsx](../../App.tsx) não declara sua rota, e o
[bootstrap da API](../../../../api/src/index.ts) não monta tierlistsRouter.
Não apresentar Tierlist como parte ativa do site ou reativá-la ao organizar pastas.

[TierlistPage](TierlistPage.tsx) é o wrapper de [TierListExperience](TierListExperience.tsx).
A experiência reúne consulta Riot, perfil/contato, disponibilidade e pool de
campeões; `components/`, `types.ts`, `constants.ts` e `utils.ts` são internos.
`api.ts` contém a submissão esperada, mas a existência desse cliente não prova
que o endpoint esteja montado.

Contrapartes preservadas: [router não montado](../../../../api/src/routes/tierlists.ts),
[validador](../../../../api/src/lib/tierlist.ts), schema/migrations de tierlist.
Não remover tabelas, dados ou migrations por ausência de rota. Reativação ou
remoção definitiva de código são mudanças de produto distintas do mapa atual.

Não há homologação integrada dessa funcionalidade. Uma futura ativação precisa
conferir rotas, política de dados/contato, autorização e os contratos reais.
