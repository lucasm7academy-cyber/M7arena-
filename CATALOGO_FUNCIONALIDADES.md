# CATÁLOGO FUNCIONALIDADES — M7Arena

> **Documento descritivo. Nada aqui foi alterado, removido ou reorganizado.**
> O objetivo é listar o que o aplicativo faz hoje, inclusive o que existe no
> backend sem aparecer na tela, para que o usuário decida depois o que manter,
> corrigir, isolar ou descontinuar.

**Levantamento:** 04/11/2026
**Base:** commit `ac36534` (`main`) — código igual a `8e498dc`
**Método:** leitura do código real (`web/src`, `api/src`, `db/schema`,
`db/migrations`, `infra`, `scripts`, `docs`) e confronto com o que a interface
mostra. Não foram consultados banco de produção, logs da VPS ou analytics.
**Relação com o documento anterior:** `ESTRUTURA_ATUAL.md` descreve a
arquitetura e os problemas estruturais. Este catálogo é funcional: parte de
“o que o usuário consegue fazer ou o sistema executa”, não de “quais arquivos
existem”.

> **Uso real x código conectado.** Este documento prova o que está ligado no
> código (rota, tela, job, chamada). Provar que os usuários usam de fato exige
> logs/banco de produção e está marcado como **PRECISA DE VERIFICAÇÃO** quando
> relevante. Não confunda “tem tela” com “tem uso”.

---

## Legenda de estado

| Estado | Significado |
|---|---|
| **Ativo** | Tem fluxo completo no código: tela (ou consumo interno) + rota + persistência. Pode ter ressalvas pontuais anotadas na evidência. |
| **Incompleto** | Existe parte do fluxo, mas falta tela, validação, integração ou configuração para funcionar de ponta a ponta. |
| **Desconectado** | O código existe e funcionaria, mas nada no front atual chama; ou a tela existe sem rota; ou a rota existe sem mount. |
| **Legado** | Foi substituído por outro fluxo e continua no ar por compatibilidade, histórico ou clientes antigos. |
| **Duplicado** | A mesma capacidade aparece em dois lugares (duas telas, duas rotas ou dois modelos). |
| **Desconhecido** | O repositório não permite concluir se algo externo usa. Marcado como **PRECISA DE VERIFICAÇÃO**. |

**“Se removido”** descreve a consequência técnica observável, **não** uma
recomendação. A decisão de remover é do usuário.

---

## 0. Resumo executivo

### Números

| Métrica | Valor |
|---|---|
| Funcionalidades de produto catalogadas | **84** |
| Ativas | **67** |
| Incompletas | **5** |
| Legadas | **4** |
| Desconectadas | **5** |
| Duplicadas | **3** |
| Dossiês aprofundados pedidos pelo usuário | **6** |
| Endpoints sem chamador no fluxo atual (ou só admin) | **16** |
| Tabelas/campos órfãos ou sem fluxo completo | **17** |
| Automações/jobs recorrentes | **10** |
| Integrações externas mapeadas | **10** |
| Capacidades de infraestrutura/operação | **10** |

### O que mais importa saber

1. **M7 Points (MP) não é um sistema de pontos por vitória.** É uma coluna de
   saldo (`user_wallets.mp`) que nenhum fluxo credita automaticamente. O que
   existe de “pontos por vitória” rodando é o **PDL de times** (+15/−13 por jogo
   finalizado de grupos). O “MP” que aparece em salas é, na prática, **MC**.
2. **A integração com Discord é só um webhook de revisão** — e ele não está
   passado pelo `docker-compose`, então em produção tende a ser no-op. Não há
   login Discord; só Google.
3. **Recrutamento não existe como feature.** A tabela `recruitment_posts` está
   morta; o recrutamento real acontece por convites/solicitações de time.
4. **VIP é só um selo.** Não há compra, concessão, expiração nem efeito de
   acesso. O bloqueio de histórico para não-VIP foi removido.
5. **Tierlist está 100% desconectada:** página sem rota, router sem mount,
   tabela fora do barrel do schema e front chamando endpoint que responde 404.
6. **A sala Time vs Time legada continua roteada**, mas a criação nova vai para
   o modo `time_vs_time_livre` (scrim). São dois modelos de dados e duas UIs.
7. **O filtro de elo mínimo das salas não é aplicado no servidor.** A sala
   exibe “Elos Ouro+”, mas o `join` não verifica o elo do jogador.
8. **O fluxo normal de resultado não usa mais print/disputa.** A verificação é
   automática pela Riot; print e contestação continuam no backend como legado.
9. **O dashboard financeiro mostra saques sempre zero** e lucro só de taxas de
   sala, mesmo existindo a feature de saque PIX.
10. **O catálogo de jogadores exibe dados de performance zerados** (KDA, CS/min,
    KP%, títulos e conquistas) porque o front preenche placeholders.

---

## 1. Visão por categoria

| Categoria | Entradas | Ativas | Incompletas | Legadas | Desconectadas | Duplicadas |
|---|---:|---:|---:|---:|---:|---:|
| A. Conta, identidade e acesso | 11 | 9 | 1 | 1 | 0 | 0 |
| B. Times e recrutamento | 7 | 6 | 0 | 0 | 1 | 0 |
| C. Salas casuais e apostadas | 16 | 12 | 1 | 3 | 0 | 0 |
| D. Sala de times / campeonato | 8 | 8 | 0 | 0 | 0 | 0 |
| E. Campeonatos | 10 | 10 | 0 | 0 | 0 | 0 |
| F. Economia e apostas | 13 | 8 | 2 | 0 | 2 | 1 |
| G. Conteúdo, streams e notificações | 10 | 8 | 0 | 0 | 2 | 0 |
| H. Administração | 9 | 6 | 1 | 0 | 0 | 2 |
| **Total** | **84** | **67** | **5** | **4** | **5** | **3** |

---

## 2. Dossiês dos pontos pedidos

### 2.1 M7 Points e vitórias dos jogadores

**O que existe hoje**

| Peça | O que é | Onde está | Comportamento real |
|---|---|---|---|
| `user_wallets.mp` | Saldo de “M7 Points” | `db/schema/identidade.ts` | Só muda por `deltaMP` em `POST /api/wallet/admin/adjust`. Nenhum prêmio, compra, saque ou vitória credita MP. |
| `matches.entry_mp` / `aposta_mc` | Valor da entrada da sala | `db/schema/matches.ts` | As duas colunas guardam o **mesmo valor em MC**. `entry_mp` é nome legado; `match-shape` publica como `mpoints`. |
| `player_stats` | Vitórias/derrotas por modo | `db/schema/conteudo.ts` | A API `POST /api/content/player-stats` incrementa manualmente. **Nenhum código chama esse POST ao fim de partida.** Não há tela consumindo. |
| `team_stats.pdl` | Pontos de liga do time | `db/schema/teams.ts` | Único sistema de pontos por vitória que roda sozinho: +15 PDL por vitória e −13 por derrota em jogo finalizado de grupos; chave não conta. |
| `bet_legs` (mercado `result_vitoria`) | Aposta na própria vitória | `db/schema/bets.ts` | É aposta em MC, não pontos. |

**Conclusão confirmada:** não existe, no código atual, cálculo, trigger, job ou
rota que credite **MP por vitória**. O nome “M7 Points” aparece em:

- `web/src/pages/players.tsx` — card público exibe `jogador.mp` como “M7 Points”;
- `web/src/pages/Admin.tsx` — aba “Saldos MPoints” que, na prática, envia
  `deltaMC` (ajusta **MC**, não MP);
- `web/src/api/salamod1.ts` — `OPCOES_MPOINTS` são valores em **MC**;
- `web/src/pages/Jogar.tsx` — cards alternam rótulo “MP” e “MC” para o mesmo
  `sala.mpoints`, que vem de `entryMp` (MC).

**Consequências práticas**

- O MP exibido em `/players` tende a ser **0** para todos, porque nada o
  alimenta; se houver valor, foi ajuste manual/admin ou dado legado.
- O admin que usa a aba “Saldos MPoints” está alterando **MC**.
- Se o produto queria “ganhar M7 Points por vitória”, isso não foi portado para
  esta base. **PRECISA DE VERIFICAÇÃO** no histórico de produção: existem
  `user_wallets.mp > 0`? Há `wallet_transactions` com `currency='mp'` e
  `kind` diferente de `admin_adjustment`? Se sim, o fluxo antigo existiu, mas
  não está neste repositório.

**Se removido:** remover `mp` hoje não quebra nenhum fluxo funcional (o MC é a
moeda usada); apaga apenas o número exibido como “M7 Points” e a possibilidade
de ajuste manual via API. Remover `player_stats` não afeta partidas nem
histórico, pois nada o alimenta.

---

### 2.2 Integrações antigas do Discord

Existem **três coisas diferentes** com o nome Discord:

| Item | Estado | Evidência |
|---|---|---|
| **Webhook de revisão** | Backend-only, provavelmente inativo em produção | `api/src/lib/discord.ts` dispara em `upload.ts` quando a sala entra em `aguardando_revisao`. Depende de `DISCORD_WEBHOOK_URL`. O `infra/docker-compose.yml` **não passa essa variável** para o container `app`; sem ela, a função só loga e retorna. |
| **Login/OAuth Discord** | Não existe no código atual | `user_identities.provider` aceita o comentário `'google' | 'discord' | 'credentials'`, mas a única rota OAuth é `auth-google.ts`. `discord_links` e `discord_oauth_state` só aparecem em `scripts/verify-swap.js` e `db/schema/DISCARDED.md` como nomes legados. |
| **Contato Discord** | Ativo, mas é texto livre | `users.socials.discord`, `teams.contacts.discord`, campos em perfil/time/contatos admin, botão “Entrar no Discord” no Lobby. Não há vínculo OAuth nem verificação. |

**Consequências**

- Não há login com Discord; quem entrou por Discord no site antigo precisa usar
  e-mail/senha ou Google.
- A notificação de revisão no Discord só funciona se alguém definir
  `DISCORD_WEBHOOK_URL` fora do compose (ex.: override manual). No fluxo atual
  de verificação automática, salas nem entram em `aguardando_revisao`, então o
  webhook quase nunca teria gatilho.
- Remover o webhook não quebra nenhuma regra de negócio: o código já trata a
  ausência como no-op. Remover os campos de contato apaga informação de perfil/
  time, mas não uma integração.

**Se removido:** o único efeito funcional é perder o aviso externo de revisão
(que hoje tende a não acontecer) e os textos de contato. Não há perda de login,
porque login Discord não existe.

---

### 2.3 Recrutamento

**O que existe**

| Peça | Estado | Evidência |
|---|---|---|
| Tabela `recruitment_posts` (`lft`/`lfp`) | **Desconectada** | Criada na migration `0000`, com índices `recruitment_type_idx` e `recruitment_active_idx`. Zero `SELECT`/`INSERT` em `api/src`, `web/src` ou `scripts/`. |
| Texto “painel de recrutamento” no Lobby | **Promessa sem tela** | `web/src/pages/Lobby.tsx` descreve “encontre parceiros de rotas no painel de recrutamento”. Não existe painel, rota ou componente. |
| Convites/solicitações de time | **Ativo — é o recrutamento real** | `team_invites` com `type='invite'` e `type='request'`; `TimePage` envia convite/solicitação; `NotificationBell` aceita/recusa; API `/api/teams/invites`. |
| Página de times / lineup | **Ativo** | `/times`, `/times/:id`; roster, contatos, convite, solicitação, edição de lineup. |

**Conclusão:** “recrutamento” como domínio separado não existe. Quem recruta
usa convite/solicitação de time. A tabela `recruitment_posts` é resíduo de um
plano que não foi implementado; o texto do Lobby promete algo que a interface
não entrega.

