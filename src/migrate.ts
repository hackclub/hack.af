import { readdir } from "node:fs/promises";
import path from "node:path";
import type pg from "pg";

const MIGRATIONS_DIR = path.join(import.meta.dir, "..", "db", "migrations");
// Arbitrary constant so two instances booting at once don't apply the same migration twice
const MIGRATION_LOCK_ID = 7_100_401;

// Migrations only ever add to the schema. The original tables ("Links", "Log",
// "slughistory") predate this runner and are documented in db/dev-schema.sql.
export async function runMigrations(pool: pg.Pool) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  const conn = await pool.connect();

  try {
    await conn.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await conn.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map(
        (row) => row.name,
      ),
    );

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await Bun.file(path.join(MIGRATIONS_DIR, file)).text();
      try {
        await conn.query("BEGIN");
        await conn.query(sql);
        await conn.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await conn.query("COMMIT");
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await conn.query("ROLLBACK");
        throw new Error(`Migration ${file} failed`, { cause: error });
      }
    }
  } finally {
    await conn.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    conn.release();
  }
}
