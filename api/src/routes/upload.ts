import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import sharp from "sharp";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";
import { teams, teamMembers } from "../../../db/schema/teams.js";
import { getRoles } from "../lib/acesso-sala.js";

export const uploadRouter = Router();

function obterUploadDir(): string {
  return process.env.UPLOAD_DIR || "/var/www/uploads";
}

/**
 * Buckets aceitos. Cada bucket vira uma pasta de primeiro nível no volume
 * (ADR-007): `team-logos` → `/uploads/team-logos/`, `public-images` →
 * `/uploads/public-images/`. O servidor restringe a escrita por bucket, então o
 * cliente não decide caminho arbitrário. A escrita também é restrita por dono
 * (README.md — Uploads e autorização): `team-logos` só aceita o dono/capitão do time (a logo
 * cai em `/uploads/team-logos/<team_id>/`), `public-images` só admin/organizador.
 * O antigo bucket privado de prints de partida foi removido junto com o fluxo
 * de revisão; não reintroduza caminho privado aqui sem um endpoint autenticado.
 */
const BUCKETS = new Set(["team-logos", "public-images"]);

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

const MAX_SIZE = 30 * 1024 * 1024; // 30 MB (teto do multer; por bucket abaixo)

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
 * Lado máximo (px) por bucket de imagem de EXIBIÇÃO (exceto `team-logos`, que
 * tem regra própria: SEMPRE 1080x1080 — ver `otimizarImagemExibicao`). Um banner
 * renderiza em ~1400px; guardar o arquivo original (1–2 MB PNG) fazia o card
 * ficar preto por ~1s até o download terminar. 1920 dá folga para telas retina
 * sem carregar o arquivo cru.
 */
const LADO_MAX_EXIBICAO: Record<string, number> = {
  "public-images": 1920,
};

/** Lado da logo de time: TODA logo é normalizada para 1080x1080 (pedido do usuário 19/10). */
const LADO_LOGO = 1080;

/**
 * Teto por bucket. Logo/banner de time aceita arquivo grande de qualquer
 * tamanho (o servidor redimensiona); os dois buckets públicos têm o mesmo teto.
 */
const MAX_POR_BUCKET: Record<string, number> = {
  "team-logos": 30 * 1024 * 1024,
  "public-images": 30 * 1024 * 1024,
};

/**
 * Converte a imagem enviada para WebP redimensionado (qualidade 82). `rotate()`
 * aplica a orientação do EXIF antes de redimensionar (foto de celular não sai
 * deitada).
 *
 * `team-logos`: qualquer tamanho de entrada vira 1080x1080. `contain` mantém a
 * proporção da arte e completa o quadrado com transparência (não corta nem
 * distorce) e AMPLIA quando a origem é menor — toda logo fica do mesmo tamanho.
 * Aqui o resultado processado é sempre o guardado (a regra "nunca piora" não se
 * aplica: o tamanho fixo é o requisito).
 *
 * Demais buckets: "nunca piora" — se o WebP sair maior que o original (acontece
 * com imagens já otimizadas ou muito ruidosas), devolve o buffer original — o
 * upload guarda o arquivo cru em vez de inflá-lo.
 *
 * Exportado para os testes exercerem o mesmo caminho da rota.
 */
export type ImagemProcessada = { buffer: Buffer; otimizada: boolean };

