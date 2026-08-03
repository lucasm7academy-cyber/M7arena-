import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { matchPrints } from "../../../db/schema/apostas.js";
import { entrarEmRevisao, notifyMatchChange } from "../lib/match-flow.js";
import { notificarRevisao } from "../lib/discord.js";
import { getRoles, eRevisor } from "../lib/acesso-sala.js";

export const uploadRouter = Router();

function obterUploadDir(): string {
  return process.env.UPLOAD_DIR || "/var/www/uploads";
}

/**
 * Buckets aceitos. Cada bucket vira uma pasta de primeiro nível no volume
 * (ADR-007): `team-logos` → `/uploads/team-logos/`, `public-images` →
 * `/uploads/public-images/`, `match-prints` → `/uploads/match-prints/`. O
 * servidor restringe a escrita por bucket, então o cliente não decide caminho
 * arbitrário. `match-prints` é privado (design v3 §6): a URL servida passa por
 * endpoint autenticado, nunca link direto do disco.
 */
const BUCKETS = new Set(["team-logos", "public-images", "match-prints"]);

/** Whitelist de MIME aceita pelo multer. */
const MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Formato (detectado por magic bytes) → extensão usada no nome salvo. */
const EXT_POR_FORMATO: Record<string, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
};

/** MIME declarado → formato esperado no conteúdo (magic bytes). */
const FORMATO_POR_MIME: Record<string, "png" | "jpeg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!MIMES.has(file.mimetype)) {
      return cb(new Error("Tipo de arquivo não permitido. Use PNG, JPEG ou WebP."));
    }
    cb(null, true);
  },
});

// Cria a raiz de uploads e as pastas de bucket na inicialização.
try {
  const dir = obterUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const b of BUCKETS) fs.mkdirSync(path.join(dir, b), { recursive: true });
} catch (err) {
  console.warn("[m7arena-api] Não foi possível criar pastas de upload na inicialização:", err);
}

/**
 * Detecta o formato real da imagem pelos primeiros bytes (magic bytes), não
 * pela extensão. Extensão é só um rótulo — um PNG renomeado para .jpg continua
 * sendo PNG (ou deixa de ser reconhecido), e é isso que impede executável
 * disfarçado de imagem.
 */
