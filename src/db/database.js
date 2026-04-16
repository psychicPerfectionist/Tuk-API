// db/database.js
// Sets up an in-memory SQLite database using sql.js (pure JavaScript - no native modules needed)
// sql.js is a port of SQLite compiled to WebAssembly, so it works on any platform

const path = require('path');
const fs   = require('fs');

let db = null; // will hold the database instance once initialized

// We persist the database to a file so data survives restarts
// Always resolve from project root (2 levels up from src/db/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_FILE = path.join(PROJECT_ROOT, 'data', 'tuktrack.db');

async function initDatabase(fresh = false) {
  // sql.js needs to be initialized before use
  const initSqlJs = require(path.join(__dirname, '../../node_modules/sql.js'));
  const SQL = await initSqlJs();

  const fileExists = fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 0;

  if (!fresh && fileExists) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
    console.log('   Database loaded from file.');
  } else {
    // fresh=true or no file: start with empty in-memory database
    db = new SQL.Database();
    if (fresh) {
      console.log('   Fresh database created.');
    } else {
      console.log('   New database created.');
    }
  }

  // Create all the tables we need
  createTables();

  console.log('   Database ready.\n');
  return db;
}

function createTables() {
  // Provinces table - Sri Lanka has 9 provinces
  db.run(`
    CREATE TABLE IF NOT EXISTS provinces (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      code       TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Districts table - 25 districts, each belongs to a province
  db.run(`
    CREATE TABLE IF NOT EXISTS districts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      code        TEXT NOT NULL UNIQUE,
      province_id INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (province_id) REFERENCES provinces(id)
    )
  `);

  // Police stations - each belongs to a district
  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      code        TEXT,
      district_id INTEGER NOT NULL,
      province_id INTEGER NOT NULL,
      address     TEXT,
      phone       TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (district_id) REFERENCES districts(id),
      FOREIGN KEY (province_id) REFERENCES provinces(id)
    )
  `);

  // Drivers table
  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name      TEXT NOT NULL,
      license_number TEXT NOT NULL UNIQUE,
      nic_number     TEXT NOT NULL UNIQUE,
      phone          TEXT,
      status         TEXT DEFAULT 'ACTIVE',
      created_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  // Vehicles (tuk-tuks) table
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL UNIQUE,
      device_id           TEXT NOT NULL UNIQUE,
      make                TEXT,
      model               TEXT,
      colour              TEXT,
      driver_id           INTEGER,
      station_id          INTEGER,
      province_id         INTEGER,
      district_id         INTEGER,
      status              TEXT DEFAULT 'ACTIVE',
      created_at          TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (driver_id)   REFERENCES drivers(id),
      FOREIGN KEY (station_id)  REFERENCES stations(id),
      FOREIGN KEY (province_id) REFERENCES provinces(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    )
  `);

  // Location pings - this is the main tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS location_pings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      latitude   REAL NOT NULL,
      longitude  REAL NOT NULL,
      speed      REAL,
      heading    REAL,
      accuracy   REAL,
      pinged_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  // Users table - police officers and device accounts
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      full_name   TEXT,
      role        TEXT NOT NULL,
      province_id INTEGER,
      district_id INTEGER,
      vehicle_id  INTEGER,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (province_id) REFERENCES provinces(id),
      FOREIGN KEY (district_id) REFERENCES districts(id),
      FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)
    )
  `);
}

// Save the database to file (called after writes so data persists)
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, buffer);
}

// Simple helper to run a SELECT and return rows as plain objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper to run INSERT / UPDATE / DELETE
function run(sql, params = []) {
  db.run(sql, params);
  const rowid = db.exec('SELECT last_insert_rowid()');
  const lastId = rowid[0] ? rowid[0].values[0][0] : null;
  saveDatabase();
  return lastId;
}

// Run many inserts without saving after each one (for bulk operations like seeding)
function batchRun(sql, params = []) {
  db.run(sql, params);
  const rowid = db.exec('SELECT last_insert_rowid()');
  return rowid[0] ? rowid[0].values[0][0] : null;
}

// Get a single row
function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { initDatabase, query, run, batchRun, queryOne, saveDatabase };
