# Perfis e vínculo Riot

## Responsabilidade

[routes.ts](routes.ts) exporta `profilesRouter`, montado em `/api/profiles`.
Mantém dados do próprio perfil, informações privadas de recebimento Pix e o
vínculo da conta LoL. Não calcula saldo, resultado de partida ou classificação.

| Método / caminho relativo | Contrato |
|---|---|
| `GET /me` | Autenticado; usuário, cargos, advertências, status, termos, profile legado e riotAccount. Inclui os dados Pix do próprio usuário. |
| `PUT /me` | Autenticado; atualização parcial de apresentação, lanes, redes sociais e dados Pix. Retorna o perfil atualizado. |
| `GET /me/riot` | Conta LoL própria em shape legado, ou null. |
| `POST /me/riot` | Vínculo por Riot ID/PUUID; atualiza/cria game_account, espelha users.riot_id e vincula vagas convidadas de Times. |
| `PUT /me/riot` | Atualiza metadados/cache da própria conta vinculada; 404 sem vínculo. |
| `DELETE /me/riot` | Remove a conta LoL própria e limpa o espelho Riot ID. |
| `GET /:id` | Perfil público, sem dados Pix; 404 se usuário ausente. |

`/me` e `/me/riot` são registrados antes do parâmetro público. Cookie ou Bearer
resolve sessão válida; a autorização ocorre nos handlers. Preserve a distinção
de payload público/privado e os campos snake_case do profile/Riot legados.

## Integrações e cuidados

- [profile-shape.ts](../../lib/profile-shape.ts) compõe o shape; teste específico
  em `api/test/profile-privacidade.test.ts` verifica a ausência de Pix público.
- Riot vive em `game_accounts` (`gameId=lol`), com cache em metadata e espelho em
  users. A API em produção confere Riot ID/PUUID na Riot antes de vincular:
  divergência retorna 400 e indisponibilidade/chave ausente retorna 503. Em modo
  não production o helper tem bypass atual; isso não homologa a verificação real.
- [Times](../teams/README.md) fornece `vincularVagasConvidado`. Remover vínculos de
  times antes de desvincular também é coordenado pela página Vincular; não inferir
  que DELETE de Riot sozinho execute todo esse fluxo da interface.
- [Proxy Riot](../../routes/riot.ts), `atualizar-elos` e `reconciliar-handles` em
  `lib/` servem também Jogadores, Times, Salas e cron. Não são serviços exclusivos
  da tela de perfil; consulte o [mapa compartilhado](../../lib/README.md).
- `user_payout_info` guarda Pix; [Economia](../economy/README.md) usa esses dados
  para snapshots de saque. Não expor campos privados em logs ou documentação.

[Feature de perfil](../../../../web/src/features/profile/README.md), PerfilContext,
SDK `profiles` e cliente `web/src/api/player.ts` são os consumidores principais.
Valide imports com build; para mudanças no shape, selecione o teste de privacidade
no [ambiente isolado](../../../../README.md#testes-da-api). Não há suíte HTTP completa
de vínculo/desvínculo nem homologação de Riot real nesta organização.