export function detectarImagem(buffer: Buffer): "png" | "jpeg" | "webp" | null {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  // WebP: 'RIFF' + <tamanho> + 'WEBP' no offset 8
  if (buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

/**
 * Valida arquivo de imagem por magic bytes. Rejeita conteúdo não reconhecido
 * (texto/executável disfarçado de imagem) e conteúdo que não corresponde ao
 * MIME declarado (extensão falsa).
 */
export type ValidacaoImagem =
  | { ok: false; erro: string }
  | { ok: true; formato: "png" | "jpeg" | "webp" };

export function validarArquivoImagem(buffer: Buffer, mimetype: string): ValidacaoImagem {
  const formato = detectarImagem(buffer);
  if (!formato) return { ok: false, erro: "formato_desconhecido" };
  if (FORMATO_POR_MIME[mimetype] !== formato) return { ok: false, erro: "conteudo_divergente" };
  return { ok: true, formato };
}

/**
 * Sanitiza o nome do arquivo enviado pelo cliente. Preserva o nome original —
 * necessário para não quebrar URLs antigas já gravadas no banco (o redirect do
 * Nginx da Task 8 assume o mesmo caminho relativo) — mas remove qualquer
 * caractere que permita path traversal (barras, `..`, pontos de controle).
 */
function sanitizeFilename(name: string): string | null {
  const base = path.basename(name || "").replace(/[^A-Za-z0-9._-]/g, "");
  if (!base || base === "." || base === ".." || base.includes("..")) return null;
  return base.slice(0, 80);
}

/**
 * Sanitiza a subpasta opcional dentro do bucket (ex.: 'campeonatos'). Um único
 * segmento, sem barras — barra/backslash dariam path traversal na escrita.
 */
function sanitizeSubpath(subpath: string): string {
  return subpath.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
}

// ── RATE LIMIT de upload (design v3 §6) ─────────────────────────────────────
// Simples: um Map de userId → timestamps na janela de 1 min. Suficiente para
// frear spam de print; o max-3 por partida já é a trava estrutural.

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_JANELA_MS = 60_000;
const rateLimits = new Map<string, number[]>();

function rateLimitPermitido(userId: string): boolean {
  const agora = Date.now();
  const times = (rateLimits.get(userId) || []).filter((t) => agora - t < RATE_LIMIT_JANELA_MS);
  if (times.length >= RATE_LIMIT_MAX) {
    rateLimits.set(userId, times);
    return false;
  }
  times.push(agora);
  rateLimits.set(userId, times);
  return true;
}

/**
 * Valida se o usuário pode enviar print da sala (design v3 §6): participante
 * CONFIRMADO ou revisor (admin/moderador), sala em `partida_iniciada` ou já em
 * `aguardando_revisao`, e ainda menos de 3 prints. Vale para TODAS as salas —
 * casuais e apostadas (decisão de 2026-08-03: o resultado é sempre decidido
 * pelo admin, sem votação no cliente). A checagem de participante e status
 * re-roda dentro da transação de gravação (via `entrarEmRevisao`, que re-locka
 * a linha), então um golpe no intervalo não vira print órfão.
 */
export type ValidacaoPrint =
  | { ok: false; erro: string; estado?: string; sala?: any }
  | { ok: true; sala: any };

export async function validarPrintDePartida(db: any, userId: string, matchId: string): Promise<ValidacaoPrint> {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return { ok: false, erro: "sala_nao_encontrada" };
  if (m.status !== "partida_iniciada" && m.status !== "aguardando_revisao") {
    return { ok: false, erro: "estado_invalido", estado: m.status };
  }
  // Revisor (admin/moderador) pode anexar de qualquer sala; participante só se
  // confirmado (decisão do usuário: "só admin ou quem joga pode anexar").
  const roles = await getRoles(db, userId);
  const ehRevisor = eRevisor(roles);
  if (!ehRevisor) {
    const [player] = await db
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)))
      .limit(1);
    if (!player) return { ok: false, erro: "nao_participante" };
    if (!player.confirmed) return { ok: false, erro: "nao_confirmado" };
  }
  const prints = await db.select().from(matchPrints).where(eq(matchPrints.matchId, matchId));
  if (prints.length >= 3) return { ok: false, erro: "limite_prints" };
  return { ok: true, sala: m };
}

/**
 * Salva o print de prova de um participante confirmado e, se a sala ainda está
 * em `partida_iniciada`, avança para `aguardando_revisao` (design v3 §6). O nome
 * do arquivo é gerado pelo servidor (uuid + extensão do magic bytes) — o nome
 * do cliente é ignorado, não há como forjar caminho. Exportado para os testes
 * exercerem a mesma função que a rota usa.
 */
export type ResultadoSalvarPrint =
  | { ok: false; erro: string; estado?: string; sala?: any }
  | { ok: true; url: string; printId: string; entrouEmRevisao: boolean; sala: any };

