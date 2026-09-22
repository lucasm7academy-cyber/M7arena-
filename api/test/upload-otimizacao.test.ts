import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { otimizarImagemExibicao, detectarImagem } from "../src/routes/upload.js";

/** Gera um PNG grande (ruído, para o WebP ter trabalho e a economia aparecer). */
async function pngGrande(lado: number): Promise<Buffer> {
  const pixels = Buffer.alloc(lado * lado * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37) % 256;
  return sharp(pixels, { raw: { width: lado, height: lado, channels: 3 } }).png().toBuffer();
}

describe("otimizarImagemExibicao (upload de imagens de exibição)", () => {
  test("team-logos: reduz para <= 512px e converte para WebP menor que o original", async () => {
    const original = await pngGrande(2000);
    const otimizada = await otimizarImagemExibicao(original, "team-logos");

    assert.equal(detectarImagem(otimizada), "webp", "saída deve ser WebP de verdade (magic bytes)");
    assert.ok(otimizada.length < original.length, `webp (${otimizada.length}) < png (${original.length})`);

    const meta = await sharp(otimizada).metadata();
    assert.ok((meta.width ?? 0) <= 512 && (meta.height ?? 0) <= 512, `dimensões ${meta.width}x${meta.height}`);
  });

  test("public-images: permite até 1920px", async () => {
    const original = await pngGrande(2400);
    const otimizada = await otimizarImagemExibicao(original, "public-images");
    const meta = await sharp(otimizada).metadata();
    assert.equal(meta.width, 1920);
  });

  test("imagem já pequena não é ampliada (withoutEnlargement)", async () => {
    const original = await pngGrande(64);
    const otimizada = await otimizarImagemExibicao(original, "team-logos");
    const meta = await sharp(otimizada).metadata();
    assert.equal(meta.width, 64);
  });

  test("bucket desconhecido cai no teto padrão (1920)", async () => {
    const original = await pngGrande(2400);
    const otimizada = await otimizarImagemExibicao(original, "bucket-novo");
    const meta = await sharp(otimizada).metadata();
    assert.equal(meta.width, 1920);
  });
});
