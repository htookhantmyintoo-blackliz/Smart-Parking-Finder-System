const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const bcrypt = require("bcryptjs");

// Database connection
const DB_PATH = path.join(__dirname, "parking.db");
const db = new DatabaseSync(DB_PATH);

// Create tables with email support
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
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL
  );
`);

// Migration: Ensure 'email' column exists if 'parking.db' was created earlier
try {
  db.exec("ALTER TABLE drivers ADD COLUMN email TEXT UNIQUE");
} catch (_) {
  // Column already exists
}
try {
  db.exec("ALTER TABLE admins ADD COLUMN email TEXT UNIQUE");
} catch (_) {
  // Column already exists
}

// Parking areas across Dublin
const seedAreas = [
  // City centre
  { id: "lot-001", name: "Trinity Street Car Park", lat: 53.3438, lng: -6.2636, totalSpaces: 120, availableSpaces: 54 },
  { id: "lot-002", name: "St Stephen's Green Car Park", lat: 53.3381, lng: -6.2592, totalSpaces: 180, availableSpaces: 12 },
  { id: "lot-003", name: "Jervis Centre Car Park", lat: 53.3477, lng: -6.2697, totalSpaces: 200, availableSpaces: 0 },
  { id: "lot-004", name: "Drury Street Car Park", lat: 53.3417, lng: -6.2634, totalSpaces: 90, availableSpaces: 31 },
  { id: "lot-005", name: "Setanta Place Car Park", lat: 53.3406, lng: -6.2576, totalSpaces: 150, availableSpaces: 8 },
  { id: "lot-006", name: "Marlborough Street Car Park", lat: 53.3508, lng: -6.2603, totalSpaces: 110, availableSpaces: 76 },
  // Further out — north, west, south, and coastal Dublin
  { id: "lot-007", name: "Dublin Airport Short-Term", lat: 53.4213, lng: -6.2701, totalSpaces: 400, availableSpaces: 145 },
  { id: "lot-008", name: "Blanchardstown Centre Car Park", lat: 53.3907, lng: -6.3855, totalSpaces: 250, availableSpaces: 60 },
  { id: "lot-009", name: "Dundrum Town Centre Car Park", lat: 53.2903, lng: -6.2470, totalSpaces: 300, availableSpaces: 0 },
  { id: "lot-010", name: "Tallaght The Square Car Park", lat: 53.2859, lng: -6.3728, totalSpaces: 220, availableSpaces: 18 },
  { id: "lot-011", name: "Dun Laoghaire Harbour Car Park", lat: 53.2941, lng: -6.1364, totalSpaces: 150, availableSpaces: 90 },
  { id: "lot-012", name: "Swords Pavilions Car Park", lat: 53.4597, lng: -6.2181, totalSpaces: 280, availableSpaces: 112 },
];

const insertArea = db.prepare(`
  INSERT OR IGNORE INTO parking_areas (id, name, lat, lng, total_spaces, available_spaces)
  VALUES (?, ?, ?, ?, ?, ?)
`);
let insertedCount = 0;
for (const a of seedAreas) {
  const result = insertArea.run(a.id, a.name, a.lat, a.lng, a.totalSpaces, a.availableSpaces);
  if (result.changes > 0) insertedCount++;
}
if (insertedCount > 0) {
  console.log(`Seeded ${insertedCount} new parking area(s).`);
}

// Seed default admin
const adminCount = db.prepare("SELECT COUNT(*) AS c FROM admins").get();
if (adminCount.c === 0) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)").run(
    "admin",
    "admin@gmail.com",
    hash
  );
  console.log("Seeded default admin account (admin / admin@gmail.com / admin123).");
}

// Seed default driver
const driverCount = db.prepare("SELECT COUNT(*) AS c FROM drivers").get();
if (driverCount.c === 0) {
  const hash = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT INTO drivers (name, username, email, password_hash) VALUES (?, ?, ?, ?)").run(
    "hkmo",
    "driver",
    "driver@gmail.com",
    hash
  );
  console.log("Seeded default driver account (driver / driver@gmail.com / password123).");
}

module.exports = db;
