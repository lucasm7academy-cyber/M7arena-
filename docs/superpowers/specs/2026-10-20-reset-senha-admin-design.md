# Reset de senha pelo painel admin — Design

**Data:** 2026-10-20 · **ADR:** ADR-090 · **Status:** aprovada e implementada (2026-10-20)

## Contexto

Não existe hoje nenhum caminho para um cliente recuperar a senha. As telas
`ResetHandler` e `ResetPassword` foram desativadas na ADR-011 (o token de
recovery era do GoTrue e o servidor próprio não tem provedor de e-mail), e o
formulário "Esqueceu a senha?" do `Login.tsx` apenas orienta o usuário a falar
com o suporte.

O problema tem dois pesos:

1. **Suporte raro** — cliente esquece a senha e precisa de ajuda pontual.
2. **BLK-001** — os hashes bcrypt não vieram do Supabase, então todo usuário
   migrado tem `password_hash = NULL` e não consegue entrar por e-mail/senha.

O objetivo é dar ao **proprietário** uma ferramenta no painel admin para gerar
um link de uso único e enviá-lo ao cliente por WhatsApp/Discord. O cliente
define a própria senha; o proprietário nunca vê nem escolhe a senha dele.

## Decisões do usuário (aprovadas em 2026-10-20)

| Decisão | Escolha |
|---|---|
| Mecanismo | **Link de uso único** gerado no painel, enviado manualmente ao cliente |
| Quem gera | **Somente cargo `proprietario`** (admin comum recebe 403) |
| Validade | **24 horas** |
| Auditoria | **Não registrar** histórico; nenhuma tabela/aba de auditoria |
| Senha mínima | **8 caracteres** na tela nova (o cadastro continua com 6) |
| Auto-reset | **Permitido** — o proprietário pode gerar link para a própria conta |

## Decisões de arquitetura

### 1. Token opaco, hash no banco

O token é 32 bytes aleatórios em base64url (43 caracteres). O banco guarda
apenas o **SHA-256** dele. Quem ler a tabela não consegue montar o link. O token
puro só existe na resposta da rota que o gerou e no link copiado pelo
proprietário.

### 2. Um link válido por usuário

Gerar um link novo apaga todos os tokens anteriores daquele usuário (usados ou
não). Isso mantém a regra simples — "o último link gerado é o que vale" — e
limpa sozinho linhas expiradas, sem cron.

### 3. Consumo atômico

A troca de senha começa com:

```sql
UPDATE password_reset_tokens
   SET used_at = now()
 WHERE token_hash = $1
   AND used_at IS NULL
   AND expires_at > now()
RETURNING user_id;
```

Se não retornar linha, o link é inválido/expirado/já usado (mesma resposta para
os três casos, para não revelar qual). Só depois da linha reservada o servidor
grava o novo `password_hash`. Duas requisições simultâneas com o mesmo link:
apenas uma consome.

### 4. Troca de senha derruba todas as sessões

Ao definir a senha, o servidor apaga **todas** as linhas de `user_sessions`
daquele usuário. Se a conta estava comprometida, o invasor perde o acesso. O
proprietário que resetar a própria conta também cai e precisa logar de novo.

### 5. URL montada a partir do host real

O link usa o mesmo padrão do OAuth (`auth-google.ts`): `req.protocol` +
`req.get("host")`, com fallback para `APP_URL`. Assim funciona em
`http://localhost:3000` no desenvolvimento e em `https://m7arena.pro` na VPS,
sem fixar domínio.

## Modelo de dados — migration `0032_*` (gerada por `drizzle-kit`)

```sql
CREATE TABLE "password_reset_tokens" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at"    timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;

CREATE INDEX "password_reset_tokens_user_idx"
  ON "password_reset_tokens" USING btree ("user_id");
```

- Registrada em `db/schema/identidade.ts` como `passwordResetTokens`,
  exportada pelo barrel (`db/schema/index.ts`).
- `token_hash UNIQUE` impede colisão/duplicação; o índice por `user_id` cobre a
  limpeza na geração e o delete no consumo.
- **Atenção no generate:** o snapshot mais recente é o `0031`. Se o
  `drizzle-kit` re-emitir DDL de migrations anteriores (problema já visto na
  ADR-021), o SQL da 0032 é editado à mão para conter só o DDL desta feature. A
  cadeia `0000→0032` precisa aplicar limpa no PGlite dos testes.

## API

### Regras no servidor — `api/src/lib/password-reset.ts`

```ts
export type ResultadoReset =
  | { ok: true }
  | { ok: false; erro: "link_invalido_ou_expirado" | "senha_curta" };

export const MIN_SENHA = 8;
export const VALIDADE_MS = 24 * 60 * 60 * 1000;

/** true somente para o cargo proprietario. */
export function podeGerarReset(roles: string[]): boolean;

/** Cria o token, apaga os anteriores do usuário e devolve o token puro + expiração. */
export async function gerarTokenReset(
  d: any,
  userId: string,
  agora?: Date
): Promise<{ token: string; expiresAt: Date }>;

/** Valida sem consumir; devolve o e-mail mascarado para a tela confirmar a conta. */
export async function validarTokenReset(
  d: any,
  token: string,
  agora?: Date
): Promise<{ ok: true; userId: string; emailMascarado: string } | { ok: false; erro: "link_invalido_ou_expirado" }>;

/** Consome o token, grava bcrypt(10), apaga sessões e tokens do usuário. */
export async function consumirTokenReset(
  d: any,
  token: string,
  senha: string,
  agora?: Date
): Promise<ResultadoReset>;
```