**Se removido:** remover `recruitment_posts` não afeta nenhum fluxo. Remover
convites/solicitações afeta o recrutamento inteiro (não há outro caminho para
entrar em time, exceto o capitão editar o lineup diretamente). O texto do Lobby
precisaria ser ajustado em qualquer cenário.

**PRECISA DE VERIFICAÇÃO:** existe alguma linha em `recruitment_posts`? Se
existir, foi escrita fora deste repositório e pode indicar cliente antigo.

---

### 2.4 VIP

**O que existe**

| Peça | Estado | Evidência |
|---|---|---|
| `users.is_vip` / `vip_expires_at` | **Incompleto/legado** | Schema e migration inicial. Nenhuma rota, `UPDATE` ou job escreve `is_vip`; `vip_expires_at` nunca é lido. |
| Selo VIP | **Ativo, só leitura** | `VipBadge`, `VipLabel`, `VipCrown`; cards de `/players`, perfil, vagas de sala (`VipSlot`) e `MinhasPartidas`. |
| Compra/assinatura VIP | **Ausente** | `payments.product` cita `'vip_monthly'` e o ledger cita `'vip_purchase'`, mas não há pacote, rota, tela ou cobrança. |
| Bloqueio de histórico para não-VIP | **Removido** | `MinhasPartidas.tsx` comenta que “o antigo bloqueio VIP foi removido junto com o modal de compra”. |
| Grupo VIP no WhatsApp | **Link externo** | Card do Lobby aponta para `chat.whatsapp.com/...`; não é status VIP da plataforma. |

**Conclusão:** VIP hoje é um **selo cosmético** que só pode ser ligado por
edição manual no banco. Não há compra, expiração aplicada, benefício de acesso
ou integração com pagamento. Se `vip_expires_at` venceu, o selo continua
aparecendo porque ninguém o desliga.

**Se removido:** some o selo e os campos; nenhum fluxo de negócio quebra. Se
houver usuários VIP reais no banco, eles perdem a distinção visual.

**PRECISA DE VERIFICAÇÃO:** quantos `users.is_vip = true` existem e como foram
concedidos? Há registro de pagamento `vip_monthly`? O produto ainda quer vender
VIP?

---

### 2.5 Tierlist (M7 Academy)

**O que existe**

| Peça | Estado | Evidência |
|---|---|---|
| Feature front `features/m7-academy-tierlist/` | **Completa, mas desconectada** | 16 arquivos: formulário público, busca Riot, disponibilidade, tier list de campeões, sucesso, `ProgressPanel`. |
| Página `pages/tierlist.tsx` | **Sem rota** | Não é importada por `App.tsx` nem por outro arquivo. |
| Router `api/src/routes/tierlists.ts` | **Não montado** | `index.ts` não importa `tierlistsRouter`. `POST /api/tierlists` responde 404 no runtime atual. |
| Tabela `tierlist_submissions` | **Fora do barrel** | `db/schema/tierlist.ts` não é exportado por `db/schema/index.ts`; `api/src/lib/tierlist.ts` importa direto. Risco de `drizzle-kit generate` propor `DROP` no futuro. |
| Validação/rate limit | **Implementados** | `validarTierlistPayload` valida Riot ID, PUUID, elos, disponibilidade, pool de 3–80 campeões, termos e honeypot; rate limit em `Map` de 20/10 min por IP. |
| `ProgressPanel.tsx` | **Sem import** | Nenhum componente o usa. |

**Conclusão:** é uma feature pronta de front + API + tabela que não está ligada
em nenhum ponto. O formulário não pode ser acessado e, se acessado por URL
manual, o envio falha porque o router não está montado. O comentário da tabela
diz que o dado seria importado por um app desktop da M7 Academy; isso não está
neste repositório.

**Se removido:** nada muda para o usuário atual, porque a feature já está
inacessível. Se a intenção é lançar a tier list, o trabalho é de conexão
(rota + mount + barrel), não de reconstrução.

**PRECISA DE VERIFICAÇÃO:** a M7 Academy ainda pretende usar essa base? Existe
algum cliente externo lendo `tierlist_submissions`?

---

### 2.6 Sala Time vs Time legada

Existem **dois fluxos diferentes** com o mesmo nome:

| Fluxo | Modo | Como nasce | UI | Dados |
|---|---|---|---|---|
| **Legado** | `time_vs_time` | `POST /api/matches` ainda aceita o modo, mas o front novo intercepta e não usa mais. | `/time_vs_time/:id` → `features/sala-time-vs-time/SalaTimeVsTime.tsx` (cópia 1:1 de `SalaMod1`). | Sala de 10 vagas (5v5) com `timeANome/timeATag`, `entry_mp/aposta_mc`. |
| **Novo scrim** | `time_vs_time_livre` | `POST /api/matches/time-vs-time` (chamada crua em `Jogar.tsx`), com formato MD1/MD3/MD5. | `/sala-time/:id` → `features/sala-campeonato/SalaCampeonato.tsx`. | Sala de 2 vagas (uma por time), série local em `campeonato_sala_estado`, draft Fearless. |

**O que ainda usa o legado**

- A rota `/time_vs_time/:id` e o componente `SalaTimeVsTime`.
- O modo `time_vs_time` na allowlist de `POST /api/matches` e no registry de
  draft (`draft/modos/time-vs-time.ts`), compartilhado com o modo novo.
- O preview OG (`/api/og/:modo/:id` e Nginx) só cobre `time_vs_time`; não cobre
  `sala-time` nem `campeonato/sala`.
- `MinhasPartidas` rotula os dois modos como “Scrim”.

**Conclusão:** a criação nova não usa mais o modelo legado; ele continua no ar
para salas históricas e por compatibilidade de API. As duas UIs compartilham
código de draft, mas têm modelos de dados e fluxos diferentes. Não há indicação
no código de quando as salas antigas deixarão de existir.

**Se removido:** remover o modo legado quebra links e históricos de salas
antigas (`/time_vs_time/:id`) e qualquer cliente que ainda crie `mode=time_vs_time`.
O scrim novo (`/sala-time/:id`) não depende dele.

**PRECISA DE VERIFICAÇÃO:** existem salas `mode='time_vs_time'` ativas ou
encerradas no banco? Se só houver históricas, o impacto de remover é menor; se
houver ativas, há jogadores em fluxo antigo.

---

## 3. Catálogo detalhado

> As tabelas abaixo cobrem as 84 funcionalidades de produto. “Depende/sustenta”
> mostra o que ela precisa e o que depende dela. “Evidência/removal” não é
> recomendação: é o que se observa no código e o efeito técnico de tirar.

### 3.1 A — Conta, identidade e acesso

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| A01 | Cadastro e login por e-mail/senha | `/login`, modal de login da vitrine | `pages/Login.tsx`, `contexts/AuthContext.tsx` / `routes/auth.ts` | `users`, `user_sessions`, `user_wallets`; `POST /api/auth/register`, `/login`, `/logout`, `GET /me` | DB; sustenta todo o app logado | Ativo | Rotas e chamadas no Login. Remover derruba o login por senha; restaria só Google. |
| A02 | Login com Google (OAuth) | Botão “Entrar com Google” no `/login` | `pages/Login.tsx`, `pages/AuthCallback.tsx` (stub) / `routes/auth-google.ts`, `lib/session.ts` | `users`, `user_identities`, `user_wallets`; `GET /api/auth/google`, `/google/callback` | Credenciais `GOOGLE_CLIENT_ID/SECRET`; sustenta login alternativo | Ativo (config-dependente) | State em cookie httpOnly, troca code→token→perfil, cria sessão. Sem credenciais, retorna 503. Remover deixa só e-mail/senha. |
| A03 | Sessão httpOnly e logout | Header, todas as rotas privadas | `contexts/AuthContext.tsx`, `lib/api.ts` / `lib/session.ts`, `auth.ts` | `user_sessions`; cookie `m7_session`; `GET /auth/me` | DB; sustenta perfil, times, salas, carteira, admin | Ativo | Cookie de 30 dias, sessão no banco, logout apaga a linha. Remover quebra toda a autenticação. |
| A04 | Termos de uso e declaração 18+ | Modal de elegibilidade nas salas e na aposta individual | `components/partidas/ModaisElegibilidade.tsx`, `hooks/useSalaSimples.ts` / `routes/auth.ts` (`termsRouter`) | `users.termos_aceitos_em`; `POST /api/terms/accept` | Sessão; sustenta salas apostadas e apostas individuais | Ativo | `validarElegibilidade` exige termos para apostada; modal aceita e refaz o perfil. Remover elimina o gate legal e muda a elegibilidade. |
| A05 | Recuperação de senha por link gerado no admin | `/admin/senhas` e `/redefinir-senha?token=...` | `pages/AdminSenhas.tsx`, `pages/RedefinirSenha.tsx` / `routes/admin-password-reset.ts`, `routes/password-reset.ts`, `lib/password-reset.ts` | `password_reset_tokens`, `user_sessions`; `POST /api/admin/usuarios/:userId/reset-link`, `GET/POST /api/auth/reset-password` | Cargo `proprietario`; sustenta recuperação de conta | Ativo | Token aleatório, SHA-256 no banco, 24h, uso único, apaga sessões. Não há envio por e-mail; o admin copia o link. Remover deixa usuários sem recuperação (não há provedor de e-mail). |
| A06 | Rotas antigas de reset e callback OAuth | `/reset-password`, `/resetpassword`, `/auth/callback` | `pages/ResetHandler.tsx`, `pages/ResetPassword.tsx`, `pages/AuthCallback.tsx` / — | Nenhuma rota de API própria | Nenhuma; compatibilidade de links | Legado | Os três componentes só redirecionam para `/login`/`/lobby`. Remover faz links antigos caírem em 404; nenhuma função real é perdida. |
| A07 | Perfil próprio: bio, rotas, redes sociais e chave Pix | `/perfil` | `pages/perfil.tsx`, `contexts/PerfilContext.tsx` / `routes/profiles.ts` | `users` (bio, lanes, socials), `user_payout_info`; `GET/PUT /api/profiles/me` | Sessão; sustenta saque PIX, Twitch do streamer, cards de jogador | Ativo | `toLegacyProfile` devolve bio/lanes/socials/Pix; `PUT /me` grava. Sem a chave Pix, `solicitarSaque` recusa. Remover quebra saque e streamer. |
| A08 | Vínculo com a Riot (link, sync, desvínculo) | `/vincular`, botão “Atualizar dados” no perfil | `pages/Vincular.tsx`, `contexts/VerificacaoContext.tsx`, `api/player.ts`, `api/riot.ts` / `routes/profiles.ts`, `routes/riot.ts` | `game_accounts`, `users.riot_id`; `GET/POST/PUT/DELETE /api/profiles/me/riot`; proxy `/api/riot/*` | `RIOT_API_KEY`; sustenta salas, times, elo, tierlist | Ativo (config-dependente) | Lookup por Riot ID, grava PUUID/handle/ícone/elo. Sem vínculo, `validarElegibilidade` bloqueia salas. O fluxo antigo de verificação por ícone está aposentado (ver A09). Remover impede jogar e montar roster. |
| A09 | Diretório público de jogadores | `/players` | `pages/players.tsx`, `components/players/PlayerDetailModal.tsx` / `routes/players.ts` | `game_accounts`, `users`, `user_wallets`; `GET /api/players/filtrados`, `/search`, `/by-ids`, `POST /by-ids`; `GET /api/wallet/admin/balances?userIds=` | Riot/elo cache; sustenta descoberta de jogadores e busca do admin | Ativo | Lista com filtros de elo/rota/busca, paginação, card e modal. `AdminCargos` e `TimePage` usam `/by-ids`. Remover tira a descoberta de jogadores e quebra a busca do admin. |
| A10 | VIP (selo e status) | Badge no perfil, `/players`, vagas de sala e `MinhasPartidas` | `components/ui/VipBadge.tsx`, `pages/perfil.tsx`, `pages/players.tsx`, `components/partidas/VagaSlot.tsx` / leitura em `auth.ts`, `profiles.ts`, `players.ts`, `matches.ts` | `users.is_vip`, `users.vip_expires_at` | Nenhum fluxo escreve; sustenta apenas exibição | Incompleto/legado | `isVip` é lido em vários shapes, mas não há rota/UPDATE. `vip_expires_at` nunca é checado. Remover apaga o selo; nenhuma capacidade real é perdida. |
| A11 | Cargos e permissões | `/admin/cargos`, aba Cargos, checks de staff/revisor | `pages/AdminCargos.tsx`, `pages/Admin.tsx`, `config/adminPermissoes.ts` / `routes/admin.ts`, `lib/acesso-sala.ts`, `lib/tournament-access.ts` | `user_roles`; `GET/PUT /api/admin/cargos` | Sessão; sustenta admin, revisão, staff de sala, streamer | Ativo parcial | UI atribui `proprietario/admin/organizador/streamer/coach/jogador`; o backend usa `moderador` em checks de staff/revisão e tem `caster` no mapa de cargos, mas nenhum dos dois aparece na UI. A grade de permissões tem flags sem uso (`resolverPartidas`, `cancelarPartidas`, `criarSalas`, `verTodosLogs`). Remover quebra toda a hierarquia. |

