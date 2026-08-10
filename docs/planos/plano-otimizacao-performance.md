# Plano de Otimização de Performance — M7Arena

> **Agentes:** cada plano (P1–P5) é executado por **um subagente dedicado**, supervisionado pelo agente principal (deepseek). Cada plano tem arquivos exatos, comandos e critérios de aceite. Depois de fechar os 5, seguimos para a Fase 2 (P6–P10).

**Objetivo:** reduzir o peso entregue ao usuário e o processamento externo (Riot API) sem quebrar a paridade visual 1:1 nem a regra de negócio no servidor.

**Métricas de partida (medidas em 2026-08-10):**

| Métrica | Valor |
|---|---|
| `web/dist` total | 27 MB |
| Imagens (42 arquivos) | 18 MB |
| Vídeos (2 `.webm`) | 7,3 MB |
| JS principal (`index-*.js`) | 681 KB minified |
| Chamadas Riot por página `/players` (cache frio) | até ~154 |
| Chamadas Riot por sync de perfil | ~80+ |

**Decisões do usuário (2026-08-10):**
1. Heróis → **WebP animado** (não GIF/APNG).
2. Compressor → **script `sharp` + webp**, mantendo nomes de arquivo, sem mudar código (rodado manualmente).
3. Deploy → **no final**, após validação local em `localhost:3000`.
4. **Fase 1 = itens #1–#5** (5 subagentes). **Fase 2 = itens #6–#10** (depois).

---

## Global Constraints (valem para todo plano)

- **Paridade visual 1:1** (invariante 3.1): nunca reescrever `className`, nunca "melhorar" layout. Trocar `<video>` por `<img>` com as **mesmas classes** é permitido (mesmo resultado renderizado).
- **Regra de negócio no servidor** (invariante 3.3): cache/refresh de elo e stats são leitura; a decisão permanece no servidor.
- **Nenhum segredo no bundle** (invariante 3.4).
- **Nenhum arquivo passa de ~400 linhas** para arquivo **novo** (invariante 3.6). Arquivos herdados do fork não são recortados aqui.
- **TypeScript strict: true** — `npx tsc --noEmit` precisa passar em `web/` e `api/`.
- **`catch {}` vazio é proibido** (convenção).
- **Deploy só no final**: nenhuma mudança vai para a VPS até os 5 planos validados localmente.
- **Não commitar sem o usuário pedir.**
- O site antigo (`M7AcademySite`) é somente leitura — nunca buscar nada de lá para "melhorar".

---

## Fase 1 — Itens #1–#5 (agora)

### P1 — Heróis: `.webm` → WebP animado (item #1)

**Objetivo:** eliminar os 2 vídeos de 3,5/3,7 MB e entregar animação em WebP animado (~10-20% do tamanho).

**Arquivos:**
- Modificar: `web/public/images/animated-highnoon-lucian.webm` → `web/public/images/animated-highnoon-lucian.webp`
- Modificar: `web/public/images/animated-battle-academia.webm` → `web/public/images/animated-battle-academia.webp`
- Modificar: `web/src/pages/Lobby.tsx:620-632` (hero highnoon)
- Modificar: `web/src/pages/campeonatos.tsx:193-201` (hero battle)
- Excluir: os 2 `.webm` (não usados em mais lugar — conferir com `rg "webm" web/src`)

**Especificações dos vídeos (ffprobe):**
- `animated-highnoon-lucian.webm`: VP8, 1056x720, 25 fps, 8,0 s
- `animated-battle-academia.webm`: VP8, 1056x720, 30 fps, 12,2 s

**Passos:**

1. Converter com ffmpeg (rodar na raiz do projeto). WebP animado lossy, 15 fps, escala para 720px de largura (metade do peso por quadro), loop infinito (`-loop 0`):

```bash
ffmpeg -y -i web/public/images/animated-highnoon-lucian.webm ^
  -vf "fps=15,scale=720:-1" -loop 0 -c:v libwebp -quality 70 ^
  -preset picture -an web/public/images/animated-highnoon-lucian.webp

ffmpeg -y -i web/public/images/animated-battle-academia.webm ^
  -vf "fps=15,scale=720:-1" -loop 0 -c:v libwebp -quality 70 ^
  -preset picture -an web/public/images/animated-battle-academia.webp
```

