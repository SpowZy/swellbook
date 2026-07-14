/**
 * Applies db/migrations/*.sql in filename order, then optionally db/seed.sql.
 *
 *   pnpm db:migrate           apply pending migrations
 *   pnpm db:migrate --seed    also load seed data (skips if listings exist)
 *   pnpm db:migrate --fresh   drop everything first (used by tests, never in prod)
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");
const SEED_FILE = join(process.cwd(), "db", "seed.sql");

async function main() {
  const fresh = process.argv.includes("--fresh");
  const seed = process.argv.includes("--seed");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (fresh) {
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      console.log("schema dropped and recreated");
    }

    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    );

    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const { rowCount } = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
      if (rowCount) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    }

    if (seed) {
      const { rows } = await client.query("SELECT count(*)::int AS n FROM listings");
      if (rows[0].n > 0) {
        console.log(`seed skipped, ${rows[0].n} listings already present`);
      } else {
        await client.query(readFileSync(SEED_FILE, "utf8"));
        const after = await client.query("SELECT count(*)::int AS n FROM listings");
        console.log(`seeded ${after.rows[0].n} listings`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
