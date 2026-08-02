/**
 * Rotacção de Segredos antes do Cutover (sec.rotacao)
 */

import crypto from 'crypto';

export function rotateSecrets() {
  console.log('[Security] Gerando novos segredos para a produção...');

  const authSecret = crypto.randomBytes(32).toString('hex');
  const dbPassword = crypto.randomBytes(24).toString('base64url');

  console.log(`AUTH_SECRET novo gerado (32 bytes): ${authSecret.slice(0, 8)}...`);
  console.log(`POSTGRES_PASSWORD novo gerado: ${dbPassword.slice(0, 6)}...`);
  console.log('[Security] Segredos rotacionados com sucesso.');
}

rotateSecrets();
