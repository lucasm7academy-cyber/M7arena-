# M7Arena — Matriz final de simplificação (planejamento)
**Decisões consolidadas em 04/11/2026, com ressalvas posteriores de A09 e F01. Nenhum código foi alterado.**

**Fonte funcional:** `CATALOGO_FUNCIONALIDADES.md` completo (84 itens, levantamento de 04/11/2026). **Fonte das decisões:** escolhas expressas pelo proprietário nesta conversa nas categorias A–H. **Estado da execução:** simplificação funcional ainda não iniciada. Baseline Git e backup de banco na VPS confirmados pelo relatório do agente (dump PostgreSQL restaurado com sucesso em container isolado). A produção permanece intocada.

## 1. Critério das decisões
- **MANTER**: preservar comportamento e contratos necessários; não significa que bugs identificados estejam aprovados.
- **SIMPLIFICAR**: reduzir UI, duplicação ou legado sem eliminar a finalidade indicada.
- **REMOVER**: retirar o fluxo do produto e seus pontos de entrada, após inspeção de dependências, dados históricos e jobs; não significa apagar dados imediatamente.
- A classificação descreve **84 itens do catálogo**, não 84 módulos independentes: F11/H07, B05/E08 e outros itens representam capacidades conectadas ou duplicadas.

## 1.1. Ressalvas adicionais aprovadas (prevalecem sobre descrições anteriores)
- **A09 — Catálogo de jogadores:** preservar listagem e filtros, **remover o popup/modal de detalhes aberto ao clicar no card**; o clique em todo o card deve abrir **nova aba para o perfil correto do jogador no OP.GG**, usando Riot ID (nome + tagline) e região. Sem vínculo Riot válido, não inventar URL; tratar estado indisponível. Manter A07, o perfil interno de usuário do M7Arena para edição e informações relevantes. Remover estatísticas fictícias/zeradas desse catálogo conforme a simplificação original.
- **F01 — Moeda:** **eliminar M7 Points (MP)** como sistema de pontos de jogador, ganhos por vitória, ranking MP e apresentação correspondente; **preservar integralmente a moeda global existente e seus saldos e operações**, mas trocar a apresentação do nome **M7 Coins (MC)** pelo nome **Essência Azul** e o símbolo **E** em todo o produto (carteira, salas, entradas, reservas, prêmios, apostas, depósitos, saques, histórico, administrações, notificações e textos de regras). **Trata-se de alteração de denominação visual, não conversão de valores**. Não alterar valores, tarifas, reservas, lógica financeira ou banco por simples substituição de strings; manter contratos técnicos internos `mc` enquanto necessário. O **PDL dos times permanece** (B05/E08). A Essência Azul aqui é moeda **interna da plataforma M7Arena**, não a essência do cliente oficial de League of Legends.
- **Efeito transversal:** descrições dos itens F02–F10 e H01/H08 ainda citam "MC" por refletirem o nome do catálogo original; na UI nova deverão dizer **Essência Azul (E)**. F05 deverá exibir E. Não renomear `entry_mp`/`mpoints` sem mapear: em contextos legados representam MC, não MP.

## 2. Resumo quantitativo
| Categoria | Manter | Simplificar | Remover | Total |
|---|---:|---:|---:|---:|
| A — Conta, identidade e acesso | 9 | 1 | 1 | 11 |
| B — Times e recrutamento | 5 | 0 | 2 | 7 |
| C — Salas casuais e apostadas | 12 | 0 | 4 | 16 |
| D — Salas de times e campeonato | 8 | 0 | 0 | 8 |
| E — Campeonatos | 10 | 0 | 0 | 10 |
| F — Economia e apostas | 8 | 2 | 3 | 13 |
| G — Conteúdo, streams e notificações | 5 | 2 | 3 | 10 |
| H — Administração | 4 | 3 | 2 | 9 |
| **Total** | **61** | **8** | **15** | **84** |

