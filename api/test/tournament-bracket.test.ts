import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { storeBracket } from "../src/lib/tournament-store.js";
import { buildBracket } from "../src/lib/tournament-shape.js";

const empty = { t1: "", t2: "", s1: 0, s2: 0, winner: null };
const mk = (n: number) => Array(n).fill(null).map(() => ({ ...empty }));

function fakeDb() {
  const inserted: any[] = [];
  const d: any = {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => undefined }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({
      values: async (rows: any[]) => {
        inserted.push(...rows);
      },
    }),
  };
  return { d, inserted };
}

describe("chaveamento: side.left/side.right (Copa Kraken)", () => {
  test("left e right com a mesma rodada não colidem e a árvore volta igual", async () => {
    const { d, inserted } = fakeDb();
    const bracket = {
      upper: { qf: mk(4) },
      lower: { r1: mk(16) },
      preFinal: { ...empty },
      grandFinal: { ...empty },
      side: {
        left: {
          r64: mk(16),
          r32: mk(8),
          r16: mk(4),
          qf: [
            { t1: "ACE", t2: "CRN", s1: 2, s2: 1, winner: "ACE" },
            { t1: "BKS", t2: "DDB", s1: 0, s2: 0, winner: null },
          ],
          sf: [{ ...empty }],
        },
        right: {
          r64: mk(16),
          r32: mk(8),
          r16: mk(4),
          qf: [
            { t1: "TCL", t2: "M7O", s1: 0, s2: 0, winner: null },
            { t1: "NCP", t2: "AES", s1: 2, s2: 0, winner: "NCP" },
          ],
          sf: [{ ...empty }],
        },
        grandFinal: { t1: "ACE", t2: "NCP", s1: 1, s2: 2, winner: "NCP" },
      },
    };

    await storeBracket("tid-teste", bracket, d);

    // Era o que estourava: duplicate key em bracket_matches_cell_idx.
    const keys = inserted.map((r) => `${r.section}|${r.round}|${r.slot}`);
    assert.equal(new Set(keys).size, keys.length);

    assert.ok(
      inserted.some(
        (r) => r.section === "side" && r.round === "left_qf" && r.slot === 0 && r.teamATag === "ACE"
      )
    );
    assert.ok(
      inserted.some(
        (r) => r.section === "side" && r.round === "right_qf" && r.slot === 0 && r.teamATag === "TCL"
      )
    );
    assert.ok(
      inserted.some(
        (r) => r.section === "side" && r.round === "grand_final" && r.winnerSide === "NCP"
      )
    );

    const shape: any = buildBracket({ brackets: inserted } as any);
    assert.equal(shape.side.left.qf[0].t1, "ACE");
    assert.equal(shape.side.left.qf[0].winner, "ACE");
    assert.equal(shape.side.right.qf[1].t1, "NCP");
    assert.equal(shape.side.grandFinal.winner, "NCP");
  });
});
