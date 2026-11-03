import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
export const secret = () => randomBytes(32).toString("base64url");
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function password(value: string, salt = secret()) {
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function verify(value: string, encoded: string) {
  const [salt, digest] = encoded.split(":");
  return timingSafeEqual(
    Buffer.from(password(value, salt).split(":")[1], "hex"),
    Buffer.from(digest, "hex"),
  );
}
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS starts(site TEXT NOT NULL,identity TEXT NOT NULL,started INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS starts_identity ON starts(site,identity,started);
   CREATE TABLE IF NOT EXISTS providers(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS logins(token TEXT PRIMARY KEY,owner TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY,owner TEXT NOT NULL,draft TEXT NOT NULL,published TEXT,revision INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS consultations(id TEXT PRIMARY KEY,site TEXT NOT NULL,started INTEGER NOT NULL,ended INTEGER,status TEXT NOT NULL,reserved INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL,engine TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,session TEXT UNIQUE NOT NULL,site TEXT NOT NULL,name TEXT NOT NULL,contact TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
  `);
    // Process restart invalidates in-memory tokens; keep reserved budget for unknown upstream closure.
    this.db
      .prepare(
        "UPDATE consultations SET status='interrupted',ended=? WHERE status='active'",
      )
      .run(Date.now());
  }
  get(sql: string, ...args: any[]) {
    return this.db.prepare(sql).get(...args) as any;
  }
  all(sql: string, ...args: any[]) {
    return this.db.prepare(sql).all(...args) as any[];
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  close() {
    this.db.close();
  }
}
