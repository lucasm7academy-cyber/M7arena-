import test from "node:test";
import assert from "node:assert/strict";
import {
  QUEUE_CUSTOM_BLIND,
  QUEUE_HOWLING_ABYSS,
  QUEUE_SUMMONERS_RIFT,
  queueDoCodigo,
} from "../src/lib/verificar-partida.js";

test("queueDoCodigo reconhece blind BR05116 como 3100", () => {
  assert.equal(queueDoCodigo("BR05116-a3f7a6fa-2354-41f3-933e-2ca8b94184be"), QUEUE_CUSTOM_BLIND);
  assert.equal(queueDoCodigo("BR05116-QUALQUER", "5v5"), QUEUE_CUSTOM_BLIND);
});

test("queueDoCodigo mantém 5v5 Tournament Draft em 3130", () => {
  assert.equal(queueDoCodigo("BR04fa2-QUALQUER"), QUEUE_SUMMONERS_RIFT);
  assert.equal(queueDoCodigo(null, "5v5"), QUEUE_SUMMONERS_RIFT);
});

test("queueDoCodigo mantém 1v1 ARAM em 3200", () => {
  assert.equal(queueDoCodigo("BR050c8-QUALQUER"), QUEUE_HOWLING_ABYSS);
  assert.equal(queueDoCodigo(null, "1v1"), QUEUE_HOWLING_ABYSS);
});
