import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_RULES,
  getDraftRules,
  temDraft,
  getTurnOrder,
  DRAFT_TURN_MS,
} from "../src/lib/draft/index.js";
import { toLegacyMatch } from "../src/lib/match-shape.js";

describe("draft: registry de regras por modo", () => {
  test("5v5: draft de 20 turnos, 5 slots por lado, MID é o capitão (só ele age)", () => {
    const r = getDraftRules("5v5");
    assert.equal(r.ativo, true, "5v5: tem draft");
    assert.equal(r.turnOrder.length, 20, "5v5: 20 turnos");
    assert.equal(r.maxBansPorLado, 5, "5v5: 5 bans por lado");
    assert.equal(r.maxPicksPorLado, 5, "5v5: 5 picks por lado");
    assert.equal(r.esconderPicksAdversario, false, "5v5: tudo visível");
    assert.equal(r.roleControladora, "MID", "5v5: o MID bane/escolhe");
    assert.equal(r.apenasRoleControladora, true, "5v5: só a role controladora age");
    assert.equal(temDraft("5v5"), true);
    assert.equal(getTurnOrder("5v5"), r.turnOrder, "5v5: ordem vem do registry");
  });

  test("time_vs_time: mesmo draft, vitrine JG e qualquer role age (sem capitão)", () => {
    const r = getDraftRules("time_vs_time");
    assert.equal(r.ativo, true);
    assert.equal(r.turnOrder.length, 20);
    assert.equal(r.roleControladora, "JG", "time_vs_time: vitrine do JG");
    assert.equal(r.apenasRoleControladora, false, "time_vs_time: qualquer participante do lado age");
    assert.equal(temDraft("time_vs_time"), true);
    assert.equal(getTurnOrder("time_vs_time"), r.turnOrder);
  });

  test("1v1 e aram: SEM draft (ativo=false, ordem vazia)", () => {
    for (const modo of ["1v1", "aram"]) {
      const r = getDraftRules(modo);
      assert.equal(r.ativo, false, `${modo}: pula a fase`);
      assert.deepEqual(r.turnOrder, [], `${modo}: sem turnos`);
      assert.equal(r.maxBansPorLado, 0, modo);
      assert.equal(r.maxPicksPorLado, 0, modo);
      assert.equal(temDraft(modo), false, modo);
    }
  });

  test("a ordem dos turnos bate com os slots declarados (ban/pick por lado)", () => {
    for (const modo of Object.keys(DRAFT_RULES)) {
      const r = DRAFT_RULES[modo];
      if (!r.ativo) continue;
      const contar = (team: "blue" | "red", phase: "ban" | "pick") =>
        r.turnOrder.filter((t) => t.team === team && t.phase === phase).length;

      assert.equal(contar("blue", "ban"), r.maxBansPorLado, `${modo}: bans azuis`);
      assert.equal(contar("red", "ban"), r.maxBansPorLado, `${modo}: bans vermelhos`);
      assert.equal(contar("blue", "pick"), r.maxPicksPorLado, `${modo}: picks azuis`);
      assert.equal(contar("red", "pick"), r.maxPicksPorLado, `${modo}: picks vermelhos`);
      assert.equal(r.turnOrder.length, (r.maxBansPorLado + r.maxPicksPorLado) * 2, `${modo}: total de turnos`);
    }
  });

  test("modo desconhecido cai no fallback 5v5 (comportamento histórico)", () => {
    assert.equal(getDraftRules("3v3"), DRAFT_RULES["5v5"]);
  });
});

describe("draft: shape publica as regras do modo (o front não decide)", () => {
  const draftRow = {
    blueBans: [],
    bluePicks: [],
    redBans: [],
    redPicks: [],
    currentTurn: 0,
    currentPhase: "ban",
    currentTeam: "blue",
    turnDeadlineAt: new Date(),
    status: "ongoing",
  };

  test("sala 5v5 em draft → regras snake_case + duração do turno", () => {
    const shape = toLegacyMatch(
      { mode: "5v5", salaNum: 1, status: "draft", createdAt: new Date() },
      [],
      "Dono",
      0,
      null,
      draftRow
    );
    assert.ok(shape.draft, "shape traz o draft");
    assert.equal(shape.draft.duracao_turno_ms, DRAFT_TURN_MS);
    assert.deepEqual(shape.draft.regras, {
      max_bans_por_lado: 5,
      max_picks_por_lado: 5,
      esconder_picks_adversario: false,
      role_controladora: "MID",
      apenas_role_controladora: true,
    });
  });

  test("sala sem draft → shape.draft null (1v1/ARAM e estados fora do draft)", () => {
    const shape = toLegacyMatch(
      { mode: "1v1", salaNum: 2, status: "iniciando_partida", createdAt: new Date() },
      [],
      "Dono"
    );
    assert.equal(shape.draft, null);
  });
});
