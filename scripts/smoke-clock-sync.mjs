// scripts/smoke-clock-sync.mjs — prova que a correção de skew (Fase 2 do
// ajustarsala) alinha os timers de dois clientes com relógios OPOSTOS.
//
// Cenário real (bug B): o servidor define `confirmacao_expires_at` absoluto.
// O cliente A com relógio ADIANTADO e o cliente B com relógio ATRASADO
// calculavam tempos restantes diferentes (ex.: 20s vs 75s) usando Date.now().
//
// Este script importa o código REAL de web/src/lib/clockSync.ts, simula os
// dois clientes com skews opostos e verifica que `agoraServidor()` converge
// para o MESMO tempo em ambos.
//
// Rodar (na pasta api/, que tem o tsx): npx tsx ../scripts/smoke-clock-sync.mjs

// O script é .mjs mas importa um .ts — o tsx resolve e transpila.
// Importamos via caminho relativo do arquivo real do front.
const clock = await import("../web/src/lib/clockSync.js");

const { registrarServerTime, agoraServidor, _resetOffset } = clock;

// ── Relógio simulado ──
// `relogioRealMs` é o tempo "verdadeiro" compartilhado (o servidor e o mundo).
// Cada cliente tem um skew (quanto o relógio dele diverge do real).
let relogioRealMs = 1_700_000_000_000;
let skewDoCliente = 0; // ms: positivo = relógio adiantado, negativo = atrasado
let ticks = 0;

// Instala Date.now simulado ANTES de qualquer uso do módulo.
const originalDateNow = Date.now;
Date.now = () => relogioRealMs + skewDoCliente;

let ok = 0;
const check = (cond, label) => {
  if (cond) { ok++; console.log(`  ok ${label}`); }
  else { console.log(`  X ${label}`); process.exitCode = 1; }
};

function clienteComSkew(skew) {
  return {
    adiantado: skew > 0,
    skewMs: skew,
    relogioLocal: () => relogioRealMs + skew,
  };
}

// ═══════════════ TESTE 1: dois clientes, skews opostos, mesmo deadline ═════
console.log("\n=== TESTE 1: cliente A adiantado (+5min) x cliente B atrasado (-3min) ===\n");

// Servidor responde `server_time` = relógio real (sem skew).
const serverTime = relogioRealMs;
const deadline = serverTime + 60_000; // confirmacao_expires_at = agora + 60s

const clienteA = clienteComSkew(300_000); // +5min
const clienteB = clienteComSkew(-180_000); // -3min

// Sem correção (o bug): cada um calcula com o relógio local cru.
const semCorrecaoA = Math.round((deadline - clienteA.relogioLocal()) / 1000);
const semCorrecaoB = Math.round((deadline - clienteB.relogioLocal()) / 1000);
console.log(`  SEM correção -> A vê ${semCorrecaoA}s, B vê ${semCorrecaoB}s (${Math.abs(semCorrecaoA - semCorrecaoB)}s de divergência)`);
check(semCorrecaoA !== semCorrecaoB, "sem correção os dois DIVERGEM (é o bug B)");

// Com correção: cada cliente registra o server_time da MESMA resposta.
// Cliente A
skewDoCliente = clienteA.skewMs;
_resetOffset();
registrarServerTime(serverTime);
const tempoRestanteA = Math.max(0, Math.round((deadline - agoraServidor()) / 1000));

// Cliente B
skewDoCliente = clienteB.skewMs;
_resetOffset();
registrarServerTime(serverTime);
const tempoRestanteB = Math.max(0, Math.round((deadline - agoraServidor()) / 1000));

console.log(`  COM correção -> A vê ${tempoRestanteA}s, B vê ${tempoRestanteB}s`);
check(tempoRestanteA === tempoRestanteB, `ambos veem o mesmo tempo restante (${tempoRestanteA}s)`);
check(tempoRestanteA === 60, "e é exatamente o deadline do servidor (60s)");

// ═══════════════ TESTE 2: skew pequeno (rede, NTP leve) não diverge ════════
console.log("\n=== TESTE 2: skews pequenos de rede (±2s) ===\n");

const clienteC = clienteComSkew(2_000);
const clienteD = clienteComSkew(-1_500);

skewDoCliente = clienteC.skewMs;
_resetOffset();
registrarServerTime(serverTime);
const rC = Math.max(0, Math.round((deadline - agoraServidor()) / 1000));

skewDoCliente = clienteD.skewMs;
_resetOffset();
registrarServerTime(serverTime);
const rD = Math.max(0, Math.round((deadline - agoraServidor()) / 1000));

check(rC === rD, `skew de rede não diverge (${rC}s == ${rD}s)`);

// ═══════════════ TESTE 3: média suave converge com medições ruidosas ═══════
console.log("\n=== TESTE 3: offset converge com medições com latência variada ===\n");

skewDoCliente = 0;
_resetOffset();
// 3 medições com latências (server_time chega "atrasado" conforme a rede)
registrarServerTime(serverTime); // sem latência
registrarServerTime(serverTime - 50); // 50ms de rede
registrarServerTime(serverTime - 120); // 120ms de rede
registrarServerTime(serverTime - 30);
const convergido = agoraServidor();
check(Math.abs(convergido - serverTime) < 100, `offset converge para o relógio do servidor (erro < 100ms: ${Math.abs(convergido - serverTime)}ms)`);

// Limpa o mock
Date.now = originalDateNow;

console.log(`\n=== RESULTADO: ${ok} ok ===\n`);
process.exit(ok === 5 ? 0 : 1);
