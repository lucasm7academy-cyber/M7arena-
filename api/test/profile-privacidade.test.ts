import { test } from "node:test";
import assert from "node:assert/strict";
import { toLegacyProfile } from "../src/lib/profile-shape.js";

test("perfil público não expõe chave Pix/nome do recebedor", () => {
  const publicShape = toLegacyProfile(
    { id: "u1", bio: "bio", lanePrimary: "MID", laneSecondary: "TOP", isVip: false, socials: { twitch: "canal" } },
    null
  );

  assert.equal(publicShape.chave_pix, "");
  assert.equal(publicShape.tipo_chave_pix, "");
  assert.equal(publicShape.nome_pix, "");
  assert.equal(publicShape.twitch, "canal");
});

test("perfil do próprio usuário continua podendo ler os dados Pix", () => {
  const ownShape = toLegacyProfile(
    { id: "u1", socials: {} },
    { pixKey: "chave@teste", pixType: "email", pixName: "Fulano" }
  );

  assert.equal(ownShape.chave_pix, "chave@teste");
  assert.equal(ownShape.tipo_chave_pix, "email");
  assert.equal(ownShape.nome_pix, "Fulano");
});
