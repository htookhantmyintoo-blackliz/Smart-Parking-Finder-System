require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const parkingRoutes = require("./routes/parking");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/parking-areas", parkingRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve frontend static files
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// Admin Page Route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "admin.html"));
});

// SPA/Client Fallback Route
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({ error: "Internal server error." });
});

// Start server
app.listen(PORT, () => {
  console.log(`Smart Parking Finder backend running on port ${PORT}`);
});
