# Testes React/DOM

Em `web/`, execute `npm run test:dom`. Para filtrar, acrescente
`-- src/caminho/arquivo.dom.test.tsx`. Vitest encontra `src/**/*.dom.test.ts(x)`;
os testes existentes de `node:test` continuam separados. Na raiz do projeto:
`node --test web/src/features/campeonatos/domain/agendamento.test.ts`.

Use React real (`createRoot` e `await act`) no jsdom e `vi.mock` para SDK,
autenticação e perfil. O exemplo [infra.dom.test.tsx](infra.dom.test.tsx) prova
montagem, efeitos, estado, timers e cleanup. Desmonte a raiz em `finally` e
remova seu container. Use fake timers somente quando o cenário precisar deles.
O [setup](setup.ts) habilita `act`, bloqueia fetch/WebSocket e restaura mocks,
globais e timers após cada teste. Não habilite rede nem use identidades reais.

Vitest 5.1.0 e jsdom 29.1.1 são dependências de desenvolvimento fixadas para
Node 24.14 e Vite 6.4.1 existentes. Instalação não altera dependências de produção.
O jsdom não verifica layout, pintura, rolagem ou integração real de navegador.
Essas homologações continuam separadas dos testes DOM.
