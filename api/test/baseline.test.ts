import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../db/schema/index.js";

const folder = fileURLToPath(new URL("../../db/migrations/", import.meta.url));
const baseline = fs.readFileSync(path.join(folder, "0000_baseline.sql"), "utf8");
const catalogSQL = "BEGIN READ ONLY;\nSELECT json_build_object(\n'columns',(SELECT coalesce(json_agg(json_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) ORDER BY c.relname,a.attname),'[]') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),\n'constraints',(SELECT coalesce(json_agg(json_build_array(c.relname,x.conname,x.contype,pg_get_constraintdef(x.oid,true)) ORDER BY c.relname,x.conname),'[]') FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND x.contype <> 'n'),\n'indexes',(SELECT coalesce(json_agg(json_build_array(tablename,indexname,indexdef) ORDER BY tablename,indexname),'[]') FROM pg_indexes WHERE schemaname='public'),\n'tables',(SELECT coalesce(json_agg(json_build_array(c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')),\n'sequences',(SELECT coalesce(json_agg(json_build_array(sequencename,data_type,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text) ORDER BY sequencename),'[]') FROM pg_sequences WHERE schemaname='public'),\n'enums',(SELECT coalesce(json_agg(json_build_array(t.typname,e.enumlabel,e.enumsortorder) ORDER BY t.typname,e.enumsortorder),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'));\nROLLBACK;";
// Catalogo estrutural consultado somente em leitura; nenhum registro de usuario.
const reference = {
  "columns": {
    "count": 530,
    "sha256": "462a6713f1597fdbf8766fe3d5f6748cabf14554311394a7617646e35f879a36"
  },
  "constraints": {
    "count": 139,
    "sha256": "ce868be6c4913cd9704a8573088a910c54c26ec3b0915b9be6d641edc478bfa5"
  },
  "indexes": {
    "count": 134,
    "sha256": "a78072b775973d7a1cd2192d7a3a1a0bdd8023cc518228bd6f1cd92ec6eb5a0b"
  },
  "tables": {
    "count": 48,
    "sha256": "aa53e36676fc037cd17647196e05566e4b790dbd5c461843d7fd7f0be988352a"
  },
  "sequences": {
    "count": 2,
    "sha256": "2573f79473227127845aa55e6466703090af69ab419997ab87c275f0d227bbb9"
  },
  "enums": {
    "count": 0,
    "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  }
};

test("baseline reconstrói o catálogo estrutural conferido na VPS, sem dados reais", async () => {
  const client = new PGlite();
  try {
    await client.exec(baseline);
    const results = await client.exec(catalogSQL);
    const catalog = results.find((r: any) => r.rows[0]?.json_build_object)!.rows[0].json_build_object as Record<string, any[]>;
    const actual = Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, {
      count: value.length,
      sha256: crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    }]));
    assert.deepEqual(actual, reference);
    const counts = await client.query<{ users: number; wallets: number; codes: number; packages: number; games: number }>(
      "select (select count(*)::int from users) users, (select count(*)::int from user_wallets) wallets, (select count(*)::int from match_codes) codes, (select count(*)::int from mc_packages) packages, (select count(*)::int from games) games");
    assert.deepEqual(counts.rows[0], { users: 0, wallets: 0, codes: 0, packages: 6, games: 1 });
  } finally { await client.close(); }
});

test("snapshot ativo corresponde às declarações de schema, sem nova migration espúria", async () => {
  const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
  const last = journal.entries.at(-1);
  const snapshot = JSON.parse(fs.readFileSync(path.join(folder, "meta", String(last.idx).padStart(4, "0") + "_snapshot.json"), "utf8"));
  assert.deepEqual(await generateMigration(snapshot, generateDrizzleJson(schema)), []);
});

test("migrador cria banco vazio e não reaplica baseline diante do histórico existente", async () => {
  const client = new PGlite();
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
    assert.equal(journal.entries[0].when, 1785556094468);
    await client.exec("insert into users (id,email,display_name) values ('00000000-0000-0000-0000-000000000001','fixture@baseline.test','Fixture')");
    // Timestamp mais recente consultado no ledger real; aqui somente uma fixture.
    await client.exec("insert into drizzle.__drizzle_migrations (hash,created_at) values ('historical-fixture',1785990426472)");
    const before = (await client.query("select * from users")).rows;
    const migrationsBefore = (await client.query("select * from drizzle.__drizzle_migrations order by id")).rows;
    await migrate(db, { migrationsFolder: folder });
    assert.deepEqual((await client.query("select * from users")).rows, before);
    assert.deepEqual((await client.query("select * from drizzle.__drizzle_migrations order by id")).rows, migrationsBefore);
  } finally { await client.close(); }
});

test("migration posterior altera só o banco isolado uma vez, preservando registros existentes", async () => {
  const client = new PGlite();
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const temporaryFolder = fs.mkdtempSync(path.join(temporaryRoot, "m7-baseline-"));
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    await client.exec("insert into users (id,email,display_name) values ('00000000-0000-0000-0000-000000000002','preserved@baseline.test','Fixture')");
    fs.mkdirSync(path.join(temporaryFolder, "meta"));
    const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
    const previousCount = journal.entries.length;
    for (const entry of journal.entries) {
      fs.copyFileSync(path.join(folder, entry.tag + ".sql"), path.join(temporaryFolder, entry.tag + ".sql"));
    }
    const last = journal.entries.at(-1);
    const tag = String(previousCount).padStart(4, "0") + "_test_delta";
    journal.entries.push({ idx: previousCount, version: "7", when: Math.max(Date.now(), last.when + 1), tag, breakpoints: true });
    fs.writeFileSync(path.join(temporaryFolder, "meta/_journal.json"), JSON.stringify(journal));
    fs.writeFileSync(path.join(temporaryFolder, tag + ".sql"), "alter table users add column baseline_test_delta text;");
    await migrate(db, { migrationsFolder: temporaryFolder });
    await migrate(db, { migrationsFolder: temporaryFolder });
    assert.equal((await client.query("select email from users")).rows[0].email, "preserved@baseline.test");
    assert.equal((await client.query("select count(*)::int total from drizzle.__drizzle_migrations")).rows[0].total, previousCount + 1);
  } finally {
    await client.close();
    const target = fs.realpathSync(temporaryFolder);
    assert.equal(path.dirname(target), temporaryRoot);
    assert(path.basename(target).startsWith("m7-baseline-"));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
