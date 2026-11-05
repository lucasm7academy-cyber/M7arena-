# Homologação da simplificação — 05/11/2026

> **Ambiente:** localhost (`http://localhost:3000`), stack Docker local com
> banco isolado `m7arena_homolog` e migrations aplicadas do zero. Nenhuma
> conexão de escrita com a produção; nenhum deploy ou migration na VPS.

## 1. Stack usada

- `m7arena_local_postgres` — PostgreSQL local, banco `m7arena_homolog`.
- `m7arena_local_app` — API Node/Drizzle.
- `m7arena_local_realtime` — WebSocket local.
- `m7arena_local_nginx` — build do Vite + proxy `/api` e `/ws`.
- Dados de teste: admin/proprietário, jogador, intruso, time HML, campeonato
  “Copa Homolog 2026” e salas 1v1/5v5.

## 2. O que foi testado no navegador

Chromium via Playwright, com captura de console, `pageerror` e respostas HTTP
>= 400:

| Fluxo | Resultado |
|---|---|
| Cadastro público pela tela de login | ✅ criou conta e abriu `/lobby` |
| Login de jogador e administrador | ✅ sessão persistida e `/auth/me` autenticado |
| Sessão/perfil | ✅ perfil abriu com os dados da conta |
| Catálogo `/players` | ✅ card encontrado; clique abriu **nova aba** no OP.GG correto (`/summoners/br/Jogador%20Homolog-br1`), sem modal |
| Times | ✅ lista e página `/times/:id` com lineup, PDL, ranking, botões de gestão |
| Campeonatos | ✅ lista, detalhe, abas de visão/classificação/agenda, time inscrito |
| Salas 5v5 | ✅ card de criação, modal, criação e abertura de `/5v5/1` |
| Sala 1v1 | ✅ criação, entrada dos dois jogadores, confirmação e transição para `INICIANDO PARTIDA` com código |
| Scrim | ✅ card “Scrim / Time vs Time” presente e clicável; sala nova preservada |
| Administração | ✅ abas Visão, Saldo E, Ranking, Highlights, Cargos, Contatos, Punições, Senhas, Saques |
| Carteira | ✅ modal “DEPOSITAR ESSÊNCIA AZUL”, pacotes em E, sem “M7 Coins”/“MPoints” |
| Páginas públicas | ✅ lobby, players, times, campeonatos, streamers, jogar, tutorial, políticas, quem somos |

### Limitações assumidas

- **Riot API**: a chave local é dummy; busca de elo e vínculo real não foram
  validados contra a Riot. O vínculo de Riot ID/PUUID agora é conferido no
  servidor em produção; em `NODE_ENV=development` o fluxo local é liberado para
  testes de UI.
- **Mercado Pago**: sem credencial local, a cobrança PIX real não foi gerada.
  Foram validados contratos/UI, permissões e o fluxo de saque com banco local.
- **Google OAuth**: sem client local; login por e-mail/senha validado.
- **5v5 com 10 jogadores e draft completo**: a criação e a UI da sala foram
  testadas no navegador; a máquina de estados, draft, encerramento e pagamento
  continuam cobertos pela suíte de API (283 testes, incluindo draft/escrow).
- Assets de `/uploads/public-images/` (logo e Yasuo) não existem no banco local
  novo; os 404 observados são de arquivos de produção, não de rota quebrada.

## 3. Falhas encontradas e corrigidas

