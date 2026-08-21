/**
 * bracket.ts — funções puras do chaveamento de campeonato (ADR-046).
 * Extraídas verbatim do orquestrador; sem React, testáveis isoladamente.
 */

export const INITIAL_BRACKET_DATA = {
  upper: {
    r64: Array(32)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r32: Array(16)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r16: Array(8)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    qf: Array(4)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    sf: Array(2)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    final: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null }],
  },
  lower: {
    r1: Array(16)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r2: Array(16)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r3: Array(8)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r4: Array(8)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r5: Array(4)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r6: Array(4)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    r7: Array(2)
      .fill(null)
      .map((_, i) => ({ t1: "", t2: "", s1: 0, s2: 0, winner: null })),
    final: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null }],
  },
  preFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
  grandFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
  side: {
    left: {
      r64: Array(16)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `L_R64_${i}`,
        })),
      r32: Array(8)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `L_R32_${i}`,
        })),
      r16: Array(4)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `L_R16_${i}`,
        })),
      qf: Array(2)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `L_QF_${i}`,
        })),
      sf: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null, id: `L_SF_0` }],
    },
    right: {
      r64: Array(16)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `R_R64_${i}`,
        })),
      r32: Array(8)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `R_R32_${i}`,
        })),
      r16: Array(4)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `R_R16_${i}`,
        })),
      qf: Array(2)
        .fill(null)
        .map((_, i) => ({
          t1: "",
          t2: "",
          s1: 0,
          s2: 0,
          winner: null,
          id: `R_QF_${i}`,
        })),
      sf: [{ t1: "", t2: "", s1: 0, s2: 0, winner: null, id: `R_SF_0` }],
    },
    grandFinal: { t1: "", t2: "", s1: 0, s2: 0, winner: null },
  },
};

export function migrateBracketData(data: any) {
  if (!data) return INITIAL_BRACKET_DATA;
  const newData = JSON.parse(JSON.stringify(INITIAL_BRACKET_DATA));

  // Deep merge existing data into new structure
  const merge = (target: any, source: any) => {
    if (!source) return;
    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        merge(target[key], source[key]);
      } else if (Array.isArray(source[key])) {
        if (!target[key]) target[key] = [];
        source[key].forEach((item: any, i: number) => {
          if (target[key][i]) {
            if (item && typeof item === "object") {
              target[key][i] = { ...target[key][i], ...item };
            } else {
              target[key][i] = item;
            }
          }
        });
      } else {
        target[key] = source[key];
      }
    });
  };

  merge(newData, data);
  return newData;
}

export function advanceTeamsInBracket(currentBracket: any, match: any, type: string, round: string, index: number, side?: string, teamsCount?: number) {
  const next = JSON.parse(JSON.stringify(currentBracket));
  const bracketTeams = teamsCount || 16;
  const loser = match.winner === match.t1 ? match.t2 : match.t1;

  if (type === "upper") {
    const roundSequences: any = { r64: "r32", r32: "r16", r16: "qf", qf: "sf", sf: "final" };
    const nextRound = roundSequences[round];
    if (nextRound) {
      const nextIdx = Math.floor(index / 2);
      const slot = index % 2 === 0 ? "t1" : "t2";
      if (next.upper[nextRound] && next.upper[nextRound][nextIdx]) {
        next.upper[nextRound][nextIdx][slot] = match.winner;
      }
    } else if (round === "final") {
      if (next.grandFinal) next.grandFinal.t1 = match.winner;
    }

    // Logic for dropping to Lower based on standard Double Elimination flow
    if (next.lower) {
      let targetRound = "";
      let targetIdx = Math.floor(index / 2);
      let targetSlot: "t1" | "t2" = index % 2 === 0 ? "t1" : "t2";

      if (bracketTeams === 32) {
        const mappings: any = { r32: "r1", r16: "r3", qf: "r5", sf: "r7", final: "final" };
        targetRound = mappings[round];
        if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
        if (round === "final") targetSlot = "t1";
      } else if (bracketTeams === 16) {
        const mappings: any = { r16: "r1", qf: "r3", sf: "r5", final: "final" };
        targetRound = mappings[round];
        if (round === "qf") { targetIdx = index; targetSlot = "t2"; }
        if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
        if (round === "final") targetSlot = "t1";
      } else if (bracketTeams === 8) {
        const mappings: any = { qf: "r1", sf: "r3", final: "final" };
        targetRound = mappings[round];
        if (round === "sf") { targetIdx = index; targetSlot = "t2"; }
        if (round === "final") targetSlot = "t2";
      }

      if (targetRound && next.lower[targetRound] && next.lower[targetRound][targetIdx]) {
        next.lower[targetRound][targetIdx][targetSlot] = loser;
      }
    }
  } else if (type === "lower") {
    const lowerSequences: any = { r1: "r2", r2: "r3", r3: "r4", r4: "r5", r5: "r6", r6: "r7", r7: "final" };
    const nextRound = lowerSequences[round];
    if (nextRound) {
      const currentCount = next.lower[round].length;
      const nextCount = next.lower[nextRound].length;
      if (currentCount === nextCount) {
        if (next.lower[nextRound][index]) next.lower[nextRound][index].t1 = match.winner;
      } else {
        const nextIdx = Math.floor(index / 2);
        const slot = index % 2 === 0 ? "t1" : "t2";
        if (next.lower[nextRound][nextIdx]) next.lower[nextRound][nextIdx][slot] = match.winner;
      }
    } else if (round === "final") {
      if (next.grandFinal) next.grandFinal.t2 = match.winner;
    }
  } else if (type === "side") {
    if (side !== "final") {
      const sequences: any = { r64: "r32", r32: "r16", r16: "qf", qf: "sf" };
      const nextRound = sequences[round];
      if (nextRound) {
        const nextIdx = (round === "qf") ? 0 : Math.floor(index / 2);
        const slot = index % 2 === 0 ? "t1" : "t2";
        if (next.side[side][nextRound] && next.side[side][nextRound][nextIdx]) {
          next.side[side][nextRound][nextIdx][slot] = match.winner;
        }
      } else if (round === "sf") {
        const slot = side === "left" ? "t1" : "t2";
        if (next.side.grandFinal) next.side.grandFinal[slot] = match.winner;
      }
    }
  }

  return next;
}
