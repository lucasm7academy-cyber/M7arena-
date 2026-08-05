import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { users, userRoles } from "../../db/schema/identidade.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { setupDb } from "./helpers.js";
import { validarPermissaoBucketPublico } from "../src/routes/upload.js";

/**
 * Restrição por dono nos buckets públicos (ARQUITETURA.md §6 — "Autorização por
 * dono"). A função é a mesma que a rota /api/upload usa: o teste exercita a
 * regra sem precisar subir o HTTP.
 */
describe("upload restrito por dono", () => {
  let ctx: any;
  let db: any;

  const DONO = "f2000000-0000-0000-0000-000000000001";
  const CAP = "f2000000-0000-0000-0000-000000000002";
  const FORA = "f2000000-0000-0000-0000-000000000003";
  const ADMIN = "f2000000-0000-0000-0000-000000000004";
  const ORG = "f2000000-0000-0000-0000-000000000005";
  let timeId: string;

  before(async () => {
    ctx = await setupDb();
    db = ctx.db;
    for (const id of [DONO, CAP, FORA, ADMIN, ORG]) {
      await db.insert(users).values({ id, email: id + "@x.com", displayName: "User " + id.slice(0, 6) });
    }
    await db.insert(userRoles).values({ userId: ADMIN, role: "admin" });
    await db.insert(userRoles).values({ userId: ORG, role: "organizer" });

    const [time] = await db
      .insert(teams)
      .values({ gameId: "lol", name: "Time X", tag: "TIX", ownerId: DONO })
      .returning();
    timeId = time.id;
    await db.insert(teamMembers).values({
      teamId: timeId, userId: CAP, roleSlot: "TOP", isCaptain: true, status: "accepted",
    });
  });

  after(async () => {
    await ctx.client.close();
  });

  test("team-logos: sem id do time (path) é recusado", async () => {
    const r = await validarPermissaoBucketPublico(db, DONO, "team-logos", "");
    assert.equal(r.ok, false);
    assert.equal((r as any).status, 400);
  });

  test("team-logos: dono e capitão escrevem; estranho é bloqueado (403)", async () => {
    assert.equal((await validarPermissaoBucketPublico(db, DONO, "team-logos", timeId)).ok, true);
    assert.equal((await validarPermissaoBucketPublico(db, CAP, "team-logos", timeId)).ok, true);

    const r = await validarPermissaoBucketPublico(db, FORA, "team-logos", timeId);
    assert.equal(r.ok, false);
    assert.equal((r as any).status, 403);
  });

  test("team-logos: time inexistente é recusado (404)", async () => {
    const r = await validarPermissaoBucketPublico(db, DONO, "team-logos", "f2000000-0000-0000-0000-00000000ffff");
    assert.equal(r.ok, false);
    assert.equal((r as any).status, 404);
  });

  test("public-images: admin e organizador podem; jogador comum é bloqueado (403)", async () => {
    assert.equal((await validarPermissaoBucketPublico(db, ADMIN, "public-images", "campeonatos")).ok, true);
    assert.equal((await validarPermissaoBucketPublico(db, ORG, "public-images", "campeonatos")).ok, true);

    const r = await validarPermissaoBucketPublico(db, FORA, "public-images", "campeonatos");
    assert.equal(r.ok, false);
    assert.equal((r as any).status, 403);
  });
});
