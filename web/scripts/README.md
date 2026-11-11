# Ferramentas do frontend

## Otimização de imagens

[optimize-images.mjs](optimize-images.mjs), comando `npm.cmd run images:optimize`
em `web/`, usa `sharp` para processar imagens de `public/images`. Pode converter
arquivos e excluir originais, além de gravar o resultado JSON. Confira os
argumentos e os alvos antes de executar; não é uma validação apenas de leitura.
O arquivo de resultado existente pertence à ferramenta, não é guia de agentes.

## Diagnóstico de bordas

`node scripts/check-cut-borders.mjs src`, em `web/`, executa
[check-cut-borders.mjs](check-cut-borders.mjs). O script procura combinações de
`clipPath` com borda no mesmo elemento e informa arquivo, linha e motivo.
É uma análise textual, sem alteração dos componentes nem homologação visual.

O contrato atual do componente está no
[README da UI compartilhada](../src/components/ui/README.md). Preserve os estados,
estilos e a semântica de cada consumidor ao corrigir uma ocorrência.

Operações transversais de salas, banco e campeonatos pertencem a
[scripts/](../../scripts/README.md).