export async function salvarPrintMatch(
  db: any,
  params: { userId: string; matchId: string; originalname: string; buffer: Buffer; mimetype: string }
): Promise<ResultadoSalvarPrint> {
  const v = await validarPrintDePartida(db, params.userId, params.matchId);
  if (!v.ok) return v;

  const img = validarArquivoImagem(params.buffer, params.mimetype);
  if (!img.ok) return { ok: false, erro: img.erro };

  const dir = path.join(obterUploadDir(), "match-prints", params.matchId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}${EXT_POR_FORMATO[img.formato]}`;
  const destino = path.join(dir, filename);
  await fs.promises.writeFile(destino, params.buffer);
  const publicUrl = `/uploads/match-prints/${params.matchId}/${filename}`;

  let resultado: any;
  try {
    resultado = await db.transaction(async (tx: any) => {
      const [print] = await tx
        .insert(matchPrints)
        .values({ matchId: params.matchId, userId: params.userId, url: publicUrl })
        .returning();
      const t = await entrarEmRevisao(tx, params.matchId);
      // Já estava em revisão: só insere o print e não transiciona (4º é bloqueado
      // na validação). Qualquer outro estado inválido aborta e desfaz a escrita.
      if (!t.ok && t.estado !== "aguardando_revisao") throw new Error(t.erro || "falha_na_transicao");
      return { print, entrouEmRevisao: t.ok };
    });
  } catch (e) {
    await fs.promises.unlink(destino).catch(() => {});
    throw e;
  }

  return {
    ok: true,
    url: `/api/prints/${resultado.print.id}/arquivo`,
    printId: resultado.print.id,
    entrouEmRevisao: resultado.entrouEmRevisao,
    sala: v.sala,
  };
}

// POST /api/upload - multipart/form-data: campos `file`, `bucket` e `path`
// (opcional). O multer roda antes do handler; erro de tamanho/tipo vira 400.
// Para o bucket `match-prints`, `path` é o matchId (uuid) da sala.
uploadRouter.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const msg =
          err?.code === "LIMIT_FILE_SIZE"
            ? "Arquivo muito grande. Máximo de 5 MB."
            : err?.message || "Erro ao processar o upload.";
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "Autenticação necessária para upload" });
      }

      const [session] = await db
        .select()
        .from(userSessions)
        .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
        .limit(1);

      if (!session) {
        return res.status(401).json({ error: "Sessão inválida ou expirada" });
      }

      const bucket = String(req.body?.bucket || "").trim();
      if (!BUCKETS.has(bucket)) {
        return res.status(400).json({ error: "Bucket inválido. Use team-logos, public-images ou match-prints." });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Arquivo ausente. Envie o campo 'file' no multipart." });
      }

      // Magic bytes: rejeita conteúdo não reconhecido ou que não bate com o MIME
      // declarado (extensão falsa) — em qualquer bucket.
      const img = validarArquivoImagem(file.buffer, file.mimetype);
      if (!img.ok) {
        return res.status(400).json({
          error: img.erro === "formato_desconhecido"
            ? "Arquivo inválido: conteúdo não reconhecido como imagem (use PNG, JPEG ou WebP)."
            : "Arquivo inválido: o conteúdo não corresponde ao tipo de arquivo declarado.",
        });
      }

      const subpath = sanitizeSubpath(String(req.body?.path || "").trim());

      // ── Bucket privado de prints de partida (design v3 §6) ──
      if (bucket === "match-prints") {
        if (!subpath) {
          return res.status(400).json({ error: "matchId obrigatório para o bucket match-prints." });
        }
        if (!rateLimitPermitido(session.userId)) {
          return res.status(429).json({ error: "Muitos uploads. Aguarde um instante e tente novamente." });
        }
        const r = await salvarPrintMatch(db, {
          userId: session.userId,
          matchId: subpath,
          originalname: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype,
        });
        if (!r.ok) return res.status(400).json({ error: r.erro });
        // Notifica revisores quando a sala entra em revisão nesta escrita.
        if (r.entrouEmRevisao) notificarRevisao(r.sala);
        // Real-time: os jogadores da sala veem "em análise" / o novo print sem
        // refresh (design v3 §6 — o cliente refaz o GET ao receber o aviso).
        notifyMatchChange(subpath);
        return res.json({ url: r.url, printId: r.printId });
      }

      const filename = sanitizeFilename(file.originalname);
      if (!filename) {
        return res.status(400).json({ error: "Nome de arquivo inválido." });
      }

      const dir = path.join(obterUploadDir(), bucket, subpath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Preserva o nome enviado pelo cliente; se colidir (mesmo bucket + nome),
      // desambigua com sufixo curto em vez de sobrescrever o arquivo existente.
      let destino = path.join(dir, filename);
      if (fs.existsSync(destino)) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        destino = path.join(dir, `${base}-${crypto.randomBytes(3).toString("hex")}${ext}`);
      }
      await fs.promises.writeFile(destino, file.buffer);

      const nomeFinal = path.basename(destino);
      const publicUrl = `/uploads/${bucket}${subpath ? "/" + subpath : ""}/${nomeFinal}`;
      return res.json({ url: publicUrl, filename: nomeFinal, ownerId: session.userId });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Erro ao salvar arquivo no servidor" });
    }
  }
);
