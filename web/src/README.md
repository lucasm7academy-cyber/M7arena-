# Frontend — composição e responsabilidades compartilhadas

## Entrada e padrão

[main.tsx](main.tsx) inicia React; [App.tsx](App.tsx) compõe providers, Router,
lazy/suspense, rotas públicas/privadas e o tratamento global de erro/chunk.
As páginas ativas estão em `features/<domínio>/pages`; componentes específicos,
hooks e serviços ficam dentro da feature. O [índice](../../docs/modules/INDEX.md)
liga cada funcionalidade às rotas e ao README correspondente.

## Compartilhado: procure aqui antes de criar outro

| Entrada | Contrato / consumidores |
|---|---|
| [contexts/AuthContext](contexts/AuthContext.tsx) | Usuário, restauração de sessão, login/signup/signOut/refetch. Providers e todas as features autenticadas. |
| [contexts/PerfilContext](contexts/PerfilContext.tsx) | Perfil, Riot, cargo, saldo e times; composição para cabeçalho/Perfil/Admin/Salas/Streams. |
| [contexts/RoleContext](contexts/RoleContext.tsx) | Apresentação dos cargos/permissões. Não autoriza ações no servidor. |
| [contexts/VerificacaoContext](contexts/VerificacaoContext.tsx) | Verificação de propriedade da conta Riot por troca de ícone: estado localStorage, primeiro check 2s, polling 30s e timeout 240s; usa API própria para vínculo. Não verifica resultado de partidas. |
| [lib/api.ts](lib/api.ts) | HTTP `/api`, credentials=include, JSON/FormData, leitura de error/erro e namespaces/tipos comuns. |
| [lib/api-content.ts](lib/api-content.ts) | Mapeamento de highlights entre contrato HTTP e interface. |
| [api/riot.ts](api/riot.ts), [api/player.ts](api/player.ts) | Proxy Riot/DDragon e sincronização da própria conta. Sem segredos no browser. |
| [api/salamod1.ts](api/salamod1.ts) | Métodos/helpers de sala, modos e mensagens de erro usados por salas e histórico. |
| [hooks/useSalaSimples](hooks/useSalaSimples.ts) | Estado/participação/relógios da sala comum; ligação com SDK/Realtime. |
| [hooks/useSalaRealtime](hooks/useSalaRealtime.ts) | Transporte `/ws` compartilhado pelas salas comum e de times; [protocolo](../../api/src/realtime/README.md). |
| [components/draft](components/draft/) | DraftRoom, tipos, posições e som para ambas as salas; recebe estado/callbacks. |
| [components/partidas](components/partidas/) | VagaSlot, resultado e modais de elegibilidade reutilizados; não é a pasta das páginas de Salas. |
| [components/players/playerMeta](components/players/playerMeta.ts) | Tipos/roles/elos/ícones usados por Jogadores e Times. |
| [components/layout/LayoutWrapper](components/layout/LayoutWrapper.tsx) | Navegação, layout público, sino e abertura do modal de economia por evento. |
| [components/notifications/VerificacaoStatus](components/notifications/VerificacaoStatus.tsx) | Apresenta andamento da verificação de ícone Riot; não é o sino persistente. |
| [components/ui](components/ui/README.md) | CutCard, moeda e VIP; contrato visual compartilhado. |
| [hooks/useSound](hooks/useSound.ts), [lib](lib/) | Som, relógio, OP.GG, notificações sonoras, rota de sala/senha e demais helpers transversais. |

## Fluxo de dados e limites

`Página → SDK/cliente → API` é o fluxo normal. SalaCampeonato ainda tem fetch
direto documentado no seu README. Não criar outro SDK ou cache antes de conferir
os existentes. `api.ts` concentra muitos tipos/métodos; divisão futura precisa
preservar a mesma interface pública. Há declaração `ApiMatchesSdk.start` sem
implementação runtime/endpoint, sem consumidor encontrado; não tratá-la como ação ativa.

UI não decide saldo, permissão, prazo, resultado ou disponibilidade de vaga.
Preview e contadores são apresentação; persistência/validação vêm da API.
Não modificar design, CSS, fontes ou animações numa reorganização estrutural.

Assets estão em `web/public` e estilos globais em `index.css`; ferramentas em
[web/scripts](../scripts/README.md). A feature Tierlist não tem rota ativa e está
separada no índice. Não inferir funcionalidade publicada de um arquivo existente.

Para paths, use lint/build. Para mudança de ciclo de vida, selecione os
[testes DOM](test/README.md) do fluxo. Documentação exige leitura/conferência,
não execução automática de toda a suíte. Testes visuais/integração são separados.