### 3.2 B — Times e recrutamento

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| B01 | Criar e editar time (nome, tag, logo, cores, contatos) | `/times` (modal), `/times/:id` (editar) | `pages/equipes.tsx`, `pages/TimePage.tsx` / `routes/teams.ts`, `routes/upload.ts` | `teams`, `team_stats`, `team_members`; `POST/PUT /api/teams`, `POST /api/upload` bucket `team-logos` | Sessão e Riot (front); sustenta campeonatos, salas de time e perfil | Ativo | Cria time + stats + capitão em transação; logo vai para `team-logos/<id>` e vira WebP 1080×1080. Remover elimina times e, por consequência, campeonatos e scrims. |
| B02 | Lineup/roster com titulares, reservas, coach e convidados sem conta | `/times/:id` (modal de lineup) | `pages/TimePage.tsx` / `routes/teams.ts`, `lib/team-membership.ts` | `team_members` (`role_slot`, `guest_*`); `POST /api/teams/:id/lineup` | Dono/capitão; sustenta roster de campeonato e sala de time | Ativo | Limite: 8 jogadores (inclui até 3 reservas) + coach; convidado sem conta usa `guest_riot_id/puuid`. Remover impede montar roster e quebra vagas de time. |
| B03 | Convites e solicitações de entrada em time | Sino de notificações e `/times/:id` | `components/notifications/NotificationBell.tsx`, `pages/TimePage.tsx` / `routes/teams.ts` | `team_invites` (`invite`/`request`); `GET/POST /api/teams/invites`, `POST /invites/:id/accept`, `/decline`, `/clear` | Time e sessão; é o recrutamento real | Ativo | Convite do time ou solicitação do jogador; aceite remove o jogador de outro time (um time só) e valida vaga. Remover elimina o recrutamento praticado hoje. |
| B04 | Sair do time, dissolver e sucessão de dono/capitão | `/times/:id` (sair) | `pages/TimePage.tsx` / `routes/teams.ts` | `teams`, `team_members`, `team_stats`; `POST /api/teams/:id/leave`, `POST /:id/transferir-dono` | Dono/capitão; sustenta ciclo de vida do time | Ativo | Sair promove próximo capitão, transfere `owner_id` e apaga o time se ficar vazio. O endpoint `transferir-dono` existe, mas o front não o chama (a coroa é movida pelo lineup). Remover deixa jogadores presos e times órfãos. |
| B05 | Ranking PDL e estatísticas do time | `/times`, `/times/:id`, admin Ranking | `pages/equipes.tsx`, `pages/TimePage.tsx`, `pages/Admin.tsx` / `lib/tournament-pdl.ts`, `routes/teams.ts` | `team_stats`; `POST /api/teams/:id/stats/adjust`; recálculo em `storeCronograma` | Resultados de campeonato; sustenta ranking e chaveamento | Ativo | PDL +15/−13, V/D, ranking; admin ajusta PDL/V/D. `/times` recalcula o número exibido pelo índice da página, não pelo `ranking` do banco — em busca/filtro o “#” pode não ser o ranking global. Remover tira ranking e seeding. |
| B06 | Página pública do time (roster, contatos, estatísticas, convite/solicitação) | `/times/:id` | `pages/TimePage.tsx` / `routes/teams.ts` | `teams`, `team_members`, `team_stats`, `game_accounts`; `GET /api/teams/:id` | B01–B03; sustenta perfil e recrutamento | Ativo | Mostra roster, PDL, winrate, contatos, abre OP.GG do jogador, permite convidar/solicitar. Remover esvazia a vitrine de times. |
| B07 | Recrutamento como posts LFT/LFP | Não aparece | — / — | `recruitment_posts`; nenhuma rota/job | Nenhuma | Desconectado | Tabela com `type`, `role_slot`, `active`, índices, mas zero código. O Lobby anuncia “painel de recrutamento” que não existe. Remover não afeta nada; o texto do Lobby fica ainda mais incoerente. |

### 3.3 C — Salas casuais e apostadas

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| C01 | Vitrine de salas com busca, filtro por modo e partidas finalizadas | `/jogar` | `pages/Jogar.tsx`, `api/salamod1.ts` / `routes/matches.ts` | `matches`, `match_players`; `GET /api/matches?view=card`, `GET /api/matches?status=encerrada` | Salas existentes; sustenta descoberta e entrada | Ativo | Polling de 15s, cards leves, filtro “Scrim” inclui `time_vs_time_livre`, seção de finalizadas. Remover deixa só links diretos para salas. |
| C02 | Criar sala (5v5, ARAM, 1v1, time vs time; casual/apostada; senha; elo mínimo; máximo; formato MD1/3/5) | Modal “Criar Sala” em `/jogar` | `pages/Jogar.tsx`, `api/salamod1.ts` / `routes/matches.ts` | `matches`, `campeonato_sala_estado`; `POST /api/matches` | Sessão, Riot ID, saldo se apostada; sustenta todas as salas | Ativo | Sanitiza modo, aposta (até 1.000.000 MC), taxa (0–100), máximo (2–10) e formato; cria sala vazia. **O `eloMinimo` é gravado e exibido, mas o `join` não verifica o elo do jogador** — filtro é só informativo. Remover impede criar salas. |
| C03 | Entrar, sair e trocar de vaga, com escrow da aposta | Sala (`/5v5`, `/aram`, `/1v1`, `/time_vs_time`) | `pages/SalaMod1.tsx`, `hooks/useSalaSimples.ts`, `components/partidas/VagaSlot.tsx` / `routes/matches.ts`, `lib/escrow.ts` | `match_players`, `user_wallets`, `wallet_transactions`; `POST /api/matches/:id/join`, `/leave`, `/remover-jogador` | C02, elegibilidade; sustenta início e prêmio | Ativo | Reserva `mc → mc_reservado` no join; devolve no leave antes do vínculo; bloqueia vaga ocupada e outra sala apostada. Remover impede salas de encherem e quebra escrow. |
| C04 | Confirmação de presença, recusa e timeout | Sala, fase “confirmando” | `pages/SalaMod1.tsx`, `hooks/useSalaSimples.ts` / `routes/matches-actions.ts`, `lib/match-flow.ts` | `matches.confirmacao_expires_at`, `match_players.confirmed`; `POST /:id/confirm`, `/recusar`, `/tick` | C03; sustenta draft/início | Ativo | Janela de 32s (5 min entre jogos de série 5v5); recusa remove e devolve escrow; timeout limpa não confirmados. Remover impede a sala de iniciar. |
| C05 | Draft ban/pick das salas de time | Sala de time legada e scrim | `components/draft/DraftRoom.tsx`, `features/sala-time-vs-time/SalaTimeVsTime.tsx` / `lib/draft/**`, `routes/matches-actions.ts` | `match_drafts`; `POST /:id/draft/ban`, `/pick` | C04; sustenta início de T-vs-T/campeonato | Ativo (só modos com draft) | 20 turnos, timer de 30s no servidor, ban vencido vira vazio, pick vencido cancela; 5v5/ARAM/1v1 não têm draft no site (só T-vs-T/campeonato). Remover impede ban/pick desses modos. |
| C06 | Código de partida e pool de tournament codes | Sala, botão copiar código; card OG | `pages/SalaMod1.tsx`, `pages/Jogar.tsx`, `routes/og.ts` / `lib/match-flow.ts` | `match_codes`; atribuição LRU em `atribuirCodigoPartida`; liberação ao encerrar/cancelar/excluir | Pool finito (6 genéricos + 2 1v1 + 7 blind); sustenta verificação Riot | Ativo | Código só é exibido a participante/staff. Pool tem 15 códigos; se esgotar, retorna `SEM-CODIGO-AGUARDE`. Remover impede partidas de começarem com código. |
| C07 | Início e verificação automática do resultado pela Riot | Sala, botão “Atualizar resultado”; cron | `pages/SalaMod1.tsx`, `hooks/useSalaSimples.ts` / `lib/verificar-partida.ts`, `cron.ts`, `routes/matches-actions.ts` | `match_results`, `match_codes`; `POST /:id/verificar`; `runCron` 10 min | C06, `RIOT_API_KEY`, PUUIDs; sustenta encerramento/payout | Ativo (config-dependente) | Busca partidas pelo código no histórico dos PUUIDs, confere nicks e decide; sem código/participantes, espera até 3h e cancela. Sem chave Riot, toda sala em `partida_iniciada` tende a cancelar após 3h. Remover deixa só o fluxo manual legado. |
| C08 | Série 5v5 personalizada MD1/MD3/MD5 | Criação de sala 5v5 e sala | `pages/Jogar.tsx`, `pages/SalaMod1.tsx` / `lib/serie-sala.ts` | `campeonato_sala_estado` (`formato`, `jogo`, `placar_a/b`); `avancarSerie5v5` | C07; sustenta múltiplos jogos | Ativo | Sala 5v5 volta para confirmação após cada jogo (5 min para trocar jogador) e paga o pote só no fim. Remover faz 5v5 virar jogo único. |
| C09 | Encerramento, prêmio, empate e cancelamento | Sala finalizada; painel admin | `pages/SalaMod1.tsx`, `components/admin/RevisaoPartidas.tsx` / `lib/escrow.ts`, `routes/revisao.ts` | `user_wallets`, `wallet_transactions`, `platform_revenue`; `pagarPremio`, `pagarEmpate`, `pagarCancelamento`, `reverterPayout` | C07; sustenta economia apostada | Ativo | Taxa `ceil`, prêmio `floor`, resto para plataforma; ledger idempotente. Empate/cancelamento devolvem sem taxa. Remover deixa MC preso e apostas sem pagamento. |
| C10 | Chat da sala em tempo real | Sala, painel lateral | `components/partidas/ChatDaSala.tsx`, `hooks/useSalaChat.ts`, `api/src/realtime/index.ts` / `routes/matches.ts` | `sala_mensagens`; `GET /:id/mensagens`; WebSocket `chat_send` | Sessão + Riot para enviar; sala assinada | Ativo | Mensagens ficam 24h (purge no GET e no cron), cor do lado no envio, rate limit. Remover tira a conversa da sala; nenhuma regra de jogo depende dela. |
| C11 | Espectador/visitante | Qualquer rota de sala | `pages/SalaMod1.tsx`, `hooks/useSalaRealtime.ts` / `realtime/index.ts` | `matches`, `match_players`; `GET /api/matches/:id`; WebSocket anônimo | Sala existente; sustenta compartilhamento | Ativo | Visitante vê estado, draft, chat e resultado, mas não vê código nem envia chat. Remover torna a sala privada e quebra o compartilhamento. |
| C12 | Revisão manual de salas pelo admin | `/admin` aba Revisão | `components/admin/RevisaoPartidas.tsx` / `routes/revisao.ts` | `matches.status='aguardando_revisao'`; `GET /api/revisao/pendentes`, `POST /:id/decidir` | C13/C14 (prints/disputas); legado do fluxo antigo | Legado | O fluxo normal agora finaliza por Riot e não gera `aguardando_revisao`; só `report-result`/upload de print ainda entram. Remover deixa salas legadas presas e o painel sem fila. |
| C13 | Prints de prova de resultado | Não aparece para o jogador; admin lê | — / `routes/upload.ts`, `routes/prints.ts`, `lib/discord.ts` | `match_prints`; `POST /api/upload` bucket `match-prints`; `GET /api/prints/:matchId`, `/:id/arquivo` | Participante confirmado ou revisor; sustenta C12 | Legado/backend-only | Upload valida magic bytes, 5 MB, 1 print/jogador, até 3; print pode levar sala a `aguardando_revisao` e dispara webhook Discord. Nenhum caller no front atual. Remover não afeta o fluxo automático; apaga a capacidade de prova manual. |
| C14 | Contestação de resultado (disputa) | Admin vê e decide; jogador não tem botão | `components/admin/RevisaoPartidas.tsx` / `routes/disputas.ts`, `routes/revisao.ts` | `match_disputas`; `POST/GET /api/disputas/:matchId`; `GET /api/revisao/disputas`, `POST /disputas/:id/decidir` | Sala encerrada/em revisão; C13 | Incompleto | API permite 1 disputa por jogador e admin decide (procedente estorna e cancela). O front do jogador não chama `POST /disputas` nem lista; só o admin usa. Remover tira a contestação; o painel de disputas fica vazio. |
| C15 | Exclusão administrativa de sala | Botão de lixeira na sala (admin) | `pages/SalaMod1.tsx`, `features/sala-time-vs-time/SalaTimeVsTime.tsx` / `routes/matches.ts` | `matches`, `match_players`, `match_results`, `match_prints`, `match_disputas`, `platform_revenue`, `match_codes`; `DELETE /api/matches/:id` | Admin/proprietário; sustenta limpeza | Ativo | Devolve reservas antes do DELETE e remove dados vinculados. Remover deixa salas travadas sem limpeza. |
| C16 | Sala Time vs Time legada (10 vagas) | `/time_vs_time/:id` | `features/sala-time-vs-time/SalaTimeVsTime.tsx` (cópia de `SalaMod1`) / `routes/matches.ts`, `draft/modos/time-vs-time.ts` | `matches.mode='time_vs_time'`; `POST /api/matches` ainda aceita o modo | C02–C09; salas históricas | Legado/duplicado | A criação nova usa `time_vs_time_livre` (2 vagas, série). A rota antiga segue no ar; o componente é cópia 1:1. Remover quebra links/histórico antigos; o scrim novo não depende. |

