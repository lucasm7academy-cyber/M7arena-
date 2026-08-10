# Linha de base de performance — M7Arena

> Usar para comparar ANTES × DEPOIS das otimizações do `docs/planos/plano-otimizacao-performance.md`.
> Medições feitas em 2026-08-10 com PowerShell. Data de referência do "antes": início da Fase 1 (P1–P5).

## Antes (início da Fase 1 — sem nenhuma otimização aplicada)

| Métrica | Valor | Observação |
|---|---|---|
| `web/dist` total | **27,0 MB** | |
| Imagens (42 arquivos) | **18,0 MB** | PNG/JPEG crus, sem webp/avif |
| Vídeos (2 `.webm`) | **7,3 MB** | `animated-highnoon-lucian.webm` 3,5 MB + `animated-battle-academia.webm` 3,7 MB (hero da home e do /campeonatos) |
| JS principal `index-*.js` | **681,4 KB** | minified (`index-Dw4CKyPa.js`) |
| Chunks lazy grandes | `CampeonatoDetalhes` 109,9 KB · `Admin` 95,7 KB · `createCampPage` 67,1 KB · `SalaMod1` 64,4 KB · `Lobby` 57,5 KB · `TimePage` 51,4 KB · `Jogar` 37,4 KB |
| Chamadas Riot por página `/players` (cache frio) | **até ~154** | `Promise.all` com 1 `buscarElo` por conta stale (`players.tsx:104`) |
| Chamadas Riot por sync de perfil (90 dias) | **~80+** | 40 match ids + 40 details do cliente (`riot.ts:131`) |
| Contas Riot no banco | 154 | game_accounts migrados (fonte do burst do /players) |

## Snapshot intermediário — após P1 (heróis → WebP animado)

Medido após o subagente P1 concluir. Compara com o "Antes" acima; o resto da Fase 1 ainda não rodou.

| Métrica | Valor |
|---|---|
| `web/public` total | **20,8 MB** (48 arquivos) |
| Imagens (44 arquivos, incl. 2 `.webp`) | **20,7 MB** |
| Vídeos | **0** (os 2 `.webm` removidos) |
| `web/dist` total | **22,4 MB** |
| `animated-highnoon-lucian.webp` | **953 KB** (era 3.487 KB) |
| `animated-battle-academia.webp` | **1.444 KB** (era 3.674 KB) |
| JS principal `index-*.js` | **680,4 KB** (`index-D6DCicfW.js`) |

> ⚠️ Os parâmetros de conversão foram ajustados pelo subagente para bater a meta de tamanho (highnoon `fps=12,scale=640,q=50`; battle `fps=6,scale=640,q=32`). **Revisão visual humana pendente** (fluidez/qualidade) antes do deploy.

## Resultado final — Fase 1 concluída (P1–P5 + follow-ups)

Medido após P1–P5, correções (ElectricBorder removida, Streamers, rolesToCargo streamer/caster) e fundoCard convertidos.

| Métrica | Antes | Depois | Economia |
|---|---|---|---|
| `web/public` | 25,0 MB | **6,3 MB** (48 arquivos) | **18,7 MB** |
| `web/dist` | 27,0 MB | **7,9 MB** (114 arquivos) | **19,1 MB** |
| Heroes (2) | 7,3 MB (webm) | **4,6 MB** (webp animado) | 2,7 MB |
| Imagens | 18 MB | ~1 MB (só webp) | ~17 MB |
| fundoCard ×4 | 5,4 MB (png) | **0,38 MB** (webp) | 5,0 MB |
| JS principal | 680,4 KB | 680,4 KB (P5: sem dep morta; cai com swaps) | — |
| `tsc` api/web | api ok / 2 erros web | **api ok / 0 erros web** | — |
| `/players` Riot (cache frio) | ~154 chamadas | **1** (server-side, lote 3, TTL 30min) | — |
| Stats 90 dias perfil | ~80 chamadas | **1** (server-side, cache 30min) | — |

**Configuração dos heroes (webp animado):** highnoon `fps=15,scale=720,q=55` (1,57 MB); battle `fps=10,scale=640,q=45` (2,99 MB). Revisão visual humana pendente.

**Correções extra aplicadas na Fase 1:**
- `ElectricBorder` removida (canvas rAF por card VIP) — componente + CSS apagados.
- `rolesToCargo` (PerfilContext) agora mapeia `streamer` e `caster` (antes caía em `jogador` → painel do streamer nunca abria).
- `Streamers.tsx` alt usava `stream.profile?.nome` (campo removido) → `stream.twitch_channel`.
- `og.ts` + `salamod1.ts` apontam para `fundoCard*.webp`; os 4 `.png` apagados.

## Como re-medir no fim

```powershell
# public assets
$files = Get-ChildItem -Recurse -File web\public
($files | Measure-Object Length -Sum).Sum / 1MB
# dist
$d = Get-ChildItem -Recurse -File web\dist
($d | Measure-Object Length -Sum).Sum / 1MB
# bundle principal
Get-ChildItem -Recurse -File web\dist\assets | Where-Object {$_.Name -like 'index-*.js'} | Select-Object Name, Length
```

## Pendências de medição

- [ ] Confirmar o total de `web/dist` final após P2 (compressor de imagens).
- [ ] Confirmar redução do bundle após P5.
- [ ] Contar chamadas externas do `/players` e do sync de perfil após P3/P4 (1 por carga, idealmente).