- `gerarTokenReset`: `crypto.randomBytes(32).toString("base64url")`,
  `crypto.createHash("sha256").update(token).digest("hex")`.
  `DELETE FROM password_reset_tokens WHERE user_id = ?` antes do insert.
- `validarTokenReset`: busca por `token_hash`, exige `used_at IS NULL` e
  `expires_at > agora`, e junta com `users.email`.
- `emailMascarado`: primeira letra + `***` + domínio
  (`macoinha07@gmail.com` → `m***@gmail.com`). E-mail curto/local vazio cai em
  `***@dominio`.
- `consumirTokenReset`: valida `senha.length >= 8` **antes** de consumir (não
  queima o link por senha curta). Depois do `UPDATE ... RETURNING`, roda em
  transação: `bcrypt.hash(senha, 10)` → update de `users.password_hash` e
  `updated_at` → `DELETE user_sessions WHERE user_id` → `DELETE
  password_reset_tokens WHERE user_id`.
- Qualquer erro de banco sobe (nada de `catch {}` vazio); a rota devolve 500.

### Rotas do painel — `api/src/routes/admin-password-reset.ts`

`POST /api/admin/usuarios/:userId/reset-link`

- Sessão obrigatória (401 `nao_autenticado`).
- Cargo `proprietario` (403 `apenas_proprietario`).
- Usuário alvo existe e não está deletado (404 `usuario_nao_encontrado`).
- Gera o token e responde:

```json
{
  "url": "https://m7arena.pro/redefinir-senha?token=XXXX",
  "expira_em": "2026-10-21T18:00:00.000Z"
}
```

- Montado como router próprio e registrado em `api/src/index.ts` como
  `app.use("/api/admin", adminPasswordResetRouter)` **antes** do `adminRouter`
  (o `admin.ts` já tem 402 linhas; esta feature não entra nele).

### Rotas públicas — `api/src/routes/password-reset.ts`

`GET /api/auth/reset-password/:token`

- 200 `{ "valido": true, "email": "m***@gmail.com" }`
- 410 `{ "erro": "link_invalido_ou_expirado" }` para token inválido, expirado
  ou usado.

`POST /api/auth/reset-password`

- Body `{ token: string, password: string }`.
- 400 `{ erro: "senha_curta" }` se `password.length < 8`.
- 400 `{ erro: "token_ausente" }` se faltar token/senha.
- 410 `{ erro: "link_invalido_ou_expirado" }` se o token não puder ser
  consumido.
- 200 `{ ok: true }` após gravar a senha e derrubar as sessões.

Registrado como `app.use("/api/auth", passwordResetRouter)` em `index.ts`.

### Por que não há rate limit novo

O token tem 256 bits de entropia; adivinhar é inviável. O GET de validação não
revela se a conta existe (retorna o mesmo 410). Não há e-mail sendo disparado,
então também não há custo por tentativa. YAGNI.

## Front (`web/src`)

### Aba do painel — `web/src/pages/AdminSenhas.tsx` (novo)

- Exporta `AbaSenhas({ adminCargo })`.
- Se `adminCargo !== 'proprietario'`: apenas um aviso "Apenas o proprietário pode
  redefinir senhas." (a aba já fica bloqueada no menu; o aviso é a segunda
  camada de UI).
- Busca reusa o endpoint existente `/api/admin/usuarios?q=` (email, nome ou Riot
  ID) e a tabela no mesmo padrão visual de `AdminPunicoes.tsx`.
- Cada linha tem o botão **"Gerar link"**. Ao clicar:
  1. `POST /api/admin/usuarios/:id/reset-link`;
  2. abre modal com o link em `<input readOnly>`, botão **Copiar**, validade
     formatada em pt-BR e o aviso: "O link vale 24h e só pode ser usado uma vez.
     Quem abrir define a nova senha. Envie por WhatsApp/Discord."
  3. botão "Fechar" e estado de erro no próprio modal.
- Estados: `buscando`, `gerando`, `erro`, `sucesso`, `linkGerado`.
- Sem listagem automática de usuários e sem histórico (decisão do usuário).

### Cliente da API — `web/src/lib/api.ts`

Novo namespace:

```ts
adminSenhas: {
  buscarUsuarios: (q: string) => api.get<Array<{ id: string; email: string; displayName: string; riotId: string | null; status: string; avatarUrl?: string | null }>>(`/admin/usuarios?q=${encodeURIComponent(q)}`),
  gerarLink: (userId: string) => api.post<{ url: string; expira_em: string }>(`/admin/usuarios/${userId}/reset-link`),
},

authReset: {
  validar: (token: string) => api.get<{ valido: boolean; email: string }>(`/auth/reset-password/${encodeURIComponent(token)}`),
  redefinir: (token: string, password: string) => api.post<{ ok: boolean }>("/auth/reset-password", { token, password }),
},
```

