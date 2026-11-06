import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

if (process.loadEnvFile) {
  try { process.loadEnvFile(".env"); } catch {}
}
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL precisa ser definida para executar migrations.");

const directory = fileURLToPath(new URL("../db/migrations", import.meta.url));
const migrations = readdirSync(directory)
  .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
  .sort()
  .map((file) => {
    // Git may check out SQL as CRLF on Windows. Hash normalized content so the
    // same immutable migration has one checksum on local machines and Linux.
    const rawSql = readFileSync(join(directory, file), "utf8");
    const sql = rawSql.replace(/\r\n/g, "\n");
    return {
      version: Number(file.slice(0, 3)),
      file,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
      compatibleChecksums: new Set([
        createHash("sha256").update(rawSql).digest("hex"),
        createHash("sha256").update(sql).digest("hex"),
      ]),
    };
  });

if (new Set(migrations.map((item) => item.version)).size !== migrations.length)
  throw new Error("Existem versões de migration duplicadas.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
});
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [
    "delivery-mhs:schema-migrations",
  ]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    filename text NOT NULL UNIQUE,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = await client.query(
    "SELECT version,filename,checksum FROM schema_migrations ORDER BY version",
  );
  const byVersion = new Map(applied.rows.map((row) => [row.version, row]));
  const legacy = await relationExists("tenants");

  for (const migration of migrations) {
    const existing = byVersion.get(migration.version);
    if (existing) {
      if (
        existing.filename !== migration.file ||
        !migration.compatibleChecksums.has(existing.checksum.trim())
      ) throw new Error(`${migration.file} foi alterada depois de aplicada.`);
      console.log(`Já aplicada: ${migration.file}`);
      continue;
    }
    if (legacy && (await legacyMigrationPresent(migration.version))) {
      await record(migration);
      console.log(`Registrada do banco legado: ${migration.file}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await record(migration);
      await client.query("COMMIT");
      console.log(`Aplicada: ${migration.file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  async function record(migration) {
    await client.query(
      "INSERT INTO schema_migrations(version,filename,checksum) VALUES($1,$2,$3)",
      [migration.version, migration.file, migration.checksum],
    );
  }
  async function relationExists(name) {
    const result = await client.query("SELECT to_regclass($1) IS NOT NULL present", [
      `public.${name}`,
    ]);
    return result.rows[0].present;
  }
  async function columnExists(table, column) {
    const result = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2) present`,
      [table, column],
    );
    return result.rows[0].present;
  }
  async function legacyMigrationPresent(version) {
    if (version <= 2) return relationExists("tenants");
    if (version === 3)
      return (await relationExists("admin_users")) &&
        (await columnExists("order_status_history", "actor_id"));
    if (version === 4) return columnExists("products", "version");
    if (version === 7) return relationExists("api_rate_limits");
    return false;
  }
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
      "delivery-mhs:schema-migrations",
    ]);
  } finally {
    client.release();
    await pool.end();
  }
}
