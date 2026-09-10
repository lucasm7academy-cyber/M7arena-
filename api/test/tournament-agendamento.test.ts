import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { jogoConfirmadoSemHorario } from "../src/lib/tournament-store.js";

describe("jogoConfirmadoSemHorario (agendamento)", () => {
  test("confirmado com data e hora válidas → ok", () => {
    assert.equal(
      jogoConfirmadoSemHorario({ status: "confirmado", data: "2026-09-11", hora: "20:00" }),
      false
    );
  });

  test("confirmado sem hora (ou sem o campo) → inválido", () => {
    assert.equal(
      jogoConfirmadoSemHorario({ status: "confirmado", data: "2026-09-11", hora: "--:--" }),
      true
    );
    assert.equal(jogoConfirmadoSemHorario({ status: "confirmado", data: "2026-09-11" }), true);
  });

  test("confirmado sem data (A COMBINAR) → inválido", () => {
    assert.equal(
      jogoConfirmadoSemHorario({ status: "confirmado", data: "A COMBINAR", hora: "20:00" }),
      true
    );
  });

  test("proposto/finalizado sem hora → não bloqueia", () => {
    assert.equal(
      jogoConfirmadoSemHorario({ status: "proposto", data: "A COMBINAR", hora: "--:--" }),
      false
    );
    assert.equal(jogoConfirmadoSemHorario({ status: "finalizado", hora: "--:--" }), false);
  });

  test("aceita o shape legado displayDate/displayTime", () => {
    assert.equal(
      jogoConfirmadoSemHorario({ status: "confirmado", displayDate: "2026-09-11", displayTime: "20:00" }),
      false
    );
    assert.equal(
      jogoConfirmadoSemHorario({ status: "confirmado", displayDate: "A COMBINAR", displayTime: "20:00" }),
      true
    );
  });
});