## 3. Matriz completa — 84/84 decisões
### A — Conta, identidade e acesso
| ID | Funcionalidade | Decisão |
|---|---|---|
| A01 | Cadastro e login | **MANTER** |
| A02 | Login com Google | **MANTER** |
| A03 | Sessão e logout | **MANTER** |
| A04 | Termos de uso e +18 | **MANTER** |
| A05 | Recuperação de senha | **MANTER** |
| A06 | Rotas antigas de recuperação | **REMOVER** |
| A07 | Perfil do jogador | **MANTER** |
| A08 | Vínculo com a Riot | **MANTER** |
| A09 | Catálogo de jogadores | **SIMPLIFICAR** |
| A10 | VIP (selo e status) | **MANTER** |
| A11 | Cargos e permissões | **MANTER** |

### B — Times e recrutamento
| ID | Funcionalidade | Decisão |
|---|---|---|
| B01 | Criação e edição de times | **MANTER** |
| B02 | Lineup e elenco do time | **MANTER** |
| B03 | Convites e solicitações | **REMOVER** |
| B04 | Saída e transferência de liderança | **MANTER** |
| B05 | Ranking PDL e estatísticas dos times | **MANTER** |
| B06 | Página pública do time | **MANTER** |
| B07 | Painel antigo de recrutamento LFT/LFP | **REMOVER** |

### C — Salas casuais e apostadas
| ID | Funcionalidade | Decisão |
|---|---|---|
| C01 | Vitrine de salas | **MANTER** |
| C02 | Criação de salas | **MANTER** |
| C03 | Entrar, sair e trocar de vaga | **MANTER** |
| C04 | Confirmação de presença | **MANTER** |
| C05 | Draft de campeões (ban/pick) | **MANTER** |
| C06 | Códigos de partida | **MANTER** |
| C07 | Verificação automática pela Riot | **MANTER** |
| C08 | Séries 5v5 MD1/MD3/MD5 | **MANTER** |
| C09 | Prêmios, empates e cancelamentos | **MANTER** |
| C10 | Chat da sala | **MANTER** |
| C11 | Espectadores e visitantes | **MANTER** |
| C12 | Revisão manual pelo administrador | **REMOVER** |
| C13 | Prints de resultados | **REMOVER** |
| C14 | Contestação de resultados | **REMOVER** |
| C15 | Exclusão administrativa de salas | **MANTER** |
| C16 | Sala Time vs Time antiga | **REMOVER** |

### D — Salas de times e campeonato
| ID | Funcionalidade | Decisão |
|---|---|---|
| D01 | Criação automática de salas de campeonato | **MANTER** |
| D02 | Entrada de times, PRONTO e escolha de lado | **MANTER** |
| D03 | Draft Fearless | **MANTER** |
| D04 | Séries MD1, MD3 e MD5 de campeonato | **MANTER** |
| D05 | Código da partida e acesso restrito | **MANTER** |
| D06 | Transmissão ao vivo da sala | **MANTER** |
| D07 | Reset administrativo da sala | **MANTER** |
| D08 | Scrim Time vs Time atual | **MANTER** |

### E — Campeonatos
| ID | Funcionalidade | Decisão |
|---|---|---|
| E01 | Listagem de campeonatos | **MANTER** |
| E02 | Criação e edição de campeonatos | **MANTER** |
| E03 | Inscrição e aprovação de times | **MANTER** |
| E04 | Grupos e sorteio | **MANTER** |
| E05 | Cronograma e agendamento | **MANTER** |
| E06 | Chaveamento mata-mata | **MANTER** |
| E07 | Classificação e desempate | **MANTER** |
| E08 | PDL e ranking de times | **MANTER** |
| E09 | Salas e verificação de jogos do campeonato | **MANTER** |
| E10 | Painel de administração do campeonato | **MANTER** |

