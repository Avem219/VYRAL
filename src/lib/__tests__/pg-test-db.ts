import { Client } from "pg";
import path from "path";

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ||
  "postgres://vyral:vyral@localhost:5432/postgres";
/**
 * Creates a fresh, uniquely-named Postgres database, applies the real
 * migration chain to it, and points DATABASE_URL at it. Must be called
 * (and awaited) BEFORE anything imports `src/db`, since that module reads
 * DATABASE_URL at import time.
 *
 * Returns a teardown function that drops the database — call it in an
 * `after()` hook.
 */
export async function createIsolatedTestDatabase(): Promise<() => Promise<void>> {
  const dbName = `vyral_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const testUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${dbName}`);
  process.env.DATABASE_URL = testUrl;

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: testUrl });
  const migrationDb = drizzle(pool);
  await migrate(migrationDb, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();

  return async () => {
    const cleanup = new Client({ connectionString: ADMIN_URL });
    await cleanup.connect();
    // Terminate any lingering connections to the test DB before dropping it.
    await cleanup.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    await cleanup.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await cleanup.end();
  };
}
