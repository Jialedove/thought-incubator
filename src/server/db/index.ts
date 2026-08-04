import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(dataDir, "thought-incubator.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });

let migrated = false;
export function ensureDatabase() {
  if (migrated) return;
  sqlite.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)");
  const migrations = fs.readdirSync(path.join(process.cwd(), "drizzle"))
    .filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  for (const name of migrations) {
    const applied = sqlite.prepare("SELECT 1 FROM _app_migrations WHERE name = ?").get(name);
    if (applied) continue;
    const migration = fs.readFileSync(path.join(process.cwd(), "drizzle", name), "utf8");
    sqlite.transaction(() => {
      sqlite.exec(migration);
      sqlite.prepare("INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
    })();
  }
  migrated = true;
}

export function databaseLocation() {
  return databasePath;
}

export function runTransaction<T>(fn: () => T) {
  ensureDatabase();
  return db.transaction(fn);
}

export const rawSql = sql;