> No Windows/PowerShell use `^` para quebrar linha; em bash use `\`.

2. Verificar tamanho: cada `.webp` deve ficar **< 1,5 MB** (meta: ~400-900 KB).

3. Trocar o JSX — **recorte, não reescreva**. Em `Lobby.tsx` substituir o bloco `<video>` (linhas 623-631) por:

```jsx
<img
  src="/images/animated-highnoon-lucian.webp"
  alt=""
  draggable={false}
  className="w-full h-full object-cover object-[center_15%] opacity-80 transition-transform duration-700 group-hover:scale-105"
/>
```

Em `campeonatos.tsx` substituir o bloco `<video>` (linhas 193-201) por:

```jsx
<img
  src="/images/animated-battle-academia.webp"
  alt=""
  draggable={false}
  className="w-full h-full object-cover object-[center_15%] opacity-60 transition-transform duration-700 group-hover:scale-105"
/>
```

> Manter exatamente as mesmas classes do `<video>` original (mesmo `object-cover object-[center_15%]`, `opacity`, `group-hover:scale-105`).

4. Excluir os `.webm` após confirmar que nenhum outro arquivo os referencia.

**Critério de aceite:**
- `npx tsc --noEmit` passa em `web/` (comando: `cd web && npx tsc --noEmit`).
- `npm run build` passa em `web/`.
- `docker compose -f infra/docker-compose.local.yml up -d --build` + `http://localhost:3000` → a home e o `/campeonatos` mostram o hero animado idêntico ao atual.
- `rg "webm" web/src` → 0 ocorrências.
- Soma dos 2 `.webp` < 3 MB (contra 7,3 MB atuais).

---

### P2 — Compressor de imagens: script `sharp` + webp (item #2)

**Objetivo:** converter/otimizar as 42 imagens (18 MB) para WebP sem mudar o código; script leve, rodado manualmente.

**Arquivos:**
- Modificar: `web/package.json` (adicionar devDependency `sharp` + script `images:optimize`)
- Criar: `web/scripts/optimize-images.mjs`

**Passos:**

1. Instalar sharp como devDependency em `web/`:

```bash
cd web
npm install --save-dev sharp
```

2. Criar `web/scripts/optimize-images.mjs` com esta lógica:
   - Caminho base: `web/public/images`.
   - Para cada `.png`/`.jpg`/`.jpeg`/`.gif` com peso > 15 KB:
     - Gerar versão `.webp` (qualidade 80, mesmo tamanho — **não redimensionar**: paridade visual).
     - Se o `.webp` for **menor** que o original → substituir o arquivo pelo `.webp` **mantendo o nome** (ex.: `heroSlide2.png` vira `heroSlide2.png` com bytes webp? NÃO — ver abaixo).
   - **Decisão de nome:** para não quebrar referências e mime, o script deve:
     1. Gerar `<nome>.webp` ao lado do original.
     2. **Não** apagar o original automaticamente.
     3. Imprimir no final uma lista `origem -> destino` de todas as conversões que valem a pena.
   - Registrar o tamanho antes/depois por arquivo e o total economizado.
   - `catch {}` vazio proibido — logar o erro e seguir.
   - Não processar arquivos já `.webp`.

3. Adicionar no `web/package.json`:

```json
"scripts": {
  "images:optimize": "node scripts/optimize-images.mjs"
}
```

4. Rodar: `cd web && npm run images:optimize` e colar a saída (economia total).

5. **Swap de referências (etapa supervisionada):** depois que o script listar os `.webp` vencedores, atualizar as referências estáticas em `web/src` para apontar para `.webp` (grep por `images/<nome>`, ex.: `heroSlide2.png` → `heroSlide2.webp`). Referências **dinâmicas** (maps de `bgImage`, `getIconeUrl`, CDN) não mudam.
   - Conferir cada referência: `rg "images/.*\.(png|jpe?g|gif)" web/src`.
   - Depois de trocar, apagar os `.png/.jpg` originais convertidos.
   - **Critério:** nenhum `404` no console ao navegar as páginas principais (Lobby, Jogar, perfil, campeonatos, times, players).

**Critério de aceite:**
- `npx tsc --noEmit` passa em `web/`.
- `npm run build` passa.
- Total de imagens em `web/public/images` cai de 18 MB para ~6-8 MB.
- Página local sem `404` de imagem no console.
- O script é re-executável (idempotente: `.webp` já existente é pulado).

