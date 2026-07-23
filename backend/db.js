const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const bcrypt = require("bcryptjs");

// Database connection
const DB_PATH = path.join(__dirname, "parking.db");
const db = new DatabaseSync(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS parking_areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    total_spaces INTEGER NOT NULL,
    available_spaces INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Initial parking data
const seedAreas = [
  { id: "lot-001", name: "Trinity Street Car Park", lat: 53.3438, lng: -6.2636, totalSpaces: 120, availableSpaces: 54 },
  { id: "lot-002", name: "St Stephen's Green Car Park", lat: 53.3381, lng: -6.2592, totalSpaces: 180, availableSpaces: 12 },
  { id: "lot-003", name: "Jervis Centre Car Park", lat: 53.3477, lng: -6.2697, totalSpaces: 200, availableSpaces: 0 },
  { id: "lot-004", name: "Drury Street Car Park", lat: 53.3417, lng: -6.2634, totalSpaces: 90, availableSpaces: 31 },
  { id: "lot-005", name: "Setanta Place Car Park", lat: 53.3406, lng: -6.2576, totalSpaces: 150, availableSpaces: 8 },
  { id: "lot-006", name: "Marlborough Street Car Park", lat: 53.3508, lng: -6.2603, totalSpaces: 110, availableSpaces: 76 },
];

const countRow = db.prepare("SELECT COUNT(*) AS c FROM parking_areas").get();
if (countRow.c === 0) {
  const insert = db.prepare(`
    INSERT INTO parking_areas (id, name, lat, lng, total_spaces, available_spaces)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const a of seedAreas) {
    insert.run(a.id, a.name, a.lat, a.lng, a.totalSpaces, a.availableSpaces);
  }
  console.log(`Seeded ${seedAreas.length} parking areas.`);
}

// Seed default admin
const adminCount = db.prepare("SELECT COUNT(*) AS c FROM admins").get();
if (adminCount.c === 0) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run("admin", hash);
  console.log("Seeded default admin account (admin / admin123).");
}

// Seed default driver
const driverCount = db.prepare("SELECT COUNT(*) AS c FROM drivers").get();
if (driverCount.c === 0) {
  const hash = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT INTO drivers (name, username, password_hash) VALUES (?, ?, ?)").run("hkmo", "driver", hash);
  console.log("Seeded default driver account (driver / password123).");
}

module.exports = db;
