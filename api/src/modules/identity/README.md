# Identidade — login, sessão, termos e recuperação

## Responsabilidade e entradas

Autenticar a conta M7Arena por senha ou Google, devolver a identidade da sessão,
registrar aceite de termos e consumir a recuperação de senha. A conta Riot é
responsabilidade de [Perfis](../profiles/README.md), não um provedor de login.

| Arquivo | Entrada no bootstrap / contrato |
|---|---|
| [routes.ts](routes.ts) | `authRouter` em `/api/auth`; `termsRouter` em `/api/terms`. |
| [google-routes.ts](google-routes.ts) | `googleAuthRouter` em `/api/auth`, após recuperação. |
| [password-reset-routes.ts](password-reset-routes.ts) | `passwordResetRouter` em `/api/auth`, após o router principal. |

## Endpoints atuais

| Método e caminho completo | Comportamento |
|---|---|
| `POST /api/auth/login` | Email/senha, bcrypt, criação da sessão; retorna `{ user }` com cargos. |
| `POST /api/auth/register` | Email/senha/displayName obrigatórios; normaliza email, recusa duplicado, cria usuário/carteira/sessão e retorna 201. |
| `POST /api/auth/logout` | Remove a sessão identificada pelo cookie e limpa o cookie; `{ success: true }`. |
| `GET /api/auth/me` | Cookie ou Bearer válido; `{ user }`; ausência/expiração retorna 401 `{ user: null }`. |
| `POST /api/terms/accept` | Sessão obrigatória; grava o primeiro aceite e retorna `{ ok, termos_aceitos_em }`. |
| `GET /api/auth/google` | Cria state com cookie de 10 minutos e redireciona ao Google; 503 se não configurado. |
| `GET /api/auth/google/callback` | Valida state, troca code, resolve usuário por identidade/email, cria sessão e redireciona ao lobby; falha redireciona ao login. |
| `GET /api/auth/reset-password/:token` | Valida link sem consumir; email mascarado ou 410. |
| `POST /api/auth/reset-password` | Consumo único, senha mínima de oito caracteres, troca de senha e revogação de sessões. |

## Contratos compartilhados

Sessão de 30 dias em `m7_session`, httpOnly, sameSite=lax e secure em produção.
O login por senha tem criação/cookie locais; OAuth usa [session.ts](../../lib/session.ts).
Outros routers ainda resolvem a sessão por helpers locais, `match-flow` ou `content`.
Este módulo não é middleware universal e não uniformiza essas implementações.
Logout lê o cookie; não presumir que ele revogue um Bearer isolado.

O [serviço de recuperação](../../lib/password-reset.ts) é compartilhado com
[Administração](../admin/README.md), que gera os links. Token puro não é persistido;
hash, validade de 24h, consumo transacional e revogação são descritos no
[contrato de recuperação](../../../../web/src/features/admin/README.md#recuperação-de-senha).
Schemas de identidade e carteira continuam em `db/schema`; criação de conta não
deve ser confundida com concessão de permissões administrativas.

## Consumidores e verificação

[Login/RedefinirSenha](../../../../web/src/features/identity/README.md),
[AuthContext](../../../../web/src/contexts/AuthContext.tsx), SDK `auth`/`authReset`
e aceite de termos nas interfaces de elegibilidade. OAuth usa navegação do browser,
não fetch do token Google pelo frontend.

Para alteração documental, confira referências. Para imports, build da API.
Para recuperação, `test/password-reset.test.ts`; autorização administrativa tem
`test/admin-router.test.ts`. Use o [isolamento da API](../../../../README.md#testes-da-api).
Não há cobertura integrada completa de cadastro/login/OAuth; não autenticar contas
reais como teste de reorganização.
