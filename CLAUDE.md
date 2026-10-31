# M7Arena — leia o AGENTS.md

As regras deste projeto estão em **[`AGENTS.md`](./AGENTS.md)**, na raiz. Leia antes de qualquer coisa.

Resumo do que você não pode deixar de fazer:

1. **Chame a tool `status_brief` do MCP `m7-status` antes de começar.** Ela te dá o contexto do projeto: o que já foi feito, o que está em andamento e quais decisões já foram tomadas. Sem isso você vai refazer trabalho pronto.
2. **O design atual é a referência.** Não redesenhe nada nem altere `className`, cores ou espaçamentos sem o usuário pedir.
3. **Regra de negócio e segredo ficam no servidor.** Nada de decisão de pagamento/saldo no cliente; nada de chave em `VITE_*`.
4. **Ao terminar, chame `set_component_status` e `log_session`.** É assim que o próximo agente sabe o que você fez.
5. **Nunca edite `statusdoprojeto.md` à mão** — ele é gerado pelo MCP.

Se o MCP `m7-status` não estiver disponível na sua sessão, use o CLI oficial em `mcp/status-server/scripts/cli.js` e avise o usuário. A configuração está em `.mcp.json`.
