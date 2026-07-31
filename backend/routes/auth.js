const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();
const TOKEN_TTL = "8h";

// Email validation
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Password strength check
function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

// Driver Registration
router.post("/driver/register", (req, res) => {
  const { name, username, email, password } = req.body || {};

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: "All fields (name, username, email, password) are required." });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters long." });
  }
  if (!validateEmail(cleanEmail)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  // 1. Explicitly check both Username and Email together/separately with LOWER()
  const existingUser = db
    .prepare("SELECT username, email FROM drivers WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)")
    .get(cleanUsername, cleanEmail);

  if (existingUser) {
    if (existingUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
      return res.status(409).json({ error: "Username is already taken." });
    }
    if (existingUser.email && existingUser.email.toLowerCase() === cleanEmail) {
      return res.status(409).json({ error: "Email address is already registered." });
    }
  }

  // Hash password and insert user safely with try-catch
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO drivers (name, username, email, password_hash) VALUES (?, ?, ?, ?)").run(
      name.trim(),
      cleanUsername,
      cleanEmail,
      hash
    );

    return res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    // Catch SQLite UNIQUE constraint fail as fallback
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "Username or Email is already registered." });
    }
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Internal server error during registration." });
  }
});

// Driver Login
router.post("/driver/login", (req, res) => {
  const { username, email, password } = req.body || {};
  const identifier = (username || email || "").trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/Email and password are required." });
  }

  const driver = db
    .prepare("SELECT * FROM drivers WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)")
    .get(identifier, identifier.toLowerCase());

  if (!driver || !bcrypt.compareSync(password, driver.password_hash)) {
    return res.status(401).json({ error: "Invalid username/email or password." });
  }

  const token = jwt.sign(
    { sub: driver.id, role: "driver", name: driver.name, email: driver.email },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  res.json({ token, name: driver.name, username: driver.username, email: driver.email });
});

// Admin Login 
router.post("/admin/login", (req, res) => {
  const { username, email, password } = req.body || {};
  const identifier = (username || email || "").trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/Email and password are required." });
  }

  const admin = db
    .prepare("SELECT * FROM admins WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)")
    .get(identifier, identifier.toLowerCase());

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }

  const token = jwt.sign(
    { sub: admin.id, role: "admin", username: admin.username },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  res.json({ token, username: admin.username });
});

module.exports = router;