---

### P3 — Rajada Riot no `/players`: refresh serial server-side (item #3)

**Problema:** `web/src/pages/players.tsx:104` dispara `Promise.all` com 1 `buscarElo` por conta stale + 1 escrita `/players/refresh-elo` por conta. Com 154 contas = ~154 chamadas concorrentes → 429 da Riot + pico no servidor.

**Objetivo:** mover o refresh para o servidor, serial/lote, com cache e TTL; o cliente não faz mais N chamadas.

**Arquivos:**
- Modificar: `api/src/routes/players.ts` (novo endpoint)
- Modificar: `web/src/pages/players.tsx` (chamar endpoint único)
- Modificar (se necessário): `api/src/routes/riot.ts` (cache de league já existe — conferir TTL)

**Design:**
1. Novo endpoint `POST /api/players/refresh-elos` (auth admin/logado):
   - Busca contas `lol` com `metadata->>'elo_cache'` ausente ou `stats_updated_at` mais velho que `TTL_MS` (30 min, igual ao TTL do cliente).
   - Para cada conta, busca `league` via `riotFetch` (que **já tem cache de 10 min** por puuid em `riot.ts`) e grava `metadata.elo_cache` + `stats_updated_at`.
   - **Concorrência limitada** (ex.: 3 em paralelo, ou serial) para nunca estourar rate limit da Riot.
   - Retorna `{ atualizadas, total, erros }`.
   - Reutilizar o mesmo shape de `elo_cache` que o cliente já envia hoje (ver `players.tsx:113-128`).
2. Cliente (`players.tsx`): em vez de `Promise.all` com N `buscarElo`, chamar **uma vez** `POST /api/players/refresh-elos` no mount (se houver contas stale), depois `refetch` da lista. Manter o código de exibição intacto.
3. Manter o endpoint antigo `POST /api/players/refresh-elo` (compatibilidade) mas o front deixa de usá-lo em massa.

**Critério de aceite:**
- `cd api && npx tsc --noEmit` passa.
- `cd web && npx tsc --noEmit` passa.
- Teste manual (local com dados reais): abrir `/players` → 1 única chamada de refresh; `rg "buscarElo" web/src/pages/players.tsx` sem ocorrência no fluxo em massa.
- Nenhum 429 da Riot durante a carga da página.

---

### P4 — Stats de 90 dias: server-side com cache (item #4)

**Problema:** `web/src/api/riot.ts:131` `buscarEstatisticasRecentes` busca 40 match IDs + 40 match details (batches de 5, delay 600 ms) **do cliente**, sem cache server-side para match v5. Cada sync de perfil = ~80 chamadas Riot.

**Objetivo:** mover para o servidor com cache por puuid; cliente chama 1 endpoint.

**Arquivos:**
- Modificar: `api/src/routes/riot.ts` (novos endpoints + cache match)
- Modificar: `web/src/api/riot.ts` (cliente chama o novo endpoint)
- Modificar: `web/src/api/player.ts` (`sincronizarContaRiot` usa o novo endpoint)

**Design:**
1. Em `riot.ts`, adicionar cache para `/matches/:puuid` e `/match/:matchId` (mesmo padrão `getCached/setCache`, TTL 30 min).
2. Novo endpoint `GET /api/riot/stats/:puuid?days=90&count=40` que faz server-side o que hoje o cliente faz (buscar ids, buscar details em batch com pequena concorrência, agregar `topChampions`/`roles`/`totalGames`) e cachea o resultado por `puuid` (TTL 30 min). Reutilizar a mesma lógica de agregação do `riot.ts:148-166`.
3. `web/src/api/riot.ts`: `buscarEstatisticasRecentes` passa a chamar `GET /api/riot/stats/:puuid` (com fallback para `null` se falhar, igual hoje).
4. `web/src/api/player.ts` continua consumindo o mesmo shape (`topChampions`, `roles`, `totalGames`) — sem mudança no perfil.

**Critério de aceite:**
- `cd api && npx tsc --noEmit` passa.
- `cd web && npx tsc --noEmit` passa.
- Sync de perfil faz **1** request externo (stats) em vez de ~80.
- Segunda chamada no mesmo puuid em < 30 min retorna do cache (sem request à Riot).

---

### P5 — Bundle JS 681 KB: deps + code-split (item #5)

