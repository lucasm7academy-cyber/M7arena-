import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { googleAuthRouter } from "./routes/auth-google.js";
import { riotRouter } from "./routes/riot.js";
import { uploadRouter } from "./routes/upload.js";
import { profilesRouter } from "./routes/profiles.js";
import { playersRouter } from "./routes/players.js";
import { discordRouter } from "./routes/discord.js";
import { teamsRouter } from "./routes/teams.js";
import { walletRouter } from "./routes/wallet.js";
import { matchesRouter } from "./routes/matches.js";
import { revisaoRouter } from "./routes/revisao.js";
import { tournamentsRouter } from "./routes/tournaments.js";
import { contentRouter } from "./routes/content.js";
import { adminRouter } from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: ["image/*", "application/octet-stream"], limit: "10mb" }));
app.use(cookieParser());

// Rotas da API Node (ADR-010 / ADR-011 / ADR-007 / ADR-009)
app.use("/api/auth", authRouter);
app.use("/api/auth", googleAuthRouter); // /google e /google/callback (ADR-011)
app.use("/api/riot", riotRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/players", playersRouter);
app.use("/api/discord", discordRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/revisao", revisaoRouter);
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/content", contentRouter);
app.use("/api/admin", adminRouter);

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
