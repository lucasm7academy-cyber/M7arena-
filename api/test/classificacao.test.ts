import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildClassificacao } from "../src/lib/tournament-shape.js";

const team = (id: string, name: string, tag: string, status = "approved") => ({
  teams: { id, name, tag, logoUrl: `/${tag}.png` },
  tournament_teams: { status },
});

describe("buildClassificacao", () => {
  test("sem jogos finalizados, inclui todos os aprovados e preserva os valores manuais", () => {
    const rows = buildClassificacao({
      t: { format: "groups" },
      matches: [],
      teamRows: [
        team("t1", "AMATERASU E-SPORTS", "AMS"),
        team("t2", "Cães De Caça", "CDC"),
        team("t3", "EMPI Academy", "EMPA"),
        team("t4", "EMPI Esports", "EMPI"),
      ],
      standings: [
        { teamId: "t2", rank: 2, v: 3, d: 1, wo: 0, j: 4, cor: "#fff", logo: "/manual-cdc.png" },
        { teamId: "t1", rank: 1, v: 4, d: 0, wo: 0, j: 4, cor: "#000", logo: "/manual-ams.png" },
      ],
    });

    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((r: any) => r.tag), ["AMS", "CDC", "EMPA", "EMPI"]);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].v, 4);
    assert.equal(rows[0].logo, "/manual-ams.png");
    assert.equal(rows[1].rank, 2);
    assert.equal(rows[1].v, 3);
    assert.equal(rows[1].logo, "/manual-cdc.png");
    assert.equal(rows[2].rank, 3);
    assert.equal(rows[2].v, 0);
    assert.equal(rows[3].rank, 4);
  });

  test("não inclui classificação manual de time que não está aprovado", () => {
    const rows = buildClassificacao({
      t: { format: "groups" },
      matches: [],
      teamRows: [
        team("t1", "APROVADO", "APR"),
        team("t2", "REJEITADO", "REJ", "rejected"),
      ],
      standings: [
        { teamId: "t1", rank: 1, v: 2, d: 0, wo: 0, j: 2 },
        { teamId: "t2", rank: 2, v: 5, d: 0, wo: 0, j: 5 },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].tag, "APR");
    assert.equal(rows[0].v, 2);
  });

  test("com jogos finalizados, deriva do cronograma e inclui todos os aprovados", () => {
    const rows = buildClassificacao({
      t: { format: "groups" },
      matches: [
        {
          status: "finalizado",
          phase: "group_stage",
          teamATag: "AMS",
          teamBTag: "CDC",
          scoreDisplay: "2 - 1",
        },
      ],
      teamRows: [
        team("t1", "AMATERASU", "AMS"),
        team("t2", "CAES", "CDC"),
        team("t3", "EMPI Academy", "EMPA"),
        team("t4", "EMPI Esports", "EMPI"),
      ],
      standings: [],
    });

    assert.equal(rows.length, 4);
    const byTag = new Map(rows.map((r: any) => [r.tag, r]));
    assert.equal((byTag.get("AMS") as any).v, 2);
    assert.equal((byTag.get("AMS") as any).d, 1);
    assert.equal((byTag.get("CDC") as any).v, 1);
    assert.equal((byTag.get("CDC") as any).d, 2);
    assert.equal((byTag.get("EMPA") as any).v, 0);
    assert.equal((byTag.get("EMPI") as any).v, 0);
  });
});
