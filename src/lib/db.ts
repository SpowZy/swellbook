import { Pool } from "pg";

// One pool per process. Next.js dev hot-reloads modules, so park it on
// globalThis to avoid leaking connections on every recompile.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
    }
    globalForDb.pgPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.pgPool;
}