### 3.4 D — Sala de times / campeonato

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| D01 | Sala de campeonato criada automaticamente 10 min antes ou manualmente | `/campeonato/sala/:id`, cronograma do campeonato | `features/sala-campeonato/SalaCampeonato.tsx`, `components/campeonatos/ListaCronograma.tsx` / `lib/sala-campeonato.ts`, `routes/tournaments.ts`, `index.ts` | `matches` (`tournament_match_id`/`bracket_match_id`), `tournament_matches`, `bracket_matches`; `POST /api/tournaments/:id/jogo/:matchId/sala`; cron de 1 min | Série + código; sustenta o jogo de campeonato | Ativo | `criarSalasCampeonatoPendentes` varre séries confirmadas com horário; manual cobre “A COMBINAR”. Remover impede o campeonato de ter sala. |
| D02 | Vagas por time, PRONTO, sorteio, escolha de lado e pick order | Sala de campeonato/scrim | `features/sala-campeonato/SalaCampeonato.tsx` / `routes/matches-actions.ts`, `lib/sala-campeonato.ts` | `campeonato_sala_estado`, `match_players`; `POST /:id/sala-campeonato/entrar`, `/sair`, `/pronto`, `/lado`, `/pick-order` | D01; sustenta draft e jogo | Ativo | Servidor decide fase; sem timer em V1; admin destrava. Remover deixa a sala presa em `camp_vagas`. |
| D03 | Draft Fearless por jogo | Sala de campeonato/scrim | `components/draft/DraftRoom.tsx`, `features/sala-campeonato/SalaCampeonato.tsx` / `lib/sala-campeonato-draft.ts` | `match_drafts`, `tournament_series_games` (picks anteriores travados); `POST /:id/sala-campeonato/ban`, `/pick` | D02; sustenta o confronto | Ativo | 30s por turno; turno vencido trava (não cancela); picks de jogos anteriores viram Fearless. Remover impede o draft de campeonato. |
| D04 | Série de campeonato MD1/MD3/MD5: resultado automático e manual | Sala e cronograma/chave | `features/sala-campeonato/SalaCampeonato.tsx`, `components/campeonatos/ListaCronograma.tsx` / `lib/serie-campeonato.ts`, `cron.ts`, `routes/matches-actions.ts` | `tournament_matches`, `bracket_matches`, `tournament_series_games`; cron de 3 min; `POST /:id/sala-campeonato/resultado` (admin) | D01/D03, Riot; sustenta PDL e avanço | Ativo (config-dependente) | Placar recalculado do zero, roster por PUUID/guest, jogo irregular marcado; admin insere resultado manual. Sem Riot, só o manual funciona. Remover deixa séries sem resultado. |
| D05 | Código da série e visibilidade restrita | Sala de campeonato, cronograma, chave | `features/sala-campeonato/SalaCampeonato.tsx`, `components/campeonatos/ListaCronograma.tsx` / `routes/tournaments.ts`, `lib/tournament-access.ts`, `lib/serie-campeonato.ts` | `tournament_matches.codigo_partida`, `bracket_matches.codigo_partida`; `POST /api/tournaments/:id/jogo/:matchId/gerar-codigo` (sem caller), criação automática em `criarSalaCampeonato` | Staff ou time da série; sustenta início | Ativo | Código é redigido no shape para espectador/estranho (`redigirCodigosDaSerie`). `gerar-codigo` existe, mas o fluxo atual gera ao criar a sala. Remover expõe/inutiliza o código. |
| D06 | Live da sala (streamer) | Botão “Iniciar live” na sala | `features/sala-campeonato/SalaCampeonato.tsx` / `lib/sala-campeonato.ts`, `lib/streams.ts` | `transmissoes` (`match_id` para campeonato, `sala_id` para scrim); `POST /:id/sala-campeonato/live`, `POST /api/streams/:id/parar` | Cargo streamer + Twitch no perfil | Ativo parcial | Para campeonato, a live ancora na série e aparece na vitrine enquanto a série não finaliza. Para scrim, `match_id` é null e `expira_em` é null: **não entra na vitrine** e o `minhaTransmissao` pode desativá-la ao abrir `/streamers`. Remover tira a live da sala. |
| D07 | Reset administrativo temporário da sala | Botão “Resetar Sala” (admin) | `features/sala-campeonato/SalaCampeonato.tsx` / `routes/matches-actions.ts` | `campeonato_sala_estado`, `match_drafts`, `matches`; `POST /:id/sala-campeonato/resetar` | Admin/proprietário; recuperação operacional | Ativo (temporário) | Zera prontos/escolhas e apaga o draft do jogo; o próprio código diz que é temporário até o fluxo estabilizar. Remover tira o botão de recuperação, mas não o fluxo normal. |
| D08 | Sala livre Time vs Time (scrim) com série MD1/MD3/MD5 | `/sala-time/:id`, card “Time vs Time” em `/jogar` | `pages/Jogar.tsx` (fetch cru), `features/sala-campeonato/SalaCampeonato.tsx` / `lib/sala-campeonato.ts`, `lib/serie-livre.ts` | `matches.mode='time_vs_time_livre'`, `campeonato_sala_estado`; `POST /api/matches/time-vs-time` | Times + Riot; sustenta treino/scrim | Ativo parcial | 2 vagas (uma por time), série local, draft Fearless; a criação usa `fetch` cru fora do SDK. A live do scrim tem o problema de vitrine descrito em D06. Remover elimina o scrim novo; o legado C16 continua. |

