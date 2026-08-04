import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const databasePath = path.resolve(process.env.DATABASE_PATH ?? "./data/thought-incubator.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
sqlite.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)");
for (const name of fs.readdirSync(path.join(process.cwd(), "drizzle")).filter((entry) => /^\d+_.+\.sql$/.test(entry)).sort()) {
  if (sqlite.prepare("SELECT 1 FROM _app_migrations WHERE name = ?").get(name)) continue;
  sqlite.transaction(() => {
    sqlite.exec(fs.readFileSync(path.join(process.cwd(), "drizzle", name), "utf8"));
    sqlite.prepare("INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
  })();
}
sqlite.close();
console.log("Migrations applied:", databasePath);
