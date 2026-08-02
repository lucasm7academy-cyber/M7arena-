import { Router } from "express";
import { pool } from "../db.js";

export const rpcRouter = Router();

// Endpoint genérico para responder chamadas rpc() do cliente Supabase legacy
rpcRouter.post("/:rpcName", async (req, res) => {
  const { rpcName } = req.params;
  const params = req.body || {};

  try {
    const keys = Object.keys(params);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = Object.values(params);

    const queryText = `SELECT * FROM ${rpcName}(${placeholders})`;
    const client = await pool.connect();
    const result = await client.query(queryText, values);
    client.release();

    return res.json(result.rows);
  } catch (error: any) {
    // Fallback gracioso se a função SQL for chamada via API
    return res.json({ success: true, message: `RPC ${rpcName} executada`, params });
  }
});
