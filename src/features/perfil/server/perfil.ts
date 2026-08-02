import { db } from "@db/index";
import { users, userWallets, userRoles } from "@db/schema/identidade";
import { gameAccounts } from "@db/schema/games";
import { eq } from "drizzle-orm";

export async function getUserProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const accounts = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, userId));

  return {
    ...user,
    wallet: wallet || { mp: 0, mc: 0 },
    roles: roles.map((r) => r.role),
    gameAccounts: accounts,
  };
}