### F — Economia e apostas
| ID | Funcionalidade | Decisão |
|---|---|---|
| F01 | Carteira MC e M7 Points | **SIMPLIFICAR** |
| F02 | Depósito de MC via Pix | **MANTER** |
| F03 | Confirmação automática dos pagamentos | **MANTER** |
| F04 | Saque de MC via Pix | **MANTER** |
| F05 | Ajuste de saldo pelo administrador | **SIMPLIFICAR** |
| F06 | Histórico interno de transações | **MANTER** |
| F07 | Reserva de MC nas salas apostadas | **MANTER** |
| F08 | Cálculo de prêmios e taxas | **MANTER** |
| F09 | Apostas individuais (desafios) | **MANTER** |
| F10 | Verificação automática de apostas | **MANTER** |
| F11 | Dashboard financeiro | **REMOVER** |
| F12 | Compra e assinatura VIP | **REMOVER** |
| F13 | Programa de indicação (referral) | **REMOVER** |

### G — Conteúdo, streams e notificações
| ID | Funcionalidade | Decisão |
|---|---|---|
| G01 | Notícias e atualizações | **REMOVER** |
| G02 | Highlights e vídeos | **MANTER** |
| G03 | Estatísticas antigas de jogadores | **REMOVER** |
| G04 | Vitrine de transmissões ao vivo | **SIMPLIFICAR** |
| G05 | Agenda de transmissões de campeonato | **MANTER** |
| G06 | Live avulsa de streamer | **MANTER** |
| G07 | Notificações do sino | **SIMPLIFICAR** |
| G08 | Sistema antigo de broadcasts | **REMOVER** |
| G09 | Prévia de links compartilhados | **MANTER** |
| G10 | Páginas institucionais e tutorial | **MANTER** |

### H — Administração
| ID | Funcionalidade | Decisão |
|---|---|---|
| H01 | Dashboard administrativo | **MANTER** |
| H02 | Gerenciamento de cargos | **SIMPLIFICAR** |
| H03 | Painel de contatos dos times | **SIMPLIFICAR** |
| H04 | Punições, advertências e banimentos | **MANTER** |
| H05 | Recuperação de senha pelo administrador | **MANTER** |
| H06 | Revisão de partidas e contestações | **REMOVER** |
| H07 | Dashboard financeiro | **REMOVER** |
| H08 | Administração de saques Pix | **MANTER** |
| H09 | Uploads de imagens | **SIMPLIFICAR** |

