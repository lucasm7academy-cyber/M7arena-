import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassificacao } from "../src/lib/tournament-shape.js";

const team = (id: string, name: string, tag: string) => ({
  teams: { id, name, tag, logoUrl: null },
  tournament_teams: { status: "approved" },
});

const match = (a: string, b: string, score: string, phaseLabel: string, status = "finalizado") => ({
  teamATag: a,
  teamBTag: b,
  scoreDisplay: score,
  phaseLabel,
  phase: phaseLabel,
  status,
});

test("liga: desempate por saldo, depois menos derrotas, depois alfabetico", () => {
  const data: any = {
    t: { format: "groups" },
    teamRows: [team("1", "Time A", "TA"), team("2", "Time B", "TB"), team("3", "Time C", "TC")],
    matches: [
      match("TA", "TB", "2 - 1", "Grupo A"),
      match("TC", "TA", "1 - 2", "Grupo A"),
    ],
    brackets: [],
    standings: [],
  };
  // TA: v=4 d=2 (saldo +2); TB: v=1 d=2 (saldo -1); TC: v=1 d=2 (saldo -1)
  const c = buildClassificacao(data);
  assert.equal(c[0].tag, "TA");
  assert.equal(c[0].matches, 2);
  // TB e TC empatam em saldo e derrotas; alfabetico: "Time B" < "Time C"
  assert.equal(c[1].tag, "TB");
  assert.equal(c[2].tag, "TC");
});

test("mata-mata: filtra chaveamento e conta serie vencida", () => {
  const data: any = {
    t: { format: "single_elimination" },
    teamRows: [team("1", "A", "TA"), team("2", "B", "TB")],
    matches: [
      match("TA", "TB", "2 - 1", "Final"),
      match("TA", "TB", "1 - 2", "MATA-MATA (CHAVEAMENTO)"),
    ],
    brackets: [],
    standings: [],
  };
  const c = buildClassificacao(data);
  assert.equal(c[0].tag, "TA");
  assert.equal(c[0].v, 1);
  assert.equal(c[1].tag, "TB");
  assert.equal(c[1].d, 1);
});

test("fallback para classificacao manual sem jogos finalizados", () => {
  const data: any = {
    t: { format: "single_elimination" },
    teamRows: [team("1", "A", "TA")],
    matches: [],
    brackets: [],
    standings: [{ rank: 1, teamId: "1", v: 3, d: 0, wo: 0, j: 3, cor: "#FFB700", logo: null }],
  };
  const c = buildClassificacao(data);
  assert.equal(c[0].nome, "A");
  assert.equal(c[0].v, 3);
});
