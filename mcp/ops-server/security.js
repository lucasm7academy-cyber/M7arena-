/**
 * Blindagem de Segurança do MCP Ops
 * Valida comandos permitidos e sanitiza parâmetros para prevenir command injection.
 */

const ALLOWED_SERVICES = new Set(['app', 'postgres', 'pgbouncer', 'realtime', 'nginx', 'backup', 'mcp-ops']);

function validateService(service) {
  if (!ALLOWED_SERVICES.has(service)) {
    throw new Error(`Serviço não permitido: ${service}. Permitidos: ${Array.from(ALLOWED_SERVICES).join(', ')}`);
  }
}

function sanitizeNumber(num, min = 1, max = 500, fallback = 50) {
  const parsed = parseInt(num, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

module.exports = {
  validateService,
  sanitizeNumber,
};