### 3.5 E — Campeonatos

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| E01 | Listagem pública de campeonatos | `/campeonatos`, Lobby | `pages/campeonatos.tsx`, `pages/Lobby.tsx` / `routes/tournaments.ts` | `tournaments`; `GET /api/tournaments?view=card`, `?view=agenda` | DB; sustenta descoberta e agenda | Ativo | Cards com status, prêmio, vagas, banner; agenda do Lobby usa jogos confirmados. Remover esvazia a vitrine de campeonatos. |
| E02 | Criação e edição de campeonato (formato, datas, prêmio, tier, regras, imagens, tema) | `/admin/criar-campeonato` | `pages/createCampPage.tsx`, `features/campeonatos/components/FormCriarCampeonato.tsx` / `routes/tournaments.ts`, `lib/tournament-store.ts` | `tournaments`; `POST/PUT /api/tournaments`; upload `public-images` | Sessão (API não exige organizer); sustenta todo o campeonato | Ativo (permission gap) | Formato `mata_mata`/`liga`; imagens sobem para `public-images/campeonatos`; blocos legados viram tabelas. **Qualquer usuário logado pode criar/editar pela API**; falta validar organizador/staff. Remover elimina a criação de campeonatos. |
| E03 | Inscrição, aprovação e remoção de times | Modal de inscrição, painel de criação | `features/campeonatos/components/modals/InscricaoModal.tsx`, `pages/createCampPage.tsx` / `routes/tournaments.ts`, `lib/tournament-store.ts` | `tournament_teams`; `POST /:id/inscricoes`, `POST /:id/inscricoes/:teamId/aprovar`, `DELETE /:id/inscricoes/:teamId` | Time + sessão; sustenta grupos/chaves | Ativo (permission gap) | **A remoção tem checagem de organizador/admin; a inscrição e a aprovação só exigem login.** A inscrição também não valida se o usuário é dono do time. Remover impede montar o torneio. |
| E04 | Grupos e sorteio | Aba Grupos, painel admin | `components/campeonatos/Grupos.tsx`, `features/campeonatos/CampeonatoContext.tsx` / `lib/tournament-store.ts` | `tournament_groups`, `tournament_teams.group_id`; salvos no `PUT` do campeonato | E03; sustenta fase de grupos | Ativo | Sorteio distribui times por grupo; grupos persistidos e usados na classificação. Remover tira a fase de grupos. |
| E05 | Cronograma, agendamento, confirmação, W.O. e arbitragem | Aba Cronograma, “Meus Jogos Pendentes”, modal de agendamento | `components/campeonatos/Cronograma.tsx`, `ListaCronograma.tsx`, `MeusJogosPendentes.tsx`, `TodosJogosPendentes.tsx` / `routes/tournaments.ts`, `lib/tournament-store.ts` | `tournament_matches`; `PUT /:id/cronograma`, `PUT /:id/cronograma/merge`; `applyAutoTiebreakers` | E03/E04; sustenta PDL e salas | Ativo | Ações `propose/counter/accept/arbitrate/finish`; confirmação exige data/hora; W.O. encerra live/sala e libera código. Remover tira o calendário e os resultados de grupo. |
| E06 | Chaveamento visual (mata-mata) | Aba Chaves | `components/campeonatos/Chaves.tsx`, `BracketModal.tsx`, `DoubleEliminationBracket.tsx`, `DoubleSideBracket.tsx` / `routes/tournaments.ts`, `lib/tournament-store.ts` | `bracket_matches`; `PUT /api/tournaments/:id` com `bracket_data` | E03; playoffs | Ativo (visual) | A chave é **apenas visual**: não gera PDL, não cria cronograma e não sincroniza com grupos; admin preenche/avança manualmente. Remover tira o desenho do mata-mata. |
| E07 | Classificação de grupos e desempate automático | Aba Grupos/Visão Geral | `components/campeonatos/GroupStage.tsx`, `VisaoGeral.tsx` / `lib/tournament-shape.ts`, `lib/tournament-tiebreakers.ts` | `tournament_standings` (fallback), `tournament_matches`; `appendTiebreakers` no save | E05; sustenta classificados | Ativo | Classificação deriva dos jogos finalizados; fallback manual em `tournament_standings`; empate na fronteira cria “DESEMPATE - Grupo”. Remover tira a tabela e o desempate. |
| E08 | PDL global e ranking de times | `/times`, admin Ranking, Lobby | `pages/equipes.tsx`, `pages/Admin.tsx`, `components/home/TopTeamsStickers.tsx` / `lib/tournament-pdl.ts` | `team_stats`; recálculo no save do cronograma e `POST /:id/recalcular-pdl` | E05; sustenta ranking/seeding | Ativo | +15 vitória, −13 derrota, piso 0, chave não conta; ranking PDL desc/V desc/tag. Remover tira o ranking competitivo. |
| E09 | Verificação/criação de sala e código da série | Cronograma, sala, botão “Verificar” | `components/campeonatos/ListaCronograma.tsx`, `features/sala-campeonato/SalaCampeonato.tsx` / `routes/tournaments.ts`, `lib/serie-campeonato.ts`, `lib/sala-campeonato.ts` | `tournament_matches`, `bracket_matches`, `match_codes`; `POST .../sala`, `POST .../verificar`, `POST .../gerar-codigo` | E05, Riot; sustenta D01/D04 | Ativo parcial | `sala` e `verificar` são usados; `gerar-codigo` não tem caller (a sala já cria o código). Sem Riot, só resultado manual. Remover impede a série de começar/verificar. |
| E10 | Painel administrativo e visão pública do campeonato | `/campeonato/:id` (abas Overview/Grupos/Cronograma/Chaves/Admin) | `pages/CampeonatoDetalhes.tsx`, `features/campeonatos/CampeonatoContext.tsx`, `VisaoGeral.tsx`, `RegrasModal.tsx` / `routes/tournaments.ts` | `tournaments`, `tournament_*`, `bracket_matches`; `GET /:id`, `/:id/shell`, `/:id/:secao` | E02–E09; sustenta operação | Ativo | Seções lazy, cache, redação de código, sorteio/reset, criação de jogo, tema, regulamento. Remover tira o controle do campeonato. |

### 3.6 F — Economia e apostas

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| F01 | Carteira MC/MP | Header, `/perfil`, modal de depósito/saque | `components/perfil/CarteiraEStrikes.tsx`, `contexts/PerfilContext.tsx` / `routes/wallet.ts` | `user_wallets`; `GET /api/wallet/balance` | Sessão; sustenta salas, apostas, saque | Ativo | Retorna `mp`, `mc`, `mcReservado`, `emPartida`; `mp` não tem fluxo de ganho (ver 2.1). Remover quebra toda a economia. |
| F02 | Depósito de MC via PIX (Mercado Pago) | Modal “Depositar” | `components/modals/deposit/DepositTab.tsx` / `routes/payments.ts`, `lib/mercado-pago.ts` | `mc_packages`, `payments`; `GET /api/payments/packages`, `POST /api/payments/mc/order`, `GET /:orderId/status` | `MERCADO_PAGO_ACCESS_TOKEN` + PIX habilitado; sustenta compra de MC | Incompleto (BLK-005) | Servidor resolve pacote/preço/bônus; QR só é gerado se a conta tiver chave PIX. Bloqueio externo: a conta atual não gera QR. Remover tira a compra de MC. |
| F03 | Webhook do Mercado Pago e crédito idempotente | Não aparece | — / `routes/payments.ts`, `lib/pagamentos.ts` | `payments`, `user_wallets`, `wallet_transactions`; `POST /api/payments/webhook` | F02; sustenta crédito | Ativo (config-dependente) | Valida assinatura, consulta o status real no MP, credita uma vez com `FOR UPDATE` e `status='approved'`. Remover deixa depósitos pagos sem crédito. |
| F04 | Saque de MC via PIX | Aba “Sacar” no modal; admin Saques | `components/modals/deposit/SaqueTab.tsx`, `components/admin/SaquesPix.tsx` / `routes/withdrawals.ts`, `lib/withdrawals.ts` | `withdrawals`, `user_payout_info`, `user_wallets`, `wallet_transactions`; `POST/GET /api/withdrawals`, `GET /admin`, `POST /:id/decide` | Chave Pix + saldo; sustenta conversão MC→R$ | Ativo | 100 MC = R$1, mínimo 2.000 MC, debita na solicitação, admin paga/rejeita com `decisionId`. Remover tira o saque. |
| F05 | Ajuste administrativo de saldo | Abas “Saldos” e “Saldo MC” em `/admin` | `pages/Admin.tsx`, `api/wallet.ts` / `routes/wallet.ts` | `user_wallets`, `wallet_transactions`; `POST /api/wallet/admin/adjust`, `POST /admin/adjust-mc` | Admin/proprietário; correção manual | Duplicado/confuso | As duas abas ajustam **MC**; “Saldos” usa `/adjust` e rotula MP, “Saldo MC” usa `/adjust-mc` (só proprietário). `deltaMP` existe na API, mas a UI nunca envia. Remover uma das abas não perde capacidade; remover as duas tira a correção manual. |
| F06 | Ledger de transações | Não aparece para o jogador | — / `lib/escrow.ts`, `lib/bets.ts`, `lib/pagamentos.ts`, `lib/withdrawals.ts` | `wallet_transactions` (tipo, valor, `balance_after`, `ref_type`, `ref_id`) | Todos os fluxos de dinheiro; sustenta auditoria/idempotência | Ativo (backend-only) | Toda movimentação grava ledger; não há tela de extrato. Remover perde a auditoria e a idempotência por constraint, mas o saldo corrente continuaria. |
| F07 | Escrow das salas apostadas | Sala, carteira (“em partida”) | `pages/SalaMod1.tsx`, `CarteiraEStrikes.tsx` / `lib/escrow.ts` | `user_wallets.mc_reservado`, `wallet_transactions`; `reservarEntrada`, `devolverEntrada` | F01; sustenta C03/C09 | Ativo | Invariante `mc + mc_reservado`; saída só por prêmio, empate, cancelamento ou saída antes do vínculo. Remover quebra salas apostadas. |
| F08 | Cálculo de prêmio, taxa e arredondamento | Sala finalizada | — / `lib/escrow.ts` | `platform_revenue`; `calcularPayout`, `pagarPremio` | F07; sustenta C09 | Ativo | Taxa `ceil`, prêmio `floor`, resto para plataforma; valida taxa 0–100. Remover deixa o pote sem divisão. |
| F09 | Aposta individual (“desafio”) na própria partida ranqueada | `/aposta-individual` | `pages/ApostaIndividualPage.tsx` / `routes/bets.ts`, `lib/bets.ts` | `bet_tickets`, `bet_legs`, `user_wallets`, `wallet_transactions`; `GET /catalog`, `GET /me`, `GET /me/active`, `POST /`, `POST /:id/sync`, `GET /history` | Riot (fila 420/440), saldo, elegibilidade | Ativo (config-dependente) | Mercados: vitória/derrota, kills over/under, first blood; stake mínimo 100 MC, payout máximo 5.000; reserva em `mc_reservado`. Remover tira o desafio. |
| F10 | Detecção e liquidação automática da aposta individual | `/aposta-individual` (status) e cron | `pages/ApostaIndividualPage.tsx` / `lib/live-bets.ts`, `cron.ts` | `bet_tickets`, `bet_legs`, `notifications`; espectador + match-v5; `runBetsCron` | F09, Riot; sustenta o resultado | Ativo (config-dependente) | Detecta jogo por espectador ou histórico; liquida cada leg; timeout de 90 min devolve, fantasma de 3h anula. Sem Riot, os bilhetes ficam aguardando até o timeout. Remover deixa MC preso. |
| F11 | Receita da plataforma e dashboard financeiro | `/admin` aba Financeiro | `components/admin/FinanceiroDashboard.tsx` / `routes/admin.ts` | `payments`, `platform_revenue`, `user_wallets`; `GET /api/admin/financeiro` | F02/F08; sustenta visão de negócio | Incompleto | Faturamento e lucro de taxas saem; **`saques` é sempre 0** (comentário antigo “sec.pix inexistente”, mas saque já existe) e o lucro não inclui spread de apostas. Remover tira o dashboard; não afeta dinheiro. |
| F12 | Compra/assinatura VIP | Não aparece | — / — | Apenas comentários `vip_monthly`/`vip_purchase`; nenhuma rota ou pacote | Nenhuma | Desconectado/ausente | Não há implementação; `is_vip` só é lido. Remover os comentários/campos não muda nada. Se o produto quer vender VIP, é feature nova. |
| F13 | Programa de indicação/referral | Não aparece | — / — | `referral_events`, `users.referred_by`; nenhum código | Nenhuma | Desconectado | Tabela e FK existem desde a migration inicial, mas não há INSERT/SELECT. Remover não afeta nada. |

