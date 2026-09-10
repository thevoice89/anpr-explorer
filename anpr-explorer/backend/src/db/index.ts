import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

const dbDir = path.dirname(env.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(env.DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Migrazioni idempotenti eseguite all'avvio (CREATE TABLE IF NOT EXISTS).
 * Per un progetto di queste dimensioni non serve un framework di migrazione dedicato.
 */
function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      client_id TEXT,
      kid TEXT,
      private_key_encrypted TEXT,
      token_endpoint TEXT,
      client_assertion_audience TEXT,
      anpr_base_url TEXT,
      environment TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purpose_map (
      service_code TEXT PRIMARY KEY,
      purpose_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      operatore TEXT NOT NULL,
      servizio TEXT NOT NULL,
      modalita TEXT,
      motivazione TEXT,
      esito TEXT NOT NULL,
      dettaglio_errore TEXT,
      cf_mascherato TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Colonna aggiunta dopo il rilascio iniziale: l'ALTER è no-op se già presente.
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN ipa_code TEXT`);
  } catch {
    // SQLite lancia "duplicate column name" se la colonna esiste già — ignorabile.
  }

  // Seed: se non esiste nessun utente, crea l'admin dall'env (hash già pronto).
  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (count === 0) {
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
      env.ADMIN_USERNAME,
      env.ADMIN_PASSWORD_HASH,
      'admin'
    );
  }
}

migrate();