| Falha | Correção |
|---|---|
| Página do time quebrava ao buscar `/wallet/admin/balances` público e recebia 403 após endurecer a rota | Removido o fetch de saldo não utilizado em `TimePage`; somente `/admin` consulta saldos |
| `/wallet/admin/balances` devolvia saldo de terceiros publicamente | Exige admin/proprietário; `/players` não usa mais esse endpoint |
| Perfil público `GET /api/profiles/:id` devolvia `chave_pix`, `nome_pix` e tipo | Perfil público passa `payout = null`; só `/profiles/me` lê Pix |
| Escrita de campeonato (editar, cronograma, PDL, reabrir, aprovar) aceitava qualquer usuário logado | Exige organizador do campeonato ou staff (`podeGerenciarCampeonato`) |
| Inscrição de time aceitava `status: approved` e `paid: true` do cliente | Não-staff entra como `registered` e `paid: false`; aprovação só pelo staff |
| `POST /teams/:id/lineup` aceitava UUID de terceiro e removia a pessoa de outro time | Só a própria conta sai de outros times; terceiro já vinculado a outro time recebe 409 |
| `POST /players/refresh-elo` permitia falsificar elo de qualquer userId | Endpoint removido; refresh correto é server-side `/players/refresh-elos` |
| `POST /matches/:id/tick` era anônimo | Exige sessão e participante/staff da sala |
| Vínculo de convidado por Riot ID podia ser sequestrado só pelo handle público | Promoção de convidado agora exige PUUID conferido; handle sozinho não promove |
| Config local do Nginx tinha `location /assets/` duplicado e realtime sem `dist` | Corrigidos `infra/nginx.local.conf` e fluxo local de build/compose |

## 4. Segurança — verificação HTTP real

| Teste | Resultado |
|---|---|
| Perfil público com Pix cadastrado | `chave_pix`, `tipo_chave_pix`, `nome_pix` vazios |
| `/profiles/me` do próprio usuário | Pix presente |
| `/wallet/admin/balances` anônimo | 401 |
| `/wallet/admin/balances` jogador | 403 |
| `/wallet/admin/balances` admin | 200 |
| Editar campeonato como intruso | 403 |
| Editar campeonato como admin | 200 |
| Aprovar inscrição como intruso | 403 |
| Inscrever time de terceiro como intruso | 403 |
| Inscrever o próprio time | 201, `status` pendente e `paid: false` |
| Reabrir/PDL como intruso | 403 |
| `/admin/cargos` e `/admin/withdrawals` como intruso | 403 |
| Ajuste de saldo / ban como jogador comum | 403 |
| Decidir saque como intruso | 403; admin decidiu reembolso |
| `tick` anônimo / intruso / participante | 401 / 403 / 200 |
| Lineup com jogador de outro time | 409, sem removê-lo do time original |

## 5. Salas antigas e saldos pendentes

Auditoria **somente leitura** na produção (`docker exec ... psql`, selects):

| Consulta | Valor |
|---|---:|
| `matches.status = 'aguardando_revisao'` | **0** |
| Reserva estimada nessas salas | **0** |
| `match_prints` históricos | 13 |
| `match_disputas` históricas | 2 |
| Prints pendentes em sala `aguardando_revisao` | 0 |
| Disputas abertas | 0 |
| `user_wallets.mc_reservado` total | **0** |
| Salas `time_vs_time` antigas (total/ativas) | 0 / 0 |

Não há sala presa nesse estado nem Essência Azul reservada pendente hoje.
Os 13 prints e 2 disputas são histórico encerrado; não foram apagados.

## 6. Validação final

Executar no fechamento:

```text
web/  npm run lint
web/  npm run build
api/  npx tsc --noEmit
api/  npx tsx --test --test-concurrency=1 api/test/*.test.ts
root  node scripts/verify-swap.js
```

Resultados completos no relatório da sessão e no commit da branch.

## 7. Pendências / riscos para produção

- Aprovação de deploy continua pendente; branch não foi mergeada na `main`.
- Migrations e dados históricos não foram tocados.
- Riot e Mercado Pago precisam ser validados com credenciais reais de
  homologação antes do deploy.
- Assets de upload de produção não existem no banco local; validar no ambiente
  com o volume real.
- O vínculo Riot agora falha fechado em produção se a Riot estiver indisponível;
  monitorar 503 durante o deploy.
- A suíte automatizada cobre o motor de salas/draft/escrow; o navegador cobriu
  a superfície e o fluxo 1v1 completo.
