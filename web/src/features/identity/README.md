# Conta — login, cadastro e recuperação

[Login](pages/Login.tsx) atende `/login`; alterna formulário de login/cadastro e
inicia Google pela navegação HTTP existente. [RedefinirSenha](pages/RedefinirSenha.tsx)
atende `/redefinir-senha`, lê token da URL, valida antes de mostrar o formulário
e consome o link pelo SDK. Ambas são rotas públicas/lazy em [App](../../App.tsx).

## Fluxos e dependências

- [AuthContext](../../contexts/AuthContext.tsx) mantém usuário/loading,
  restaura por `auth.me` e fornece login, signup, signOut e refetch.
  É infraestrutura compartilhada por todas as features; não está dentro da página.
- [Backend de identidade](../../../../api/src/modules/identity/README.md) possui
  as rotas `/api/auth/*` e `/api/terms/accept`. O cookie é httpOnly; o cliente
  usa credentials, não lê nem persiste o token de sessão em localStorage.
- [PerfilContext](../../contexts/PerfilContext.tsx) carrega perfil, Riot,
  carteira e vínculos após autenticação. [RoleContext](../../contexts/RoleContext.tsx)
  apresenta cargos. Visibilidade/PrivateRoute não substituem autorização na API.
- Recuperação é gerada pelo proprietário no [painel Admin](../admin/README.md#recuperação-de-senha).
  Não há fluxo autônomo de envio de email. Link inválido/expirado e senha curta
  conservam mensagens e respostas atuais; redefinir revoga sessões no servidor.
- Vínculo Riot é a [feature Perfil](../profile/README.md), não cadastro de login.

## Alteração e verificação

Preserve redirecionamentos, query de erros do OAuth, validação do token,
estados de loading e submissão e desenho das páginas. Reutilize AuthContext/SDK
em vez de implementar outro gerenciador de sessão.

Não há teste DOM específico dessas páginas. Imports/tipos são verificados por
`npm.cmd run lint` e `npm.cmd run build` em `web/`; use somente o necessário à
alteração. O teste backend de recuperação é descrito no README do servidor.
Não realizar login ou redefinição de contas reais para validar organização.
