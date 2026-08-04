# Relatório de Auditoria de Segurança — Fluxo de Salas (Morpheus)

**Alvo:** M7Arena — fluxo de salas (`/api/matches*`, escrow, realtime, upload)
**Data:** 2026-08-04
**Stack:** Node/Express + PostgreSQL + Drizzle, React/Vite (front), WebSocket próprio
**Agente:** Morpheus v2.0.0 (Red Team)
**Frameworks:** OWASP Top 10, OWASP API Security 2023, MITRE ATT&CK

---

## Sumário Executivo

O fluxo de salas passou por uma força-tarefa (`ajustarsala`) que corrigiu 4 bugs
funcionais (contagem/timer dessincronizados, sala presa em estado morto, polling
desnecessário, double-GET). **A auditoria confirma que essas correções são
sólidas**: a concorrência está protegida por `FOR UPDATE` + transação, o clock
sync converge para o relógio do servidor, e o polling só ativa quando o WS cai.

Porém, a auditoria ofensiva encontrou **4 findings de segurança não-funcionais**
que não estavam no escopo do ajustarsala. O mais relevante: **a senha das salas
privadas é devolvida no JSON para qualquer usuário autenticado, e o servidor
nunca a valida** — a proteção por senha é apenas cosmética no cliente.

---

## O que foi confirmado como SÓLIDO (correções do ajustarsala)

| Área | Verificação | Evidência |
|------|-------------|-----------|
| Race no `join` (10 cliques simultâneos) | `FOR UPDATE` na linha do match + transação serializa | `matches.ts:193`, teste 10 confirms paralelos 8/8 |
| Race no `confirm` (10 confirms) | Lock + `avaliarTransicoes` dentro da transação; exatamente 1 transição | `matches-actions.ts:64`, smoke-concorrente |
| Clock sync | `server_time` no shape + offset no cliente; 7 relógios opostos → todos 60s | `match-shape.ts:79`, `clockSync.ts`, smoke-clock-sync-vps 6/6 |
| Polling fallback | Só roda com WS morto (não desperdiça em sala parada) | `useSalaSimples.ts` |
| 1 GET único no sync | `sincronizarTudo` não duplica o request | `useSalaSimples.ts` |
| Upload de prints | `memoryStorage` + `sanitizeFilename` + `sanitizeSubpath` + `randomUUID` | `upload.ts:116-211` |
| Cookie de sessão | `httpOnly` + `secure` + `sameSite:lax` | `session.ts:17-24` |

---

## Findings

### MORPH-001 — Senha de sala exposta a qualquer usuário autenticado
- **Severity:** High
- **CWE:** CWE-287 (Improper Authentication) / CWE-522
- **OWASP:** API1:2023 (Broken Object Level Authorization)
- **MITRE ATT&CK:** T1078 (Valid Accounts)
- **Location:** `api/src/routes/matches.ts:64-67` + `api/src/lib/match-shape.ts:86`
- **Description:** O GET `/api/matches/:id` e `/api/matches` devolvem o campo
  `senha` da sala para **qualquer** usuário com sessão. `redigirSenha` só remove
  para visitantes anônimos. O `join` **nunca** recebe/valida a senha
  (`matches.ts:183-302` não lê `senha` do body). A "proteção" por senha vive só
  no cliente (`Jogar.tsx:652` compara `senha !== sala.senha`) — e como a senha
  vem no JSON, qualquer pessoa logada a lê sem digitar.
- **Evidence:**
  ```ts
  // match-shape.ts:86 — a senha sempre vai no shape
  senha: m.senha ?? null,
  // matches.ts:65 — só anônimo é privado da senha
  function redigirSenha(legacy: any, autenticado: boolean) {
    if (!autenticado) delete legacy.senha;
    return legacy;
  }
  // matches.ts:183-302 — join não lê/valida senha do body
  ```
- **Impact:** Qualquer usuário registrado entra em salas privadas sem saber a
  senha. Quebra total da noção de sala privada.
- **Remediation:** (a) remover `senha` do shape sempre; (b) validar senha no
  servidor no `join` quando `temSenha` (enviar senha no body, comparar com hash);
  (c) manter `tem_senha: true` para a UI mostrar o cadeado.
- **Confidence:** High — Status: **Open**

