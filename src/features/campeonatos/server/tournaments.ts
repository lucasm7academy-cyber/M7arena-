import { db } from "@db/index";
import { tournaments, tournamentTeams, tournamentMatches } from "@db/schema/tournaments";
import { eq } from "drizzle-orm";

export async function getTournamentsList(gameId: string = "lol") {
  return await db.select().from(tournaments).where(eq(tournaments.gameId, gameId));
}

export async function getTournamentDetails(tournamentId: string) {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return null;

  const teams = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, tournamentId));
  const matches = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));

  return {
    ...tournament,
    teams,
    matches,
  };
}
