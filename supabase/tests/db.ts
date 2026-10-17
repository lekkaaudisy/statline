// Test database: PGlite (Postgres running inside Vitest) with a small
// Supabase stand-in and every migration applied. Lets tests check RLS and the
// database functions without Docker or a real Supabase project.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = join(__dirname, "..");

export type TestDb = {
  db: PGlite;
  // Creates a sign-up (and so a profile) and returns the user id.
  createUser: (name: string) => Promise<string>;
  // Runs SQL as a signed-in user, inside a transaction that sets their id.
  asUser: <T = Record<string, unknown>>(
    userId: string,
    sql: string,
    params?: unknown[],
  ) => Promise<T[]>;
  // Runs SQL as the database owner (no RLS), for setting up test data.
  admin: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
};

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = join(ROOT, "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  const admin = async <T>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows;

  const asUser = async <T>(userId: string, sql: string, params: unknown[] = []) =>
    db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await tx.exec("set local role authenticated");
      return (await tx.query<T>(sql, params)).rows;
    });

  const createUser = async (name: string) => {
    const rows = await admin<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [`${name.toLowerCase()}@example.com`, { display_name: name }],
    );
    return rows[0].id;
  };

  return { db, createUser, asUser, admin };
}
