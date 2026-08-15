import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { runCron } from "./cron.js";
import { authRouter, termsRouter } from "./routes/auth.js";
import { googleAuthRouter } from "./routes/auth-google.js";
import { riotRouter } from "./routes/riot.js";
import { uploadRouter } from "./routes/upload.js";
import { profilesRouter } from "./routes/profiles.js";
import { playersRouter } from "./routes/players.js";
import { discordRouter } from "./routes/discord.js";
import { teamsRouter } from "./routes/teams.js";
import { walletRouter } from "./routes/wallet.js";
import { paymentsRouter } from "./routes/payments.js";
import { withdrawalsRouter } from "./routes/withdrawals.js";
import { matchesRouter } from "./routes/matches.js";
import { revisaoRouter } from "./routes/revisao.js";
import { printsRouter } from "./routes/prints.js";
import { disputasRouter } from "./routes/disputas.js";
import { tournamentsRouter } from "./routes/tournaments.js";
import { contentRouter } from "./routes/content.js";
import { streamsRouter } from "./routes/streams.js";
import { adminRouter } from "./routes/admin.js";
import { ogRouter } from "./routes/og.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança (MORPH-003): CORS com allowlist fixa, nunca ecoar `Origin`
// arbitrária com credenciais. O front roda no mesmo domínio servido pelo
// nginx, mas o Google OAuth usa redirect no app — manter APP_URL + localhost
// para o compose local (ADR-017) cobrir o desenvolvimento.
const CORS_ALLOWLIST = [
  process.env.APP_URL || "",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requisições sem Origin (curl, ferramentas, same-origin) são permitidas.
    if (!origin || CORS_ALLOWLIST.includes(origin)) return callback(null, true);
    return callback(new Error("Origin não permitida pelo CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: ["image/*", "application/octet-stream"], limit: "10mb" }));
app.use(cookieParser());

// Rotas da API Node (ADR-010 / ADR-011 / ADR-007 / ADR-009)
app.use("/api/auth", authRouter);
app.use("/api/terms", termsRouter);
app.use("/api/auth", googleAuthRouter); // /google e /google/callback (ADR-011)
app.use("/api/riot", riotRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/players", playersRouter);
app.use("/api/discord", discordRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/withdrawals", withdrawalsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/revisao", revisaoRouter);
app.use("/api/prints", printsRouter);
app.use("/api/disputas", disputasRouter);
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/content", contentRouter);
app.use("/api/streams", streamsRouter);
app.use("/api/admin", adminRouter);

// Página de preview social (OG) de uma sala — servida só para crawlers
// (o Nginx desvia bots de /:modo/:id para cá). Ver routes/og.ts.
app.use("/api/og", ogRouter);

// Rota de Health Check da API Node
app.get("/api/health", async (_req, res) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", service: "m7arena-api", timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message || "Database connection error" });
  }
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`[m7arena-api] Servidor de API rodando na porta ${PORT}`);
});

// Cron de varredura (design v3 §8): kick de ociosidade (30min) + partida
// fantasma (3h) a cada 10 min. Roda 1x ao subir e depois em intervalo.
setInterval(() => {
  runCron().catch((e) => console.error("[cron] erro:", e?.message));
}, 10 * 60 * 1000);
runCron().catch((e) => console.error("[cron] erro inicial:", e?.message));
