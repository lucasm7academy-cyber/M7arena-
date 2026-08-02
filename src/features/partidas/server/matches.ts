import { db } from "@db/index";
import { matches, matchPlayers, matchResults } from "@db/schema/matches";
import { eq, desc } from "drizzle-orm";

export async function getActiveMatches(gameId: string = "lol") {
  return await db
    .select()
    .from(matches)
    .where(eq(matches.gameId, gameId))
    .orderBy(desc(matches.createdAt));
}

export async function getMatchDetails(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return null;

  const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  const [result] = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId)).limit(1);

  return {
    ...match,
    players,
    result,
  };
}
