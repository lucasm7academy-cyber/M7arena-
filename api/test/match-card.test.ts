import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toLegacyMatch, toLegacyMatchCard } from "../src/lib/match-shape.js";

const salaBase = {
  id: "uuid-interno",
  salaNum: 217,
  nome: "Sala teste",
  descricao: "desc",
  mode: "5v5",
  status: "preenchendo",
  createdBy: "user-1",
  maxJogadores: 10,
  entryMp: 0,
  temSenha: true,
  apostaMc: 0,
  timeANome: "M7W",
  timeBNome: "BKA",
  createdAt: new Date("2026-10-30T12:00:00Z"),
  winnerSide: null,
};

/**
 * Contrato da vitrine /jogar: o polling de 15s usa `view=card`. Se alguém
 * voltar a mandar jogadores enriquecidos/draft/código nesse shape, o polling
 * fica caro de novo — estes testes seguram a regressão.
 */
describe("card da vitrine /jogar", () => {
  test("devolve só o que o card desenha", () => {
    const card: any = toLegacyMatchCard(salaBase, 4, "Fulano");
    assert.equal(card.id, 217);
    assert.equal(card.match_id, "uuid-interno");
    assert.equal(card.jogadores_count, 4);
    assert.equal(card.criador_nome, "Fulano");
    assert.equal(card.tem_senha, true);
    assert.equal(card.estado, "preenchendo");
    assert.equal(card.modo, "5v5");
    assert.equal(card.time_a_nome, "M7W");
    assert.equal(card.vencedor, null);

    for (const pesado of [
      "jogadores",
      "senha",
      "codigo_partida",
      "draft",
      "resultado_riot",
      "server_time",
      "campeonato",
    ]) {
      assert.equal(card[pesado], undefined, `card não deve conter ${pesado}`);
    }
  });

  test("vencedor segue o shape legado (A/B/empate)", () => {
    assert.equal((toLegacyMatchCard({ ...salaBase, winnerSide: "blue" }, 0) as any).vencedor, "A");
    assert.equal((toLegacyMatchCard({ ...salaBase, winnerSide: "red" }, 0) as any).vencedor, "B");
    assert.equal((toLegacyMatchCard({ ...salaBase, winnerSide: "draw" }, 0) as any).vencedor, "empate");
  });

  test("shape completo continua com jogadores e código (sem regressão)", () => {
    const full: any = toLegacyMatch(salaBase, [], "Fulano");
    assert.ok(Array.isArray(full.jogadores));
    assert.equal(full.id, 217);
    assert.equal(full.codigo_partida, null);
  });
});
