import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const databasePath = path.resolve(process.env.DATABASE_PATH ?? "./data/thought-incubator.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
sqlite.exec(fs.readFileSync(path.join(process.cwd(), "drizzle/0000_init.sql"), "utf8"));
sqlite.close();
console.log("Migration applied:", databasePath);
