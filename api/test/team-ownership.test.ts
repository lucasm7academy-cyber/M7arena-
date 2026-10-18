import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolverNovoDono } from "../src/lib/team-ownership.js";

const U = (n: number) => `ccccccc8-0000-0000-0000-00000000000${n}`;

describe("team-ownership — quem tiver a coroa é o dono (ADR-089)", () => {
  test("coroa muda de dono: o coroado vira owner_id e o antigo perde", () => {
    const novo = resolverNovoDono(
      [
        { userId: U(1), isCaptain: false }, // antigo dono, perdeu a coroa
        { userId: U(2), isCaptain: true },  // novo coroado
      ],
      U(1)
    );
    assert.equal(novo, U(2));
  });

  test("coroa no mesmo dono de antes: no-op", () => {
    const novo = resolverNovoDono(
      [{ userId: U(1), isCaptain: true }, { userId: U(2), isCaptain: false }],
      U(1)
    );
    assert.equal(novo, null);
  });

  test("coroa num convidado (sem conta) não troca o dono que continua no time", () => {
    const novo = resolverNovoDono(
      [
        { userId: U(1), isCaptain: false },
        { userId: null, isCaptain: true }, // guest coroado
      ],
      U(1)
    );
    assert.equal(novo, null, "dono atual continua no time e ninguém com conta foi coroado");
  });

  test("dono fora do lineup: coroa cai para o primeiro membro com conta", () => {
    const novo = resolverNovoDono(
      [
        { userId: null, isCaptain: false }, // guest
        { userId: U(2), isCaptain: false },
        { userId: U(3), isCaptain: false },
      ],
      U(1) // dono antigo não está mais no lineup
    );
    assert.equal(novo, U(2), "primeiro com conta herda o time");
  });

  test("dono fora do lineup e time só de convidados: fica sem dono", () => {
    const novo = resolverNovoDono(
      [{ userId: null, isCaptain: true }, { userId: null, isCaptain: false }],
      U(1)
    );
    assert.equal(novo, null, "não há user_id real para herdar");
  });

  test("lineup vazio: sem dono novo", () => {
    assert.equal(resolverNovoDono([], U(1)), null);
  });
});
