import { DatabaseSync } from 'node:sqlite';
export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, customer TEXT, pending_customer TEXT, auth_state TEXT, auth_code TEXT, auth_expires INTEGER);
    CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL, member TEXT, code TEXT, code_expires INTEGER);
    CREATE TABLE IF NOT EXISTS links (shop TEXT NOT NULL, customer TEXT NOT NULL, member TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(shop,customer), UNIQUE(shop,member));
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, subject_hash TEXT NOT NULL, at INTEGER NOT NULL);
  `);
  return db;
}
export function transaction(db, fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
export function purge(db, now) {
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
  db.prepare('DELETE FROM flows WHERE expires <= ?').run(now);
  db.prepare('DELETE FROM audit WHERE at < ?').run(now - 30 * 86400_000);
}
