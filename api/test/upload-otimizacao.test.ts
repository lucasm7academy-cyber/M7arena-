import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { otimizarImagemExibicao, detectarImagem } from "../src/routes/upload.js";

/**
 * Gera um PNG "foto-like": ruído com correlação local (blur). É o caso em que a
 * conversão para WebP ganha de verdade — imagem de logo/banner de verdade.
 */
async function imagemFoto(largura: number, altura = largura): Promise<Buffer> {
  const n = largura * altura * 3;
  const raw = Buffer.alloc(n);
  for (let i = 0; i < n; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width: largura, height: altura, channels: 3 } }).blur(3).png().toBuffer();
}

describe("otimizarImagemExibicao (upload de imagens de exibição)", () => {
  test("team-logos: qualquer tamanho vira WebP 1080x1080 e fica menor", async () => {
    const original = await imagemFoto(1200);
    const r = await otimizarImagemExibicao(original, "team-logos");

    assert.equal(r.otimizada, true);
    assert.equal(detectarImagem(r.buffer), "webp", "saída deve ser WebP de verdade (magic bytes)");
    assert.ok(r.buffer.length < original.length, `webp (${r.buffer.length}) < png (${original.length})`);

    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1080);
  });

  test("team-logos: imagem retangular ganha padding transparente (contain, sem corte)", async () => {
    const original = await imagemFoto(2000, 500);
    const r = await otimizarImagemExibicao(original, "team-logos");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1080);
    assert.equal(meta.hasAlpha, true, "quadrado completado com transparência");
  });

  test("team-logos: imagem pequena É ampliada para 1080 (toda logo do mesmo tamanho)", async () => {
    const original = await imagemFoto(64);
    const r = await otimizarImagemExibicao(original, "team-logos");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1080);
  });

  test("public-images: permite até 1920px", async () => {
    const original = await imagemFoto(2400);
    const r = await otimizarImagemExibicao(original, "public-images");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1920);
  });

  test("public-images: nunca piora — WebP maior que o original devolve o original intacto", async () => {
    // WebP já muito comprimido (quality 1): reencodar em 82 sai maior.
    const foto = await imagemFoto(300);
    const original = await sharp(foto).webp({ quality: 1 }).toBuffer();
    const r = await otimizarImagemExibicao(original, "public-images");

    assert.equal(r.otimizada, false);
    assert.equal(r.buffer.length, original.length, "buffer original devolvido sem alteração");
  });

  test("bucket desconhecido cai no teto padrão (1920)", async () => {
    const original = await imagemFoto(2400);
    const r = await otimizarImagemExibicao(original, "bucket-novo");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1920);
  });
});
