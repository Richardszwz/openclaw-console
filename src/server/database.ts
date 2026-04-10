/**
 * @fileoverview SQLite database configuration and schema definition for OpenClaw Console
 * Uses better-sqlite3 for efficient synchronous database access
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'openclaw.db');

const db = new Database(dbPath);

/**
 * Initialize database schema - creates all tables if they don't exist
 * 
 * Table Structure:
 * 
 * @table settings - Stores console configuration key-value pairs
 * @column {TEXT} key - Configuration key (primary key)
 * @column {TEXT} value - Configuration value (JSON encoded)
 * @column {DATETIME} updated_at - Last update timestamp
 * 
 * @table users - User accounts for authentication
 * @column {INTEGER} id - User ID (auto-increment primary key)
 * @column {TEXT} username - Unique username
 * @column {TEXT} password_hash - Bcrypt hashed password
 * @column {TEXT} email - Unique email address (optional)
 * @column {TEXT} role - User role: 'admin' | 'user' (default 'user')
 * @column {DATETIME} created_at - Account creation timestamp
 * @column {DATETIME} last_login - Last successful login timestamp
 * 
 * @table sessions - Active user sessions
 * @column {INTEGER} id - Session ID (auto-increment primary key)
 * @column {INTEGER} user_id - Reference to users.id
 * @column {TEXT} token - Unique session token
 * @column {DATETIME} expires_at - Session expiration timestamp
 * @column {DATETIME} created_at - Session creation timestamp
 * @foreign_key (user_id) REFERENCES users(id)
 * 
 * @table skills - Cached skill metadata from ClawHub
 * @column {INTEGER} id - Skill record ID (auto-increment primary key)
 * @column {TEXT} name - Unique skill name
 * @column {TEXT} version - Current installed version
 * @column {TEXT} description - Skill description
 * @column {BOOLEAN} installed - Whether skill is installed (0/1)
 * @column {DATETIME} installed_at - Installation timestamp
 * @column {DATETIME} updated_at - Last update timestamp
 * 
 * @table logs - System event logs
 * @column {INTEGER} id - Log ID (auto-increment primary key)
 * @column {TEXT} level - Log level: 'debug' | 'info' | 'warn' | 'error'
 * @column {TEXT} message - Log message content
 * @column {TEXT} source - Source module/function
 * @column {DATETIME} created_at - Log creation timestamp
 * 
 * @table backups - Backup metadata
 * @column {INTEGER} id - Backup ID (auto-increment primary key)
 * @column {TEXT} path - File path to backup archive
 * @column {INTEGER} size_bytes - Backup file size in bytes
 * @column {DATETIME} created_at - Backup creation timestamp
 * @column {TEXT} status - Backup status: 'completed' | 'failed' | 'in-progress'
 */
export function initDatabase(): void {
  // Settings table for storing console configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Users table for authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);

  // Sessions table for user sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Skills table for cached skill information
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      version TEXT,
      description TEXT,
      installed BOOLEAN DEFAULT 0,
      installed_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Logs table for system logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Backups table for backup metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      size_bytes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'completed'
    );
  `);
}

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
`);

export { db };
export default db;
