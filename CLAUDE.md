# M7Arena — leia o AGENTS.md

As regras deste projeto estão em **[`AGENTS.md`](./AGENTS.md)**, na raiz. Leia antes de qualquer coisa.

Resumo do que você não pode deixar de fazer:

1. **Chame a tool `status_brief` do MCP `m7-status` antes de começar.** Ela te dá o contexto do projeto: o que já foi feito, o que está em andamento e quais decisões já foram tomadas. Sem isso você vai refazer trabalho pronto.
2. **O design é cópia 1:1 do site atual.** Não redesenhe nada, não altere nenhum `className`.
3. **`D:\Aplicativos\M7AcademySite` é somente leitura.** É o site de produção, continua no ar.
4. **Ao terminar, chame `set_component_status` e `log_session`.** É assim que o próximo agente sabe o que você fez.
5. **Nunca edite `statusdoprojeto.md` à mão** — ele é gerado pelo MCP.

Se o MCP `m7-status` não estiver disponível na sua sessão, avise o usuário em vez de trabalhar sem ele. A configuração está em `.mcp.json`.
