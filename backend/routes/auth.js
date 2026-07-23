const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();
const TOKEN_TTL = "8h";

// Driver registration
router.post("/driver/register", (req, res) => {
  const { name, username, password } = req.body || {};

  if (!name || !username || !password) {
    return res.status(400).json({ error: "Name, username and password are required." });
  }

  const existing = db.prepare("SELECT id FROM drivers WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "Username is already taken." });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO drivers (name, username, password_hash) VALUES (?, ?, ?)").run(name, username, hash);

  res.status(201).json({ message: "Account created successfully." });
});

// Driver login
router.post("/driver/login", (req, res) => {
  const { username, password } = req.body || {};
  const driver = db.prepare("SELECT * FROM drivers WHERE username = ?").get(username);

  if (!driver || !bcrypt.compareSync(password || "", driver.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = jwt.sign({ sub: driver.id, role: "driver", name: driver.name }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, name: driver.name, username: driver.username });
});

// Admin login 
router.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);

  if (!admin || !bcrypt.compareSync(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }

  const token = jwt.sign({ sub: admin.id, role: "admin", username: admin.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, username: admin.username });
});

module.exports = router;