### Aba no `Admin.tsx`

- `Aba` ganha `'senhas'`.
- Import de `AbaSenhas` e do ícone `KeyRound`.
- Item no array `abas`: `{ id: 'senhas', label: 'Senhas', icon: KeyRound, bloqueada: adminCargo !== 'proprietario' }`.
- Render: `{abaAtiva === 'senhas' && <AbaSenhas adminCargo={adminCargo} />}`.

### Página pública — `web/src/pages/RedefinirSenha.tsx` (novo)

Visual copiado do `Login.tsx` (mesmo fundo `#0D0D0D`, logo, card, inputs com
`rounded-2xl`, botão gradiente `#FFB800 → #FF5E00`). Sem a coluna do Yasuo —
apenas o card central, para não inventar layout novo.

Estados:

1. **validando** — spinner enquanto chama `authReset.validar(token)`.
2. **invalido** — card com "Link inválido ou expirado. Peça um novo link ao
   suporte." + botão "Ir para o login".
3. **form** — mostra o e-mail mascarado (`Conta: m***@gmail.com`) e os campos
   Senha + Confirmar Senha (ambos com olho de mostrar/ocultar), botão
   "Definir nova senha".
   - Validação local: mínimo 8, senhas iguais.
   - Erros da API traduzidos: `link_invalido_ou_expirado` → a mensagem do estado
     inválido; `senha_curta` → "A senha deve ter pelo menos 8 caracteres."
4. **enviando** — botão com spinner.
5. Sucesso → `navigate('/login?senha_alterada=1', { replace: true })`.

Sem token na URL → cai direto no estado inválido.

### Rota e mensagem de sucesso

- `App.tsx`: lazy import de `RedefinirSenha` e
  `<Route path="/redefinir-senha" element={<RouteWithSuspense element={<RedefinirSenha />} />} />`.
  As rotas antigas `/reset-password` e `/resetpassword` continuam como estão
  (redirecionam para `/login`), para não quebrar links velhos.
- `Login.tsx`: no `useEffect` que lê a query, se `senha_alterada=1` →
  `setSuccessMessage('Senha redefinida. Entre com a nova senha.')` por 6 s e
  limpa a query com `history.replaceState`. Nenhum className muda.

## Segurança

- Token puro nunca é gravado nem logado.
- Hash SHA-256 no banco; link de uso único; expiração de 24h; consumo atômico.
- Só `proprietario` gera link (checado no servidor, não só na UI).
- A rota pública devolve o mesmo erro para token inexistente, expirado e usado.
- A troca de senha derruba todas as sessões do usuário.
- A senha nunca trafega de volta; a resposta não inclui hash nem senha.
- Nenhum segredo novo no bundle.

## Testes / verificação (como "done" vai ser medido)

1. `npm run db:generate` cria a migration `0032_*`; a suíte aplica a cadeia
   completa num PGlite em memória (`api/test/helpers.ts`).
2. Novo `api/test/password-reset.test.ts` com PGlite cobrindo:
   - `podeGerarReset(['proprietario']) === true` e `false` para `admin`/`user`.
   - `gerarTokenReset` cria 1 linha, token não aparece em texto no banco e
     gera um link consumível.
   - `validarTokenReset` devolve e-mail mascarado correto (`m***@gmail.com`) e
     recusa token inexistente.
   - `consumirTokenReset`: grava hash verificável com `bcrypt.compare`, apaga
     as sessões do usuário e recusa o segundo uso com
     `link_invalido_ou_expirado`.
   - Token expirado (gerado com `agora` no passado além de 24h) recusa.
   - Gerar um segundo link apaga o primeiro: o token antigo deixa de validar.
   - Senha com 7 caracteres recusa **sem** queimar o link (o token continua
     válido depois).
3. `npx tsx --test api/test/password-reset.test.ts` → PASS.
4. `npx tsx --test "api/test/*.test.ts"` → suíte completa PASS (regressão).
5. `npx tsc --noEmit -p api/tsconfig.json` → exit 0.
6. `web`: `npx tsc --noEmit` → exit 0 e `npx vite build` → sucesso.
7. Manual no navegador (local): logar como proprietário, buscar um usuário,
   gerar link, abrir em aba anônima, definir senha, ser redirecionado ao login,
   entrar com a senha nova; conferir que a sessão antiga daquele usuário caiu.
8. Deploy só depois da validação do usuário (regra do harness).

## Fora de escopo (YAGNI)

- Envio de e-mail (SMTP/Resend) — o link é copiado e enviado manualmente.
- Auto-atendimento "esqueci minha senha" para o cliente.
- Histórico/auditoria de resets (decisão do usuário: não registrar).
- Troca de senha pelo próprio perfil logado.
- Rate limiting dedicado (token de 256 bits + nenhum e-mail disparado).
- Reset em lote para os usuários da BLK-001 (pode ser feito um a um pela aba).
