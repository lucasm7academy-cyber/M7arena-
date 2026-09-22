import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { otimizarImagemExibicao, detectarImagem } from "../src/routes/upload.js";

/**
 * Gera um PNG "foto-like": ruído com correlação local (blur). É o caso em que a
 * conversão para WebP ganha de verdade — imagem de logo/banner de verdade.
 */
async function imagemFoto(lado: number): Promise<Buffer> {
  const n = lado * lado * 3;
  const raw = Buffer.alloc(n);
  for (let i = 0; i < n; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width: lado, height: lado, channels: 3 } }).blur(3).png().toBuffer();
}

describe("otimizarImagemExibicao (upload de imagens de exibição)", () => {
  test("team-logos: converte para WebP, reduz para <= 512px e fica menor", async () => {
    const original = await imagemFoto(1200);
    const r = await otimizarImagemExibicao(original, "team-logos");

    assert.equal(r.otimizada, true);
    assert.equal(detectarImagem(r.buffer), "webp", "saída deve ser WebP de verdade (magic bytes)");
    assert.ok(r.buffer.length < original.length, `webp (${r.buffer.length}) < png (${original.length})`);

    const meta = await sharp(r.buffer).metadata();
    assert.ok((meta.width ?? 0) <= 512 && (meta.height ?? 0) <= 512, `dimensões ${meta.width}x${meta.height}`);
  });

  test("public-images: permite até 1920px", async () => {
    const original = await imagemFoto(2400);
    const r = await otimizarImagemExibicao(original, "public-images");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 1920);
  });

  test("imagem já pequena não é ampliada (withoutEnlargement)", async () => {
    const original = await imagemFoto(64);
    const r = await otimizarImagemExibicao(original, "team-logos");
    const meta = await sharp(r.buffer).metadata();
    assert.equal(meta.width, 64);
  });

  test("nunca piora: WebP maior que o original devolve o original intacto", async () => {
    // WebP já muito comprimido (quality 1): reencodar em 82 sai maior.
    const foto = await imagemFoto(300);
    const original = await sharp(foto).webp({ quality: 1 }).toBuffer();
    const r = await otimizarImagemExibicao(original, "team-logos");

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
