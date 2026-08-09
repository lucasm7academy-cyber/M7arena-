# Compartilhar Sala — design

**Data:** 2026-08-09
**Decisão:** botão "Compartilhar" na tela da sala que copia uma mensagem formatada
para a área de transferência.

## Contexto

O usuário quer divulgar uma sala de partida para amigos. O botão fica **somente na
tela da sala** (`/sala-mod1/:id`), copiando uma **mensagem de texto formatada** —
não depende do crawler de embeds (Open Graph), então é 100% front, sem mudança de
servidor.

A rota `/sala-mod1/:id` já é pública (commits recentes): visitantes não logados
conseguem ver a sala, então o link compartilhado funciona para qualquer pessoa.

## Comportamento

- Clique no botão (ícone `Share2`) → monta a mensagem com os dados **ao vivo** da
  sala → `navigator.clipboard.writeText` → feedback "Copiado!".
- Mesmo padrão do botão "Copiar Código" existente (`SalaMod1.tsx:103-110`): estado
  `copiado` + timeout de 2s + toast.

## Formato da mensagem

```
🎮 {Nick} convida você para jogar 5x5 Summoner's Rift personalizado
🎯 Free Elo
👥 3/10 vagas preenchidas
💰 500 M7Coins
👇 Entre aqui

https://m7arena.pro/sala-mod1/123
```

### Mapeamento dos campos

| Campo | Fonte | Regra |
|---|---|---|
| `{Nick}` | `usuarioAtual.nome` / `usuarioAtual.riotId` | Usuário logado que compartilha; prioriza `riotId` (ex.: "Faker#BR1") quando existir, senão `nome` |
| Texto do modo | `sala.modo` | `5v5` → "5x5 Summoner's Rift", `aram` → "ARAM Howling Abyss", `1v1` → "1v1 Howling Abyss", `time_vs_time` → "Time vs Time Summoner's Rift" |
| Elo | `sala.eloMinimo` | vazio → "Free Elo"; senão → "Mínimo: {eloMinimo}" |
| Vagas | `jogadores.length` / `sala.maxJogadores` | contagem ao vivo |
| M7Coins | `sala.mpoints` | se 0 → "Casual"; senão → "{mpoints} M7Coins" |
| Link | `window.location.origin` + `/sala-mod1/{sala.id}` | funciona em dev e prod |

**O nome da sala não entra na mensagem** (decisão do usuário).

## Implementação

- Novo botão circular no header da sala, junto aos dados Estado/Modo/Premiação
  (`SalaMod1.tsx:298-326`), no mesmo estilo do botão de excluir já existente.
- Nova função `compartilharSala` (padrão de `copiarCodigo`) + estado
  `compartilhado` com timeout.
- Nenhum `className` existente é tocado — adição, não alteração.

## Critérios de aceite

- Clicar no botão copia a mensagem exata com os dados da sala atual.
- Mensagem usa o nome do criador/logado, elo (ou Free Elo), vagas, M7Coins e link.
- `npx tsc --noEmit` passa no `web/`.
