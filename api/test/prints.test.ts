import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { users, userWallets, userRoles } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { matchPrints } from "../../db/schema/apostas.js";
import { setupDb } from "./helpers.js";
import { acessoSala } from "../src/lib/acesso-sala.js";
import { listarPrints, resolverArquivoPrint } from "../src/routes/prints.js";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "m7-prints-"));

// Buffers de imagem: só os primeiros bytes importam para a detecção por magic
// bytes — o resto é lixo de enchimento.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(16)]);
const TEXTO = Buffer.from("isto não é uma imagem", "utf8");

async function criaJogador(db: any, id: string, mc = 100, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador " + id.slice(0, 6) });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

async function criaAdmin(db: any, id: string) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Admin" });
  await db.insert(userRoles).values({ userId: id, role: "admin" });
}

/** Sala apostada em `partida_iniciada` (pré-condição para enviar print). */
async function criaSalaIniciada(db: any, dono: string, aposta = 30) {
  const [sala] = await db
    .insert(matches)
    .values({
      gameId: "lol",
      mode: "5v5",
      createdBy: dono,
      status: "partida_iniciada",
      apostaMc: aposta,
      taxaPct: "8.99",
    })
    .returning();
  return sala;
}

async function confirmaJogador(db: any, matchId: string, userId: string, side = "blue") {
  await db.insert(matchPlayers).values({ matchId, userId, side, slot: 0, roleSlot: "TOP", confirmed: true });
}

