# Rotina: sorteio semanal das copas (Kraken / Tesouro)

**Gatilho:** o usuário pede algo como *"segue com o sorteio da copa do Kraken"* (ou Tesouro, ou as duas).
Não precisa reexplicar nada: é só rodar os comandos abaixo.

## Contexto

- Cada copa tem **8 times, 1 Grupo A**, formato liga (todos contra todos) = **28 pares** no total.
- Convenção (ADR-068): **2 adversários inéditos por time por semana** = 8 jogos por copa. Quando
  restarem menos pares, o script sorteia o que houver (ex.: 4 jogos = 1 adversário por time) e avisa.
- Os jogos entram como **pendentes de fase de grupos** (`status='combinando'`, `A COMBINAR` / `--:--`)
  e aparecem em **"Meus Jogos Pendentes"** para os capitães proporem data/hora.
- "Já sorteado" conta **qualquer** jogo existente (pendente, agendado ou finalizado) — um confronto
  pendente da semana anterior nunca é repetido.

## Como fazer

```powershell
# 1. copiar o script para dentro do container da API
scp scripts/campeonatos/sortear-semana.mjs pandapost-vps:/root/m7arena/sortear-semana.mjs
ssh pandapost-vps "docker cp /root/m7arena/sortear-semana.mjs m7arena_app:/app/sortear-semana.mjs"

# 2. prévia (não grava nada) — conferir os pares com o usuário se quiser
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken --dry-run"

# 3. aplicar (transação com validação: aborta se repetir par ou contar errado)
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken"
```

O filtro aceita `kraken`, `tesouro` ou nada (as duas copas). `--dry-run` pode vir em qualquer ordem.

## O que o script faz

1. Lê os times aprovados e todos os jogos existentes do torneio.
2. Calcula os pares inéditos.
3. Sorteia até 2 emparelhamentos perfeitos disjuntos aleatórios (cada time joga 2x, sem repetir par).
4. Insere em `tournament_matches` numa transação que valida: contagem inserida e 0 pares repetidos.
   Se a validação falhar, faz rollback e não grava nada.
5. Imprime os jogos sorteados, os jogos por time e os pares que sobram para a próxima semana.

## Formato do registro inserido

| coluna | valor |
|---|---|
| `phase` | `group_stage` |
| `round` | `0` |
| `phase_label` | `Fase de Grupos` |
| `status` | `combinando` |
| `display_date` / `display_time` | `A COMBINAR` / `--:--` |
| `score_display` | `0 - 0` |
| `proposed_by` | `''` (ninguém propôs ainda) |
| `best_of` | `3` |
| `match_key` | `manual-<Date.now()>-<n>` |
| `team_a_id` / `team_b_id` | resolvidos por tag |

## Verificação depois de aplicar

IDs fixos das copas (não mudam):

| copa | tournament_id |
|---|---|
| Copa do Kraken - SET/26 | `2bcef957-09ce-4224-ae17-b0857739cc6b` |
| Copa do Tesouro - SET/26 | `42a7e314-13b4-4b2c-9c76-060cd1bd8ef5` |

```powershell
curl.exe -s "https://dev.m7arena.pro/api/tournaments/2bcef957-09ce-4224-ae17-b0857739cc6b" -o "$env:TEMP\kraken.json"
# esperado: cronograma = 16 + 8 por semana já sorteada; pendentes = jogos da semana
```

## Histórico

| data | semana | o que foi feito |
|---|---|---|
| 14/09/2026 | 2 | 8 jogos por copa (deepseek) — cada time ficou com 4 jogos |
| 21/09/2026 | 3 | 8 jogos por copa (deepseek) — restaram 4 pares por copa |
| próxima | 4 | 4 jogos por copa (1 adversário por time) — o script detecta sozinho |

## Se o MCP/CLI não carregar

Registrar a sessão pelo CLI oficial:

```bash
node mcp/status-server/scripts/cli.js session --agent <nome> --summary "..." --touched tournament_matches
```
