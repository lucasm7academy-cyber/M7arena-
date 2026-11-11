# Administração — abas específicas

As quatro abas ficam em `components/`. O painel principal está em
[Admin](pages/Admin.tsx), que coordena a navegação e passa `adminCargo`
(`CargoAdmin`) a cada aba. O [App](../../App.tsx) mantém `/admin` com rota privada
e suspense, fora do layout público do site.

- [AdminCargos](components/AdminCargos.tsx), export `AbaCargos`: lista cargos,
  associa contas Riot via `players.byIds`, busca e edição; a interface de edição
  exige proprietário e conserva as chamadas `adminCargos` do SDK.
- [AdminContatos](components/AdminContatos.tsx), export `AbaContatos`: consulta
  times por ranking, filtra nome/tag/contatos, mostra WhatsApp/Discord e oferece
  cópia e CSV. Usa `useSound` compartilhado; acesso visual admin/proprietário.
- [AdminPunicoes](components/AdminPunicoes.tsx), export `AbaPunicoes`: busca,
  histórico, advertência/remoção, ban/desban e modal com motivo. Preserva avisos,
  condições existentes e chamadas `adminPunicoes`, sem reimplementar as regras.
- [AdminSenhas](components/AdminSenhas.tsx), export `AbaSenhas`: busca usuários,
  solicita link de recuperação, exibe validade e cópia. Interface restrita ao
  proprietário; chamadas `adminSenhas` permanecem no SDK.

O contrato de recuperação e suas dependências estão na seção abaixo.

As quatro recebem somente `adminCargo`; estados, efeitos, formulários e handlers
permanecem em suas abas. Dependências compartilhadas:
[SDK](../../lib/api.ts), [cargos/permissões](../../config/adminPermissoes.ts) e
[som](../../hooks/useSound.ts). `PerfilContext` é usado pelo painel principal.
Contatos dependem de Times; Cargos também consulta jogadores. Não mover SDKs,
identidade ou regras de outros domínios junto com ajustes dessas interfaces.

Na página permanecem dashboard, estatísticas, saldo, ranking, highlights, refresh
de elos e seus estados/efeitos/handlers, sem recortes. Ela usa `PerfilContext` e
SDK para compor o painel; filtros, carregamentos, timers e cleanup devem manter
o ciclo de vida atual. A configuração compartilhada controla as opções visíveis.

Permanecem fora do módulo: [SaquesPix](../economy/components/SaquesPix.tsx), permissões, SDK,
contextos e a [fronteira HTTP administrativa](../../../../api/src/modules/admin/README.md).
A página importa Saques Pix no local atual;
Times, Jogadores, Conteúdo e Carteira continuam responsáveis por seus serviços.
Nenhuma dessas responsabilidades foi movida com a página.

Preserve permissões e visibilidade existentes, payloads, ordem das operações,
validações, mensagens, DOM e classes. Para comparar callbacks, use identidades
fictícias e SDK simulado; não altere cargos, punições, contatos ou senhas reais,
nem envie mensagens ou links. A validação visual não substitui autorização da API.

Validação existente em `web/`: `npm run lint` e `npm run build`.
Não há suíte frontend específica dessas abas. Comparação SSR/mocks não homologa
permissões integradas, layout ou interação real; essas verificações permanecem
pendentes em ambiente isolado, sem operações administrativas reais.

## Recuperação de senha

O comportamento foi conferido nos routers
[administrativo](../../../../api/src/modules/admin/password-reset-routes.ts) e
[público](../../../../api/src/modules/identity/password-reset-routes.ts), no
[serviço](../../../../api/src/lib/password-reset.ts) e no
[SDK](../../lib/api.ts), namespaces `adminSenhas` e `authReset`.

| Método / caminho | Contrato atual |
|---|---|
| `POST /api/admin/usuarios/:userId/reset-link` | Sessão e cargo `proprietario`; alvo com UUID válido e sem `deletedAt`. Retorna `{ url, expira_em }`. Sem sessão: 401 `nao_autenticado`; cargo insuficiente: 403 `apenas_proprietario`; alvo inválido/ausente: 404 `usuario_nao_encontrado`. |
| `GET /api/auth/reset-password/:token` | Valida sem consumir. Sucesso `{ valido: true, email }` mascarado; token inexistente, expirado ou usado: 410 `link_invalido_ou_expirado`. |
| `POST /api/auth/reset-password` | Body `{ token, password }`. Dados ausentes: 400 `token_ausente`; senha curta: 400 `senha_curta`; token inválido: 410; sucesso `{ ok: true }`. |

O token tem 32 bytes aleatórios e validade de 24 horas; somente o hash SHA-256 é
persistido. Um novo link elimina os tokens anteriores. Consumo atômico via
`UPDATE ... RETURNING`, gravação bcrypt, remoção de sessões e eliminação dos tokens
ocorrem na mesma transação. Mínimo de oito caracteres; senha curta não queima o
link. O proprietário também perde sua sessão se redefinir a própria senha.

A API resolve permissão e origem do link pelo host/protocolo com fallback do
servidor. O [bootstrap](../../../../api/src/index.ts) monta o router específico
antes do administrativo geral. A página
[RedefinirSenha](../identity/pages/RedefinirSenha.tsx) consome o link e retorna ao login.
Não há envio automático de e-mail ou recuperação em lote no fluxo atual.

O [teste de serviço](../../../../api/test/password-reset.test.ts) cobre
permissão, hash, expiração, uso único e revogação com PGlite. Em `api/`, usando
conexão auxiliar isolada em loopback, execute
`.\node_modules\.bin\tsx.cmd --test --test-concurrency=1 test/password-reset.test.ts`.
Isso não homologa automaticamente os handlers autenticados ou a interface.
Não gerar links, redefinir contas ou enviar mensagens reais durante testes.
Os serviços backend continuam compartilhados, fora deste módulo frontend.
