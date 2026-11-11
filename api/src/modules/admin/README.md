# Administração — fronteira HTTP

Este módulo reúne cargos, busca administrativa de usuários, advertências,
banimento e geração de links de recuperação. O [bootstrap](../../index.ts) monta
ambos em `/api/admin`: [recuperação](password-reset-routes.ts) primeiro,
[administração](routes.ts) depois. A autorização continua em cada handler,
após os middlewares globais. Este módulo não é todo o backend do painel.

## Endpoints e autorização

Todos exigem sessão válida do cookie `m7_session` ou de `Bearer`.
O servidor consulta os cargos a cada operação.

| Método e caminho, após `/api/admin` | Cargo necessário | Contrato principal |
|---|---|---|
| `POST /usuarios/:userId/reset-link` | `proprietario` | UUID válido e alvo não excluído; retorna `{ url, expira_em }`. |
| `GET /cargos` | `admin` ou `proprietario` | Até 500 usuários; shape legado com `user_id`, `display_name` e `cargo`. |
| `PUT /cargos/:userId` | `proprietario` | Recebe `p_cargo` ou `cargo`; mantém o mapeamento de cargos e retorna `{ ok: true }`. |
| `GET /usuarios` | `admin` ou `proprietario` | `q` vazio retorna `[]`; busca parcial por nome, email ou Riot ID, até 20 resultados. |
| `GET /advertencias/:userId` | `admin` ou `proprietario` | Lista advertências por criação decrescente. |
| `POST /advertencias` | `admin` ou `proprietario` | `userId` e `motivo`; transação registra advertência e aplica a regra compartilhada de ban automático. |
| `DELETE /advertencias/:id` | `admin` ou `proprietario` | Remoção auditada/idempotente; não desfaz banimento automaticamente. |
| `POST /usuarios/:userId/ban` | `admin` ou `proprietario` | Ban manual com auditoria e motivo. |
| `POST /usuarios/:userId/unban` | `admin` ou `proprietario` | Reativa e limpa os campos de ban/suspensão conforme o handler existente. |

O router geral usa erros `{ error }`; recuperação usa `{ erro }`. Preserve as
diferenças esperadas pelo cliente. A listagem de cargos usa `DISTINCT ON` e
ordenação textual descendente do cargo; não é uma hierarquia formal de permissões.

## Dependências e consumidores

- A [feature administrativa](../../../../web/src/features/admin/README.md) usa o
  [SDK](../../../../web/src/lib/api.ts), namespaces `adminCargos`, `adminPunicoes`
  e `adminSenhas`. A recuperação pública usa `authReset` e permanece em
  [routes/password-reset.ts](../identity/password-reset-routes.ts).
- [match-flow](../../lib/match-flow.ts) fornece autenticação à recuperação e
  remoção de advertências ao router geral. [Elegibilidade](../../lib/elegibilidade.ts)
  mantém a regra de ban automático também usada por Partidas. São compartilhados.
- [password-reset](../../lib/password-reset.ts) mantém geração, hash, validade,
  consumo transacional, troca de senha e revogação de sessões. O link é retornado
  ao proprietário, sem envio automático de email. Consulte o
  [contrato completo](../../../../web/src/features/admin/README.md#recuperação-de-senha).
- Schemas de [identidade](../../../../db/schema/identidade.ts) e
  [advertências](../../../../db/schema/apostas.ts) são compartilhados.
  Acesso a sessão/cargos ainda se repete em outros routers; não foi centralizado.
- Saldo e saques pertencem à economia; highlights e contatos a Conteúdo;
  atualização de elos a Jogadores. Seus serviços permanecem fora deste módulo,
  assim como carteira, ledger, Draft e Realtime.

## Validação e limites

Na pasta `api/`, com dependências já instaladas:

```powershell
$env:DATABASE_URL = 'postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY = ''
.\node_modules\.bin\tsx.cmd --test --test-reporter=spec --test-concurrency=1 test/admin-router.test.ts test/password-reset.test.ts test/elegibilidade.test.ts test/profile-privacidade.test.ts
npm.cmd run build
```

[admin-router.test.ts](../../../test/admin-router.test.ts) monta os routers reais
em HTTP local com leituras simuladas, proibindo escritas e conexões. Verifica os
nove registros, acesso anônimo/comum, restrições do proprietário, shape da
listagem e alvos inválidos/ausentes no reset. Não testa mutações administrativas
bem-sucedidas. [password-reset.test.ts](../../../test/password-reset.test.ts) e
[elegibilidade.test.ts](../../../test/elegibilidade.test.ts) exercitam serviços
em PGlite isolado. Não homologam navegador, WebSocket, produção ou operações
financeiras reais. Consulte também a [orientação de testes](../../../../README.md#testes-da-api).