### 3.7 G — Conteúdo, streams e notificações

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| G01 | Notícias e atualizações | Lobby (“Notícias & Atualizações”), admin Notícias | `pages/Lobby.tsx`, `pages/Admin.tsx` / `routes/content-news.ts` | `news`; `GET /api/content/news`, `GET /all`, `POST`, `PUT /:id`, `DELETE /:id` | Cargo admin/organizador para escrita; sustenta comunicação | Ativo | Lista publicadas, destaque no Lobby, modal de leitura; CRUD admin com slug único e categoria. Remover tira o canal de notícias. |
| G02 | Highlights/vídeos | Lobby e `/streamers`; admin Highlights | `pages/Lobby.tsx`, `pages/Streamers.tsx`, `pages/Admin.tsx` / `routes/content-highlights.ts` | `highlights`; `GET /api/content/highlights`, `/all`, `POST`, `PUT /:id`, `DELETE /:id` | Admin; sustenta vitrine de clipes | Ativo | Ordenação por `ordem`, categoria, thumbnail e link; aparece quando não há live. Remover esvazia a seção de clipes. |
| G03 | Estatísticas de jogador por modo (`player_stats`) | Não aparece | — / `routes/content.ts` | `player_stats`; `GET /api/content/player-stats/:userId`, `POST /api/content/player-stats` | Nenhum job; não é alimentado por partidas | Desconectado | O POST recalcula vitórias/derrotas/winrate, mas nenhum código o chama ao fim de partida e nenhum componente lê. Remover não afeta partidas nem histórico; apaga um contador que hoje não reflete a realidade. |
| G04 | Vitrine de streams ao vivo | `/streamers` e Lobby | `pages/Streamers.tsx`, `pages/Lobby.tsx` / `routes/streams.ts`, `lib/streams.ts` | `transmissoes`; `GET /api/streams` | Streamer + Twitch; sustenta descoberta de lives | Ativo (com ressalva) | Lista lives avulsas não expiradas e lives de campeonato não finalizadas. **Live de scrim (`sala_id`, `match_id` null, `expira_em` null) não entra na vitrine** e pode ser desativada pelo `minhaTransmissao`. Remover tira a vitrine de lives. |
| G05 | Agenda de transmissões, vaga por jogo e “entrar no ar” | `/streamers` (agenda) | `features/streams/components/AgendaTransmissoes.tsx` / `routes/streams.ts`, `lib/streams.ts` | `escalas_transmissao`, `transmissoes`, `tournament_matches`; `GET /agenda`, `POST/DELETE /agenda/:matchId`, `POST /agenda/:matchId/no-ar` | Cargo streamer + Twitch; sustenta transmissão de campeonato | Ativo | 1 streamer por jogo (UNIQUE), janela de 30 min antes, código visível para o escalado/staff, encerra quando o jogo finaliza. Remover tira a escala e o “no ar” de campeonato. |
| G06 | Live avulsa do streamer | `/streamers` (formulário sanfona) | `pages/Streamers.tsx` / `routes/streams.ts` | `transmissoes`; `POST /api/streams`, `GET /minha`, `POST /:id/parar` | Cargo streamer + Twitch; sustenta live sem jogo | Ativo (com ressalva) | Duração em horas, modo `padrao/amistoso/campeonato`, times selecionados. **No modo campeonato o front envia `campeonatoId: null`**; o campeonato só entra no título, não no vínculo. Não há verificação de que a Twitch está realmente ao vivo. Remover tira a live avulsa. |
| G07 | Notificações do sino | Header (sino) | `components/notifications/NotificationBell.tsx` / `routes/notifications.ts`, `lib/notifications.ts` | `notifications`, `team_invites`; `GET /api/notifications`, `POST /read-all`, `POST /:id/read` | Times (convites) e apostas (resultados); sustenta avisos | Ativo (com ressalva) | O sino junta convites/solicitações sintetizados de `team_invites` + notificações persistidas. **Só a liquidação de apostas grava `notifications`**; tipos `wallet/match/team/tournament/system` existem no schema, mas não são usados. Remover tira convites e resultados do sino. |
| G08 | Cache de broadcasts ao vivo | Não aparece | — / — | `broadcasts` (`is_live`, `viewer_count`, `thumbnail_url`, `synced_at`); nenhum código | Nenhuma | Desconectado | Tabela com índice `is_live`, mas zero SELECT/INSERT. As lives reais usam `transmissoes`. Remover não afeta nada. |
| G09 | Preview social (Open Graph) de sala | Links compartilhados no WhatsApp/Discord/Telegram etc. | Nginx desvia crawlers / `routes/og.ts` | `matches`, `match_players`; `GET /api/og/:modo/:id` | Nginx + APP_URL; sustenta card de compartilhamento | Ativo (com ressalva) | Só cobre `/5v5`, `/aram`, `/1v1`, `/time_vs_time`. **`/sala-time/:id` e `/campeonato/sala/:id` não têm OG** (nem rota, nem imagem por modo). Remover faz links compartilhados perderem card; não afeta a sala. |
| G10 | Páginas institucionais e tutorial | `/quem-somos`, `/politicas`, `/tutorial` | `pages/QuemSomos.tsx`, `pages/Politicas.tsx`, `pages/Tutorial.tsx` / — | Conteúdo estático no front | Nenhuma | Ativo | Textos e layout estáticos; não há CMS nem rota de API. Remover tira informação institucional/legal e o tutorial. |

### 3.8 H — Administração

| ID | Funcionalidade e finalidade | Onde aparece | Front / Back | Tabelas, endpoints e jobs | Depende de / sustenta | Estado | Evidência e consequência da remoção |
|---|---|---|---|---|---|---|---|
| H01 | Dashboard administrativo | `/admin` aba Visão | `pages/Admin.tsx` / `routes/players.ts`, `routes/matches.ts`, `routes/teams.ts`, `routes/wallet.ts` | `users`, `matches`, `teams`, `user_wallets`; contagens e somas no cliente | Admin/proprietário; sustenta visão geral | Ativo | Conta jogadores, salas ativas, times e “MC em circulação”; esse card soma **apenas `user_wallets.mc`** (não inclui `mc_reservado`), então subconta o total que o dashboard financeiro calcula. Remover tira a visão geral, sem afetar dados. |
| H02 | Gestão de cargos | `/admin` aba Cargos e página `/admin/cargos` | `pages/AdminCargos.tsx`, `pages/Admin.tsx` / `routes/admin.ts` | `users`, `user_roles`; `GET /api/admin/cargos`, `PUT /cargos/:userId` | Proprietário para alterar; sustenta permissões | Duplicado | A mesma tela existe como aba e como página inteira. A UI atribui um cargo por vez e apaga os demais; `moderador`/`caster` não aparecem na lista, embora o backend os use. Remover uma das entradas não perde capacidade; remover as duas tira a gestão de cargos. |
| H03 | Painel de contatos dos times | `/admin` aba Contatos e página `/admin/contatos` | `pages/AdminContatos.tsx`, `pages/Admin.tsx` / `routes/teams.ts` | `teams.contacts`; `GET /api/teams` | Admin; sustenta contato com capitães | Duplicado | Lista WhatsApp/Discord, copia campo e exporta CSV. A mesma tela existe em aba e página. Remover uma não perde capacidade. |
| H04 | Punições: advertências, ban e desban | `/admin` aba Punições | `pages/AdminPunicoes.tsx` / `routes/admin.ts`, `lib/elegibilidade.ts` | `user_advertencias`, `users.status/ban_*`; `GET/POST/DELETE /advertencias`, `POST /usuarios/:userId/ban`, `/unban` | Admin/proprietário; sustenta elegibilidade | Ativo | 3 advertências ativas → ban automático; ban é permanente até unban; remover advertência não desbana sozinho. Remover tira a punição e o ban. |
| H05 | Reset de senha pelo admin | `/admin` aba Senhas | `pages/AdminSenhas.tsx` / `routes/admin-password-reset.ts` | `password_reset_tokens`; `POST /api/admin/usuarios/:userId/reset-link` | Proprietário; sustenta A05 | Ativo | Gera link de uso único (24h) e mostra para copiar; não envia e-mail. Remover tira a recuperação de senha. |
| H06 | Revisão de partidas e contestações | `/admin` aba Revisão | `components/admin/RevisaoPartidas.tsx` / `routes/revisao.ts` | `matches.aguardando_revisao`, `match_prints`, `match_disputas`; `GET /pendentes`, `POST /:id/decidir`, `GET /disputas`, `POST /disputas/:id/decidir` | Revisor (admin/moderador/proprietário); sustenta C12/C14 | Ativo (com ressalva) | Decide vencedor/empate/cancelamento com `decisionId`; disputa procedente estorna e cancela. O fluxo normal não gera mais fila; a aba fica útil para legado e disputas. Remover tira a decisão manual e a contestação. |
| H07 | Dashboard financeiro | `/admin` aba Financeiro | `components/admin/FinanceiroDashboard.tsx` / `routes/admin.ts` | `payments`, `platform_revenue`, `user_wallets`; `GET /api/admin/financeiro` | F02/F04/F08; sustenta visão de negócio | Incompleto | Mesma lacuna de F11: `saques` sempre 0 e lucro só de taxas de sala. Remover tira o gráfico; não move dinheiro. |
| H08 | Fila e decisão de saques PIX | `/admin` aba Saques | `components/admin/SaquesPix.tsx` / `routes/withdrawals.ts` | `withdrawals`, `user_payout_info`; `GET /api/withdrawals/admin`, `POST /:id/decide` | Admin; sustenta F04 | Ativo | Mostra chave Pix completa, paga ou rejeita com idempotência; rejeição devolve MC. Remover deixa pedidos sem decisão. |
| H09 | Uploads de imagens (logos, imagens públicas, prints) | Logos de time, imagens de campeonato, prints (legado) | `pages/equipes.tsx`, `pages/TimePage.tsx`, `features/campeonatos/domain/imagem.ts` / `routes/upload.ts` | Volume `/var/www/uploads`; buckets `team-logos`, `public-images`, `match-prints`; `POST /api/upload` | Sessão + permissão por bucket; sustenta times/campeonatos | Ativo | Magic bytes, MIME, limites por bucket, Sharp para WebP, logo 1080×1080, print privado com permissão. Remover quebra logos e imagens de campeonato; prints legados deixam de subir. |

---

## 4. Endpoints sem tela ou sem chamador no fluxo atual

> “Sem chamador” = não há `api.*` nem `fetch` no `web/src` atual. Isso **não**
> prova que ninguém usa: cliente antigo, link salvo ou chamada manual podem
> existir. Onde a rota é usada só pelo admin, está dito.

| # | Endpoint | O que faz | Por que não tem tela | Evidência | Consequência/risco |
|---|---|---|---|---|---|
| 1 | `GET /api/profiles/:id` | Perfil público de qualquer usuário, com `profile` legado | Nenhum SDK/chamada no front | `routes/profiles.ts:362`; não há `api.profiles.get` em uso | Devolve **chave Pix, nome do titular e redes** sem autenticação. Se um cliente antigo usar, é exposição de dado financeiro. **PRECISA DE VERIFICAÇÃO.** |
| 2 | `POST /api/wallet/deposit` | Cria `payments` pendente a partir de `amountBrl`/`mcAmount` do cliente | O front usa `POST /api/payments/mc/order` | `routes/wallet.ts:64`; SDK não expõe `wallet.deposit` | Rota legada; não credita sozinha, mas aceita valores do cliente e cria cobrança sem MP. Remover não afeta o depósito atual. |
| 3 | `POST /api/matches/:id/report-result` | Move sala para `aguardando_revisao` (fluxo antigo de print) | O front usa verificação Riot | `routes/matches-actions.ts:615`; nenhum caller | Mantém salas antigas no fluxo de revisão. Remover deixa salas antigas sem como entrar em revisão. |
| 4 | `POST /api/matches` com `mode='time_vs_time'` | Cria sala legada de 10 vagas | O front intercepta e cria `time_vs_time_livre` | `routes/matches.ts:431`; `Jogar.tsx:714` desvia | Compatibilidade de API/cliente antigo. Remover quebra quem ainda cria o modo antigo; não afeta o scrim novo. |
| 5 | `POST /api/upload` bucket `match-prints` (modos `revisao`/`contestacao`) | Salva print, pode levar sala a revisão | Nenhum componente envia print | `routes/upload.ts:467`; `api.prints.upload` sem caller | Ainda aceita print de cliente antigo e dispara Discord/revisão. Remover tira a prova manual; o fluxo automático não depende. |
| 6 | `GET /api/prints/:matchId` | Lista prints de uma sala | O admin recebe prints embutidos em `/revisao/pendentes` | `routes/prints.ts:43`; `api.prints.list` sem caller | Leitura por participante/revisor. Remover não afeta o painel atual, que usa o embed. |
| 7 | `POST /api/disputas/:matchId` | Abre contestação (1 por jogador) | Não há botão de contestar no front | `routes/disputas.ts:79`; `api.disputas.abrir` sem caller | A contestação existe na API, mas o jogador não consegue abrir pela interface. Remover tira a capacidade; o admin continua vendo disputas antigas. |
| 8 | `GET /api/disputas/:matchId` | Lista disputas de uma sala | Admin usa `/revisao/disputas` | `routes/disputas.ts:100`; `api.disputas.list` sem caller | Leitura por participante/revisor. Remover não afeta o painel atual. |
| 9 | `GET /api/content/player-stats/:userId` | Lê stats por modo | Nenhum componente consome | `routes/content.ts:19`; `api.content.playerStats` sem caller | Dado não aparece em perfil, players ou sala. Remover não afeta nada visível. |
| 10 | `POST /api/content/player-stats` | Incrementa vitórias/derrotas/winrate | Nenhum job/partida chama | `routes/content.ts:35`; `recordPlayerStats` sem caller | Tabela não reflete partidas reais. Remover não afeta placares; apaga um contador desconectado. |
| 11 | `GET /api/bets/:id` | Detalhe de um bilhete (dono) | O front usa `/me`, `/me/active` e `/history` | `routes/bets.ts:92`; sem chamador | Útil para deep link futuro; remover não afeta o fluxo atual. |
| 12 | `POST /api/notifications/:id/read` | Marca uma notificação como lida | O sino usa `markAllRead` | `routes/notifications.ts:45`; `markRead` sem caller | Remover não muda o sino; ele marca todas ao abrir. |
| 13 | `POST /api/players/refresh-elo` | Atualiza elo de uma conta (legado) | Admin usa `refresh-elos` em lote | `routes/players.ts`; `api.players.refreshElo` sem caller | Rota antiga de conta única; remover não afeta o botão admin em lote. |
| 14 | `POST /api/teams/:id/transferir-dono` | Passa a coroa para um membro | O front move a coroa pelo lineup | `routes/teams.ts:586`; sem SDK/caller | Duplica a regra de ownership do lineup. Remover não afeta a UI; perde um caminho de API. |
| 15 | `POST /api/tournaments/:id/jogo/:matchId/gerar-codigo` | Gera código da série | A criação da sala já gera o código | `routes/tournaments.ts:579`; `api.tournaments.gerarCodigo` sem caller | Rota redundante. Remover não afeta o fluxo atual; clientes antigos podem usá-la. |
| 16 | `POST /api/tierlists` | Envia tier list da M7 Academy | Router não está montado; página sem rota | `routes/tierlists.ts`; `index.ts` não importa; `features/.../api.ts` chama `/api/tierlists` | Hoje responde 404. Remover não muda nada visível; a feature já está inacessível. |

