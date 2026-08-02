import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";

export const uploadRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/uploads";

/**
 * Buckets aceitos. Cada bucket vira uma pasta de primeiro nível no volume
 * (ADR-007): `team-logos` → `/uploads/team-logos/`, `public-images` →
 * `/uploads/public-images/`. O servidor restringe a escrita por bucket, então
 * o cliente não decide caminho arbitrário.
 */
const BUCKETS = new Set(["team-logos", "public-images"]);

/** Whitelist de MIME → extensão. Nada de .bin/.html/.svg — só imagem. */
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!(file.mimetype in EXT_BY_MIME)) {
      return cb(new Error("Tipo de arquivo não permitido. Use PNG, JPEG ou WebP."));
    }
    cb(null, true);
  },
});

// Cria a raiz de uploads e as pastas de bucket na inicialização.
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const b of BUCKETS) fs.mkdirSync(path.join(UPLOAD_DIR, b), { recursive: true });
} catch (err) {
  console.warn("[m7arena-api] Não foi possível criar pastas de upload na inicialização:", err);
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

// POST /api/upload - multipart/form-data: campos `file`, `bucket` e `path`
// (opcional). O multer roda antes do handler; erro de tamanho/tipo vira 400.
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
        return res.status(400).json({ error: "Bucket inválido. Use team-logos ou public-images." });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Arquivo ausente. Envie o campo 'file' no multipart." });
      }

      const subpath = sanitizeSubpath(String(req.body?.path || "").trim());

      const filename = sanitizeFilename(file.originalname);
      if (!filename) {
        return res.status(400).json({ error: "Nome de arquivo inválido." });
      }

      const dir = path.join(UPLOAD_DIR, bucket, subpath);
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
