import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (poolInstance) return poolInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. VYRAL runs on PostgreSQL — see .env.example for the expected format " +
        "(e.g. postgres://user:password@localhost:5432/vyral_dev)."
    );
  }

  poolInstance = new Pool({ connectionString });
  return poolInstance;
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }

  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const value = Reflect.get(getDb(), property);

    if (typeof value === "function") {
      return value.bind(getDb());
    }

    return value;
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const value = Reflect.get(getPool(), property);

    if (typeof value === "function") {
      return value.bind(getPool());
    }

    return value;
  },
});

export { schema };