describe("prints (magic bytes, upload e leitura autenticada)", () => {
  let ctx: any;
  let db: any;
  let upload: any;

  before(async () => {
    // UPLOAD_DIR aponta para o tmp ANTES de carregar o módulo: o upload grava em
    // processo.env.UPLOAD_DIR no momento da escrita, e o mkdir de inicialização
    // do módulo também o lê — sem isso os testes criariam /var/www/uploads local.
    process.env.UPLOAD_DIR = path.join(tmpBase, "uploads");
    ctx = await setupDb();
    db = ctx.db;
    upload = await import("../src/routes/upload.js");
  });

  after(async () => {
    await ctx.client.close();
    fs.rmSync(tmpBase, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  test("magic bytes: PNG/JPEG/WebP reais passam; PNG disfarçado de jpeg rejeitado; texto rejeitado", () => {
    assert.equal(upload.validarArquivoImagem(PNG, "image/png").ok, true);
    assert.equal(upload.validarArquivoImagem(JPEG, "image/jpeg").ok, true);
    assert.equal(upload.validarArquivoImagem(WEBP, "image/webp").ok, true);

    const divergente = upload.validarArquivoImagem(PNG, "image/jpeg");
    assert.equal(divergente.ok, false);
    assert.equal(divergente.erro, "conteudo_divergente");

    const renomeado = upload.validarArquivoImagem(JPEG, "image/png");
    assert.equal(renomeado.ok, false);

    const texto = upload.validarArquivoImagem(TEXTO, "image/png");
    assert.equal(texto.ok, false);
    assert.equal(texto.erro, "formato_desconhecido");
  });

  test("upload: não-participante é rejeitado", async () => {
    const dono = "f1001000-0000-0000-0000-000000000001";
    const fora = "f1001000-0000-0000-0000-000000000002";
    await criaJogador(db, dono);
    await criaJogador(db, fora);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);

    const r = await upload.salvarPrintMatch(db, {
      userId: fora,
      matchId: sala.id,
      originalname: "prova.png",
      buffer: PNG,
      mimetype: "image/png",
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_participante");
  });

  test("upload: participante não-confirmado é rejeitado", async () => {
    const dono = "f1002000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaIniciada(db, dono);
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: dono, side: "blue", slot: 0, roleSlot: "TOP", confirmed: false,
    });

    const r = await upload.salvarPrintMatch(db, {
      userId: dono, matchId: sala.id, originalname: "p.png", buffer: PNG, mimetype: "image/png",
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_confirmado");
  });

  test("upload: 4º print da mesma partida é rejeitado (máx 3)", async () => {
    const dono = "f1003000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);
    for (let i = 0; i < 3; i++) {
      await db.insert(matchPrints).values({
        matchId: sala.id, userId: dono, url: `/uploads/match-prints/${sala.id}/p${i}.png`,
      });
    }

    const r = await upload.salvarPrintMatch(db, {
      userId: dono, matchId: sala.id, originalname: "quarto.png", buffer: PNG, mimetype: "image/png",
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "limite_prints");
  });

  test("upload: magic bytes divergentes do MIME são rejeitados (extensão falsa)", async () => {
    const dono = "f1004000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);

    // O cliente declara PNG no MIME, mas o conteúdo é JPEG (extensão falsa).
    const r = await upload.salvarPrintMatch(db, {
      userId: dono, matchId: sala.id, originalname: "print.jpg", buffer: JPEG, mimetype: "image/png",
    });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "conteudo_divergente");
  });

  test("upload: participante confirmado envia print, sala entra em revisão, URL é autenticada", async () => {
    const dono = "f1005000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);

    const r = await upload.salvarPrintMatch(db, {
      userId: dono, matchId: sala.id, originalname: "print.png", buffer: PNG, mimetype: "image/png",
    });
    assert.equal(r.ok, true);
    assert.match(r.url, /^\/api\/prints\/[0-9a-f-]{36}\/arquivo$/);
    assert.equal(r.entrouEmRevisao, true);

    // Arquivo físico gravado dentro de match-prints/<matchId>/
    const pastaPrints = path.join(process.env.UPLOAD_DIR as string, "match-prints", sala.id);
    const arquivos = fs.readdirSync(pastaPrints);
    assert.equal(arquivos.length, 1);
    assert.match(arquivos[0], /^[0-9a-f-]{36}\.png$/);

    // Linha em match_prints + transição de estado
    const prints = await db.select().from(matchPrints).where(eq(matchPrints.matchId, sala.id));
    assert.equal(prints.length, 1);
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m.status, "aguardando_revisao");
    assert.ok(m.revisaoDesde);
  });

  test("upload: novo print em sala já em aguardando_revisao não regride o estado", async () => {
    const dono = "f1006000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);
    await db.update(matches).set({ status: "aguardando_revisao", revisaoDesde: new Date() }).where(eq(matches.id, sala.id));

    const r = await upload.salvarPrintMatch(db, {
      userId: dono, matchId: sala.id, originalname: "p2.png", buffer: PNG, mimetype: "image/png",
    });
    assert.equal(r.ok, true);
    assert.equal(r.entrouEmRevisao, false);
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m.status, "aguardando_revisao");
  });

  test("prints: participante vê, não-participante não vê, revisor vê", async () => {
    const dono = "f1007000-0000-0000-0000-000000000001";
    const fora = "f1007000-0000-0000-0000-000000000002";
    await criaJogador(db, dono);
    await criaJogador(db, fora);
    const sala = await criaSalaIniciada(db, dono);
    await confirmaJogador(db, sala.id, dono);
    const [print] = await db.insert(matchPrints).values({
      matchId: sala.id, userId: dono, url: `/uploads/match-prints/${sala.id}/p.png`,
    }).returning();

    assert.equal(await acessoSala(db, dono, sala.id), "participante");
    assert.equal(await acessoSala(db, fora, sala.id), "nenhum");

    // Revisor (admin) enxerga sem estar na sala
    const admin = "f1007000-0000-0000-0000-000000000003";
    await criaAdmin(db, admin);
    assert.equal(await acessoSala(db, admin, sala.id), "revisor");

    const lista = await listarPrints(db, sala.id);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].nomeJogador, "Jogador " + dono.slice(0, 6));
    assert.equal(lista[0].url, `/api/prints/${print.id}/arquivo`);
    assert.ok(lista[0].createdAt);
  });

  test("resolverArquivoPrint recusa caminho fora do bucket match-prints", () => {
    const base = path.join(process.env.UPLOAD_DIR as string, "match-prints");
    // Caminho legítimo dentro do bucket resolve para dentro dele
    assert.equal(resolverArquivoPrint("/uploads/match-prints/abc/p.png"), path.join(base, "abc", "p.png"));
    // Fora do bucket / traversal são recusados
    assert.equal(resolverArquivoPrint("/uploads/team-logos/x.png"), null);
    assert.equal(resolverArquivoPrint("/uploads/match-prints/../etc/passwd"), null);
    assert.equal(resolverArquivoPrint("../etc/passwd"), null);
  });
});
