import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import pg from "pg";
import { APP_ENV, DATABASE_URL, OUTBOX, STATE_DIR } from "./env";

/** A fresh, migrated, seeded test database for every run. */
export default async function globalSetup() {
  mkdirSync(STATE_DIR, { recursive: true });
  rmSync(OUTBOX, { force: true });

  const url = new URL(DATABASE_URL);
  const database = url.pathname.slice(1);
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${database}"`);
  await admin.end();

  // `npm run db:start` answers every database name with the same database, so
  // on it `ambassadors_test` is the dev data, and the truncate below empties it.
  const probe = new pg.Client({ connectionString: DATABASE_URL });
  await probe.connect();
  const { rows: current } = await probe.query<{ name: string }>("SELECT current_database() AS name");
  await probe.end();
  if (current[0].name !== database) {
    throw new Error(
      `The test database "${database}" opened "${current[0].name}" instead, so this run would empty ` +
        "the database `npm run dev` uses. Run `npm run db:test:start` and set TEST_DATABASE_URL " +
        "in .env to the URL it prints.",
    );
  }

  const env = { ...process.env, ...APP_ENV };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  if (rows.length > 0) {
    await client.query(
      `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }
  await client.end();

  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
