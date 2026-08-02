import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";

export const uploadRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/uploads";

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("[m7arena-api] Não foi possível criar pasta de uploads na inicialização:", err);
}

// POST /api/upload - Recebe arquivo e valida autenticação do usuário
uploadRouter.post("/", async (req, res) => {
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

    const contentType = req.headers["content-type"] || "";
    const ext = contentType.includes("png")
      ? ".png"
      : contentType.includes("jpeg") || contentType.includes("jpg")
      ? ".jpg"
      : contentType.includes("webp")
      ? ".webp"
      : ".bin";

    const filename = `${session.userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (Buffer.isBuffer(req.body)) {
      await fs.promises.writeFile(filePath, req.body);
    } else {
      const data = typeof req.body === "string" ? Buffer.from(req.body, "base64") : JSON.stringify(req.body);
      await fs.promises.writeFile(filePath, data);
    }

    const publicUrl = `/uploads/${filename}`;
    return res.json({ url: publicUrl, filename, ownerId: session.userId });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao salvar arquivo no servidor" });
  }
});