---

## 5. Tabelas e campos órfãos ou sem fluxo completo

| # | Recurso | O que existe | Quem lê/escreve hoje | Estado | Se removido / verificação |
|---|---|---|---|---|---|
| 1 | `broadcasts` | Cache de live com `is_live`, `viewer_count`, `thumbnail`, `synced_at` | Ninguém | Desconectado | As lives reais usam `transmissoes`. Remover não afeta nada. **Verificar se há linhas** de integração antiga. |
| 2 | `recruitment_posts` | Posts LFT/LFP com `role_slot`, `active`, índices | Ninguém | Desconectado | O recrutamento real é `team_invites`. Remover não afeta. **Verificar linhas.** |
| 3 | `referral_events` | Indicação com `referrer`, `referred`, `event_type` | Ninguém | Desconectado | Não há programa de indicação. Remover não afeta. |
| 4 | `audit_logs` | Log central com `action`, `entity`, `details`, IP/UA | Ninguém | Desconectado | Banimentos e alguns `criado_por` são auditados em colunas, mas não há log central. Remover não afeta; a auditoria continua parcial. |
| 5 | `player_stats` | Vitórias/derrotas por modo | API `content/player-stats` (sem caller) | API ativa, sem consumidor | Não reflete partidas. Remover não afeta; **verificar linhas** de cliente antigo. |
| 6 | `match_prints` | Prints de prova | Upload/prints/revisão (legado) | Sem fluxo no front | O fluxo automático não usa. Remover apaga provas antigas e a capacidade manual. |
| 7 | `match_disputas` | Contestações | API de disputas + admin | Parcial | Jogador não abre pelo front; admin decide. Remover tira a contestação. |
| 8 | `tierlist_submissions` | Respostas da tier list | Router não montado | Desconectado | Remover não afeta o site atual; **verificar se app desktop lê**. |
| 9 | `users.referred_by` | Quem indicou o usuário | Ninguém | Desconectado | Sem código de referral. Remover não afeta. |
| 10 | `users.vip_expires_at` | Expiração do VIP | Ninguém | Órfão | `is_vip` não é desligado por expiração. Remover não muda o selo; **verificar VIPs reais**. |
| 11 | `users.suspensa_ate` | Suspensão temporária | `profiles.ts` devolve; `CarteiraEStrikes` exibe | Legado | Nada escreve desde a ADR-033; o ban atual é permanente. Remover tira um aviso que nunca é gerado. |
| 12 | `users.email_verified` | Verificação de e-mail | Só o Google grava; ninguém checa | Órfão | Não há verificação de e-mail por código. Remover não afeta login. |
| 13 | `matches.entry_mp` | Valor da entrada (nome legado) | Grava junto com `aposta_mc`; shape publica `mpoints` | Legado ativo | Guarda o **mesmo MC** de `aposta_mc`. Remover exigiria ajustar shape/SDK; hoje é só duplicação de nome. |
| 14 | `matches.status='finalizacao'` | Estado de finalização | Ninguém entra; o cron converte para `encerrada` | Morto | Nenhuma rota seta `finalizacao`. Remover do enum/cron não afeta o fluxo atual. |
| 15 | `tournament_matches.sorteio_forcado` | Força o sorteado do jogo 1 | Nenhuma rota/UI; só SQL/teste | Órfão operacional | Usado em operação pontual via SQL. Remover tira um ajuste manual que não tem interface. |
| 16 | `tournament_standings` | Classificação manual | Fallback quando não há jogos finalizados | Fallback | A classificação normal deriva do cronograma. Remover tira o fallback de mata-mata antes de começar. |
| 17 | `user_identities.provider='discord'` | Comentário de provider | Só Google grava | Órfão | Não há OAuth Discord. Remover o comentário/valor não afeta login. |

---

## 6. Jobs e automações

| # | Job/automação | Intervalo | O que lê/escreve | Depende de | Estado | Evidência/consequência |
|---|---|---|---|---|---|---|
| 1 | `runCron` | 10 min + boot | Varre `matches` em `partida_iniciada`, verifica Riot, cancela após 3h, resolve drafts, converte `finalizacao`, libera `linked` órfão, purga chat >24h, roda apostas | Riot, DB | Ativo | `api/src/cron.ts`. Sem Riot, salas em jogo tendem a cancelar após 3h. |
| 2 | Criação de salas de campeonato | 1 min + boot | `tournament_matches` confirmados com horário → `matches` | Série/código | Ativo | `criarSalasCampeonatoPendentes`. Sala nasce 10 min antes. |
| 3 | Verificação de séries de campeonato | 3 min | `tournament_matches`/`bracket_matches` em andamento com código → Riot | Riot | Ativo | `verificarSeriesPendentes`. Sem Riot, só resultado manual. |
| 4 | Reconciliação de Riot ID | 3 dias + boot | `game_accounts.handle`, `users.riot_id`, ícone/nível | Riot | Ativo (config-dependente) | `runReconciliacaoHandles`; pacing de 3 contas/10s para não estourar rate limit. |
| 5 | Refresh de elos | 7 dias + boot | `game_accounts.metadata.elo_cache` | Riot | Ativo (config-dependente) | `runRefreshElos`; lote 2000, 3 em paralelo com pacing; preserva cache em falha. |
| 6 | Detecção/liquidação de apostas | dentro do `runCron` (10 min) | `bet_tickets`, `bet_legs`, `notifications` | Riot spectator/match-v5 | Ativo (config-dependente) | `runBetsCron`; timeout 90 min devolve, fantasma 3h anula. |
| 7 | Purge do chat | dentro do `runCron` + leitura | `sala_mensagens` >24h | — | Ativo | `cron.ts` e `GET /:id/mensagens`. |
| 8 | Expiração de lives | sob demanda | `transmissoes` expiradas ou de jogo finalizado | — | Ativo | `minhaTransmissao`/`listarVitrine` desativam “lazy”; não é interval. |
| 9 | Recálculo de PDL | a cada escrita de cronograma | `team_stats` | — | Ativo | `storeCronograma` chama `recalcularPdlGlobal`; também há endpoint manual. |
| 10 | Sorteio semanal das copas | manual | `tournament_matches` (jogos pendentes) | DB | Ativo operacional | `scripts/campeonatos/sortear-semana.mjs`; 2 adversários inéditos/time, 8 jogos/copa. |

> **Risco comum:** os jobs rodam com `setInterval` dentro do processo da API
> (`api/src/index.ts`), sem lock distribuído. Com uma réplica, funciona; com
> duas, cada réplica executa o mesmo job. Já registrado como E-27 na
> `ESTRUTURA_ATUAL.md`.

---

## 7. Integrações externas

| # | Integração | O que faz | Onde | Credencial/config | Estado | Impacto se removida |
|---|---|---|---|---|---|---|
| 1 | Riot API — proxy | Conta, invocador, elo, partidas e stats | `routes/riot.ts`, `web/src/api/riot.ts` | `RIOT_API_KEY` | Ativo (config-dependente) | Sem ela, vínculo, elo, tierlist e verificação param. |
| 2 | Riot API — jobs | Reconcilia handle/ícone e atualiza elo | `lib/reconciliar-handles.ts`, `lib/atualizar-elos.ts` | `RIOT_API_KEY` | Ativo (config-dependente) | Dados de perfil ficam velhos; não quebra o resto. |
| 3 | Google OAuth | Login social | `routes/auth-google.ts`, `pages/Login.tsx` | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | Ativo (config-dependente) | Resta login por senha. |
| 4 | Mercado Pago PIX | Compra de MC e webhook | `routes/payments.ts`, `lib/mercado-pago.ts`, `lib/pagamentos.ts` | `MERCADO_PAGO_ACCESS_TOKEN`, `WEBHOOK_SECRET` | Incompleto (BLK-005) | Sem PIX, não há compra de MC; o resto da economia continua. |
| 5 | Discord webhook | Aviso de sala em revisão | `lib/discord.ts`, `routes/upload.ts` | `DISCORD_WEBHOOK_URL` (não passado no compose) | Backend-only, provavelmente inativo | Nenhuma regra quebra; só não há aviso externo. |
| 6 | Discord OAuth | Login com Discord | — | — | Ausente | Não há perda; nunca foi portado. |
| 7 | Twitch | Links, embeds e lives | `pages/Streamers.tsx`, `Lobby.tsx`, `lib/streams.ts` | Twitch no perfil; sem API oficial | Ativo (links) | Sem Twitch no perfil, streamer não abre live; não há verificação de status real. |
| 8 | WhatsApp/Instagram | Contato e comunidade | Perfil/time/admin; cards do Lobby | Links/telefone | Ativo (texto/link) | Sem integração de API; remover tira contato e links. |
| 9 | Data Dragon | Ícones e campeões | `lib/ddragon.ts`, `web/src/api/riot.ts` | Nenhuma (CDN pública) | Ativo | Sem ícones/campeões atualizados; draft e cards degradam. |
| 10 | Nginx + OG | Serve SPA, proxy `/api`, OG para crawlers | `infra/nginx.conf`, `routes/og.ts` | `APP_URL` | Ativo parcial | Sem OG, links perdem preview; SPA/API continuam. |

---

## 8. Infraestrutura e operação

