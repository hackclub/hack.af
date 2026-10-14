import pg from "pg";
import { runMigrations } from "./migrate.ts";

const connectionString = process.env.DATABASE_URL;

async function connectToDatabase() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const pool = new pg.Pool({
        connectionString,
        max: parseInt(Bun.env.DATABASE_POOL_SIZE ?? "10", 10),
      });
      // Fail fast if the database is unreachable instead of on the first request
      await pool.query("SELECT 1");
      console.log("Connected to the database successfully");
      return pool;
    } catch (error) {
      console.error(`Database connection attempt ${attempt + 1} failed:`, error);
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Failed to connect to the database after 5 attempts.");
}

// A pool rather than a single client so dashboard queries never queue behind redirects
export let client: pg.Pool;
export async function initializeDatabase() {
  try {
    client = await connectToDatabase();
    await runMigrations(client);
  } catch (error) {
    console.error("Could not establish a database connection:", error);
    process.exit(1);
  }
}

export async function withTransaction<T>(fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
  const tx = await client.connect();
  try {
    await tx.query("BEGIN");
    const result = await fn(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
