const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

const resolvedDbPath = path.resolve(process.cwd(), config.dbPath);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new Database(resolvedDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema on every boot — all statements are idempotent (CREATE ... IF NOT EXISTS).
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.sql'), 'utf8');
db.exec(schemaSql);

module.exports = db;