## 4. Escopo esperado de cada simplificação
| ID | Escopo proposto para validar, não autorizado automaticamente |
|---|---|
| A09 | Preservar diretório e busca por nome/elo/rota; **eliminar popup/modal ao clicar no card** e **abrir nova aba OP.GG** com perfil correto do Riot ID (gameName#tagLine) e região. Sem Riot ID válido, tratar indisponibilidade; remover indicadores fictícios. **Não remover A07**, perfil interno de edição. |
| F01 | Eliminar MP como pontos/ranking de jogadores e quaisquer ganhos por vitória; **renomear a apresentação global da moeda MC para Essência Azul (E)** sem alterar os saldos, a equivalência, transações, reservas ou taxas. Manter internamente `mc` enquanto seguro. Nunca apagar por texto `mp` sem mapear aliases `matches.entry_mp`, `entryMp`, `mpoints` que representam MC; preservar PDL (B05/E08). |
| F05 | Unificar ajuste administrativo da moeda, exibida como **Essência Azul (E)**, removendo aba/rótulo duplicado “MPoints”; manter checagem de cargo, trilha de auditoria, idempotência e contratos internos sem migração precipitada. |
| G04 | Simplificar vitrine de lives, garantindo compatibilidade com G05/G06/D06; revisar live de scrim que não aparece e pode ser desativada. |
| G07 | Retirar avisos e lógica de convites B03; manter notificações persistentes de apostas e seu estado lido/não lido. |
| H02 | Escolher um único ponto de gestão de cargos; manter APIs e permissões de A11; verificar `moderador`/`caster` e flags não utilizadas. |
| H03 | Escolher apenas uma tela de contatos dos times; preservar dados, edição em B01/B06, cópia e CSV se úteis. Não reviver convites B03. |
| H09 | Manter uploads de logos dos times e imagens de campeonatos; retirar somente fluxo de **novos prints de partidas** ligado a C13; preservar arquivos antigos até política de retenção e checagem. |

## 5. Remoções aprovadas e dependências
| Remoção | Dependências / precauções antes de mexer |
|---|---|
| A06 — rotas antigas | Verificar links antigos de reset/callback; manter A05/H05 e Google A02. Pode ser necessário redirecionamento neutro para evitar quebra desnecessária, sujeito à decisão de produto. |
| B03 — convites/solicitações | Retirar botões de B06, endpoints `team_invites`, geração sintética no sino G07, contadores e textos; preservar B02 para capitão editar lineup e B04 para sair/transferir. Verificar entradas pendentes antes de desligar. |
| B07 — LFT/LFP incompleto | Retirar anúncio falso do Lobby e referências; não confundir com B03. Tabela órfã só após vistoria de dados e autorização de migração. |
| C12/C13/C14/H06 — resultado por revisão, prints e disputas | São partes de **um mesmo conjunto antigo**. Mapear partidas `aguardando_revisao`, `match_prints`, `match_disputas`, saldos MC e jobs/Discord antes de remover; manter encerramento, reembolso e correção de falhas operacionais. **Não tocar em D04**, resultado manual de campeonato. |
| C16 — Time vs Time antigo | Retirar criação `mode=time_vs_time`, UI e rota antiga somente após identificar salas ainda ativas e links históricos; preservar D08 `time_vs_time_livre` e corrigir G09 OG para `/sala-time/:id`. Não apagar histórico financeiro. |
| F11/H07 — financeiro | Um painel duplicado em dois itens; retirar **dashboard e eventualmente endpoint sem uso**, sem retirar F02–F10, H01 ou H08. |
| F12 — venda VIP | A venda/assinatura não está implementada; limpar referências obsoletas sem apagar A10 (`is_vip`, selo, status existente). Validar dados existentes antes de qualquer limpeza de DB. |
| F13 — referral | Sem fluxo na aplicação; retirar referências inativas; `referral_events` e `users.referred_by` só em migração posterior verificada. |
| G01 — notícias | Retirar seção do Lobby e CRUD de notícias do Admin; preservar G02 highlights. Não excluir dados editoriais existentes sem verificação. |
| G03 — player_stats antigo | Retirar API/código desconectado; não confundir com dados Riot, ranking PDL nem card A09 (que passará a abrir OP.GG). Verificar existência de linhas históricas. |
| G08 — broadcasts antigo | Retirar tabela/código inativo depois de verificação; preservar `transmissoes` ativas de G04–G06/D06. |

## 6. Conflitos e decisões cruzadas a respeitar
1. **B03 removido × B02/B06/G07 mantidos:** fluxo de entrada em times passará pela edição do lineup pelo capitão. Não deixar botões/API de solicitação no perfil do time ou no sino. Confirmar funcionamento completo de adição/removal manual.
2. **A10 VIP mantido × F12 venda VIP removida:** manter selo sem criar assinaturas. Atualmente não há concessão/expiração automática; tratar essa limitação como constatação, não como autorização para inventar sistema.
3. **C12–C14/H06 removidos × C09/F07/F08 preservados:** fechamentos automáticos da Riot, empates, cancelamentos e reservas MC precisam cobrir estados pendentes. D04 (resultado manual campeonato) permanece.
4. **C16 removido × D08/G09 mantidos:** nova scrim é outro modo/modelo; substituir links/OG/rotas com cautela, preservar histórico.
5. **F01 MP removido × MC renomeado visualmente para Essência Azul (E) × PDL mantido:** `user_wallets.mp` é diferente de `matches.entry_mp`/`mpoints` (aliases técnicos do saldo MC). A moeda fica com mesmos saldos/valores; só sua denominação pública muda. PDL de times é outro sistema e fica.
6. **F11 e H07 são o mesmo dashboard:** não executar duas exclusões de backend independentes. H01 (visão geral) continua e deve ser auditado pois subconta MC reservado.
7. **A09 catálogo simplificado × A07 perfil interno mantido:** só o clique no card do catálogo abre OP.GG em nova aba; o jogador ainda edita seu próprio perfil no M7Arena. Validar Riot ID e região, e não direcionar ao perfil errado.
8. **G04 vitrine simplificada × G05/G06/D06 mantidos:** corrigir incompatibilidade das lives de scrim e verificar vínculos da live avulsa no modo campeonato sem remover os fluxos necessários.
9. **H02 simplificado × A11 mantido:** retirar interface duplicada sem perder checks reais; atenção a cargos backend sem opção no front e a flags inertes.
10. **H09 simplificado × B01/E02 mantidos:** preservar buckets `team-logos` e `public-images`; prints legados podem existir nos uploads e banco.
11. **G01 removido × G02 mantido:** retirar notícias sem afetar vídeos/highlights e seções do Lobby.
12. **E02/E03 mantidos × vulnerabilidades atuais:** manutenção inclui corrigir autorização de organizador/dono; não remover capacidade de inscrever/aprovar times.

## 7. Achados relevantes fora das 84 decisões (NÃO autorizados para remoção automática)
- **Segurança**: `GET /api/profiles/:id` público devolve chave Pix/nome; endpoint legado `POST /api/wallet/deposit` aceita valores enviados pelo cliente; permissões de torneios E02/E03 precisam de checagens. Tratar em correções pequenas, prioritárias e testadas.
- **Tierlist M7 Academy** (página/endpoint/tabela desconectados), webhook Discord de revisão, `audit_logs`, `tournament_standings` e outros endpoints/colunas órfãos: pedir decisão específica após inventário; não presumir que a classificação A–H autorizou excluir tudo.
- **Banco/migrations**: 48 tabelas na VPS, mas histórico Drizzle inconsistente (14 registros contra 33 no journal/35 SQL); não rodar `drizzle-kit generate/migrate` contra produção como parte da limpeza.
- **Backup**: baseline/tags e restauração real do dump na própria VPS **confirmados pelo relatório do agente**. Realtime preservado via `docker export` de rootfs, pois `docker commit` falhou; a imagem exata ainda não é reproduzível. Backups automáticos antigos de 20 bytes continuam inválidos; dump está apenas na VPS.
- **Dados e história**: preservar histórico financeiro/ledger, pagamentos, saques, IDs de salas, rastreabilidade dos resultados e conteúdos existentes até decisão explícita de retenção.

## 8. Plano de execução local (sem autorização de mudanças nesta etapa)
### Etapa 0 — Gate do baseline
**CONCLUÍDA conforme o relatório do agente:** tags `baseline-producao-2026-11-04` (`8e498dc`), `baseline-documentos-2026-11-04` (`8e848f6`) e `stash-backup-2026-10-31` (`ae91584`); branch `simplificacao-m7arena` em `8e848f6`; backup na VPS `/root/backups/baseline-2026-11-04/`; restore `RESTORE_OK` (48 tabelas, contagem idêntica); produção intacta. Limitação do realtime e backup automático defeituoso permanecem riscos documentados.
### Etapa 1 — Ambiente local confiável
Trabalhar só na branch de simplificação; isolar base de dados/portas/volumes/segredos, preferindo banco sintético ou sanitizado. Desativar jobs externos e pagamentos/webhooks reais; não conectar localhost à produção. Capturar build/typecheck/testes atuais e smoke tests como referência (falhas preexistentes listadas). Não executar migrations automáticas.
### Etapa 2 — Inventário de dependências e dados
Para cada item REMOVER/SIMPLIFICAR, localizar imports, rotas, endpoints, hooks, serviços, workers, jobs, tipos e tabelas; pesquisar dados históricos em queries **somente leitura** na VPS, nunca apagar. Confirmar consumidores de APIs aparentemente órfãs e estados financeiros/partidas pendentes. Produzir mapa arquivo→funcionalidade e riscos.
### Etapa 3 — Contenção de riscos importantes
Planejar correções isoladas e testáveis: Pix exposto no perfil público, autorização real em E02/E03 e endpoint de depósito legado. Essas correções são relevantes independentemente da simplificação; não executar/deploy sem revisão da mudança.
### Etapa 4 — Pacotes pequenos de simplificação
**4A UI/duplicação:** A09 (card → nova aba OP.GG, sem popup), F05, H02, H03, G07, H09. **4B fluxos desconectados/estáticos:** A06, B07, G01, G03, G08, F11/H07, F12, F13. **4C núcleo compartilhado:** F01 (retirar MP e renomear visualmente MC → Essência Azul/E sem conversão monetária e sem tocar PDL); B03 (times + notificações); C16 (legado × scrim/OG); C12/C13/C14/H06 (revisão × escrow/autoresultado). **4D streams:** G04 × G05/G06/D06, priorizando que scrims continuem visíveis. Revisar fronteiras das etapas, podem ser reordenadas conforme dependências reais.
### Etapa 5 — Validações de regressão por domínio
- Conta: senha, Google mock/ambiente de teste, sessão/logout, recuperação A05/H05, Riot, card de jogadores abrindo OP.GG em nova aba (sem popup; Riot ID/região corretos) e selo VIP.
- Times: criar/editar, escalar titular/reserva/coach/convidado, adicionar diretamente via lineup, transferir liderança/sair, exibir PDL; nenhum botão de convite restante.
- Salas: criar 1v1/ARAM/5v5, entrar/sair, presença, MD1/MD3/MD5, ban/pick, código restrito, Riot, encerramento, empate, cancelamento, escrow/liberação correta; testar idempotência.
- Campeonatos/scrim: autorizações, inscrições, sorteio, agenda, WO, classificação, PDL, mata-mata, Fearless, MD1/3/5, resultado automático e **manual D04**, reset D07; Time vs Time novo sem dependência do antigo.
- Economia: pedido de depósito Pix (mock), webhook idempotente, Essência Azul (E) na interface, saldos antigos MC/reservados e histórico intactos, ajustes administrativos com ledger, apostas, saques e rejeição/reembolso; sem dashboard financeiro. Validar a consistência de nomenclatura por todas as telas sem mudar valor ou conversão.
- Streams/conteúdo: highlights, agenda, live avulsa, live da sala/scrim na vitrine, notificações de apostas, OG de salas novas, páginas institucionais, contatos; sem notícias ou convites.
- Conferência de segurança: sem chave Pix em endpoint público; permissões de campeonato por organizador/dono; nenhum endpoint legado acionável indevidamente.
### Etapa 6 — Revisão final e integração posterior
Cada pacote: diff pequeno, testes, revisão humana e commit na branch de trabalho. Não fazer deploy nem mexer na `main` automaticamente. Só depois de testes/aceite, preparar plano de merge e janela de deploy, com rollback do código e do banco. Tabelas/colunas legadas não devem ser apagadas no mesmo pacote sem migração separada e confirmação de dados.

## 9. Próxima decisão prática
**Baseline confirmado.** Próxima ação: enviar ao agente um pedido de inventário somente leitura de arquivos e dependências por pacote, incluindo mapeamento global de MC → Essência Azul (E) e card → OP.GG; revisar o primeiro pacote antes de liberar alterações em localhost.

---
**Registro de aprovação:** decisões de produto aprovadas A01–H09, incluindo ressalvas A09 e F01; **este arquivo é planejamento e não autoriza sozinho exclusão de dados, migrations ou deploy**.
