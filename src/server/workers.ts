import cron from 'node-cron';

async function syncTwitchStreams() {
  console.log('[Worker] Executando syncTwitchStreams...');
}

async function syncRiotAccounts() {
  console.log('[Worker] Executando syncRiotAccounts...');
}

export function startBackgroundWorkers() {
  // Cron Twitch a cada 5 minutos
  cron.schedule('*/5 * * * *', () => {
    syncTwitchStreams().catch((err) => console.error('[Worker Twitch] Erro:', err));
  });

  // Sync Riot a cada 1 hora
  cron.schedule('0 * * * *', () => {
    syncRiotAccounts().catch((err) => console.error('[Worker Riot] Erro:', err));
  });

  console.log('[Workers] Cronjobs iniciados (Twitch: 5m, Riot: 1h).');
}

startBackgroundWorkers();
