# Baseline e evolução do banco

## Arquivos ativos

| Arquivo | Responsabilidade |
|---|---|
| [0000_baseline.sql](0000_baseline.sql) | Origem consolidada: 48 tabelas públicas, 530 colunas, 139 restrições, 134 índices e duas sequências; catálogo inicial de jogos e pacotes. |
| [meta/0000_snapshot.json](meta/0000_snapshot.json) | Modelo estrutural inicial usado pelo gerador do Drizzle para calcular mudanças seguintes. |
| [meta/_journal.json](meta/_journal.json) | Ordem e timestamp das migrations ativas. |

A baseline reconstrói estrutura; não copia registros de produção. Usuários,
carteiras, pagamentos, histórico, Pix e códigos Riot ficam vazios. Códigos fictícios
existem somente nas fixtures dos testes. Instalação nova precisa de configuração
e provisionamento autorizado do pool Riot para operar salas reais.

## Banco novo e banco existente

`npm run db:migrate` aplica somente as migrations pendentes pelo Drizzle, usando
a configuração do projeto. Esse comando conecta ao banco configurado: exige
ambiente isolado para testes e autorização específica em produção.

O timestamp inicial **1785556094468** foi preservado da primeira migration do
projeto. Não é a data da consolidação. O migrador compara esse valor ao histórico
registrado no banco: um banco atual com histórico posterior não reaplica a
baseline. Não houve reset do ledger de migrations nem aplicação desta baseline
na produção para realizar a consolidação.

Essa compatibilidade foi verificada contra a estrutura pública atual consultada
somente em leitura. Não usar a baseline para pular etapas de um banco antigo
incompleto: nesse caso, conferir a estrutura e preparar atualização específica.
Não executar o SQL inicial manualmente sobre um banco já existente.

## Novas tabelas e mudanças

1. Atualize o schema correspondente em `db/schema/` e sua exportação no índice.
2. Execute `npm run db:generate`, revise a migration incremental e os metadados.
3. Teste a reconstrução com baseline + incrementos e o efeito sobre banco já
   existente, em ambiente isolado. Atualize o README do domínio afetado.
4. Aplique na produção somente no lote autorizado, preservando dados.

Não substituir apenas o SQL da baseline quando surgir uma tabela: isso não
atualizaria um banco que já executou aquela etapa. A origem permanece estável,
e os incrementos mantêm o banco existente e a reconstrução nova coerentes.
Consolidar novamente o histórico é uma intervenção explícita com nova validação.

O snapshot e journal atuais são necessários ao fluxo escolhido. Não apagar JSON
ativos por serem antigos nem editar seus identificadores/timestamps manualmente.
O histórico anterior está no Git, sem cópias ou pastas de arquivo no projeto.

## Verificação e limites

Em `api/`, com dependências já instaladas:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY=''
.\node_modules\.bin\tsx.cmd --test --test-concurrency=1 test/baseline.test.ts
```

O teste reconstrói PGlite e compara hashes do catálogo público conferido na VPS:
tipos/defaults/nulidade, PK/FK/unique/check, índices e predicados, tabelas/RLS,
sequências e enums. A diferença de representação de NOT NULL entre PostgreSQL
16 e o PostgreSQL do PGlite é normalizada; nulidade continua conferida nas colunas.
Não há funções ou triggers próprios na estrutura pública de referência.

Não compara dados reais, roles globais, permissões fora desse catálogo ou
ambientes diferentes. A revisão seguinte da baseline deve conferir novamente
esses limites e os fingerprints do teste. Consulte [db/README.md](../README.md).