export async function otimizarImagemExibicao(buffer: Buffer, bucket: string): Promise<ImagemProcessada> {
  if (bucket === "team-logos") {
    const webp = await sharp(buffer)
      .rotate()
      .resize(LADO_LOGO, LADO_LOGO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer: webp, otimizada: true };
  }
  const lado = LADO_MAX_EXIBICAO[bucket] ?? 1920;
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  if (webp.length >= buffer.length) return { buffer, otimizada: false };
  return { buffer: webp, otimizada: true };
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

/**
 * Restrição por dono dos buckets públicos (README.md — Uploads e autorização — "Autorização por
 * dono, com limite de tamanho e MIME"). Não é só "estar autenticado": a escrita
 * tem que pertencer ao dono do recurso.
 *
 * - `team-logos`: `subpath` é o `team_id` e a logo é gravada em
 *   `/uploads/team-logos/<team_id>/`. Só o dono ou o capitão do time escreve —
 *   mesma regra do PUT /api/teams/:id, para o atacante não plantar arquivos na
 *   pasta de um time alheio.
 * - `public-images`: usado só pelo painel de campeonatos. Só admin,
 *   proprietário ou organizador escreve.
 */
export type PermissaoBucketPublico =
  | { ok: true }
  | { ok: false; status: number; erro: string };

export async function validarPermissaoBucketPublico(
  db: any,
  userId: string,
  bucket: string,
  subpath: string
): Promise<PermissaoBucketPublico> {
  if (bucket === "team-logos") {
    if (!subpath) {
      return { ok: false, status: 400, erro: "Informe o id do time (path) para o bucket team-logos." };
    }
    const [team] = await db.select().from(teams).where(eq(teams.id, subpath)).limit(1);
    if (!team) return { ok: false, status: 404, erro: "Time não encontrado." };

    const isOwner = team.ownerId === userId;
    const [cap] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.isCaptain, true)))
      .limit(1);
    const isCaptain = !isOwner && Boolean(cap && cap.userId === userId);
    const roles = await getRoles(db, userId);
    const isProprietario = roles.some((r) => r === "proprietario");

    if (!isOwner && !isCaptain && !isProprietario) {
      return { ok: false, status: 403, erro: "Apenas o dono, capitão ou proprietário do time pode enviar a logo." };
    }
    return { ok: true };
  }

  if (bucket === "public-images") {
    const roles = await getRoles(db, userId);
    const pode = roles.some(
      (r) => r === "admin" || r === "proprietario" || r === "organizer" || r === "organizador"
    );
    if (!pode) {
      return { ok: false, status: 403, erro: "Apenas admin ou organizador pode enviar imagens públicas." };
    }
    return { ok: true };
  }

  return { ok: true };
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
            ? "Arquivo muito grande. Máximo de 30 MB."
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

      // Teto por bucket (o multer só conhece o global de 30 MB; o bucket chega
      // no mesmo multipart, então a checagem fina é aqui).
      const limiteBucket = MAX_POR_BUCKET[bucket] ?? MAX_SIZE;
      if (file.size > limiteBucket) {
        return res.status(400).json({
          error: "Imagem muito grande. Máximo de 30 MB.",
        });
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

      // ── Buckets públicos: escrita restrita ao dono/role (README.md — Uploads e autorização) ──
      const permissoes = await validarPermissaoBucketPublico(db, session.userId, bucket, subpath);
      if (!permissoes.ok) {
        return res.status(permissoes.status).json({ error: permissoes.erro });
      }

      const filename = sanitizeFilename(file.originalname);
      if (!filename) {
        return res.status(400).json({ error: "Nome de arquivo inválido." });
      }

      // Imagem de exibição vira WebP redimensionado; o nome troca para `.webp` e
      // a URL devolvida (fonte da verdade para o front) reflete isso. Se o sharp
      // falhar, salva o original — upload do usuário nunca quebra por causa da
      // otimização.
      let bufferFinal = file.buffer;
      let ext = path.extname(filename).toLowerCase() || EXT_POR_FORMATO[img.formato];
      try {
        const processada = await otimizarImagemExibicao(file.buffer, bucket);
        bufferFinal = processada.buffer;
        if (processada.otimizada) ext = ".webp";
      } catch (err: any) {
        console.warn(`[upload] sharp falhou em ${bucket}, salvando original:`, err?.message || err);
      }
      const base = path.basename(filename, path.extname(filename)) || "imagem";

      const dir = path.join(obterUploadDir(), bucket, subpath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Preserva o nome enviado pelo cliente; se colidir (mesmo bucket + nome),
      // desambigua com sufixo curto em vez de sobrescrever o arquivo existente.
      let destino = path.join(dir, `${base}${ext}`);
      if (fs.existsSync(destino)) {
        destino = path.join(dir, `${base}-${crypto.randomBytes(3).toString("hex")}${ext}`);
      }
      await fs.promises.writeFile(destino, bufferFinal);

      const nomeFinal = path.basename(destino);
      const publicUrl = `/uploads/${bucket}${subpath ? "/" + subpath : ""}/${nomeFinal}`;
      return res.json({ url: publicUrl, filename: nomeFinal, ownerId: session.userId });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Erro ao salvar arquivo no servidor" });
    }
  }
);
