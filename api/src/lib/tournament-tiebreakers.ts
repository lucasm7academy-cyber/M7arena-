/**
 * tournament-tiebreakers.ts — desempate automático de campeonato (ADR-046).
 *
 * Regra de negócio movida do cliente (antes em `checkAndAddTiebreakers` no
 * CampeonatoDetalhes.tsx) para o servidor, cumprindo o invariante 3.3:
 * o navegador não decide desempate, ele só exibe o cronograma resultante.
 *
 * Opera sobre o shape legado (`cronograma`, `grupos`, `times_inscritos`,
 * `formato`) que `toLegacyTournament` reconstrói — assim a regra é testável
 * como função pura e o front não muda uma linha.
 */

export interface LegacyCronogramaJogo {
  id?: string;
  fase: string;
  timeA: string;
  timeB: string;
  status: string;
  placar?: string;
  data?: string;
  hora?: string;
  proposedBy?: string;
}

export interface LegacyTournament {
  cronograma: LegacyCronogramaJogo[];
  grupos: Record<string, Array<string | { tag?: string; name?: string }>> | any;
  times_inscritos?: Array<{ tag?: string; name?: string }>;
  timesInscritos?: Array<{ tag?: string; name?: string }>;
  formato: string;
}

/**
 * Anexa um jogo de "DESEMPATE - {grupo}" ao cronograma se houver empate na
 * fronteira de classificação do grupo, e devolve o campeonato (novo objeto).
 * Idempotente: se o desempate já existir, devolve o mesmo cronograma.
 */
export function appendTiebreakers(campeonato: LegacyTournament, groupName: string): LegacyTournament {
  if (
    !groupName ||
    groupName === "Fase Final" ||
    groupName.includes("Chaves") ||
    groupName.includes("DESEMPATE")
  ) {
    return campeonato;
  }

  let groupTeamsRaw: any[] = [];
  if (Array.isArray(campeonato.grupos)) {
    groupTeamsRaw = campeonato.grupos.find((g: any) => g.name === groupName)?.teams || [];
  } else if (typeof campeonato.grupos === "object" && campeonato.grupos !== null) {
    groupTeamsRaw = campeonato.grupos[groupName] || [];
  }

  if (!groupTeamsRaw || groupTeamsRaw.length === 0) return campeonato;

  const timesInscritos = campeonato.times_inscritos || campeonato.timesInscritos || [];
  const cronograma = campeonato.cronograma || [];

  // Só adiciona desempate quando todos os jogos regulares do grupo terminaram.
  const allRegularMatchesFinished = cronograma.every((jogo) => {
    if (jogo.fase === groupName) return jogo.status === "finalizado";
    return true;
  });
  if (!allRegularMatchesFinished) return campeonato;

  const groupStats: any = {};
  groupTeamsRaw.forEach((t) => {
    const tag = typeof t === "string" ? t : t.tag;
    const team = timesInscritos.find((ti) => ti.tag === tag);
    if (team && team.tag) {
      groupStats[team.tag] = { tag: team.tag, name: team.name, v: 0, d: 0, matches: 0, j: 0 };
    }
  });

  cronograma.forEach((jogo) => {
    if (jogo.fase !== groupName || jogo.status !== "finalizado") return;
    const scores = (jogo.placar || "0 - 0").split(" - ");
    const s1 = parseInt(scores[0]) || 0;
    const s2 = parseInt(scores[1]) || 0;
    if (groupStats[jogo.timeA]) {
      groupStats[jogo.timeA].matches++;
      groupStats[jogo.timeA].v += s1;
      groupStats[jogo.timeA].d += s2;
      groupStats[jogo.timeA].j = groupStats[jogo.timeA].v + groupStats[jogo.timeA].d;
    }
    if (groupStats[jogo.timeB]) {
      groupStats[jogo.timeB].matches++;
      groupStats[jogo.timeB].v += s2;
      groupStats[jogo.timeB].d += s1;
      groupStats[jogo.timeB].j = groupStats[jogo.timeB].v + groupStats[jogo.timeB].d;
    }
  });

  const sorted = Object.values(groupStats).sort(
    (a: any, b: any) => b.v - a.v || a.d - b.d || a.matches - b.matches,
  );

  const classificadosThreshold = campeonato.formato === "grupos_16_4_2" ? 2 : 1;

  if (sorted.length > classificadosThreshold) {
    const lastQualifier = sorted[classificadosThreshold - 1] as any;
    const firstNonQualifier = sorted[classificadosThreshold] as any;

    if (lastQualifier.v === firstNonQualifier.v) {
      const desempateExists = cronograma.some(
        (j) =>
          j.fase === `DESEMPATE - ${groupName}` &&
          ((j.timeA === lastQualifier.tag && j.timeB === firstNonQualifier.tag) ||
            (j.timeB === lastQualifier.tag && j.timeA === firstNonQualifier.tag)),
      );

      if (!desempateExists) {
        const tiebreakerMatch: LegacyCronogramaJogo = {
          timeA: lastQualifier.tag,
          timeB: firstNonQualifier.tag,
          fase: `DESEMPATE - ${groupName}`,
          status: "combinando",
          data: "A COMBINAR",
          hora: "--:--",
          proposedBy: "ORGANIZAÇÃO",
          placar: "",
        };

        return { ...campeonato, cronograma: [...cronograma, tiebreakerMatch] };
      }
    }
  }

  return campeonato;
}