| # | Capacidade | O que faz | Evidência | Estado | Observação |
|---|---|---|---|---|---|
| 1 | PostgreSQL 16 | Banco principal | `infra/docker-compose.yml`, `db/migrations` | Ativo | 48 tabelas, 35 migrations. |
| 2 | PgBouncer | Pool em transaction mode | `infra/pgbouncer.ini` | Ativo | `prepare=false` obrigatório; LISTEN/NOTIFY não passa por ele. |
| 3 | Container `app` | API Express + crons | `Dockerfile`, compose | Ativo | `dist/api/src/index.js`. |
| 4 | Container `realtime` | WebSocket + LISTEN/NOTIFY | `api/src/realtime/index.ts` | Ativo | Conecta direto no Postgres. |
| 5 | Nginx | SPA, proxy, TLS, OG | `infra/nginx.conf`, `Dockerfile.nginx` | Ativo | Host faz TLS; container expõe 8090. |
| 6 | Volume de uploads | Logos/imagens/prints | `uploads_data` | Ativo | `UPLOAD_DIR` default `/var/www/uploads`. |
| 7 | Backup | `pg_dump` diário | compose, serviço `backup` | Incompleto (BLK-008) | Sem `PGPASSWORD`; dumps de 20 bytes. |
| 8 | MCP de operações | Operações da VPS | `mcp/ops-server` | Incompleto (BLK-009) | Container em restart loop; dependência não instalada no mount. |
| 9 | CI | Build da imagem | `.github/workflows/ci.yml` | Ativo parcial | Não roda typecheck, lint, testes nem verify-swap. |
| 10 | MCP status/browser | Governança e browser | `mcp/status-server`, `mcp/browser-server` | Ativo (dev) | Fora do runtime do produto. |

---

## 9. Documentos x código — divergências funcionais

| Documento | Afirma | Código mostra hoje |
|---|---|---|
| `docs/SALAS_APOSTADAS.md` | Resultado por print + revisão manual + SLA + webhook Discord; strikes e suspensão temporária | O fluxo normal verifica pela Riot e finaliza sozinho; strikes/suspensão foram removidos (ADR-033); print/disputa são legado. |
| `docs/SALAS_APOSTADAS.md` | Partida fantasma (3h sem print) vai para revisão | O cron cancela após 3h e devolve o escrow; não vai para revisão. |
| `docs/ARQUITETURA.md` | “Recrutamento” é domínio principal; `broadcasts`, `recruitment_posts`, `referral_events`, `audit_log` ativos | Nenhum código lê/escreve essas tabelas; recrutamento real é convite/solicitação. |
| `docs/ARQUITETURA.md` | `audit_log` particionado por mês | `audit_logs` é tabela comum, sem uso. |
| `docs/ARQUITETURA.md` | Produção no branch `feat/redesign-modais` | `main` é o branch atual. |
| `db/schema/DISCARDED.md` | `scrims` descontinuado | `time_vs_time_livre` está ativo em `/sala-time/:id` e `Jogar.tsx`. |
| `docs/auditoria-salas-morpheus.md` | MORPH-001/002/003 abertos | Senha de sala, clamp e CORS estão corrigidos no código. |
| `web/src/pages/Vincular.tsx` | “Sua conta será verificada através do ícone de perfil” | O fluxo de ícone foi aposentado; o vínculo salva direto. |
| `web/src/pages/Admin.tsx` | Aba “Saldos MPoints” / “Adicione ou remova MPoints” | A aba envia `deltaMC` e ajusta **MC**. |
| `web/src/pages/Jogar.tsx` | Cards alternam “MP” e “MC” | O valor é o mesmo `entryMp`/`apostaMc` em MC. |
| `web/src/pages/Streamers.tsx` | Modo “CAMPEONATO” na live avulsa | O front envia `campeonatoId: null`; o campeonato só entra no título. |
| `scripts/verify-swap.js` | Comentário cita `VipModal` | O componente não existe no repositório. |

---

## 10. Achados novos ou aprofundados em relação ao `ESTRUTURA_ATUAL.md`

1. **MP não tem ganho por vitória**: `user_wallets.mp` só muda por ajuste admin; `player_stats` não é alimentado por partida; o único pontos-por-vitória é o PDL de times.
2. **Aba “Saldos MPoints” ajusta MC**: o rótulo e o texto dizem MP, mas o payload é `deltaMC`.
3. **`matches.entry_mp` é MC**: o shape publica `mpoints`, e a UI alterna “MP”/“MC” para o mesmo valor.
4. **`player_stats` está desconectado**: API existe, mas nenhum código a chama no fim da partida e nenhuma tela lê.
5. **`eloMinimo` não é aplicado**: a sala exibe “Elos Ouro+”, mas o `join` não valida o elo.
6. **`GET /api/profiles/:id` é público e devolve Pix**: a rota não tem chamador, mas expõe chave/nome se usada.
7. **`POST /api/wallet/deposit` é legado e aceita valores do cliente**: o front usa `/payments/mc/order`.
8. **`gerar-codigo` não tem caller**: a sala de campeonato já cria o código ao nascer.
9. **Quatro rotas sem caller**: `GET /bets/:id`, `POST /notifications/:id/read`, `POST /players/refresh-elo`, `POST /teams/:id/transferir-dono`.
10. **Dashboard financeiro zera saques**: `GET /admin/financeiro` devolve `saques: 0` fixo, apesar de `withdrawals` existir.
11. **Live de scrim não entra na vitrine**: `match_id` null + `expira_em` null; `minhaTransmissao` pode desativá-la.
12. **Live avulsa “campeonato” não vincula campeonato**: `campeonatoId` é sempre null no front.
13. **OG não cobre as salas novas**: `/sala-time/:id` e `/campeonato/sala/:id` ficam sem preview.
14. **Modal de jogador exibe placeholders**: KDA, CS/min, KP%, títulos e conquistas são 0/vazios em `players.tsx`.
15. **Verificação por ícone está aposentada, mas o contexto ainda faz polling** e a tela ainda promete verificação por ícone.
16. **VIP não tem escrita nem expiração aplicada**: `vip_expires_at` nunca é lido; não há compra.
17. **Cargos `moderador`/`caster` não são atribuíveis pela UI**: o backend os checa, a lista de cargos não os oferece.
18. **Flags de permissão mortas**: `resolverPartidas`, `cancelarPartidas`, `criarSalas`, `verTodosLogs` não são consultadas.
19. **`finalizacao` é estado morto**: ninguém entra; o cron só converte para `encerrada`.
20. **`suspensaAte` é campo morto**: a UI exibe, mas nada escreve desde a remoção das suspensões.
21. **Ranking de `/times` é recalculado pelo índice da página**: em busca/filtro, o “#” pode não ser o ranking global de `team_stats`.
22. **`sorteio_forcado` não tem UI**: só SQL/teste; operação manual escondida.
23. **`tournament_standings` é só fallback**: a classificação normal deriva do cronograma.
24. **Pool de códigos é finito**: 15 códigos; se todos estiverem em uso, a sala recebe `SEM-CODIGO-AGUARDE`.
25. **Webhook Discord não está no compose**: sem `DISCORD_WEBHOOK_URL`, o aviso de revisão é no-op.
26. **Dashboard admin subconta MC em circulação**: soma só `mc`, não `mc_reservado`; o card e o dashboard financeiro usam critérios diferentes.

---

## 11. Contagens finais

### 11.1 Funcionalidades de produto

| Categoria | Entradas | Ativas | Incompletas | Legadas | Desconectadas | Duplicadas |
|---|---:|---:|---:|---:|---:|---:|
| A. Conta, identidade e acesso | 11 | 9 | 1 | 1 | 0 | 0 |
| B. Times e recrutamento | 7 | 6 | 0 | 0 | 1 | 0 |
| C. Salas casuais e apostadas | 16 | 12 | 1 | 3 | 0 | 0 |
| D. Sala de times / campeonato | 8 | 8 | 0 | 0 | 0 | 0 |
| E. Campeonatos | 10 | 10 | 0 | 0 | 0 | 0 |
| F. Economia e apostas | 13 | 8 | 2 | 0 | 2 | 1 |
| G. Conteúdo, streams e notificações | 10 | 8 | 0 | 0 | 2 | 0 |
| H. Administração | 9 | 6 | 1 | 0 | 0 | 2 |
| **Total** | **84** | **67** | **5** | **4** | **5** | **3** |

### 11.2 Recursos fora do catálogo de produto

| Métrica | Valor |
|---|---|
| Endpoints sem tela/sem chamador no fluxo atual | **16** |
| Tabelas/campos órfãos ou sem fluxo completo | **17** |
| Jobs/automações recorrentes | **10** |
| Integrações externas mapeadas | **10** |
| Capacidades de infraestrutura/operação | **10** |
| Dossiês aprofundados | **6** |

### 11.3 Cobertura do levantamento

| Item | Valor |
|---|---|
| Funcionalidades declaradas | **84** |
| Funcionalidades detalhadas | **84** |
| Cobertura | **100%** |
| Páginas do front | 28 (27 roteadas) |
| Rotas do front | 32 |
| Routers de API | 27 (24 montados) |
| Tabelas Drizzle | 48 |
| Migrations | 35 |
| Arquivos de teste da API | 43 |

### 11.4 Pendências de verificação em produção

Estes pontos não podem ser concluídos só pelo repositório:

1. Existem `user_wallets.mp > 0`? Há ledger `currency='mp'` fora de `admin_adjustment`?
2. Quantos `users.is_vip = true` e como foram concedidos? Há `payments` com `vip_monthly`?
3. Existem linhas em `broadcasts`, `recruitment_posts`, `referral_events`, `audit_logs`?
4. Existem linhas em `player_stats` e de onde vieram?
5. Existem salas `mode='time_vs_time'` ativas ou só históricas?
6. Existem prints/disputas recentes (fluxo legado ainda usado)?
7. `tierlist_submissions` tem dados ou cliente externo?
8. `tournament_standings` tem linhas usadas como fallback?
9. `sorteio_forcado` foi usado em quais séries?
10. Algum cliente antigo chama `profiles/:id`, `wallet/deposit`, `report-result`, `gerar-codigo` ou `transferir-dono`?
11. As lives de streamer estavam de fato no ar na Twitch?
12. Há usuários com cargo `moderador`/`caster` no banco, mesmo sem UI para atribuir?

---

## 12. Resumo em uma página

O M7Arena tem **84 funcionalidades de produto catalogadas**. A maior parte
(67) está ativa e conectada de ponta a ponta: conta, perfil, times, salas,
campeonatos, economia, conteúdo, streams e administração. Mas há uma camada
grande de coisas que **existem no código e não aparecem na tela** ou que
**aparecem na tela e não funcionam como o texto promete**.

Os seis pontos que mais mudam a leitura do produto:

1. **M7 Points não é pontos por vitória.** É um saldo manual, exibido como se
   fosse ranking; o único pontos-por-vitória real é o PDL de times.
2. **Discord é um webhook provavelmente inativo**, não um login/integração.
3. **Recrutamento é convite/solicitação de time**; a tabela de posts LFT/LFP
   está morta e o Lobby promete um painel que não existe.
4. **VIP é selo cosmético**, sem compra, concessão ou expiração aplicada.
5. **Tierlist está pronta, mas 100% desconectada** (página sem rota, router sem
   mount, endpoint 404, tabela fora do schema).
6. **Time vs Time tem dois fluxos**: o legado de 10 vagas (rota antiga) e o
   scrim novo de 2 vagas (sala de campeonato), com modelos de dados diferentes.

Fora desses, os achados mais concretos são:

- filtro de elo mínimo não aplicado no join;
- `player_stats` sem alimentação automática;
- dashboard financeiro com saques sempre zero;
- live de scrim fora da vitrine e sujeita a desligar sozinha;
- live avulsa “campeonato” sem vínculo com campeonato;
- OG sem preview para as salas novas;
- modal de jogador com KDA/CS/KP/títulos zerados;
- 16 endpoints sem tela, 17 tabelas/campos órfãos e 10 jobs/automações.

Nada disso foi alterado. A decisão de manter, corrigir, isolar ou descontinuar
cada item fica com o usuário.





