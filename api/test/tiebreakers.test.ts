import { test } from "node:test";
import assert from "node:assert/strict";
import { appendTiebreakers } from "../src/lib/tournament-tiebreakers.js";

test("gera desempate quando ha empate na fronteira de classificacao", () => {
  const campeonato: any = {
    formato: "liga",
    grupos: { "Grupo A": [{ tag: "TA" }, { tag: "TB" }, { tag: "TC" }] },
    times_inscritos: [
      { tag: "TA", name: "A" },
      { tag: "TB", name: "B" },
      { tag: "TC", name: "C" },
    ],
    cronograma: [
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TB", placar: "1 - 0" },
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TC", placar: "0 - 1" },
      { fase: "Grupo A", status: "finalizado", timeA: "TB", timeB: "TC", placar: "1 - 0" },
    ],
  };
  // TA: 1V1D, TB: 1V1D, TC: 1V1D — empate triplo, threshold=1 → desempate entre 1º e 2º
  const out = appendTiebreakers(campeonato, "Grupo A");
  assert.ok(out.cronograma.some((j: any) => j.fase === "DESEMPATE - Grupo A"));
  const d = out.cronograma.find((j: any) => j.fase === "DESEMPATE - Grupo A");
  assert.equal(d.status, "combinando");
});

test("nao gera desempate para fase final", () => {
  const campeonato: any = {
    formato: "liga",
    grupos: {},
    times_inscritos: [],
    cronograma: [],
  };
  const out = appendTiebreakers(campeonato, "Fase Final");
  assert.equal(out.cronograma.length, 0);
});

test("nao gera desempate quando jogos do grupo nao terminaram", () => {
  const campeonato: any = {
    formato: "liga",
    grupos: { "Grupo A": [{ tag: "TA" }, { tag: "TB" }] },
    times_inscritos: [{ tag: "TA", name: "A" }, { tag: "TB", name: "B" }],
    cronograma: [
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TB", placar: "1 - 0" },
      { fase: "Grupo A", status: "combinando", timeA: "TA", timeB: "TB", placar: "" },
    ],
  };
  const out = appendTiebreakers(campeonato, "Grupo A");
  assert.equal(out.cronograma.length, 2);
});

test("e idempotente: nao duplica desempate ja existente", () => {
  const campeonato: any = {
    formato: "liga",
    grupos: { "Grupo A": [{ tag: "TA" }, { tag: "TB" }, { tag: "TC" }] },
    times_inscritos: [
      { tag: "TA", name: "A" },
      { tag: "TB", name: "B" },
      { tag: "TC", name: "C" },
    ],
    cronograma: [
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TB", placar: "1 - 0" },
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TC", placar: "0 - 1" },
      { fase: "Grupo A", status: "finalizado", timeA: "TB", timeB: "TC", placar: "1 - 0" },
      { fase: "DESEMPATE - Grupo A", status: "combinando", timeA: "TA", timeB: "TB", placar: "" },
    ],
  };
  const out = appendTiebreakers(campeonato, "Grupo A");
  assert.equal(out.cronograma.length, 4);
});
