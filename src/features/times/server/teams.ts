import { db } from "@db/index";
import { teams, teamMembers, teamStats } from "@db/schema/teams";
import { eq, desc } from "drizzle-orm";

export async function getTeamsList(gameId: string = "lol") {
  return await db.select().from(teams).where(eq(teams.gameId, gameId));
}

export async function getTeamDetails(teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return null;

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  const [stats] = await db.select().from(teamStats).where(eq(teamStats.teamId, teamId)).limit(1);

  return {
    ...team,
    members,
    stats,
  };
}
