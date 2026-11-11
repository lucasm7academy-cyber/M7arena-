import { Router } from "express";
import { contentHighlightsRouter } from "./highlights-routes.js";

export const contentRouter = Router();

// Conteúdo ativo: apenas highlights. Notícias (G01) e player_stats (G03)
// foram removidos na simplificação de 2026-11.
contentRouter.use("/highlights", contentHighlightsRouter);
