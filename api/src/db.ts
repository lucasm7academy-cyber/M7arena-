import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../db/schema/index.js";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/m7arena";

export const pool = new pg.Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// node-postgres: o Pool emite 'error' quando uma conexão idle morre (postgres
// reiniciou, timeout, rede caiu). SEM este handler o processo inteiro crasha
// com "Unhandled 'error' event" (57P01) e o app reinicia — durante a janela de
// restart qualquer request devolve 500. Com o handler, o pool descarta o client
// morto e a próxima query cria uma conexão nova.
pool.on("error", (err) => {
  console.error("[db] conexão idle do pool morreu:", err.message);
});

export const db = drizzle(pool, { schema });
