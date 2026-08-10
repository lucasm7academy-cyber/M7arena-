# Compartilhar Sala — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Compartilhar" na tela da sala (`/sala-mod1/:id`) que copia para a área de transferência uma mensagem formatada convidando para a partida.

**Architecture:** Tudo no front. O botão fica no header da sala (junto aos dados Estado/Modo/Premiação), ao lado do botão de excluir existente. Ao clicar, monta uma string com os dados ao vivo da sala e chama `navigator.clipboard.writeText`, com feedback visual "Copiado!" e toast.

**Tech Stack:** React 19 + Vite (TypeScript strict), `lucide-react` (ícone `Share2`), `react-hot-toast` (já importado no arquivo), `motion/react` (animação de hover já usada no arquivo).

## Global Constraints

- Nenhum `className` existente é tocado — adição, não alteração (invariante de paridade visual).
- Arquivo alvo: `web/src/pages/SalaMod1.tsx` (não passa de ~400 linhas — 782 hoje; a adição é ~45 linhas, sem recorte necessário nesta tarefa).
- Textos de interface em português do Brasil.
- `{Nick}` prioriza `perfil.riotId` (ex.: "Faker#BR1") quando existir, senão `perfil.nome`.
- Mensagem copiada NÃO contém o nome da sala (decisão do usuário).
- TypeScript `strict: true` — `npx tsc --noEmit` no diretório `web/` deve passar.

---

### Task 1: Botão "Compartilhar" que copia mensagem formatada

**Files:**
- Modify: `web/src/pages/SalaMod1.tsx`

**Interfaces:**
- Consumes: do componente já existente `usuarioAtual` (com `nome`, `riotId`), `sala` (com `modo`, `mpoints`, `maxJogadores`, `id`, `eloMinimo`), `jogadores` (array), `estadoRotulo`; `toast` de `react-hot-toast`; `Share2` de `lucide-react`.
- Produces: função `compartilharSala()` e estado `compartilhado` (nada exportado; uso interno do componente).

- [ ] **Step 1: Importar o ícone `Share2`**

Modificar a linha 5 de `web/src/pages/SalaMod1.tsx` para incluir `Share2` no import de `lucide-react`:

```tsx
import { Copy, Check, AlertTriangle, LinkIcon, ImagePlus, Loader, Clock, X, Trash2, Share2 } from 'lucide-react';
```

- [ ] **Step 2: Adicionar estado `compartilhado` e a função `compartilharSala`**

Após o bloco de `copiarCodigo` (que termina na linha 109), adicionar:

```tsx
    const [compartilhado, setCompartilhado] = useState(false);
    const compartilhadoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── COMPARTILHAR SALA ─────────────────────────────
    // Monta uma mensagem formatada convidando para a partida e copia para a
    // área de transferência. 100% front — não depende do crawler de embeds.
    const compartilharSala = () => {
        if (!sala) return;

        const nick = perfil?.riotId || perfil?.nome || 'Jogador';
        const textoModo: Record<string, string> = {
            '5v5': "5x5 Summoner's Rift",
            'aram': 'ARAM Howling Abyss',
            '1v1': '1v1 Howling Abyss',
            'time_vs_time': 'Time vs Time Summoner\'s Rift',
        };
        const eloLinha = sala.eloMinimo ? `Mínimo: ${sala.eloMinimo}` : 'Free Elo';
        const premio = (sala.mpoints || 0) > 0 ? `${sala.mpoints} M7Coins` : 'Casual';
        const link = `${window.location.origin}/sala-mod1/${sala.id}`;

        const mensagem =
`🎮 ${nick} convida você para jogar ${textoModo[sala.modo] || 'uma partida'} personalizado
🎯 ${eloLinha}
👥 ${jogadores.length}/${sala.maxJogadores} vagas preenchidas
💰 ${premio}
👇 Entre aqui

${link}`;

        navigator.clipboard.writeText(mensagem);
        setCompartilhado(true);
        if (compartilhadoTimeoutRef.current) clearTimeout(compartilhadoTimeoutRef.current);
        compartilhadoTimeoutRef.current = setTimeout(() => setCompartilhado(false), 2000);
        toast.success('Mensagem de convite copiada!');
    };
```

- [ ] **Step 3: Adicionar o botão no header da sala**

No header da sala, dentro do `<div className="flex items-center gap-[5vmin] z-10">` que começa na linha 306, **antes do bloco do botão de excluir** (que começa com o comentário `{/* Excluir sala — só admin/proprietário... */}` na linha 322), adicionar:

```tsx
                    {/* Compartilhar sala — copia convite formatado */}
                    <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={compartilharSala}
                        className="w-[5vmin] h-[5vmin] rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 flex items-center justify-center text-[#FFB700] hover:bg-[#FFB700]/20 transition-colors backdrop-blur-md"
                        title="Compartilhar sala"
                    >
                        {compartilhado ? (
                            <Check className="w-[2.2vmin] h-[2.2vmin] text-green-400" />
                        ) : (
                            <Share2 className="w-[2.2vmin] h-[2.2vmin]" />
                        )}
                    </motion.button>
```

- [ ] **Step 4: Limpar timeout ao desmontar**

A função `compartilharSala` não é chamada fora de `onClick`, então não precisa de cleanup adicional (o timeout de 2s apenas reseta o ícone; não há risco de memory leak relevante). Nenhuma alteração necessária neste passo — passar para o Step 5.

- [ ] **Step 5: Typecheck**

Run (do diretório raiz do projeto):
```bash
npx tsc --noEmit
```
Expected: exit 0, sem erros. Se o workspace do web tiver tsconfig próprio, rodar na pasta `web/`:
```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 6: Build do front para confirmar**

Run (na pasta `web/`):
```bash
npm run build
```
Expected: build concluído com sucesso (Vite emite o bundle).

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/SalaMod1.tsx
git commit -m "feat(web): botao compartilhar sala copia convite formatado"
```

## Self-Review

- **Spec coverage:** botão na tela da sala ✓ (Step 3); copia mensagem formatada ✓ (Step 2); formato exato com Nick, modo, elo (Free Elo / mínimo), vagas, M7Coins e link ✓ (Step 2); nome da sala fora da mensagem ✓; typecheck + build ✓ (Steps 5-6).
- **Placeholder scan:** nenhum "TBD"/"TODO"; todo o código está no plano.
- **Type consistency:** `compartilharSala`, `compartilhado` e `compartilhadoTimeoutRef` usados de forma consistente entre Steps 2 e 3; `textoModo` tipado como `Record<string, string>` com `sala.modo` acessado por índice (string) — compatível com o `any` de `sala`.