### MORPH-002 — Mass assignment na criação de sala (taxaPct negativo cria MC)
- **Severity:** Medium (potencial High se abusado)
- **CWE:** CWE-20 (Improper Input Validation)
- **OWASP:** API3:2023 (Broken Object Property Level Authorization)
- **MITRE ATT&CK:** T1565.001 (Data Manipulation)
- **Location:** `api/src/routes/matches.ts:114-141` + `api/src/lib/escrow.ts:64-70`
- **Description:** `maxJogadores`, `apostaMc`/`entryMp` e `taxaPct` vêm do body
  **sem clamp nem validação de tipo**. Com `taxaPct` negativo e `apostaMc`
  positivo, `calcularPayout` produz `taxa` negativa → `premioLiq > pote` → o
  prêmio pago aos vencedores **supera o pote** (cria MC do nada na economia).
  Com `maxJogadores: -1`, `total >= max` é sempre verdadeiro → sala abre
  contagem com 1 jogador.
- **Evidence:**
  ```ts
  // matches.ts:116-141 — sem validação
  const aposta = Number(apostaMc ?? entryMp ?? 0);
  const taxa = Number(taxaPct ?? 8.99);
  maxJogadores: maxJogadores || 10,
  // escrow.ts:66 — taxa negativa infla o prêmio
  const taxa = Math.ceil((pote * taxaPct) / 100);
  const premioLiq = pote - taxa;   // taxa < 0 → premioLiq > pote
  ```
- **Impact:** Inflação da moeda interna (MC) e salas com contagem quebrada.
- **Remediation:** `apostaMc = Math.max(0, Math.min(aposta, 1_000_000))`;
  `taxaPct` clampado a `[0, 100]` (ou usar o valor do servidor `8.99` sempre);
  `maxJogadores` clampado a `[2, 10]` e inteiro.
- **Confidence:** High — Status: **Open**

### MORPH-003 — CORS espelha origem arbitrária com credenciais
- **Severity:** Medium (mitigado por SameSite=Lax)
- **CWE:** CWE-942 (Permissive Cross-domain Policy)
- **OWASP:** API8:2023 (Security Misconfiguration)
- **Location:** `api/src/index.ts:29-32`
- **Description:** `cors({ origin: true, credentials: true })` reflete qualquer
  `Origin` na resposta com `Access-Control-Allow-Credentials: true`. O
  `sameSite:lax` do cookie reduz o risco de CSRF, mas o padrão de ecoar origem
  arbitrária é anti-padrão.
- **Remediation:** `origin` fixo = `https://dev.m7arena.pro` (e o domínio de
  produção), mantendo `credentials: true`.
- **Confidence:** Medium — Status: **Open**

### MORPH-004 — Aposta negativa vira dado inconsistente
- **Severity:** Low
- **CWE:** CWE-20
- **OWASP:** API3:2023
- **Location:** `api/src/routes/matches.ts:116` + `api/src/lib/escrow.ts:20`
- **Description:** `aposta = -100` passa: `reservarEntrada` faz no-op (early
  return se `aposta <= 0`), mas `apostaMc = -100` fica gravado. Elegibilidade e
  payout tratam como casual (`> 0`), então o dado fica inconsistente no banco.
- **Remediation:** o clamp do MORPH-002 resolve.
- **Confidence:** High — Status: **Open**

---

## Coverage Matrix

| Área | Aplicável | Findings |
|------|-----------|----------|
| Lógica de Negócio | Yes | MORPH-002, MORPH-004 |
| API Security | Yes | MORPH-001, MORPH-002, MORPH-003 |
| Autenticação & Tokens | Yes | MORPH-001 (sessão), cookies OK |
| Injeções | Parcial (SQL via Drizzle parametrizado) | — |
| Upload & Desserialização | Yes | OK (defendido) |
| Infra & Config | Yes | MORPH-003 |
| AI/LLM | No | — |

## Recomendações Prioritizadas
1. **[High] MORPH-001** — remover `senha` do shape e validar senha no `join`
   (auth no servidor, não no cliente).
2. **[Medium] MORPH-002** — clamp de `apostaMc`, `taxaPct`, `maxJogadores` na
   criação (e nos outros campos numéricos do body).
3. **[Medium] MORPH-003** — CORS com `origin` fixa.
4. **[Low] MORPH-004** — coberto pelo clamp do MORPH-002.
