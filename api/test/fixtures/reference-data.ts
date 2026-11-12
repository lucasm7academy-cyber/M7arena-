import { matchCodes } from "../../../db/schema/matches.js";

/** Pool fictício para testes isolados; nunca provisiona códigos Riot reais. */
export async function seedTestMatchCodes(db: any) {
  const pools = [
    { mode: null, prefix: "BR04fa2", count: 6 },
    { mode: "1v1", prefix: "BR050c8", count: 2 },
    { mode: "blind", prefix: "BR05116", count: 7 },
  ];
  await db.insert(matchCodes).values(pools.flatMap(pool =>
    Array.from({ length: pool.count }, (_, index) => ({
      code: `${pool.prefix}-FIXTURE-ONLY-${index + 1}`,
      mode: pool.mode,
      used: false,
    }))));
}
