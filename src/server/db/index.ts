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
  const migration = fs.readFileSync(path.join(process.cwd(), "drizzle/0000_init.sql"), "utf8");
  sqlite.exec(migration);
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