**Objetivo:** reduzir `index-*.js` (681 KB) e chunks grandes, sem mexer em layout.

**Arquivos:**
- Modificar: `web/package.json` (remover deps mortas)
- Analisar: `web/src/main.tsx`, `web/src/App.tsx`, imports de libs

**Passos de investigação (fazer antes de mudar):**
1. Verificar se `@supabase/supabase-js` ainda é importado em `web/src`:
   ```bash
   rg "from ['\"]@supabase/supabase-js" web/src
   ```
   - Se 0 ocorrências → remover a dependency e re-rodar build (economia típica ~50 KB). ADR-018 removeu imports mortos; conferir se sobrou algum.
2. `react-icons`: conferir se os imports são por ícone (`import { FaDiscord } from 'react-icons/fa'`) — tree-shakeable no build Vite; se algum import é `react-icons` inteiro (`import * as` ou `from 'react-icons'`), corrigir para import por ícone.
3. `motion` e `lucide-react` são usados em toda parte (layout) — continuam no bundle principal. **Não** mexer.
4. Conferir o que mais pesa no chunk principal com `vite build` (o output lista os chunk sizes). Se algum componente pesado (ex.: `react-hot-toast`) só é usado em parte do app, avaliar mover para chunk lazy via `React.lazy` — mas **sem tocar em paridade visual**.

**Ações permitidas (só estas):**
- Remover dependência morta (supabase-js se não usado).
- Corrigir imports não-tree-shakeables de `react-icons`.
- Nada além disso sem consultar o supervisor (risco de quebrar visual).

**Critério de aceite:**
- `cd web && npm run build` passa e o output mostra `index-*.js` **menor** que antes (colar antes/depois).
- `npx tsc --noEmit` passa.
- Página local navega normalmente (Lobby, Jogar, campeonatos) sem erro no console.

---

## Fase 2 — Itens #6–#10

| Plano | Item | Status | Resumo |
|---|---|---|---|
| P6 | #6 Realtime/refetch | ✅ done | Jitter no refetch em massa (`useSalaRealtime`: debounce 250ms + jitter 0–600ms) e no polling fallback (`useSalaSimples`: 5–7s). Desincroniza clientes sem mudar comportamento |
| P7 | #7 Páginas-monstro | 🔒 blocked | Corte de arquivos herdados acontece dentro dos `app.swap.*` (ADR-010) — nunca como tarefa isolada |
| P8 | #8 Elo por membro no TimePage | ✅ done | `GET /api/teams/:id` devolve `elo` por membro do `elo_cache` do banco; TimePage usa cache + TIER_MAP e **removeu o `buscarElo` por membro** (Promise.all de N chamadas) |
| P9 | #9 NotificationBell | ✅ done | **Decisão do usuário: sem WS/polling** — recarrega ao clicar (já era lazy-load); badge de pendentes calculado do último clique |
| P10 | #10 Externos + cron | ✅ done | Index do cron **já existe** (migration 0009 `idx_matches_status_updated`); CDN de ícones não vale cache próprio; supabase residual é dos swaps. **Achados p/ cutover:** gap de cobertura no `verify-swap.js` (recrutamentos/transmissoes/votos_jogos/results/pagamentos) + 2 URLs hardcoded do Supabase em `Login.tsx:9-10` |

**Achados do P10 que precisam de decisão (não são performance):**
- `Login.tsx:9-10` usa `bfsusctegzvfrlehhink.supabase.co` (logo + fundo Yasuo) — quebra no cutover se o Supabase cair.
- `verify-swap.js` não conta domínios residuais (recrutamentos 7, transmissoes 5, votos_jogos 1, resultados_partidas 1, pagamentos 1) — portão pode declarar swap feito com chamadas restantes.

---

## Ordem de execução e deploy

1. Escrever plano (este arquivo). ✅
2. Registrar no MCP: componentes `perf.*` + ADR.
3. Disparar **5 subagentes** (um por plano P1–P5), cada um com o trecho deste plano.
4. Supervisor (deepseek) revisa cada entrega: diff + `tsc` + build.
5. Validação local final em `http://localhost:3000` (heróis animados, imagens webp sem 404, `/players` com 1 chamada, perfil com 1 chamada).
6. Deploy na VPS (rebuild `web` + `api` + `realtime`, se aplicável) **somente após o usuário validar local**.
7. `log_session` + `set_component_status` por componente.
