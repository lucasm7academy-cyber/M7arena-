// =============================================================================
// CÓDIGOS DE PARTIDA POR MÓDULO
// Sistema de rodízio automático sem queries ao banco
// Cada vez que um código é usado, o próximo é selecionado automaticamente
// =============================================================================

export const CODIGOS_PARTIDA: Record<string, string[]> = {
    '1v1': [
        'BR04fa2-4611cfe4-f5fd-47da-8497-0b9edb308d83',
        'BR04fa2-ca5d28f8-28c3-4b03-a212-0ab9dbf237bc',
        'BR04fa2-8ad0a8b7-4d00-4ce9-9272-46c6a5ec7f53',
        'BR04fa2-4acc3d6d-923c-49b6-b9d8-2ebbb8acbad3',
    ],
    '5v5': [
        'BR04fa2-4611cfe4-f5fd-47da-8497-0b9edb308d83',
        'BR04fa2-ca5d28f8-28c3-4b03-a212-0ab9dbf237bc',
        'BR04fa2-8ad0a8b7-4d00-4ce9-9272-46c6a5ec7f53',
        'BR04fa2-4acc3d6d-923c-49b6-b9d8-2ebbb8acbad3',
    ],
    'aram': [
        'BR04fa2-4611cfe4-f5fd-47da-8497-0b9edb308d83',
        'BR04fa2-ca5d28f8-28c3-4b03-a212-0ab9dbf237bc',
        'BR04fa2-8ad0a8b7-4d00-4ce9-9272-46c6a5ec7f53',
        'BR04fa2-4acc3d6d-923c-49b6-b9d8-2ebbb8acbad3',
    ],
    'Time vs Time': [
        'BR04fa2-4611cfe4-f5fd-47da-8497-0b9edb308d83',
        'BR04fa2-ca5d28f8-28c3-4b03-a212-0ab9dbf237bc',
        'BR04fa2-8ad0a8b7-4d00-4ce9-9272-46c6a5ec7f53',
        'BR04fa2-4acc3d6d-923c-49b6-b9d8-2ebbb8acbad3',
    ],
};

/**
 * Retorna o próximo código de partida para o módulo especificado
 * Usa localStorage para rastrear o índice (rodízio automático)
 * Sem queries ao banco de dados
 * @param modo - módulo do jogo ('1v1', '5v5', 'aram', etc)
 * @returns código de partida
 */
export const getProximoCodigoPartida = (modo: string): string => {
    const codigos = CODIGOS_PARTIDA[modo] || CODIGOS_PARTIDA['5v5'];

    if (!codigos || codigos.length === 0) {
        return 'CODIGO-PADRAO-0000';
    }

    // Rastreia o índice por módulo em localStorage
    const chave = `codigo_partida_index_${modo}`;
    const indiceAtual = parseInt(localStorage.getItem(chave) || '0', 10);

    // Pega o código no índice atual
    const codigoAtual = codigos[indiceAtual % codigos.length];

    // Calcula próximo índice (rodízio: 0→1→2→...→0)
    const proximoIndice = (indiceAtual + 1) % codigos.length;
    localStorage.setItem(chave, proximoIndice.toString());

    if (import.meta.env.DEV) {
    }

    return codigoAtual;
};

/**
 * Reseta o índice de códigos para um módulo (útil para debug)
 */
export const resetarIndiceCodigo = (modo: string) => {
    localStorage.removeItem(`codigo_partida_index_${modo}`);
};
