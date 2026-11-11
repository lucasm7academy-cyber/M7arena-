# Economia — carteira e interface Pix

Interface compartilhada entre cabeçalho, Perfil e painel Admin. Não tem rota
própria no App; é uma funcionalidade por componentes. A autoridade financeira
está na [API de Economia](../../../../api/src/modules/economy/README.md).

| Componente | Responsabilidade / consumidor |
|---|---|
| [DepositModal](components/DepositModal.tsx) | Container das abas de depósito e saque; montado pelo Layout. Fechar restaura a aba inicial. |
| [DepositTab](components/DepositTab.tsx) | Consulta pacotes, cria pedido Pix, exibe QR/copia código e acompanha status pelo SDK. |
| [SaqueTab](components/SaqueTab.tsx) | Formulário e histórico dos próprios saques; confirma valor e chama API. |
| [SaquesPix](components/SaquesPix.tsx) | Fila administrativa e decisão paid/rejected com decisionId; consumido pelo painel Admin. |
| [CarteiraEStrikes](components/CarteiraEStrikes.tsx) | Saldo disponível/reservado, salas que seguram valores e estado de elegibilidade; consumido por Perfil. |

[LayoutWrapper](../../components/layout/LayoutWrapper.tsx) escuta `m7:open-deposit`
para abrir o modal. Outras features emitem esse evento em vez de criar outro fluxo
Pix. PerfilContext distribui dados de saldo/perfil; o SDK `wallet`, `payments` e
`withdrawals` faz HTTP com sessão. O cadastro de chave Pix fica no Perfil.

Valores calculados para apresentação não autorizam pagamentos. Compra usa
packageId e preço do servidor; saque usa mcAmount e conversão/regras no servidor.
A decisão administrativa registra o estado do pedido; não executa transferência
bancária automática. Não duplicar carteira, gateway ou ledger em outra feature.

## Alterações e verificação

Preserve timers de acompanhamento, estados de pedido, limpeza dos efeitos,
atualização do PerfilContext e erros do SDK. Componentes de recorte/elegibilidade
continuam compartilhados. O histórico de desafios está na feature Apostas.

Não há teste DOM específico dessas interfaces. Para movimentação, comparação e
lint/build verificam imports e bundle. Testes financeiros de serviço são indicados
no README backend e só usam ambiente isolado. Não criar cobranças/saques reais
como validação de estrutura ou documentação.
